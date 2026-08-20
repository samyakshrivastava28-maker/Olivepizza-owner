import React, { useState, useEffect } from 'react';
import {
  Store,
  Clock,
  Power,
  Bike,
  ShoppingBag,
  MapPin,
  Phone,
  Save,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  ShieldAlert,
} from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { fetchApi } from '../lib/api';
import toast from 'react-hot-toast';

export default function RestaurantManagement() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Operational State
  const [isStoreOpen, setIsStoreOpen] = useState(true);
  const [closureReason, setClosureReason] = useState('');
  const [deliveryEnabled, setDeliveryEnabled] = useState(true);
  const [takeawayEnabled, setTakeawayEnabled] = useState(true);
  const [dineInEnabled, setDineInEnabled] = useState(true);

  // Timings
  const [openingTime, setOpeningTime] = useState('12:00');
  const [closingTime, setClosingTime] = useState('00:00');
  const [defaultPrepTime, setDefaultPrepTime] = useState(25);
  const [maxDeliveryRadiusKm, setMaxDeliveryRadiusKm] = useState(15);

  // Store Contact & Info
  const [restaurantName, setRestaurantName] = useState('Olive Pizza');
  const [phone, setPhone] = useState('+91 91799 44445');
  const [address, setAddress] = useState('Dongargaon Rd, near Saraswati school, Gokul Nagar, Rajnandgaon, Chhattisgarh 491441');

  // Load from Firestore /settings/store_config in real-time
  useEffect(() => {
    setLoading(true);
    const storeRef = doc(db, 'settings', 'store_config');
    const unsubscribe = onSnapshot(
      storeRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.isStoreOpen !== undefined) setIsStoreOpen(data.isStoreOpen);
          if (data.closureReason !== undefined) setClosureReason(data.closureReason);
          if (data.deliveryEnabled !== undefined) setDeliveryEnabled(data.deliveryEnabled);
          if (data.takeawayEnabled !== undefined) setTakeawayEnabled(data.takeawayEnabled);
          if (data.dineInEnabled !== undefined) setDineInEnabled(data.dineInEnabled);
          if (data.openingTime) setOpeningTime(data.openingTime);
          if (data.closingTime) setClosingTime(data.closingTime);
          if (data.defaultPrepTime) setDefaultPrepTime(data.defaultPrepTime);
          if (data.maxDeliveryRadiusKm) setMaxDeliveryRadiusKm(data.maxDeliveryRadiusKm);
          if (data.restaurantName) setRestaurantName(data.restaurantName);
          if (data.phone) setPhone(data.phone);
          if (data.address) setAddress(data.address);
        }
        setLoading(false);
      },
      (err) => {
        console.warn('[RestaurantManagement] Firestore config read error:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Save Settings to Firestore & notify backend
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const toastId = toast.loading('Saving operational configuration...');

    try {
      const payload = {
        isStoreOpen,
        closureReason: isStoreOpen ? '' : closureReason,
        deliveryEnabled,
        takeawayEnabled,
        dineInEnabled,
        openingTime,
        closingTime,
        defaultPrepTime: Number(defaultPrepTime) || 25,
        maxDeliveryRadiusKm: Number(maxDeliveryRadiusKm) || 15,
        restaurantName,
        phone,
        address,
        updatedAt: new Date().toISOString(),
      };

      // 1. Direct Firestore persistence
      await setDoc(doc(db, 'settings', 'store_config'), payload, { merge: true });

      // 2. Notify backend endpoint for server cache invalidation
      fetchApi('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {});

      toast.success('Restaurant operational configuration saved!', { id: toastId });
    } catch (err: any) {
      toast.error('Failed to save settings: ' + err.message, { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-[#0E1524] p-5 rounded-2xl border border-slate-800 shadow-lg">
        <h1 className="text-xl font-extrabold text-white tracking-tight">Restaurant Management</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Configure real-time store availability, ordering schedule, delivery boundaries, and operational hours.
        </p>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* SECTION 1: LIVE STORE AVAILABILITY */}
        <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                <Power className="w-4 h-4 text-orange-400" /> Live Ordering Master Switch
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Controls whether customer applications and the website accept incoming orders.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsStoreOpen(!isStoreOpen)}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                isStoreOpen
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20'
                  : 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              {isStoreOpen ? 'STORE OPEN (ACCEPTING ORDERS)' : 'STORE CLOSED (PAUSED)'}
            </button>
          </div>

          {!isStoreOpen && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl space-y-2 text-xs">
              <div className="font-bold text-rose-400 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" /> Reason for Temporary Closure
              </div>
              <input
                type="text"
                value={closureReason}
                onChange={(e) => setClosureReason(e.target.value)}
                placeholder="e.g. Kitchen deep cleaning, will reopen at 6:00 PM."
                className="w-full px-3 py-2 bg-[#0B0F17] border border-slate-800 rounded-lg text-white focus:border-rose-500 focus:outline-none"
              />
              <p className="text-[11px] text-slate-400">This message will be shown to customers attempting to place orders.</p>
            </div>
          )}

          {/* Service Channel Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <label className="flex items-center justify-between p-3.5 bg-[#0B0F17] rounded-xl border border-slate-800 cursor-pointer">
              <div className="flex items-center gap-2 text-xs">
                <Bike className="w-4 h-4 text-orange-400" />
                <span className="font-bold text-white">Home Delivery</span>
              </div>
              <input
                type="checkbox"
                checked={deliveryEnabled}
                onChange={(e) => setDeliveryEnabled(e.target.checked)}
                className="accent-orange-500 w-4 h-4"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 bg-[#0B0F17] rounded-xl border border-slate-800 cursor-pointer">
              <div className="flex items-center gap-2 text-xs">
                <ShoppingBag className="w-4 h-4 text-orange-400" />
                <span className="font-bold text-white">Takeaway / Pickup</span>
              </div>
              <input
                type="checkbox"
                checked={takeawayEnabled}
                onChange={(e) => setTakeawayEnabled(e.target.checked)}
                className="accent-orange-500 w-4 h-4"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 bg-[#0B0F17] rounded-xl border border-slate-800 cursor-pointer">
              <div className="flex items-center gap-2 text-xs">
                <Store className="w-4 h-4 text-orange-400" />
                <span className="font-bold text-white">Dine-In Table Orders</span>
              </div>
              <input
                type="checkbox"
                checked={dineInEnabled}
                onChange={(e) => setDineInEnabled(e.target.checked)}
                className="accent-orange-500 w-4 h-4"
              />
            </label>
          </div>
        </div>

        {/* SECTION 2: OPERATIONAL HOURS & PREPARATION TIME */}
        <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-6 shadow-md space-y-4">
          <h2 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3">
            <Clock className="w-4 h-4 text-orange-400" /> Store Timings & Preparation Speeds
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="text-[11px] font-bold text-slate-300 uppercase block mb-1">Daily Opening Time</label>
              <input
                type="time"
                value={openingTime}
                onChange={(e) => setOpeningTime(e.target.value)}
                className="w-full px-3 py-2 bg-[#0B0F17] border border-slate-800 rounded-xl text-white focus:border-orange-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-300 uppercase block mb-1">Daily Closing Time</label>
              <input
                type="time"
                value={closingTime}
                onChange={(e) => setClosingTime(e.target.value)}
                className="w-full px-3 py-2 bg-[#0B0F17] border border-slate-800 rounded-xl text-white focus:border-orange-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-300 uppercase block mb-1">Default Prep Time (Mins)</label>
              <input
                type="number"
                min={10}
                max={90}
                value={defaultPrepTime}
                onChange={(e) => setDefaultPrepTime(Number(e.target.value))}
                className="w-full px-3 py-2 bg-[#0B0F17] border border-slate-800 rounded-xl text-white font-mono focus:border-orange-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-300 uppercase block mb-1">Max Delivery Radius (KM)</label>
              <input
                type="number"
                min={1}
                max={30}
                value={maxDeliveryRadiusKm}
                onChange={(e) => setMaxDeliveryRadiusKm(Number(e.target.value))}
                className="w-full px-3 py-2 bg-[#0B0F17] border border-slate-800 rounded-xl text-white font-mono focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: STORE PROFILE & ADDRESS */}
        <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-6 shadow-md space-y-4">
          <h2 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3">
            <Store className="w-4 h-4 text-orange-400" /> Restaurant Profile & Contact
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="text-[11px] font-bold text-slate-300 uppercase block mb-1">Restaurant Name</label>
              <input
                type="text"
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                className="w-full px-3 py-2 bg-[#0B0F17] border border-slate-800 rounded-xl text-white focus:border-orange-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-300 uppercase block mb-1">Helpline Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 bg-[#0B0F17] border border-slate-800 rounded-xl text-white focus:border-orange-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-[11px] font-bold text-slate-300 uppercase block mb-1">Kitchen / Restaurant Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 bg-[#0B0F17] border border-slate-800 rounded-xl text-white focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-orange-600/20 disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving Changes...' : 'Save Restaurant Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
