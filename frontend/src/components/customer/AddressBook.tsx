import { useState, useEffect } from 'react';
import { auth, db } from '../../lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Plus, Edit2, Trash2, Home, Briefcase, Navigation, Check, Map, X, Star } from 'lucide-react';
import PizzaLoader from '../ui/PizzaLoader';
import toast from 'react-hot-toast';
import { LocationManager, LocationData } from '../../lib/permissions';
import { useAuthStore } from '../../lib/store';

// Reuse Leaflet map from SetupLocation but dynamically import to save bundle
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import "leaflet/dist/leaflet.css";
import L from 'leaflet';
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});
const RAJNANDGAON_CENTER = { lat: 21.0963, lng: 81.0335 };

export interface SavedAddress {
  id: string;
  type: 'Home' | 'Work' | 'Other';
  addressLine: string;
  landmark: string;
  pincode: string;
  city: string;
  lat: number;
  lng: number;
  isDefault: boolean;
}

export default function AddressBook() {
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const { user, setUser } = useAuthStore();

  const [newAddress, setNewAddress] = useState<Partial<SavedAddress>>({ type: 'Home' });
  const [markerPos, setMarkerPos] = useState(RAJNANDGAON_CENTER);
  const [gettingGps, setGettingGps] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  useEffect(() => {
    fetchAddresses();
  }, []);

  const fetchAddresses = async () => {
    if (!auth.currentUser) return;
    try {
      const docSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setAddresses(data.addresses || []);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load addresses');
    } finally {
      setLoading(false);
    }
  };

  const LocationMarker = () => {
    useMapEvents({
      click(e) {
        setMarkerPos({ lat: e.latlng.lat, lng: e.latlng.lng });
        reverseGeocode(e.latlng.lat, e.latlng.lng);
      },
    });
    return markerPos === null ? null : (
      <Marker position={[markerPos.lat, markerPos.lng]}>
        <Popup>Delivery Location</Popup>
      </Marker>
    );
  };

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await res.json();
      if (data && data.address) {
        const foundCity = data.address.city || data.address.town || data.address.village || "";
        const foundPincode = data.address.postcode || "";
        
        setNewAddress(prev => ({
          ...prev,
          addressLine: data.display_name,
          city: foundCity || 'Rajnandgaon',
          pincode: foundPincode
        }));
      }
    } catch (err) {
      console.error("Reverse geocode failed", err);
    }
  };

  const handleGetGps = async () => {
    setGettingGps(true);
    try {
      const location = await LocationManager.getCurrentLocation({ forcePrompt: true, fallbackToCache: false });
      setMarkerPos({ lat: location.lat, lng: location.lng });
      await reverseGeocode(location.lat, location.lng);
      toast.success("Location detected!");
    } catch (err: any) {
      toast.error(err.message || 'Failed to get location');
    } finally {
      setGettingGps(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    setSaveLoading(true);

    try {
      const addressToSave: SavedAddress = {
        id: Date.now().toString(),
        type: newAddress.type as any,
        addressLine: newAddress.addressLine || '',
        landmark: newAddress.landmark || '',
        pincode: newAddress.pincode || '',
        city: newAddress.city || 'Rajnandgaon',
        lat: markerPos.lat,
        lng: markerPos.lng,
        isDefault: addresses.length === 0, // First address is default
      };

      const updatedAddresses = [...addresses, addressToSave];
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        addresses: updatedAddresses
      });

      setAddresses(updatedAddresses);
      setIsAdding(false);
      setNewAddress({ type: 'Home' });
      toast.success('Address saved successfully!');

      if (addressToSave.isDefault) {
        updateDefaultAddress(addressToSave);
      }
    } catch (e) {
      toast.error('Failed to save address');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!auth.currentUser) return;
    const isDeletingDefault = addresses.find(a => a.id === id)?.isDefault;
    const newAddresses = addresses.filter(a => a.id !== id);
    
    if (isDeletingDefault && newAddresses.length > 0) {
      newAddresses[0].isDefault = true;
      updateDefaultAddress(newAddresses[0]);
    }

    setAddresses(newAddresses);
    await updateDoc(doc(db, 'users', auth.currentUser.uid), {
      addresses: newAddresses
    });
    toast.success('Address deleted');
  };

  const handleSetDefault = async (id: string) => {
    if (!auth.currentUser) return;
    const newAddresses = addresses.map(a => ({
      ...a,
      isDefault: a.id === id
    }));
    
    setAddresses(newAddresses);
    await updateDoc(doc(db, 'users', auth.currentUser.uid), {
      addresses: newAddresses
    });

    const defaultAddr = newAddresses.find(a => a.id === id);
    if (defaultAddr) updateDefaultAddress(defaultAddr);
    
    toast.success('Default address updated!');
  };

  const updateDefaultAddress = async (addr: SavedAddress) => {
    if (!auth.currentUser || !user) return;
    
    // Update global state
    setUser({
      ...user,
      lat: addr.lat,
      lng: addr.lng,
      fullAddress: addr.addressLine,
    }, user.role);

    // Update Cache
    LocationManager.setCachedLocation({
      lat: addr.lat,
      lng: addr.lng,
      fullAddress: addr.addressLine,
      city: addr.city,
      pincode: addr.pincode
    });

    // Notify other components (like Cart, Dashboard ETA) to refresh delivery availability
    window.dispatchEvent(new Event('olive:location:updated'));
  };

  if (loading) return <div className="p-8 text-center"><PizzaLoader size="small" text="" /></div>;

  return (
    <div className="bg-white dark:bg-slate-800 p-4 md:p-8 rounded-3xl shadow-lg border border-slate-200 dark:border-slate-700">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <h2 className="text-2xl font-black flex items-center gap-2 text-slate-800 dark:text-white">
          <MapPin className="text-primary-500 w-6 h-6" /> My Locations
        </h2>
        {!isAdding && (
          <button 
            onClick={() => setIsAdding(true)}
            className="bg-primary-600 hover:bg-primary-500 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-md shadow-primary-500/30 flex items-center gap-2 text-sm"
          >
            <Plus size={18} /> Add New Address
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {isAdding ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 mb-8">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg dark:text-white">Add New Address</h3>
                <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <button
                    onClick={handleGetGps}
                    disabled={gettingGps}
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 mb-4 transition-colors"
                  >
                    {gettingGps ? <PizzaLoader size="inline" /> : '📍 Use Current GPS Location'}
                  </button>
                  <div className="h-[250px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 relative z-0">
                    <MapContainer center={[markerPos.lat, markerPos.lng]} zoom={15} style={{ width: "100%", height: "100%" }}>
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <LocationMarker />
                    </MapContainer>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 text-center">Tap the map to set an exact pin location.</p>
                </div>

                <form onSubmit={handleSave} className="space-y-4 flex flex-col">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Save As</label>
                    <div className="flex gap-2">
                      {['Home', 'Work', 'Other'].map(type => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setNewAddress({ ...newAddress, type: type as any })}
                          className={`flex-1 py-2 rounded-xl border text-sm font-bold transition-all ${
                            newAddress.type === type 
                            ? 'bg-primary-500 border-primary-500 text-white' 
                            : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Address Line</label>
                    <textarea
                      required
                      rows={2}
                      value={newAddress.addressLine || ''}
                      onChange={e => setNewAddress({...newAddress, addressLine: e.target.value})}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl text-slate-800 dark:text-white focus:border-primary-500 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Landmark</label>
                      <input
                        type="text"
                        value={newAddress.landmark || ''}
                        onChange={e => setNewAddress({...newAddress, landmark: e.target.value})}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl text-slate-800 dark:text-white focus:border-primary-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Pincode</label>
                      <input
                        type="text"
                        required
                        value={newAddress.pincode || ''}
                        onChange={e => setNewAddress({...newAddress, pincode: e.target.value})}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl text-slate-800 dark:text-white focus:border-primary-500 outline-none"
                      />
                    </div>
                  </div>
                  
                  <div className="mt-auto pt-4">
                    <button
                      type="submit"
                      disabled={saveLoading}
                      className="w-full bg-primary-600 hover:bg-primary-500 text-white font-black py-4 rounded-xl shadow-lg transition-transform active:scale-95 disabled:opacity-70 flex items-center justify-center"
                    >
                      {saveLoading ? <PizzaLoader size="inline" /> : 'Save Address'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {addresses.length === 0 ? (
              <div className="col-span-full text-center py-12 bg-slate-50 dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-3xl">
                <Map className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-500 dark:text-slate-400">No saved addresses</h3>
                <p className="text-sm text-slate-400 dark:text-slate-500 mb-6">Add an address for faster checkout.</p>
              </div>
            ) : (
              addresses.map((addr) => (
                <div key={addr.id} className={`relative p-5 rounded-2xl border transition-all ${
                  addr.isDefault 
                  ? 'bg-primary-500/10 border-primary-500 shadow-md shadow-primary-500/10' 
                  : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-primary-500/50'
                }`}>
                  {addr.isDefault && (
                    <div className="absolute top-0 right-0 bg-primary-500 text-white text-[10px] font-black px-2 py-1 rounded-bl-xl rounded-tr-2xl flex items-center gap-1">
                      <Star className="w-3 h-3" /> DEFAULT
                    </div>
                  )}
                  
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400">
                      {addr.type === 'Home' && <Home size={18} />}
                      {addr.type === 'Work' && <Briefcase size={18} />}
                      {addr.type === 'Other' && <MapPin size={18} />}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-white leading-none">{addr.type}</h4>
                    </div>
                  </div>

                  <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2 mb-1 h-10">
                    {addr.addressLine}
                  </p>
                  {addr.landmark && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 line-clamp-1">
                      Landmark: {addr.landmark}
                    </p>
                  )}

                  <div className="flex gap-2 mt-4">
                    {!addr.isDefault && (
                      <button 
                        onClick={() => handleSetDefault(addr.id)}
                        className="flex-1 bg-white dark:bg-slate-800 text-primary-600 dark:text-primary-400 border border-slate-200 dark:border-slate-700 text-xs font-bold py-2 rounded-lg hover:border-primary-500 transition-colors"
                      >
                        Set Default
                      </button>
                    )}
                    <button 
                      onClick={() => handleDelete(addr.id)}
                      className={`text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors ${addr.isDefault ? 'ml-auto' : ''}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
