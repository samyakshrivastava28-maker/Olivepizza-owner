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

    interface CityInfo {
      id: string;
      city: string;
      name: string;
      state: string;
      country: string;
      center: { lat: number; lng: number };
      deliveryRadiusKm: number;
      viewbox: number[]; // [minLon, maxLat, maxLon, minLat] for OSM bounding
      activeBranches: number;
      branchNames: string[];
      branches: Array<{
        id: string;
        name: string;
        lat: number;
        lng: number;
        deliveryRadiusKm: number;
      }>;
      popularLocalities: Array<{
        id?: string;
        title: string;
        subtitle: string;
        lat: number;
        lng: number;
        pincode?: string;
        type?: string;
        isServiceable?: boolean;
      }>;
      serviceable: boolean;
    }

    const cityMap = new Map<string, CityInfo>();

    // 1. Query franchises (branch records) collection
    const franchisesSnap = await adminDb.collection('franchises').get();
    for (const doc of franchisesSnap.docs) {
      const data = doc.data();
      if (
        data.isActive === false ||
        data.status === 'DEACTIVATED' ||
        data.status === 'SUSPENDED' ||
        data.status === 'PLANNED'
      ) {
        continue;
      }

      const rawCity = (data.city || '').trim();
      if (!rawCity) continue;

      const cityKey = rawCity.toLowerCase();
      const lat = Number(data.lat ?? data.coordinates?.lat ?? data.location?.lat);
      const lng = Number(data.lng ?? data.coordinates?.lng ?? data.location?.lng);
      const radius = Number(
        data.maxDeliveryRadiusKm ||
        data.deliverySettings?.maxDeliveryRadiusKm ||
        data.deliveryRadiusKm ||
        data.deliveryRadius ||
        15
      );
      const state = data.state || 'Chhattisgarh';
      const branchName = data.name || `Olive Pizza ${rawCity}`;

      const rawPopular = Array.isArray(data.popularLocalities) && data.popularLocalities.length > 0
        ? data.popularLocalities
        : Array.isArray(data.popularLocations) && data.popularLocations.length > 0
          ? data.popularLocations
          : [];

      if (!isNaN(lat) && !isNaN(lng)) {
        const deltaLat = radius / 110.574;
        const deltaLng = radius / (111.320 * Math.cos((lat * Math.PI) / 180));
        const viewbox = [
          Number((lng - deltaLng).toFixed(6)),
          Number((lat + deltaLat).toFixed(6)),
          Number((lng + deltaLng).toFixed(6)),
          Number((lat - deltaLat).toFixed(6)),
        ];

        const branchInfo = {
          id: doc.id,
          name: branchName,
          lat,
          lng,
          deliveryRadiusKm: radius,
        };

        if (!cityMap.has(cityKey)) {
          cityMap.set(cityKey, {
            id: `city_${cityKey}`,
            city: rawCity,
            name: rawCity,
            state,
            country: 'India',
            center: { lat, lng },
            deliveryRadiusKm: radius,
            viewbox,
            activeBranches: 1,
            branchNames: [branchName],
            branches: [branchInfo],
            popularLocalities: [...rawPopular],
            serviceable: true,
          });
        } else {
          const existing = cityMap.get(cityKey)!;
          existing.activeBranches += 1;
          existing.branchNames.push(branchName);
          existing.branches.push(branchInfo);
          existing.deliveryRadiusKm = Math.max(existing.deliveryRadiusKm, radius);
          existing.viewbox = [
            Math.min(existing.viewbox[0], viewbox[0]),
            Math.max(existing.viewbox[1], viewbox[1]),
            Math.max(existing.viewbox[2], viewbox[2]),
            Math.min(existing.viewbox[3], viewbox[3]),
          ];
          if (rawPopular.length > 0) {
            const existingIds = new Set(existing.popularLocalities.map((p) => (p.title || '').toLowerCase()));
            for (const item of rawPopular) {
              if (!existingIds.has((item.title || '').toLowerCase())) {
                existing.popularLocalities.push(item);
                existingIds.add((item.title || '').toLowerCase());
              }
            }
          }
        }
      }
    }

    // 2. Also check franchise_entities collection if franchises had no branches for an active franchise
    try {
      const entitiesSnap = await adminDb.collection('franchise_entities').get();
      for (const eDoc of entitiesSnap.docs) {
        const eData = eDoc.data();
        if (
          eData.isActive === false ||
          eData.status === 'DEACTIVATED' ||
          eData.status === 'SUSPENDED' ||
          eData.status === 'PLANNED'
        ) {
          continue;
        }

        const rawCity = (eData.city || '').trim();
        if (!rawCity) continue;

        const cityKey = rawCity.toLowerCase();
        // If this city is not yet in cityMap and has valid coordinates, include it
        if (!cityMap.has(cityKey)) {
          const lat = Number(eData.lat ?? eData.coordinates?.lat ?? eData.location?.lat);
          const lng = Number(eData.lng ?? eData.coordinates?.lng ?? eData.location?.lng);
          const radius = Number(
            eData.deliverySettings?.maxDeliveryRadiusKm ||
            eData.maxDeliveryRadiusKm ||
            eData.deliveryRadiusKm ||
            15
          );
          const state = eData.state || eData.region || 'Chhattisgarh';
          const branchName = eData.name || `Olive Pizza ${rawCity}`;

          if (!isNaN(lat) && !isNaN(lng)) {
            const deltaLat = radius / 110.574;
            const deltaLng = radius / (111.320 * Math.cos((lat * Math.PI) / 180));
            const viewbox = [
              Number((lng - deltaLng).toFixed(6)),
              Number((lat + deltaLat).toFixed(6)),
              Number((lng + deltaLng).toFixed(6)),
              Number((lat - deltaLat).toFixed(6)),
            ];

            cityMap.set(cityKey, {
              id: `city_${cityKey}`,
              city: rawCity,
              name: rawCity,
              state,
              country: 'India',
              center: { lat, lng },
              deliveryRadiusKm: radius,
              viewbox,
              activeBranches: 1,
              branchNames: [branchName],
              branches: [{
                id: eData.mainBranchId || eDoc.id,
                name: branchName,
                lat,
                lng,
                deliveryRadiusKm: radius,
              }],
              serviceable: true,
            });
          }
        }
      }
    } catch (entityErr) {
      // Non-fatal
    }

    // 100% database-driven: NO hardcoded fallback cities!
    const cities = Array.from(cityMap.values());

    // Dynamic auto-discovery for any city (current or future) that has no explicit popularLocalities configured
    await Promise.all(
      cities.map(async (c) => {
        if (c.popularLocalities && c.popularLocalities.length > 0) return;
        try {
          const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(c.name)}&lat=${c.center.lat}&lon=${c.center.lng}&limit=12`;
          const resp = await axios.get(photonUrl, { timeout: 3500 });
          if (resp.data && Array.isArray(resp.data.features) && resp.data.features.length > 0) {
            const places: any[] = [];
            const seen = new Set<string>();
            for (const feat of resp.data.features) {
              const props = feat.properties || {};
              const coords = feat.geometry?.coordinates;
              if (!coords || coords.length < 2) continue;
              const name = (props.name || '').trim();
              if (!name || seen.has(name.toLowerCase())) continue;
              seen.add(name.toLowerCase());

              const subtitleParts = [
                props.street,
                props.suburb || props.district,
                props.city || c.name,
                props.state || c.state,
              ].filter(Boolean);

              places.push({
                id: `dyn_${props.osm_id || Math.random().toString(36).substr(2, 9)}`,
                title: name,
                subtitle: subtitleParts.join(', '),
                lat: coords[1],
                lng: coords[0],
                pincode: props.postcode || '',
                type: props.osm_value || 'locality',
                isServiceable: true,
              });
              if (places.length >= 10) break;
            }
            if (places.length > 0) {
              c.popularLocalities = places;
              return;
            }
          }
        } catch {
          // Non-fatal
        }

        c.popularLocalities = [
          {
            id: `center_${c.id}`,
            title: `${c.name} Center`,
            subtitle: `${c.name}, ${c.state}, India`,
            lat: c.center.lat,
            lng: c.center.lng,
            type: 'center',
            isServiceable: true,
          },
        ];
      })
    );

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
// 1b. GET /api/location/popular-locations
// Returns instant popular localities for a selected city or all active cities
// ============================================================================
router.get('/popular-locations', async (req: Request, res: Response): Promise<void> => {
  try {
    const cityName = String(req.query.city || '').trim().toLowerCase();
    let cities = citiesCache.get<any[]>('serviceable_cities');
    if (!cities) {
      // Trigger internal resolution by querying franchises
      const franchisesSnap = await adminDb.collection('franchises').get();
      const cityMap = new Map<string, any>();
      for (const doc of franchisesSnap.docs) {
        const data = doc.data();
        if (
          data.isActive === false ||
          data.status === 'DEACTIVATED' ||
          data.status === 'SUSPENDED' ||
          data.status === 'PLANNED'
        ) {
          continue;
        }
        const rawCity = (data.city || '').trim();
        if (!rawCity) continue;
        const cityKey = rawCity.toLowerCase();
        const popular = Array.isArray(data.popularLocalities) ? data.popularLocalities : [];
        if (!cityMap.has(cityKey)) {
          cityMap.set(cityKey, {
            name: rawCity,
            popularLocalities: popular,
          });
        }
      }
      cities = Array.from(cityMap.values());
    }

    if (cityName && cities) {
      const match = cities.find(
        (c: any) =>
          (c.city && c.city.toLowerCase() === cityName) ||
          (c.name && c.name.toLowerCase() === cityName)
      );
      if (match) {
        res.json({
          success: true,
          city: match.name || match.city,
          localities: match.popularLocalities || [],
        });
        return;
      }
    }

    res.json({
      success: true,
      cities: (cities || []).map((c: any) => ({
        city: c.name || c.city,
        localities: c.popularLocalities || [],
      })),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to retrieve popular locations' });
  }
});

// ============================================================================
// 2. GET /api/location/geocode
// Nominatim-compliant geocoding proxy with strict city bounding, rate-limiting & attribution
// ============================================================================
router.get('/geocode', publicLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const query = String(req.query.q || req.query.query || '').trim();
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

    // Look up city details from cache to retrieve its viewbox, state & center
    let cityViewbox: number[] | null = null;
    let cityState = '';
    let cityCenter: { lat: number; lng: number } | null = null;
    let cityRadius = 15;
    const cachedCities = citiesCache.get<any[]>('serviceable_cities');
    if (cachedCities && city) {
      const match = cachedCities.find((c: any) => c.city.toLowerCase() === city.toLowerCase());
      if (match) {
        cityViewbox = match.viewbox;
        cityState = match.state || '';
        cityCenter = match.center;
        cityRadius = match.deliveryRadiusKm || 15;
      }
    }

    let results: any[] = [];

    // 1. Primary: Photon (Fast, autocomplete-optimized OpenStreetMap search with lat/lon bias)
    try {
      const photonParams: Record<string, any> = {
        q: `${query} ${city}`.trim(),
        limit: 10,
      };
      if (cityCenter) {
        photonParams.lat = cityCenter.lat;
        photonParams.lon = cityCenter.lng;
      }

      const photonRes = await axios.get('https://photon.komoot.io/api/', {
        params: photonParams,
        timeout: 4000,
      }).catch(() => null);

      if (photonRes?.data?.features && Array.isArray(photonRes.data.features) && photonRes.data.features.length > 0) {
        const filteredFeatures = photonRes.data.features.filter((f: any) => {
          const props = f.properties || {};
          const coords = f.geometry?.coordinates || [];
          if (coords.length < 2) return false;
          const [lon, lat] = coords;

          // If cityCenter is known, ensure location is within reasonable vicinity (max cityRadius + 15km)
          if (cityCenter) {
            const dist = CustomerOrderingContextService.haversineDistanceKm(cityCenter.lat, cityCenter.lng, lat, lon);
            if (dist > (cityRadius + 15)) return false;
          }

          // Check city or county text if present
          if (city) {
            const fCity = (props.city || props.county || props.district || props.locality || '').toLowerCase();
            if (fCity && !fCity.includes(city.toLowerCase()) && !city.toLowerCase().includes(fCity)) {
              if (cityCenter) {
                const dist = CustomerOrderingContextService.haversineDistanceKm(cityCenter.lat, cityCenter.lng, lat, lon);
                if (dist > cityRadius) return false;
              }
            }
          }
          return true;
        });

        if (filteredFeatures.length > 0) {
          results = await Promise.all(
            filteredFeatures.slice(0, 8).map(async (f: any) => {
              const props = f.properties || {};
              const coords = f.geometry?.coordinates || [0, 0];
              const lng = coords[0];
              const lat = coords[1];

              const title = props.name || props.street || query;
              const subtitleParts = [
                props.street,
                props.locality || props.district,
                props.city || city,
                props.state || cityState,
                props.country || 'India',
              ].filter(Boolean).filter((val, idx, arr) => arr.indexOf(val) === idx);
              const subtitle = subtitleParts.join(', ');
              const displayName = `${title}, ${subtitle}`;

              let isServiceable = false;
              try {
                const check = await CustomerOrderingContextService.resolveOrderingContext({
                  customerId: 'guest',
                  lat,
                  lng,
                });
                isServiceable = check.isServiceable;
              } catch (e) {}

              return {
                placeId: String(props.osm_id || `${lat}_${lng}`),
                title,
                subtitle,
                displayName,
                lat,
                lng,
                type: props.osm_value || props.type || 'place',
                isServiceable,
                address: {
                  road: props.street || '',
                  suburb: props.locality || props.district || '',
                  city: props.city || city,
                  state: props.state || cityState || '',
                  postcode: props.postcode || '',
                  country: props.country || 'India',
                },
              };
            })
          );
        }
      }
    } catch (photonErr) {
      // Fall through to Nominatim
    }

    // 2. Secondary Fallback: Nominatim
    if (results.length === 0) {
      // City-constrained search query
      const searchQuery = city
        ? (cityState ? `${query}, ${city}, ${cityState}, India` : `${query}, ${city}, India`)
        : `${query}, India`;

      const nominatimUrl = 'https://nominatim.openstreetmap.org/search';
      const params: Record<string, any> = {
        q: searchQuery,
        format: 'json',
        addressdetails: 1,
        limit: 8,
        countrycodes: 'in',
      };

      if (cityViewbox && cityViewbox.length === 4) {
        params.viewbox = cityViewbox.join(',');
        params.bounded = 1;
      }

      let response = await axios.get(nominatimUrl, {
        params,
        headers: {
          'User-Agent': 'OlivePizzaApp/1.0 (contact: olivepizzarjn@gmail.com; platform: customer-web)',
          'Accept-Language': 'en-IN,en;q=0.9',
        },
        timeout: 8000,
      }).catch(() => null);

      if (!response || !Array.isArray(response.data) || response.data.length === 0) {
        const fallbackParams: Record<string, any> = {
          q: city ? `${query}, ${city}` : query,
          format: 'json',
          addressdetails: 1,
          limit: 8,
          countrycodes: 'in',
        };
        if (cityViewbox) {
          fallbackParams.viewbox = cityViewbox.join(',');
        }
        response = await axios.get(nominatimUrl, {
          params: fallbackParams,
          headers: {
            'User-Agent': 'OlivePizzaApp/1.0 (contact: olivepizzarjn@gmail.com; platform: customer-web)',
            'Accept-Language': 'en-IN,en;q=0.9',
          },
          timeout: 8000,
        }).catch(() => null);
      }

      const rawList = Array.isArray(response?.data) ? response.data : [];

      results = await Promise.all(
        rawList.map(async (item: any) => {
          const lat = parseFloat(item.lat);
          const lng = parseFloat(item.lon);
          const addr = item.address || {};

          const title = addr.amenity || addr.shop || addr.building || addr.road || addr.suburb || item.name || query;
          const subtitle = [
            addr.suburb || addr.neighbourhood || addr.road,
            addr.city || addr.town || addr.village || city,
            addr.state || cityState,
            addr.country || 'India',
          ]
            .filter(Boolean)
            .filter((val, idx, arr) => arr.indexOf(val) === idx)
            .join(', ');

          let isServiceable = false;
          try {
            const check = await CustomerOrderingContextService.resolveOrderingContext({
              customerId: 'guest',
              lat,
              lng,
            });
            isServiceable = check.isServiceable;
          } catch (e) {}

          return {
            placeId: String(item.place_id),
            title,
            subtitle,
            displayName: item.display_name,
            lat,
            lng,
            type: item.type,
            isServiceable,
            address: {
              road: addr.road || addr.pedestrian || '',
              suburb: addr.suburb || addr.neighbourhood || '',
              city: addr.city || addr.town || addr.village || city,
              state: addr.state || cityState || '',
              postcode: addr.postcode || '',
              country: addr.country || 'India',
            },
          };
        })
      );
    }

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
// Reverse geocodes map pin coordinates to formatted address string + authoritative serviceability check
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
      res.json({
        success: true,
        location: cached,
        isServiceable: cached.isServiceable,
        source: 'cache',
      });
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
    const formattedAddress =
      data?.display_name ||
      `${addr.road || ''}, ${addr.suburb || ''}, ${addr.city || addr.town || ''}`.replace(/^,\s*/, '');

    const resolvedCity = addr.city || addr.town || addr.village || addr.county || addr.state_district || '';
    const resolvedState = addr.state || '';
    const resolvedPostcode = addr.postcode || '';
    const resolvedCountry = addr.country || 'India';

    // Authoritative serviceability check
    const orderingResolution = await CustomerOrderingContextService.resolveOrderingContext({
      customerId: (req as any).user?.uid || 'guest',
      lat,
      lng,
      addressLine: formattedAddress,
    });

    const locationResult = {
      displayName: formattedAddress,
      lat,
      lng,
      road: addr.road || addr.pedestrian || '',
      neighbourhood: addr.neighbourhood || addr.suburb || '',
      city: resolvedCity,
      state: resolvedState,
      postcode: resolvedPostcode,
      country: resolvedCountry,
      isServiceable: orderingResolution.isServiceable,
      resolvedBranchId: orderingResolution.context?.branchId,
      resolvedFranchiseId: orderingResolution.context?.franchiseId,
      branchName: orderingResolution.context?.branchName,
      distanceKm: orderingResolution.context?.distanceKm,
      deliveryRadiusKm: orderingResolution.context?.deliveryRadiusKm,
      serviceabilityMessage: orderingResolution.isServiceable
        ? `Within delivery coverage (${orderingResolution.context?.distanceKm} km from ${orderingResolution.context?.branchName})`
        : orderingResolution.error || "We currently don't deliver to this location.",
    };

    geocodeCache.set(roundedKey, locationResult);

    res.json({
      success: true,
      location: locationResult,
      isServiceable: orderingResolution.isServiceable,
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
        error: orderingResolution.error || "This location is currently outside Olive Pizza's delivery zone.",
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
      city: String(city || orderingResolution.context?.branchName || '').trim(),
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
