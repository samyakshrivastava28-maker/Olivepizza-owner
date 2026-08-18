import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuthStore, useOwnerSettingsStore } from '../lib/store';
import { uploadMediaToCloudinary } from '../lib/cloudinary';
import { Store, BellRing, Volume2, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';

export default function OwnerSettings() {
  const { user } = useAuthStore();
  const ownerSettings = useOwnerSettingsStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const [settings, setSettings] = useState({
    restaurantName: "Olive Pizza",
    contactNumber: "",
    supportEmail: "",
    deliveryRadiusKm: 5,
    minOrderAmount: 0,
    deliveryCharge: 0,
    taxPercentage: 5,
    businessHours: "12:00 PM - 11:30 PM",
    openingTime: "12:00",
    closingTime: "23:30",
    openingHour: 12,
    closingHour: 24,
    logoUrl: "",
    bannerUrl: "",
    isRestaurantOpen: true,
    isDeliveryAvailable: true,
    is24x7: false,
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, "settings", "global");
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          setSettings((prev) => ({ 
            ...prev, 
            ...data,
            openingTime: data.openingTime || "12:00",
            closingTime: data.closingTime || "23:30",
            openingHour: data.openingHour !== undefined ? data.openingHour : 12,
            closingHour: data.closingHour !== undefined ? data.closingHour : 24,
          }));
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let finalLogoUrl = settings.logoUrl;
      if (logoFile) {
        const uploadRes = await uploadMediaToCloudinary(
          logoFile,
          "Olive Pizza/branding",
        );
        finalLogoUrl = uploadRes.secureUrl;
      }

      // Calculate numeric opening and closing hours from openingTime & closingTime
      const openH = settings.openingTime ? parseInt(settings.openingTime.split(":")[0], 10) : 12;
      const closeH = settings.closingTime ? parseInt(settings.closingTime.split(":")[0], 10) : 24;

      const updatedSettings = { 
        ...settings, 
        logoUrl: finalLogoUrl,
        openingHour: openH,
        closingHour: closeH,
        businessHours: `${settings.openingTime} - ${settings.closingTime}`
      };

      await setDoc(doc(db, "settings", "global"), updatedSettings, {
        merge: true,
      });

      setSettings(updatedSettings);
      setLogoFile(null);
      toast.success("Restaurant settings & operating hours saved successfully! 🍕");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="p-8 text-center animate-pulse font-bold text-slate-400">
        Loading Settings...
      </div>
    );

  // Compute live current store open status
  const currentH = new Date().getHours();
  const is24H = settings.is24x7 === true ||
    (settings.openingHour === 0 && (settings.closingHour >= 23 || settings.closingHour === 24 || settings.closingTime === '23:59' || String(settings.businessHours).includes('23:59') || String(settings.businessHours).toLowerCase().includes('24')));
  const isWithinHours = is24H || (settings.openingHour <= settings.closingHour ? (currentH >= settings.openingHour && currentH < settings.closingHour) : (currentH >= settings.openingHour || currentH < settings.closingHour));
  const isLiveOpen = settings.isRestaurantOpen && isWithinHours;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white">Restaurant Settings</h1>
          <p className="text-slate-400">
            Manage store operating hours, delivery radius, and branding.
          </p>
        </div>

        {/* Live Operating Status Badge */}
        <div className={`px-4 py-2 rounded-2xl border flex items-center gap-2 shadow-lg ${
          isLiveOpen ? 'bg-emerald-950/60 border-emerald-500/30 text-emerald-400' : 'bg-rose-950/60 border-rose-500/30 text-rose-400'
        }`}>
          <span className={`w-2.5 h-2.5 rounded-full ${isLiveOpen ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
          <span className="font-bold text-xs uppercase tracking-wider">
            {isLiveOpen ? 'Restaurant is Live & Open' : 'Restaurant is Closed'}
          </span>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">

        {/* 🕒 Operating Hours & Schedule (NEW OWNER CONTROL) */}
        <div className="bg-[#1E293B] border border-white/10 shadow-xl rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-700 pb-2">
            <h2 className="text-xl font-bold text-amber-400 flex items-center gap-2">
              <Store className="w-5 h-5" /> Operating Hours & Schedule
            </h2>
            <span className="text-xs font-bold text-slate-400">
              Current: {settings.openingTime} to {settings.closingTime}
            </span>
          </div>

          <p className="text-xs text-slate-400">
            Set the exact daily opening and closing hours for Olive Pizza. Customers will see real-time store availability based on these hours.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-1">
                Opening Time
              </label>
              <input
                type="time"
                value={settings.openingTime}
                onChange={(e) => setSettings({ ...settings, openingTime: e.target.value })}
                className="w-full p-3 rounded-xl border border-slate-700 bg-slate-900 text-white font-bold focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-300 mb-1">
                Closing Time
              </label>
              <input
                type="time"
                value={settings.closingTime}
                onChange={(e) => setSettings({ ...settings, closingTime: e.target.value })}
                className="w-full p-3 rounded-xl border border-slate-700 bg-slate-900 text-white font-bold focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {/* Quick Timing Presets */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Quick Presets
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSettings({ ...settings, openingTime: "12:00", closingTime: "23:30", openingHour: 12, closingHour: 24 })}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-white/10 transition-colors"
              >
                12:00 PM – 11:30 PM (Standard)
              </button>
              <button
                type="button"
                onClick={() => setSettings({ ...settings, openingTime: "11:00", closingTime: "23:00", openingHour: 11, closingHour: 23 })}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-white/10 transition-colors"
              >
                11:00 AM – 11:00 PM (Early Bird)
              </button>
              <button
                type="button"
                onClick={() => setSettings({ ...settings, openingTime: "10:00", closingTime: "00:00", openingHour: 10, closingHour: 24 })}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-white/10 transition-colors"
              >
                10:00 AM – 12:00 AM (Late Night)
              </button>
              <button
                type="button"
                onClick={() => setSettings({ ...settings, openingTime: "00:00", closingTime: "23:59", openingHour: 0, closingHour: 24 })}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold border border-amber-400/30 transition-colors"
              >
                24 Hours Open 🚀
              </button>
            </div>
          </div>
        </div>

        {/* Branding */}
        <div className="bg-[#1E293B] border border-white/10 shadow-xl rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-bold text-primary-600 border-b border-slate-100 dark:border-slate-800 pb-2">
            Branding
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-1">
                Restaurant Name
              </label>
              <input
                type="text"
                value={settings.restaurantName}
                onChange={(e) =>
                  setSettings({ ...settings, restaurantName: e.target.value })
                }
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-[#1E293B] border border-white/10 shadow-2xl"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-1">
                Upload Logo
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                className="w-full p-2"
              />
              {settings.logoUrl && !logoFile && (
                <img
                  src={settings.logoUrl}
                  alt="Current Logo"
                  className="mt-2 h-12 rounded"
                />
              )}
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div className="bg-[#1E293B] border border-white/10 shadow-xl rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-bold text-primary-600 border-b border-slate-100 dark:border-slate-800 pb-2">
            Contact & Operations
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-1">
                Support Email
              </label>
              <input
                type="email"
                value={settings.supportEmail}
                onChange={(e) =>
                  setSettings({ ...settings, supportEmail: e.target.value })
                }
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-[#1E293B] border border-white/10 shadow-2xl"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-1">
                Contact Number
              </label>
              <input
                type="text"
                value={settings.contactNumber}
                onChange={(e) =>
                  setSettings({ ...settings, contactNumber: e.target.value })
                }
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-[#1E293B] border border-white/10 shadow-2xl"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-slate-300 mb-1">
                Business Hours
              </label>
              <input
                type="text"
                value={settings.businessHours}
                onChange={(e) =>
                  setSettings({ ...settings, businessHours: e.target.value })
                }
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-[#1E293B] border border-white/10 shadow-2xl"
              />
            </div>
          </div>
        </div>

        {/* Delivery & Fees */}
        <div className="bg-[#1E293B] border border-white/10 shadow-xl rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-bold text-primary-600 border-b border-slate-100 dark:border-slate-800 pb-2">
            Delivery & Finances
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-1">
                Delivery Radius (km)
              </label>
              <input
                type="number"
                value={settings.deliveryRadiusKm}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    deliveryRadiusKm: Number(e.target.value),
                  })
                }
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-[#1E293B] border border-white/10 shadow-2xl"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-1">
                Base Delivery Charge (₹)
              </label>
              <input
                type="number"
                value={settings.deliveryCharge}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    deliveryCharge: Number(e.target.value),
                  })
                }
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-[#1E293B] border border-white/10 shadow-2xl"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-1">
                Minimum Order Amount (₹)
              </label>
              <input
                type="number"
                value={settings.minOrderAmount}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    minOrderAmount: Number(e.target.value),
                  })
                }
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-[#1E293B] border border-white/10 shadow-2xl"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-1">
                Tax Percentage (%)
              </label>
              <input
                type="number"
                value={settings.taxPercentage}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    taxPercentage: Number(e.target.value),
                  })
                }
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-[#1E293B] border border-white/10 shadow-2xl"
              />
            </div>
          </div>
        </div>

        {/* Master Controls */}
        <div className="bg-[#1E293B] border border-white/10 shadow-xl rounded-2xl p-6 space-y-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <Store size={100} />
          </div>
          <h2 className="text-xl font-bold text-primary-600 border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-2">
            <Store className="w-5 h-5" /> Store Operational Controls
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="flex items-center justify-between bg-slate-900/50 p-4 rounded-xl border border-white/5">
              <div>
                <h3 className="font-bold text-white">Restaurant Open</h3>
                <p className="text-xs text-slate-400">
                  Accepting new orders from customers.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={settings.isRestaurantOpen}
                  onChange={async (e) => {
                    const val = e.target.checked;
                    setSettings({ ...settings, isRestaurantOpen: val });
                    await setDoc(
                      doc(db, "settings", "global"),
                      { isRestaurantOpen: val },
                      { merge: true },
                    );
                    toast.success(
                      `Restaurant is now ${val ? "Open" : "Closed"}`,
                    );
                  }}
                />
                <div className="w-14 h-7 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-500"></div>
              </label>
            </div>

            <div className="flex items-center justify-between bg-slate-900/50 p-4 rounded-xl border border-white/5">
              <div>
                <h3 className="font-bold text-white">Delivery Available</h3>
                <p className="text-xs text-slate-400">
                  Allow customers to choose delivery.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={settings.isDeliveryAvailable}
                  onChange={async (e) => {
                    const val = e.target.checked;
                    setSettings({ ...settings, isDeliveryAvailable: val });
                    await setDoc(
                      doc(db, "settings", "global"),
                      { isDeliveryAvailable: val },
                      { merge: true },
                    );
                    toast.success(
                      `Delivery is now ${val ? "Enabled" : "Disabled"}`,
                    );
                  }}
                />
                <div className="w-14 h-7 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-500"></div>
              </label>
            </div>
          </div>
        </div>

        {/* POS Alert Settings */}
        <div className="bg-[#1E293B] border border-white/10 shadow-xl rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-bold text-primary-600 border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-2">
            <BellRing className="w-5 h-5" /> POS Alert Settings (Local Device)
          </h2>
          <p className="text-sm text-slate-400 mb-4">
            These settings are specific to this browser/device and control how
            you are notified of new orders.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between bg-slate-800/30 p-3 rounded-lg">
              <span className="font-medium text-slate-200">
                New Order Sound
              </span>
              <input
                type="checkbox"
                checked={ownerSettings.enableNewOrderSound}
                onChange={(e) =>
                  ownerSettings.updateSettings({
                    enableNewOrderSound: e.target.checked,
                  })
                }
                className="w-5 h-5 accent-primary-500"
              />
            </div>
            <div className="flex items-center justify-between bg-slate-800/30 p-3 rounded-lg">
              <span className="font-medium text-slate-200">
                Urgent Alarm Sound
              </span>
              <input
                type="checkbox"
                checked={ownerSettings.enableUrgentSound}
                onChange={(e) =>
                  ownerSettings.updateSettings({
                    enableUrgentSound: e.target.checked,
                  })
                }
                className="w-5 h-5 accent-red-500"
              />
            </div>
            <div className="flex items-center justify-between bg-slate-800/30 p-3 rounded-lg">
              <span className="font-medium text-slate-200">
                Browser Push Notifications
              </span>
              <input
                type="checkbox"
                checked={ownerSettings.enableBrowserNotifications}
                onChange={(e) =>
                  ownerSettings.updateSettings({
                    enableBrowserNotifications: e.target.checked,
                  })
                }
                className="w-5 h-5 accent-primary-500"
              />
            </div>
            <div className="flex items-center justify-between bg-slate-800/30 p-3 rounded-lg">
              <span className="font-medium text-slate-200">
                Device Vibration
              </span>
              <input
                type="checkbox"
                checked={ownerSettings.enableVibrations}
                onChange={(e) =>
                  ownerSettings.updateSettings({
                    enableVibrations: e.target.checked,
                  })
                }
                className="w-5 h-5 accent-primary-500"
              />
            </div>
            <div className="flex items-center justify-between bg-slate-800/30 p-3 rounded-lg col-span-1 md:col-span-2">
              <span className="font-medium text-slate-200 flex items-center gap-2">
                <Volume2 size={18} /> Alarm Volume
              </span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={ownerSettings.volumeLevel}
                onChange={(e) =>
                  ownerSettings.updateSettings({
                    volumeLevel: parseFloat(e.target.value),
                  })
                }
                className="w-1/2 accent-primary-500"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <button
            type="submit"
            disabled={saving}
            className="bg-primary-500 hover:bg-primary-600 disabled:opacity-100 text-white font-bold py-3 px-8 rounded-xl transition-colors shadow-md"
          >
            {saving ? "Saving..." : "Save All Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
