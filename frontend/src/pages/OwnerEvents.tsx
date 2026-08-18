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
  getDocs,
} from 'firebase/firestore';
import { MenuItem } from '../types/models';

export default function OwnerEvents() {
  const [events, setEvents] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  const [newEvent, setNewEvent] = useState({
    name: "",
    startDate: "",
    endDate: "",
    adBars: [] as {
      title: string;
      description: string;
      mediaType: "none" | "image" | "video";
      mediaUrl: string;
    }[],
    coupons: [] as {
      code: string;
      type: "percent" | "flat";
      value: number;
      isFirstOrderOnly: boolean;
    }[],
    menuOverrides: {} as Record<string, { discountPercentage: number }>,
    isActive: true,
  });

  // Load Events & Menu
  useEffect(() => {
    const fetchInitialData = async () => {
      const menuSnap = await getDocs(collection(db, "menu"));
      setMenuItems(
        menuSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as MenuItem),
      );
    };
    fetchInitialData();

    const q = query(collection(db, "events"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEvents(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "events"), {
        ...newEvent,
        startDate: new Date(newEvent.startDate).getTime(),
        endDate: new Date(newEvent.endDate).getTime(),
        createdAt: Date.now(),
      });
      setIsAdding(false);
      setNewEvent({
        name: "",
        startDate: "",
        endDate: "",
        adBars: [],
        coupons: [],
        menuOverrides: {},
        isActive: true,
      });
    } catch (error) {
      console.error("Error creating event", error);
    }
  };

  const deleteEvent = async (id: string) => {
    if (!window.confirm("Delete this event?")) return;
    try {
      await deleteDoc(doc(db, "events", id));
    } catch (e) {
      console.error(e);
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, "events", id), { isActive: !currentStatus });
    } catch (e) {
      console.error(e);
    }
  };

  if (loading)
    return (
      <div className="p-8 font-bold text-center animate-pulse">
        Loading Events...
      </div>
    );

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-white">Events Engine</h1>
          <p className="text-slate-400">
            Automate campaigns, discounts, and banners for specific dates.
          </p>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="bg-primary-500 hover:bg-primary-600 text-white font-bold px-6 py-3 rounded-xl transition-colors shadow-sm"
        >
          {isAdding ? "Cancel" : "+ Create Event"}
        </button>
      </div>

      {isAdding && (
        <form
          onSubmit={handleCreate}
          className="bg-[#1E293B] border border-white/10 shadow-xl rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-top-4"
        >
          {/* 1. Event Basics */}
          <div className="space-y-4 md:col-span-2">
            <h3 className="font-bold text-lg border-b pb-2">
              1. Event Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input
                type="text"
                placeholder="Event Name (e.g. Diwali Sale)"
                required
                value={newEvent.name}
                onChange={(e) =>
                  setNewEvent({ ...newEvent, name: e.target.value })
                }
                className="p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-[#1E293B] border border-white/10 shadow-2xl"
              />
              <div className="flex flex-col">
                <label className="text-xs font-bold text-slate-400 ml-1">
                  Start Date
                </label>
                <input
                  type="date"
                  required
                  value={newEvent.startDate}
                  onChange={(e) =>
                    setNewEvent({ ...newEvent, startDate: e.target.value })
                  }
                  className="p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-[#1E293B] border border-white/10 shadow-2xl"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-bold text-slate-400 ml-1">
                  End Date
                </label>
                <input
                  type="date"
                  required
                  value={newEvent.endDate}
                  onChange={(e) =>
                    setNewEvent({ ...newEvent, endDate: e.target.value })
                  }
                  className="p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-[#1E293B] border border-white/10 shadow-2xl"
                />
              </div>
            </div>
          </div>

          {/* 2. Ad Bars */}
          <div className="space-y-4 md:col-span-2 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-white/10">
            <div className="flex justify-between items-center border-b pb-2 border-white/10">
              <h3 className="font-bold text-lg">
                2. Ad Bars (Promotional Banners)
              </h3>
              <button
                type="button"
                onClick={() =>
                  setNewEvent({
                    ...newEvent,
                    adBars: [
                      ...newEvent.adBars,
                      {
                        title: "",
                        description: "",
                        mediaType: "none",
                        mediaUrl: "",
                      },
                    ],
                  })
                }
                className="text-sm bg-slate-200 dark:bg-slate-700 px-3 py-1 rounded font-bold hover:bg-slate-300 dark:hover:bg-slate-600"
              >
                + Add Banner
              </button>
            </div>

            {newEvent.adBars.map((bar, index) => (
              <div
                key={index}
                className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#1E293B] border border-white/10 shadow-2xl p-4 rounded-lg shadow-sm border border-white/10"
              >
                <input
                  type="text"
                  placeholder="Title (MEGA DEAL!)"
                  value={bar.title}
                  onChange={(e) => {
                    const bars = [...newEvent.adBars];
                    bars[index].title = e.target.value;
                    setNewEvent({ ...newEvent, adBars: bars });
                  }}
                  className="p-2 border rounded"
                  required
                />
                <select
                  value={bar.mediaType}
                  onChange={(e) => {
                    const bars = [...newEvent.adBars];
                    bars[index].mediaType = e.target.value as any;
                    setNewEvent({ ...newEvent, adBars: bars });
                  }}
                  className="p-2 border rounded"
                >
                  <option value="none">No Media (Text Banner)</option>
                  <option value="image">Image Background</option>
                  <option value="video">Autoplay Video</option>
                </select>
                {bar.mediaType !== "none" && (
                  <input
                    type="url"
                    placeholder="Media URL"
                    value={bar.mediaUrl}
                    onChange={(e) => {
                      const bars = [...newEvent.adBars];
                      bars[index].mediaUrl = e.target.value;
                      setNewEvent({ ...newEvent, adBars: bars });
                    }}
                    className="p-2 border rounded md:col-span-2"
                    required
                  />
                )}
                <input
                  type="text"
                  placeholder="Description"
                  value={bar.description}
                  onChange={(e) => {
                    const bars = [...newEvent.adBars];
                    bars[index].description = e.target.value;
                    setNewEvent({ ...newEvent, adBars: bars });
                  }}
                  className="p-2 border rounded md:col-span-2"
                  required
                />
              </div>
            ))}
            {newEvent.adBars.length === 0 && (
              <p className="text-slate-400 text-sm">
                No banners added for this event.
              </p>
            )}
          </div>

          {/* 3. Coupons */}
          <div className="space-y-4 md:col-span-2 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-white/10">
            <div className="flex justify-between items-center border-b pb-2 border-white/10">
              <h3 className="font-bold text-lg">3. Coupons & Promo Codes</h3>
              <button
                type="button"
                onClick={() =>
                  setNewEvent({
                    ...newEvent,
                    coupons: [
                      ...newEvent.coupons,
                      {
                        code: "",
                        type: "percent",
                        value: 0,
                        isFirstOrderOnly: false,
                      },
                    ],
                  })
                }
                className="text-sm bg-slate-200 dark:bg-slate-700 px-3 py-1 rounded font-bold hover:bg-slate-300 dark:hover:bg-slate-600"
              >
                + Add Coupon
              </button>
            </div>

            {newEvent.coupons.map((coupon, index) => (
              <div key={index} className="flex gap-2 items-center flex-wrap">
                <input
                  type="text"
                  placeholder="Code (e.g. DIWALI50)"
                  value={coupon.code}
                  onChange={(e) => {
                    const c = [...newEvent.coupons];
                    c[index].code = e.target.value.toUpperCase();
                    setNewEvent({ ...newEvent, coupons: c });
                  }}
                  className="p-2 border rounded flex-1 uppercase"
                  required
                />
                <select
                  value={coupon.type}
                  onChange={(e) => {
                    const c = [...newEvent.coupons];
                    c[index].type = e.target.value as any;
                    setNewEvent({ ...newEvent, coupons: c });
                  }}
                  className="p-2 border rounded w-32"
                >
                  <option value="percent">% Off</option>
                  <option value="flat">₹ Flat Off</option>
                </select>
                <input
                  type="number"
                  placeholder="Value"
                  value={coupon.value || ""}
                  onChange={(e) => {
                    const c = [...newEvent.coupons];
                    c[index].value = Number(e.target.value);
                    setNewEvent({ ...newEvent, coupons: c });
                  }}
                  className="p-2 border rounded w-24"
                  required
                />

                <label className="flex items-center gap-2 bg-[#1E293B] border border-white/10 shadow-sm p-2 rounded cursor-pointer whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={coupon.isFirstOrderOnly || false}
                    onChange={(e) => {
                      const c = [...newEvent.coupons];
                      c[index].isFirstOrderOnly = e.target.checked;
                      setNewEvent({ ...newEvent, coupons: c });
                    }}
                    className="accent-primary-500"
                  />
                  <span className="text-xs font-bold text-slate-300">
                    First Order Only
                  </span>
                </label>
              </div>
            ))}
            {newEvent.coupons.length === 0 && (
              <p className="text-slate-400 text-sm">
                No coupons added for this event.
              </p>
            )}
          </div>

          {/* 4. Menu Overrides */}
          <div className="space-y-4 md:col-span-2 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-white/10">
            <h3 className="font-bold text-lg border-b pb-2 border-white/10">
              4. Menu Discounts
            </h3>
            <p className="text-sm text-slate-400">
              Temporarily discount specific pizzas during the event.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
              {menuItems.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between items-center bg-[#1E293B] border border-white/10 shadow-2xl p-2 rounded border border-white/10"
                >
                  <span className="text-sm font-bold truncate flex-1">
                    {item.name}
                  </span>
                  <div className="flex items-center gap-1 w-24">
                    <input
                      type="number"
                      placeholder="%"
                      value={
                        newEvent.menuOverrides[item.id!]?.discountPercentage ||
                        ""
                      }
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        const overrides = { ...newEvent.menuOverrides };
                        if (val > 0)
                          overrides[item.id!] = { discountPercentage: val };
                        else delete overrides[item.id!];
                        setNewEvent({ ...newEvent, menuOverrides: overrides });
                      }}
                      className="w-full p-1 border rounded text-sm text-center"
                    />
                    <span className="text-xs text-slate-400">off</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              className="bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl px-8 py-4 transition-colors shadow-lg text-lg w-full md:w-auto"
            >
              Schedule Event
            </button>
          </div>
        </form>
      )}

      {/* Events List */}
      <div className="space-y-6">
        {events.map((event) => {
          const now = Date.now();
          const isLive =
            event.isActive && event.startDate <= now && event.endDate >= now;
          const isUpcoming = event.isActive && event.startDate > now;
          const isPast = event.endDate < now;

          return (
            <div
              key={event.id}
              className={`bg-[#1E293B] border border-white/10 shadow-xl rounded-2xl p-6 border-l-8 ${isLive ? "border-green-500" : isUpcoming ? "border-blue-500" : "border-slate-400 opacity-100"}`}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-black">{event.name}</h2>
                    {isLive && (
                      <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full animate-pulse">
                        LIVE NOW
                      </span>
                    )}
                    {isUpcoming && (
                      <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full">
                        UPCOMING
                      </span>
                    )}
                    {isPast && (
                      <span className="bg-slate-200 text-slate-300 text-xs font-bold px-2 py-1 rounded-full">
                        ENDED
                      </span>
                    )}
                    {!event.isActive && (
                      <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-full">
                        PAUSED
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400 font-medium">
                    {new Date(event.startDate).toLocaleDateString()} to{" "}
                    {new Date(event.endDate).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleActive(event.id!, event.isActive)}
                    className="bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-lg font-bold text-sm"
                  >
                    {event.isActive ? "Pause" : "Resume"}
                  </button>
                  <button
                    onClick={() => deleteEvent(event.id!)}
                    className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg font-bold text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                <div>
                  <div className="text-sm font-bold text-slate-400 uppercase">
                    Ad Bars
                  </div>
                  <div className="text-xl font-black">
                    {event.adBars?.length || 0}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-400 uppercase">
                    Coupons
                  </div>
                  <div className="text-xl font-black">
                    {event.coupons?.length || 0}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-400 uppercase">
                    Item Discounts
                  </div>
                  <div className="text-xl font-black">
                    {Object.keys(event.menuOverrides || {}).length}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {events.length === 0 && !isAdding && (
          <div className="text-center p-12 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 font-medium">
            No events scheduled. Create one to run a campaign!
          </div>
        )}
      </div>
    </div>
  );
}
