import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useOwnerSettingsStore } from '../lib/store';
import { Settings as SettingsIcon, Save, Volume2, Clock, MapPin, Shield } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Settings() {
  const settings = useOwnerSettingsStore();
  const [openingHour, setOpeningHour] = useState(12);
  const [closingHour, setClosingHour] = useState(24);
  const [deliveryRadius, setDeliveryRadius] = useState(15);
  const [autoAccept, setAutoAccept] = useState(settings.autoAcceptOrders);
  const [repeatInterval, setRepeatInterval] = useState(settings.repeatAlarmIntervalSeconds);
  const [soundEnabled, setSoundEnabled] = useState(settings.soundEnabled);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadStoreSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'store'));
        if (snap.exists()) {
          const d = snap.data();
          if (d.openingHour) setOpeningHour(d.openingHour);
          if (d.closingHour) setClosingHour(d.closingHour);
          if (d.deliveryRadius) setDeliveryRadius(d.deliveryRadius);
        }
      } catch (e) {
        console.warn(e);
      }
    };
    loadStoreSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'store'), {
        openingHour: Number(openingHour),
        closingHour: Number(closingHour),
        deliveryRadius: Number(deliveryRadius),
        updatedAt: new Date().toISOString(),
      });

      settings.updateSettings({
        autoAcceptOrders: autoAccept,
        repeatAlarmIntervalSeconds: Number(repeatInterval),
        soundEnabled,
      });

      toast.success('Store & operational settings saved.');
    } catch (e: any) {
      toast.error('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-white">Store & Operational Settings</h2>
        <p className="text-xs text-slate-400">Configure delivery radius, opening schedule, and emergency alert intervals.</p>
      </div>

      <div className="bg-[#131B2B] border border-slate-800 rounded-2xl p-6 max-w-xl">
        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Opening Hour (24h)</label>
              <input
                type="number"
                min={0}
                max={23}
                value={openingHour}
                onChange={(e) => setOpeningHour(Number(e.target.value))}
                className="w-full p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white font-mono focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Closing Hour (24h)</label>
              <input
                type="number"
                min={1}
                max={24}
                value={closingHour}
                onChange={(e) => setClosingHour(Number(e.target.value))}
                className="w-full p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white font-mono focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Max Delivery Radius (KM)</label>
            <input
              type="number"
              min={1}
              max={50}
              value={deliveryRadius}
              onChange={(e) => setDeliveryRadius(Number(e.target.value))}
              className="w-full p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white font-mono focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div className="border-t border-slate-800 pt-4 space-y-3">
            <h4 className="text-xs font-extrabold text-orange-400 uppercase tracking-wider">Audio & Emergency Alerts</h4>

            <label className="flex items-center gap-2 text-xs text-slate-300 font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(e) => setSoundEnabled(e.target.checked)}
                className="rounded text-orange-500 focus:ring-0"
              />
              Enable High-Priority Audio Alarms for Incoming Orders
            </label>

            <div>
              <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Alarm Repeat Interval (Seconds)</label>
              <input
                type="number"
                min={10}
                max={300}
                value={repeatInterval}
                onChange={(e) => setRepeatInterval(Number(e.target.value))}
                className="w-full p-2.5 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white font-mono focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-600/20 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Store Configuration'}
          </button>
        </form>
      </div>
    </div>
  );
}
