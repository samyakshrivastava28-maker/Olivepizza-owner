import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import {
  collection,
  onSnapshot,
  query,
  updateDoc,
  doc,
  deleteDoc,
  addDoc,
  orderBy,
} from 'firebase/firestore';

export default function OwnerOffers() {
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  const [newOffer, setNewOffer] = useState({
    title: "",
    description: "",
    mediaType: "none" as "none" | "image" | "video",
    mediaUrl: "",
    isActive: true,
  });

  useEffect(() => {
    const q = query(collection(db, "offers"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setOffers(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      (error) => {
        console.error("Failed to listen to offers", error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "offers"), {
        ...newOffer,
        createdAt: Date.now(),
      });
      setIsAdding(false);
      setNewOffer({
        title: "",
        description: "",
        mediaType: "none",
        mediaUrl: "",
        isActive: true,
      });
    } catch (error) {
      console.error("Error creating offer", error);
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, "offers", id), { isActive: !currentStatus });
    } catch (error) {
      console.error("Error updating offer", error);
    }
  };

  const deleteOffer = async (id: string) => {
    if (
      !window.confirm("Are you sure you want to permanently delete this offer?")
    )
      return;
    try {
      await deleteDoc(doc(db, "offers", id));
    } catch (error) {
      console.error("Error deleting offer", error);
    }
  };

  if (loading)
    return (
      <div className="p-8 font-bold text-center animate-pulse">
        Loading Offers...
      </div>
    );

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Offers & Ad Bars</h1>
          <p className="text-slate-400">
            Manage promotional banners displayed at the top of the Customer
            Menu.
          </p>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="bg-primary-500 hover:bg-primary-600 text-white font-bold px-6 py-3 rounded-xl transition-colors shadow-sm"
        >
          {isAdding ? "Cancel" : "+ Create New Offer"}
        </button>
      </div>

      {isAdding && (
        <form
          onSubmit={handleCreate}
          className="bg-[#1E293B] border border-white/10 shadow-xl rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-4"
        >
          <input
            type="text"
            placeholder="Offer Title (e.g. MEGA DEAL!)"
            required
            value={newOffer.title}
            onChange={(e) =>
              setNewOffer({ ...newOffer, title: e.target.value })
            }
            className="p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-[#1E293B] border border-white/10 shadow-2xl"
          />
          <select
            value={newOffer.mediaType}
            onChange={(e) =>
              setNewOffer({ ...newOffer, mediaType: e.target.value as any })
            }
            className="p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-[#1E293B] border border-white/10 shadow-2xl"
          >
            <option value="none">No Media (Text Banner)</option>
            <option value="image">Image Background</option>
            <option value="video">Autoplaying Video</option>
          </select>

          {newOffer.mediaType !== "none" && (
            <div className="md:col-span-2">
              <input
                type="url"
                placeholder={`Paste ${newOffer.mediaType} URL here...`}
                required
                value={newOffer.mediaUrl}
                onChange={(e) =>
                  setNewOffer({ ...newOffer, mediaUrl: e.target.value })
                }
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-[#1E293B] border border-white/10 shadow-2xl"
              />
            </div>
          )}

          <div className="md:col-span-2">
            <textarea
              placeholder="Offer Description (e.g. Get 20% off on all large pizzas this weekend only!)"
              required
              value={newOffer.description}
              onChange={(e) =>
                setNewOffer({ ...newOffer, description: e.target.value })
              }
              className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-[#1E293B] border border-white/10 shadow-2xl h-24"
            />
          </div>

          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              className="bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl px-8 py-3 transition-colors shadow-md"
            >
              Publish Offer
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 gap-6">
        {offers.length === 0 && !isAdding && (
          <div className="text-center p-12 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 font-medium">
            No offers currently active. Create one to boost your sales!
          </div>
        )}

        {offers.map((offer) => (
          <div
            key={offer.id}
            className={`bg-[#1E293B] border border-white/10 shadow-xl rounded-2xl overflow-hidden flex flex-col md:flex-row transition-opacity ${!offer.isActive ? "opacity-100" : ""}`}
          >
            {/* Media Preview */}
            <div className="w-full md:w-64 h-48 bg-slate-200 dark:bg-slate-800 relative flex-shrink-0">
              {offer.mediaType === "image" && offer.mediaUrl ? (
                <img
                  src={offer.mediaUrl}
                  alt={offer.title}
                  className="w-full h-full object-cover"
                />
              ) : offer.mediaType === "video" && offer.mediaUrl ? (
                <video
                  src={offer.mediaUrl}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary-500 to-primary-800 flex items-center justify-center p-6 text-center">
                  <span className="text-white font-black text-2xl drop-shadow-md">
                    {offer.title}
                  </span>
                </div>
              )}

              {!offer.isActive && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="bg-slate-800 text-white px-3 py-1 rounded-full font-bold text-sm tracking-wider uppercase">
                    Paused
                  </span>
                </div>
              )}
            </div>

            {/* Content & Actions */}
            <div className="p-6 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-black text-2xl text-white">
                    {offer.title}
                  </h3>
                  <span className="text-xs font-bold text-slate-400 bg-[#0B0F14] border border-white/5 px-2 py-1 rounded-full uppercase tracking-wider">
                    {offer.mediaType === "none"
                      ? "Text Banner"
                      : offer.mediaType}
                  </span>
                </div>
                <p className="text-slate-300 dark:text-slate-300 mb-4">
                  {offer.description}
                </p>
              </div>

              <div className="flex gap-3 justify-end mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => toggleActive(offer.id!, offer.isActive)}
                  className={`px-6 py-2 rounded-lg font-bold transition-colors ${
                    offer.isActive
                      ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                      : "bg-green-100 text-green-700 hover:bg-green-200"
                  }`}
                >
                  {offer.isActive ? "Pause Offer" : "Activate Offer"}
                </button>
                <button
                  onClick={() => deleteOffer(offer.id!)}
                  className="bg-slate-100 text-slate-400 hover:bg-red-500 hover:text-white px-4 py-2 rounded-lg font-bold transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
