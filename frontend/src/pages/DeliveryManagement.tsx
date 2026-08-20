import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Bike,
  Navigation,
  MapPin,
  Phone,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Search,
  Plus,
  RefreshCw,
  Eye,
  UserCheck,
  Zap,
  Activity,
  Layers,
  ChevronRight,
  Compass,
  ArrowUpRight,
  X,
} from 'lucide-react';
import { db } from '../lib/firebase';
import {
  collection,
  onSnapshot,
  query,
  where,
  doc,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { DeliveryPartner, Order } from '../types/models';
import { fetchApi } from '../lib/api';
import toast from 'react-hot-toast';
import { RESTAURANT_LOCATION } from '../lib/config';

// Import Leaflet directly for custom map rendering
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function DeliveryManagement() {
  const [partners, setPartners] = useState<DeliveryPartner[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [locations, setLocations] = useState<Record<string, { lat: number; lng: number; speed?: number; bearing?: number; updatedAt?: string; activeOrderId?: string }>>({});
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'fleet' | 'dispatch'>('fleet');
  const [loading, setLoading] = useState(true);

  // Add Partner Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newPartnerName, setNewPartnerName] = useState('');
  const [newPartnerPhone, setNewPartnerPhone] = useState('');
  const [newPartnerEmail, setNewPartnerEmail] = useState('');
  const [newPartnerVehicle, setNewPartnerVehicle] = useState('Motorcycle');
  const [newPartnerReg, setNewPartnerReg] = useState('');

  // Map DOM reference
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker | L.Polyline }>({});

  // 1. Listen to Delivery Partners collection & delivery users in Firestore
  useEffect(() => {
    setLoading(true);
    let partnersFromColl: DeliveryPartner[] = [];
    let partnersFromUsers: DeliveryPartner[] = [];

    const mergePartners = () => {
      const combinedMap = new Map<string, DeliveryPartner>();
      partnersFromColl.forEach((p) => combinedMap.set(p.id, p));
      partnersFromUsers.forEach((u) => {
        if (!combinedMap.has(u.id)) {
          combinedMap.set(u.id, u);
        }
      });
      setPartners(Array.from(combinedMap.values()));
      setLoading(false);
    };

    // A. delivery_partners collection
    const unsubPartners = onSnapshot(
      collection(db, 'delivery_partners'),
      (snapshot) => {
        const fetched: DeliveryPartner[] = [];
        snapshot.forEach((d) => {
          const data = d.data();
          fetched.push({
            id: d.id,
            ...data,
            name: data.name || data.displayName || 'Delivery Partner',
            phone: data.phone || data.phoneNumber || '',
            status: data.status || 'online',
          } as DeliveryPartner);
        });
        partnersFromColl = fetched;
        mergePartners();
      },
      (err) => {
        console.warn('[DeliveryManagement] Partners stream warning:', err);
      }
    );

    // B. users collection where role is delivery
    const unsubUsers = onSnapshot(
      query(collection(db, 'users'), where('role', '==', 'delivery')),
      (snapshot) => {
        const fetched: DeliveryPartner[] = [];
        snapshot.forEach((d) => {
          const data = d.data();
          fetched.push({
            id: d.id,
            name: data.name || data.displayName || 'Delivery Partner',
            phone: data.phone || '',
            email: data.email || '',
            status: data.isOnline ? 'online' : (data.status || 'online'),
            approvalStatus: 'approved',
            vehicleType: data.vehicleType || 'Motorcycle',
            vehicleNumber: data.vehicleNumber || 'Standard',
            rating: data.rating || 4.9,
            totalDeliveries: data.totalDeliveries || 1,
            lat: data.lat || (data.location ? data.location.lat : undefined),
            lng: data.lng || (data.location ? data.location.lng : undefined),
            isAvailable: true,
          } as DeliveryPartner);
        });
        partnersFromUsers = fetched;
        mergePartners();
      },
      () => {}
    );

    return () => {
      unsubPartners();
      unsubUsers();
    };
  }, []);

  // 2. Listen to Active Orders (Preparing, Ready, Out for Delivery)
  useEffect(() => {
    const q = query(
      collection(db, 'orders'),
      where('status', 'in', ['accepted', 'preparing', 'ready', 'picked_up', 'out_for_delivery'])
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched: Order[] = [];
        snapshot.forEach((docSnap) => {
          fetched.push({ id: docSnap.id, ...docSnap.data() } as Order);
        });
        setActiveOrders(fetched);
      },
      (err) => {
        console.warn('[DeliveryManagement] Active orders stream fallback:', err);
      }
    );

    return () => unsubscribe();
  }, []);

  // 3. Listen to Real-time GPS Locations
  useEffect(() => {
    const q = query(collection(db, 'delivery_locations'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const locMap: Record<string, any> = {};
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          const partnerId = d.delivery_partner_id || docSnap.id;
          if (d.latitude && d.longitude) {
            locMap[partnerId] = {
              lat: Number(d.latitude),
              lng: Number(d.longitude),
              speed: d.speed,
              bearing: d.bearing || d.heading,
              updatedAt: d.updated_at || d.updatedAt,
              activeOrderId: d.active_order_id,
            };
          }
        });
        setLocations(locMap);
      },
      () => {
        fetchApi('/api/tracking/locations/active')
          .then((r) => r.json())
          .then((data) => {
            if (Array.isArray(data)) {
              const locMap: Record<string, any> = {};
              data.forEach((loc: any) => {
                if (loc.delivery_partner_id) locMap[loc.delivery_partner_id] = loc;
              });
              setLocations(locMap);
            }
          })
          .catch(() => {});
      }
    );

    return () => unsubscribe();
  }, []);

  // 4. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const restaurantCoords: [number, number] = [
        RESTAURANT_LOCATION.lat || 21.0810244,
        RESTAURANT_LOCATION.lng || 81.0123793,
      ];

      const map = L.map(mapContainerRef.current, {
        center: restaurantCoords,
        zoom: 14,
        zoomControl: false,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      const restaurantIcon = L.divIcon({
        className: 'custom-restaurant-icon',
        html: `
          <div class="w-10 h-10 rounded-2xl bg-orange-600 border-2 border-white shadow-xl flex items-center justify-center text-lg animate-bounce" style="box-shadow: 0 0 20px rgba(249, 115, 22, 0.6)">
            🍕
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      L.marker(restaurantCoords, { icon: restaurantIcon })
        .addTo(map)
        .bindPopup(`
          <div style="color: #0E1524; font-family: sans-serif; padding: 4px;">
            <strong style="font-size: 13px;">🍕 Olive Pizza HQ</strong>
            <p style="font-size: 11px; margin: 4px 0 0; color: #64748B;">Central Kitchen & Dispatch</p>
          </div>
        `);

      mapInstanceRef.current = map;
    }
  }, []);

  // 5. Update Map Markers & Live Route Polylines
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear old dynamic rider markers & polylines
    Object.values(markersRef.current).forEach((layer) => layer.remove());
    markersRef.current = {};

    const restaurantCoords: [number, number] = [
      RESTAURANT_LOCATION.lat || 21.0810244,
      RESTAURANT_LOCATION.lng || 81.0123793,
    ];

    partners.forEach((partner) => {
      const loc = locations[partner.id] || {
        lat: partner.lat || partner.latitude || (restaurantCoords[0] + (Math.random() - 0.5) * 0.015),
        lng: partner.lng || partner.longitude || (restaurantCoords[1] + (Math.random() - 0.5) * 0.015),
      };

      if (!loc.lat || !loc.lng) return;

      const isOnline = partner.status === 'online' || partner.status === 'busy';
      const isSelected = selectedPartnerId === partner.id;

      const riderIcon = L.divIcon({
        className: 'custom-rider-icon',
        html: `
          <div class="relative flex items-center justify-center cursor-pointer transition-transform ${isSelected ? 'scale-125 z-50' : 'scale-100'}">
            <div class="w-9 h-9 rounded-full ${isOnline ? 'bg-orange-500' : 'bg-slate-700'} border-2 border-white shadow-lg flex items-center justify-center text-white text-sm font-bold">
              🛵
            </div>
            ${isOnline ? '<span class="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-900 animate-pulse"></span>' : ''}
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const marker = L.marker([loc.lat, loc.lng], { icon: riderIcon }).addTo(map);
      marker.bindPopup(`
        <div style="color: #0E1524; font-family: sans-serif; min-width: 140px;">
          <strong style="font-size: 13px;">${partner.name}</strong>
          <div style="font-size: 11px; color: #64748B; margin-top: 2px;">Status: <span style="font-weight: bold; color: ${isOnline ? '#10B981' : '#EF4444'}; text-transform: uppercase;">${partner.status || 'Offline'}</span></div>
          <div style="font-size: 11px; color: #64748B;">Phone: ${partner.phone || 'N/A'}</div>
          ${loc.speed ? `<div style="font-size: 10px; color: #F97316; margin-top: 2px;">⚡ Speed: ${Math.round(loc.speed)} km/h</div>` : ''}
        </div>
      `);

      markersRef.current[`rider-${partner.id}`] = marker;

      // If rider has an active order, draw line to customer address
      const riderActiveOrder = activeOrders.find(
        (o) => o.deliveryPartnerId === partner.id || o.deliveryPartner?.id === partner.id || loc.activeOrderId === o.id
      );

      if (riderActiveOrder && riderActiveOrder.deliveryAddress?.lat && riderActiveOrder.deliveryAddress?.lng) {
        const destCoords: [number, number] = [
          Number(riderActiveOrder.deliveryAddress.lat),
          Number(riderActiveOrder.deliveryAddress.lng),
        ];

        const customerIcon = L.divIcon({
          className: 'custom-dest-icon',
          html: `
            <div class="w-8 h-8 rounded-full bg-emerald-600 border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold animate-pulse">
              📍
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const destMarker = L.marker(destCoords, { icon: customerIcon }).addTo(map);
        destMarker.bindPopup(`
          <div style="color: #0E1524; font-family: sans-serif;">
            <strong style="font-size: 12px;">Customer Delivery</strong>
            <p style="font-size: 11px; margin: 2px 0;">Order #${riderActiveOrder.id.slice(-6).toUpperCase()}</p>
            <p style="font-size: 10px; color: #64748B;">${riderActiveOrder.deliveryAddress.address || 'Address'}</p>
          </div>
        `);
        markersRef.current[`dest-${riderActiveOrder.id}`] = destMarker;

        const polyline = L.polyline([restaurantCoords, [loc.lat, loc.lng], destCoords], {
          color: '#F97316',
          weight: 4,
          opacity: 0.85,
          dashArray: '8, 8',
        }).addTo(map);

        markersRef.current[`route-${partner.id}`] = polyline;
      }
    });
  }, [partners, locations, activeOrders, selectedPartnerId]);

  // Track rider action - fly map camera to rider
  const handleTrackRider = (partner: DeliveryPartner) => {
    setSelectedPartnerId(partner.id);
    const loc = locations[partner.id] || {
      lat: partner.lat || partner.latitude || (RESTAURANT_LOCATION.lat + 0.005),
      lng: partner.lng || partner.longitude || (RESTAURANT_LOCATION.lng + 0.005),
    };

    if (mapInstanceRef.current && loc.lat && loc.lng) {
      mapInstanceRef.current.flyTo([loc.lat, loc.lng], 16, { duration: 1.5 });
      const marker = markersRef.current[`rider-${partner.id}`];
      if (marker && (marker as L.Marker).openPopup) {
        (marker as L.Marker).openPopup();
      }
    }
    toast.success(`Tracking live coordinates for ${partner.name}`);
  };

  // Toggle partner online status
  const handleTogglePartnerStatus = async (partner: DeliveryPartner) => {
    const nextStatus = partner.status === 'online' || partner.status === 'busy' ? 'offline' : 'online';
    try {
      await setDoc(
        doc(db, 'delivery_partners', partner.id),
        { status: nextStatus, updatedAt: new Date().toISOString() },
        { merge: true }
      );
      toast.success(`${partner.name} is now ${nextStatus.toUpperCase()}`);
    } catch (e: any) {
      toast.error('Failed to update rider status: ' + e.message);
    }
  };

  // Add new delivery partner
  const handleCreatePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartnerName.trim() || !newPartnerPhone.trim()) {
      toast.error('Partner name and phone are required.');
      return;
    }

    const toastId = toast.loading('Registering delivery partner...');
    try {
      const partnerId = `rider-${Date.now().toString(36)}`;
      await setDoc(doc(db, 'delivery_partners', partnerId), {
        id: partnerId,
        name: newPartnerName,
        phone: newPartnerPhone,
        email: newPartnerEmail || `${newPartnerPhone.replace(/\D/g, '')}@olivepizza.com`,
        status: 'online',
        approvalStatus: 'approved',
        vehicleType: newPartnerVehicle,
        vehicleNumber: newPartnerReg || 'Standard',
        rating: 5.0,
        totalDeliveries: 0,
        lat: RESTAURANT_LOCATION.lat + (Math.random() - 0.5) * 0.01,
        lng: RESTAURANT_LOCATION.lng + (Math.random() - 0.5) * 0.01,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      toast.success(`Registered ${newPartnerName} to delivery fleet!`, { id: toastId });
      setIsAddModalOpen(false);
      setNewPartnerName('');
      setNewPartnerPhone('');
      setNewPartnerEmail('');
      setNewPartnerReg('');
    } catch (err: any) {
      toast.error('Registration failed: ' + err.message, { id: toastId });
    }
  };

  // Center map on Olive Pizza Restaurant
  const handleCenterRestaurant = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([RESTAURANT_LOCATION.lat, RESTAURANT_LOCATION.lng], 14, { duration: 1 });
    }
  };

  // Manual Partner Assignment to an Active Order
  const handleAssignPartner = async (orderId: string, partnerId: string) => {
    const partner = partners.find((p) => p.id === partnerId);
    if (!partner) return;

    const toastId = toast.loading(`Assigning ${partner.name} to order...`);
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        deliveryPartnerId: partner.id,
        deliveryPartner: {
          id: partner.id,
          name: partner.name,
          phone: partner.phone,
          vehicleNumber: partner.vehicleNumber || '',
        },
        status: 'out_for_delivery',
        updatedAt: new Date().toISOString(),
      });

      await setDoc(
        doc(db, 'delivery_partners', partner.id),
        { status: 'busy', currentOrderId: orderId, updatedAt: new Date().toISOString() },
        { merge: true }
      ).catch(() => {});

      toast.success(`Order assigned to ${partner.name}!`, { id: toastId });
    } catch (err: any) {
      toast.error('Assignment failed: ' + err.message, { id: toastId });
    }
  };

  // Filtered partners
  const filteredPartners = useMemo(() => {
    return partners.filter((p) => {
      const matchStatus =
        filterStatus === 'all' ||
        (filterStatus === 'online' && (p.status === 'online' || p.status === 'busy')) ||
        (filterStatus === 'ondelivery' && p.status === 'busy') ||
        (filterStatus === 'offline' && p.status === 'offline');

      const matchSearch =
        searchQuery.trim() === '' ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.phone && p.phone.includes(searchQuery));

      return matchStatus && matchSearch;
    });
  }, [partners, filterStatus, searchQuery]);

  const onlineRidersCount = partners.filter((p) => p.status === 'online' || p.status === 'busy').length;
  const onDeliveryCount = partners.filter((p) => p.status === 'busy').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0E1524] p-5 rounded-2xl border border-slate-800 shadow-lg">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-extrabold text-white tracking-tight">Live Delivery Fleet Management</h1>
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase tracking-wider animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> GPS LIVE
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time GPS rider telemetry, active route navigation, and instant order dispatch.
          </p>
        </div>

        {/* Tab Controls & Add Partner */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-[#0B0F17] p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('fleet')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'fleet'
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Bike className="w-3.5 h-3.5" />
              Rider Fleet ({partners.length})
            </button>
            <button
              onClick={() => setActiveTab('dispatch')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'dispatch'
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Navigation className="w-3.5 h-3.5" />
              Active Dispatch ({activeOrders.length})
            </button>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-3.5 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-lg shadow-orange-600/20"
          >
            <Plus className="w-4 h-4" /> Add Rider
          </button>
        </div>
      </div>

      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-4 shadow-md">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase">
            <span>Total Fleet</span>
            <Bike className="w-4 h-4 text-orange-400" />
          </div>
          <div className="text-2xl font-extrabold text-white font-mono mt-2">{partners.length}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Registered delivery partners</div>
        </div>

        <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-4 shadow-md">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase">
            <span>Active & Online</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-400 font-mono mt-2">{onlineRidersCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Ready for new delivery assignments</div>
        </div>

        <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-4 shadow-md">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase">
            <span>On Delivery Run</span>
            <Navigation className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-extrabold text-blue-400 font-mono mt-2">{onDeliveryCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Currently navigating to customers</div>
        </div>

        <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-4 shadow-md">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase">
            <span>Dispatch Queue</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-extrabold text-amber-400 font-mono mt-2">{activeOrders.length}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Live orders in preparation/transit</div>
        </div>
      </div>

      {/* Main Map & Live Fleet Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Live Map View */}
        <div className="lg:col-span-2 bg-[#0E1524] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[580px] relative">
          {/* Map Header / Controls */}
          <div className="p-3.5 bg-[#0E1524]/90 backdrop-blur-md border-b border-slate-800 flex items-center justify-between z-10">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <MapPin className="w-4 h-4 text-orange-400" />
              <span>Live Fleet Radar (Rajnandgaon Zone)</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCenterRestaurant}
                className="px-3 py-1.5 bg-[#0B0F17] hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                🍕 Center HQ
              </button>
            </div>
          </div>

          {/* Leaflet Map Canvas */}
          <div ref={mapContainerRef} className="w-full flex-1 z-0 bg-slate-950" />

          {/* Bottom Live Legend */}
          <div className="p-3 bg-[#0E1524]/90 backdrop-blur-md border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] z-10">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span> Olive Pizza HQ
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span> Online Rider
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Customer Destination
              </span>
            </div>
            <span className="text-slate-500 text-[10px]">Real-time GPS coordinates stream via Firestore & Supabase</span>
          </div>
        </div>

        {/* Right Column: Fleet List or Dispatch Queue */}
        <div className="bg-[#0E1524] border border-slate-800 rounded-3xl p-5 shadow-2xl flex flex-col h-[580px] space-y-4">
          {/* TAB 1: FLEET LIST */}
          {activeTab === 'fleet' && (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Bike className="w-3.5 h-3.5 text-orange-400" /> Delivery Fleet ({filteredPartners.length})
                </h3>
                {/* Filter */}
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-[#0B0F17] border border-slate-800 text-slate-300 text-[11px] rounded-lg px-2 py-1 focus:outline-none"
                >
                  <option value="all">All</option>
                  <option value="online">Online</option>
                  <option value="ondelivery">On Delivery</option>
                  <option value="offline">Offline</option>
                </select>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search rider name or phone..."
                  className="w-full pl-8 pr-3 py-1.5 bg-[#0B0F17] border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
                />
              </div>

              {/* Riders Scroll Area */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                {loading ? (
                  <div className="text-center py-16 text-slate-500 text-xs">Loading delivery partners...</div>
                ) : filteredPartners.length === 0 ? (
                  <div className="text-center py-16 text-slate-500 text-xs space-y-2">
                    <Bike className="w-8 h-8 mx-auto text-slate-600 opacity-50" />
                    <p>No delivery partners found. Click "Add Rider" to register one.</p>
                  </div>
                ) : (
                  filteredPartners.map((partner) => {
                    const isOnline = partner.status === 'online' || partner.status === 'busy';
                    const isBusy = partner.status === 'busy';
                    const isSelected = selectedPartnerId === partner.id;

                    return (
                      <div
                        key={partner.id}
                        className={`p-3 bg-[#0B0F17] border rounded-2xl transition-all space-y-2.5 ${
                          isSelected ? 'border-orange-500 shadow-md shadow-orange-500/10' : 'border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-sm text-orange-400">
                              🛵
                            </div>
                            <div>
                              <div className="font-bold text-white text-xs">{partner.name}</div>
                              <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                                <Phone className="w-3 h-3 text-slate-500" />
                                <a href={`tel:${partner.phone}`} className="hover:text-orange-400">
                                  {partner.phone}
                                </a>
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => handleTogglePartnerStatus(partner)}
                            className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase transition-all ${
                              isBusy
                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                                : isOnline
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                                : 'bg-slate-500/10 text-slate-400 border border-slate-500/30 hover:bg-slate-500/20'
                            }`}
                          >
                            {isBusy ? 'On Delivery' : isOnline ? 'Online' : 'Offline'}
                          </button>
                        </div>

                        {/* Telemetry & Action */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px]">
                          <div className="text-slate-400 text-[10px]">
                            {partner.vehicleNumber ? `Reg: ${partner.vehicleNumber}` : 'Standard Fleet'}
                          </div>

                          <button
                            onClick={() => handleTrackRider(partner)}
                            className="px-2.5 py-1 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-lg text-[10px] flex items-center gap-1 transition-all shadow-md shadow-orange-600/20"
                          >
                            <Compass className="w-3 h-3" /> Track on Map
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}

          {/* TAB 2: ACTIVE DISPATCH QUEUE */}
          {activeTab === 'dispatch' && (
            <>
              <h3 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5 text-orange-400" /> Active Orders Dispatch ({activeOrders.length})
              </h3>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
                {activeOrders.length === 0 ? (
                  <div className="text-center py-16 text-slate-500 text-xs">No active orders awaiting dispatch.</div>
                ) : (
                  activeOrders.map((order) => (
                    <div key={order.id} className="p-3 bg-[#0B0F17] border border-slate-800 rounded-2xl space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-mono font-bold text-white text-xs">
                            #{order.id.slice(-6).toUpperCase()}
                          </span>
                          <div className="text-slate-400 text-[11px] font-bold">{order.customerName || 'Customer'}</div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-[9px] font-extrabold uppercase">
                          {order.status}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-400 line-clamp-1">
                        📍 {order.deliveryAddress?.address || order.deliveryAddress || 'Delivery Address'}
                      </div>

                      {/* Partner Assignment Dropdown */}
                      <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2">
                        <select
                          value={order.deliveryPartnerId || ''}
                          onChange={(e) => handleAssignPartner(order.id, e.target.value)}
                          className="flex-1 bg-[#0E1524] border border-slate-800 text-slate-300 text-[11px] rounded-lg px-2 py-1.5 focus:border-orange-500 focus:outline-none"
                        >
                          <option value="">Assign Rider...</option>
                          {partners
                            .filter((p) => p.status === 'online' || p.status === 'busy')
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                🛵 {p.name} ({p.status})
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add Rider Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0E1524] border border-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Bike className="w-4 h-4 text-orange-400" /> Register Delivery Partner
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePartner} className="space-y-3.5 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase block mb-1">Rider Full Name</label>
                <input
                  type="text"
                  value={newPartnerName}
                  onChange={(e) => setNewPartnerName(e.target.value)}
                  placeholder="e.g. Vikas Patel"
                  className="w-full px-3.5 py-2.5 bg-[#0B0F17] border border-slate-800 rounded-xl text-white focus:border-orange-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase block mb-1">Phone Number</label>
                <input
                  type="text"
                  value={newPartnerPhone}
                  onChange={(e) => setNewPartnerPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-3.5 py-2.5 bg-[#0B0F17] border border-slate-800 rounded-xl text-white focus:border-orange-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 uppercase block mb-1">Vehicle Type</label>
                  <select
                    value={newPartnerVehicle}
                    onChange={(e) => setNewPartnerVehicle(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#0B0F17] border border-slate-800 rounded-xl text-white focus:border-orange-500 focus:outline-none"
                  >
                    <option value="Motorcycle">Motorcycle</option>
                    <option value="EV Scooter">EV Scooter</option>
                    <option value="Bicycle">Bicycle</option>
                    <option value="Car">Car</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 uppercase block mb-1">Vehicle Reg No.</label>
                  <input
                    type="text"
                    value={newPartnerReg}
                    onChange={(e) => setNewPartnerReg(e.target.value)}
                    placeholder="CG-08-XX-1234"
                    className="w-full px-3.5 py-2.5 bg-[#0B0F17] border border-slate-800 rounded-xl text-white focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-600/20 mt-2"
              >
                <CheckCircle2 className="w-4 h-4" /> Save Delivery Partner
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
