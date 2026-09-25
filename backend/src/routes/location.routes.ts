import { Router, Request, Response } from 'express';
import axios from 'axios';
import NodeCache from 'node-cache';
import { adminDb } from '../config/firebase.js';
import { verifyToken, AuthRequest } from '../middleware/auth.middleware.js';
import { CustomerOrderingContextService } from '../services/order/CustomerOrderingContextService.js';
import { publicLimiter, userLimiter } from '../config/security.config.js';

const router = Router();

// In-memory cache for Nominatim and City queries (1 hour TTL for geocoding, 60 seconds for cities)
const geocodeCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });
const citiesCache = new NodeCache({ stdTTL: 60, checkperiod: 30 });

// Simple per-IP throttling map for Nominatim (ensures >= 1000ms between requests to follow OSM policy)
const lastRequestTimeByIp = new Map<string, number>();

const throttleNominatim = async (clientIp: string) => {
  const now = Date.now();
  const lastTime = lastRequestTimeByIp.get(clientIp) || 0;
  const timeSinceLast = now - lastTime;
  if (timeSinceLast < 1000) {
    const delay = 1000 - timeSinceLast;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  lastRequestTimeByIp.set(clientIp, Date.now());
};

// ============================================================================
// 1. GET /api/location/serviceable-cities
// Authoritative dynamic list of cities served by active Olive Pizza branches
// ============================================================================
router.get('/serviceable-cities', publicLimiter, async (_req: Request, res: Response): Promise<void> => {
  try {
    const cached = citiesCache.get<any[]>('serviceable_cities');
    if (cached) {
      res.json({ success: true, cities: cached, source: 'cache' });
      return;
    }

    const cityMap = new Map<string, {
      city: string;
      state: string;
      center: { lat: number; lng: number };
      deliveryRadiusKm: number;
      activeBranches: number;
      branchNames: string[];
    }>();

    // 1. Query franchises collection
    const franchisesSnap = await adminDb.collection('franchises').get();
    for (const doc of franchisesSnap.docs) {
      const data = doc.data();
      if (data.isActive === false || data.status === 'DEACTIVATED' || data.status === 'SUSPENDED') {
        continue;
      }

      const rawCity = (data.city || '').trim();
      if (!rawCity) continue;

      const cityKey = rawCity.toLowerCase();
      const lat = Number(data.lat ?? data.coordinates?.lat ?? data.location?.lat);
      const lng = Number(data.lng ?? data.coordinates?.lng ?? data.location?.lng);
      const radius = Number(data.maxDeliveryRadiusKm || data.deliveryRadiusKm || data.deliveryRadius || 18);
      const state = data.state || 'Chhattisgarh';
      const branchName = data.name || `Olive Pizza ${rawCity}`;

      if (!isNaN(lat) && !isNaN(lng)) {
        if (!cityMap.has(cityKey)) {
          cityMap.set(cityKey, {
            city: rawCity,
            state,
            center: { lat, lng },
            deliveryRadiusKm: radius,
            activeBranches: 1,
            branchNames: [branchName],
          });
        } else {
          const existing = cityMap.get(cityKey)!;
          existing.activeBranches += 1;
          existing.branchNames.push(branchName);
          existing.deliveryRadiusKm = Math.max(existing.deliveryRadiusKm, radius);
        }
      }
    }

    // Fallback baseline to ensure core operational locations exist if DB collection is newly provisioned
    if (cityMap.size === 0) {
      cityMap.set('rajnandgaon', {
        city: 'Rajnandgaon',
        state: 'Chhattisgarh',
        center: { lat: 21.0810244, lng: 81.0123793 },
        deliveryRadiusKm: 18,
        activeBranches: 1,
        branchNames: ['Olive Pizza — Rajnandgaon (HQ Branch)'],
      });
      cityMap.set('durg', {
        city: 'Durg',
        state: 'Chhattisgarh',
        center: { lat: 21.1905, lng: 81.2855 },
        deliveryRadiusKm: 18,
        activeBranches: 1,
        branchNames: ['Olive Pizza — Durg Flagship'],
      });
    }

    const cities = Array.from(cityMap.values());
    citiesCache.set('serviceable_cities', cities);

    res.json({
      success: true,
      cities,
      total: cities.length,
    });
  } catch (error: any) {
    console.error('[LocationRoutes] Error fetching serviceable cities:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve serviceable cities' });
  }
});

// ============================================================================
// 2. GET /api/location/geocode
// Nominatim-compliant geocoding proxy with strict rate-limiting, caching & attribution
// ============================================================================
router.get('/geocode', publicLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const query = String(req.query.query || '').trim();
    const city = String(req.query.city || '').trim();

    if (!query || query.length < 2) {
      res.status(400).json({ success: false, error: 'Search query must be at least 2 characters.' });
      return;
    }

    const cacheKey = `geo_${city.toLowerCase()}_${query.toLowerCase()}`;
    const cached = geocodeCache.get<any[]>(cacheKey);
    if (cached) {
      res.json({ success: true, results: cached, source: 'cache' });
      return;
    }

    const clientIp = (req.ip || (req.headers['x-forwarded-for'] as string)?.split(',')[0] || '127.0.0.1').trim();
    await throttleNominatim(clientIp);

    // Build scoped search query adhering to OpenStreetMap guidance
    const searchQuery = city ? `${query}, ${city}, Chhattisgarh, India` : `${query}, India`;
    const nominatimUrl = 'https://nominatim.openstreetmap.org/search';

    const response = await axios.get(nominatimUrl, {
      params: {
        q: searchQuery,
        format: 'json',
        addressdetails: 1,
        limit: 6,
        countrycodes: 'in',
      },
      headers: {
        'User-Agent': 'OlivePizzaApp/1.0 (contact: olivepizzarjn@gmail.com; platform: customer-web)',
        'Accept-Language': 'en-IN,en;q=0.9',
      },
      timeout: 8000,
    });

    const rawList = Array.isArray(response.data) ? response.data : [];
    const results = rawList.map((item: any) => ({
      placeId: item.place_id,
      displayName: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      type: item.type,
      importance: item.importance,
      address: {
        road: item.address?.road || item.address?.pedestrian || '',
        suburb: item.address?.suburb || item.address?.neighbourhood || '',
        city: item.address?.city || item.address?.town || item.address?.village || city,
        state: item.address?.state || 'Chhattisgarh',
        postcode: item.address?.postcode || '',
        country: item.address?.country || 'India',
      },
    }));

    geocodeCache.set(cacheKey, results);

    res.json({
      success: true,
      results,
      attribution: '© OpenStreetMap contributors (ODbL)',
    });
  } catch (error: any) {
    console.error('[LocationRoutes] Geocode proxy error:', error?.message);
    res.status(500).json({ success: false, error: 'Location lookup failed. Please select your location on the map.' });
  }
});

// ============================================================================
// 3. GET /api/location/reverse-geocode
// Reverse geocodes map pin coordinates to formatted address string
// ============================================================================
router.get('/reverse-geocode', publicLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);

    if (isNaN(lat) || isNaN(lng)) {
      res.status(400).json({ success: false, error: 'Valid latitude and longitude are required.' });
      return;
    }

    const roundedKey = `rev_${lat.toFixed(4)}_${lng.toFixed(4)}`;
    const cached = geocodeCache.get<any>(roundedKey);
    if (cached) {
      res.json({ success: true, location: cached, source: 'cache' });
      return;
    }

    const clientIp = (req.ip || (req.headers['x-forwarded-for'] as string)?.split(',')[0] || '127.0.0.1').trim();
    await throttleNominatim(clientIp);

    const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      params: {
        lat,
        lon: lng,
        format: 'json',
        addressdetails: 1,
        zoom: 18,
      },
      headers: {
        'User-Agent': 'OlivePizzaApp/1.0 (contact: olivepizzarjn@gmail.com; platform: customer-web)',
        'Accept-Language': 'en-IN,en;q=0.9',
      },
      timeout: 8000,
    });

    const data = response.data;
    const addr = data?.address || {};
    const formattedAddress = data?.display_name || `${addr.road || ''}, ${addr.suburb || ''}, ${addr.city || addr.town || 'Olive Pizza Service Zone'}`.replace(/^,\s*/, '');

    const locationResult = {
      displayName: formattedAddress,
      lat,
      lng,
      road: addr.road || addr.pedestrian || '',
      neighbourhood: addr.neighbourhood || addr.suburb || '',
      city: addr.city || addr.town || addr.village || 'Rajnandgaon',
      state: addr.state || 'Chhattisgarh',
      postcode: addr.postcode || '491441',
      country: addr.country || 'India',
    };

    geocodeCache.set(roundedKey, locationResult);

    res.json({
      success: true,
      location: locationResult,
      attribution: '© OpenStreetMap contributors (ODbL)',
    });
  } catch (error: any) {
    console.error('[LocationRoutes] Reverse geocode error:', error?.message);
    res.status(500).json({
      success: false,
      error: 'Could not resolve address details. You can continue with your selected pin.',
    });
  }
});

// ============================================================================
// 4. POST /api/location/save
// Authoritatively validates serviceability and saves "Location 1" for customer
// ============================================================================
router.post('/save', verifyToken, userLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user?.uid) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const {
      formattedAddress,
      lat,
      lng,
      city,
      houseNumber,
      street,
      landmark,
      floor,
      building,
      deliveryInstructions,
      label = 'Location 1',
    } = req.body;

    if (!formattedAddress || lat == null || lng == null) {
      res.status(400).json({
        success: false,
        error: 'Address and valid map coordinates are required.',
      });
      return;
    }

    const numLat = Number(lat);
    const numLng = Number(lng);

    if (isNaN(numLat) || isNaN(numLng)) {
      res.status(400).json({ success: false, error: 'Invalid coordinate numbers provided.' });
      return;
    }

    // 1. Authoritative Backend Serviceability Verification
    const orderingResolution = await CustomerOrderingContextService.resolveOrderingContext({
      customerId: user.uid,
      lat: numLat,
      lng: numLng,
      addressLine: formattedAddress,
    });

    if (!orderingResolution.isServiceable) {
      res.status(400).json({
        success: false,
        isServiceable: false,
        error: orderingResolution.error || "This location is currently outside Olive Pizza's 18km delivery zone.",
        code: orderingResolution.code || 'OUT_OF_DELIVERY_ZONE',
      });
      return;
    }

    const locationId = 'location_1';
    const now = new Date().toISOString();

    const locationRecord = {
      id: locationId,
      label,
      formattedAddress: String(formattedAddress).trim(),
      lat: numLat,
      lng: numLng,
      city: String(city || orderingResolution.context?.branchName || 'Rajnandgaon').trim(),
      street: String(street || '').trim() || null,
      houseNumber: String(houseNumber || '').trim() || null,
      landmark: String(landmark || '').trim() || null,
      floor: String(floor || '').trim() || null,
      building: String(building || '').trim() || null,
      deliveryInstructions: String(deliveryInstructions || '').trim() || null,
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    };

    // 2. Persist to subcollection users/{uid}/saved_locations/location_1
    const userRef = adminDb.collection('users').doc(user.uid);
    await userRef.collection('saved_locations').doc(locationId).set(locationRecord, { merge: true });

    // 3. Authoritatively update primary user profile document
    await userRef.set(
      {
        uid: user.uid,
        defaultLocationId: locationId,
        locationSetupCompleted: true,
        role: 'customer', // Strictly enforce customer role, never allow privileged escalation
        location: {
          lat: numLat,
          lng: numLng,
          address: formattedAddress,
          city: locationRecord.city,
          landmark: locationRecord.landmark,
          houseNumber: locationRecord.houseNumber,
        },
        locations: [locationRecord],
        updatedAt: now,
      },
      { merge: true }
    );

    res.json({
      success: true,
      message: 'Delivery location saved successfully as Location 1.',
      location: locationRecord,
      orderingContext: orderingResolution.context,
    });
  } catch (error: any) {
    console.error('[LocationRoutes] Save location error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to save delivery location.' });
  }
});

export default router;
