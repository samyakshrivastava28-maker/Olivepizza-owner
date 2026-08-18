import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { logActivity } from '../lib/logger';
import { useAuthStore } from '../lib/store';
import { getScheduleStatus, getItemExpiryDate, getItemStartDate } from '../lib/scheduling';

export default function OwnerCoupons() {
  const { user } = useAuthStore();
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  const [newCoupon, setNewCoupon] = useState<any>({
    code: "",
    type: "percentage",
    discountValue: 0,
    minOrderValue: 0,
    maxDiscount: 0,
    isActive: true,
    startDate: "",
    endDate: "",
    tiers: [],
    isFirstOrderOnly: false,
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "coupons"), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setCoupons(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "coupons"), {
        ...newCoupon,
        code: newCoupon.code.toUpperCase(),
        expiryDate: newCoupon.endDate || null,
        validUntil: newCoupon.endDate || null,
        createdAt: new Date().toISOString(),
      });
      await logActivity(
        "Coupon Created",
        `Created coupon ${newCoupon.code}`,
        user?.email || undefined,
      );
      setIsAdding(false);
      setNewCoupon({
        code: "",
        type: "percentage",
        discountValue: 0,
        minOrderValue: 0,
        maxDiscount: 0,
        isActive: true,
        startDate: "",
        endDate: "",
        tiers: [],
        isFirstOrderOnly: false,
      });
    } catch (error) {
      console.error("Error creating coupon", error);
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, "coupons", id), { isActive: !currentStatus });
      await logActivity(
        "Coupon Updated",
        `Coupon status changed to ${!currentStatus ? "Active" : "Inactive"}`,
        user?.email || undefined,
      );
    } catch (error) {
      console.error("Error toggling coupon", error);
    }
  };

  const deleteCoupon = async (id: string) => {
    if (!confirm("Are you sure you want to delete this coupon?")) return;
    try {
      await deleteDoc(doc(db, "coupons", id));
      await logActivity(
        "Coupon Updated",
        `Deleted coupon ${id}`,
        user?.email || undefined,
      );
    } catch (error) {
      console.error("Error deleting coupon", error);
    }
  };

  const addTier = () => {
    setNewCoupon({
      ...newCoupon,
      tiers: [...newCoupon.tiers, { minAmount: 0, discount: 0 }],
    });
  };

  const updateTier = (index: number, field: string, value: number) => {
    const updatedTiers = [...newCoupon.tiers];
    updatedTiers[index][field] = value;
    setNewCoupon({ ...newCoupon, tiers: updatedTiers });
  };

  const removeTier = (index: number) => {
    const updatedTiers = newCoupon.tiers.filter(
      (_: any, i: number) => i !== index,
    );
    setNewCoupon({ ...newCoupon, tiers: updatedTiers });
  };

  if (loading)
    return <div className="p-8 font-bold text-center">Loading Coupons...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">Coupons Management</h1>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-2 rounded-lg font-bold transition-colors"
        >
          {isAdding ? "Cancel" : "+ Create Coupon"}
        </button>
      </div>

      {isAdding && (
        <form
          onSubmit={handleCreate}
          className="bg-[#1E293B] dark:bg-slate-800 p-8 rounded-xl shadow-sm border border-white/10 grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          <div>
            <label className="text-sm font-bold text-slate-400 block mb-1">
              Coupon Code
            </label>
            <input
              type="text"
              required
              value={newCoupon.code}
              onChange={(e) =>
                setNewCoupon({ ...newCoupon, code: e.target.value })
              }
              className="w-full p-3 rounded-lg border dark:bg-slate-900 dark:border-slate-700 uppercase"
              placeholder="e.g. SAVE100"
            />
          </div>

          <div>
            <label className="text-sm font-bold text-slate-400 block mb-1">
              Discount Type
            </label>
            <select
              value={newCoupon.type}
              onChange={(e) =>
                setNewCoupon({ ...newCoupon, type: e.target.value })
              }
              className="w-full p-3 rounded-lg border dark:bg-slate-900 dark:border-slate-700"
            >
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed Amount (₹)</option>
              <option value="tier">Tier-Based</option>
              <option value="free_delivery">Free Delivery</option>
              <option value="first_order">First Order</option>
              <option value="bogo">Buy One Get One</option>
            </select>
          </div>

          {(newCoupon.type === "percentage" || newCoupon.type === "fixed") && (
            <>
              <div>
                <label className="text-sm font-bold text-slate-400 block mb-1">
                  Discount Value
                </label>
                <input
                  type="number"
                  required
                  value={newCoupon.discountValue}
                  onChange={(e) =>
                    setNewCoupon({
                      ...newCoupon,
                      discountValue: Number(e.target.value),
                    })
                  }
                  className="w-full p-3 rounded-lg border dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="text-sm font-bold text-slate-400 block mb-1">
                  Minimum Order Value (₹)
                </label>
                <input
                  type="number"
                  required
                  value={newCoupon.minOrderValue}
                  onChange={(e) =>
                    setNewCoupon({
                      ...newCoupon,
                      minOrderValue: Number(e.target.value),
                    })
                  }
                  className="w-full p-3 rounded-lg border dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
            </>
          )}

          {newCoupon.type === "percentage" && (
            <div>
              <label className="text-sm font-bold text-slate-400 block mb-1">
                Max Discount (₹)
              </label>
              <input
                type="number"
                value={newCoupon.maxDiscount}
                onChange={(e) =>
                  setNewCoupon({
                    ...newCoupon,
                    maxDiscount: Number(e.target.value),
                  })
                }
                className="w-full p-3 rounded-lg border dark:bg-slate-900 dark:border-slate-700"
              />
            </div>
          )}

          {newCoupon.type === "tier" && (
            <div className="md:col-span-2 space-y-4 border p-4 rounded-lg border-slate-300 dark:border-slate-700">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-700 dark:text-slate-200">
                  Discount Tiers
                </h3>
                <button
                  type="button"
                  onClick={addTier}
                  className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded font-bold hover:bg-blue-200"
                >
                  + Add Tier
                </button>
              </div>
              {newCoupon.tiers.map((tier: any, index: number) => (
                <div key={index} className="flex gap-4 items-end">
                  <div className="flex-1">
                    <label className="text-xs font-bold text-slate-400 block">
                      Min Amount (₹)
                    </label>
                    <input
                      type="number"
                      required
                      value={tier.minAmount}
                      onChange={(e) =>
                        updateTier(index, "minAmount", Number(e.target.value))
                      }
                      className="w-full p-2 rounded border dark:bg-slate-900 dark:border-slate-700"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-bold text-slate-400 block">
                      Discount (₹)
                    </label>
                    <input
                      type="number"
                      required
                      value={tier.discount}
                      onChange={(e) =>
                        updateTier(index, "discount", Number(e.target.value))
                      }
                      className="w-full p-2 rounded border dark:bg-slate-900 dark:border-slate-700"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeTier(index)}
                    className="p-2 bg-red-100 text-red-600 rounded font-bold hover:bg-red-200"
                  >
                    X
                  </button>
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="text-sm font-bold text-slate-400 block mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={newCoupon.startDate}
              onChange={(e) =>
                setNewCoupon({ ...newCoupon, startDate: e.target.value })
              }
              className="w-full p-3 rounded-lg border dark:bg-slate-900 dark:border-slate-700"
            />
          </div>

          <div>
            <label className="text-sm font-bold text-slate-400 block mb-1">
              End Date
            </label>
            <input
              type="date"
              value={newCoupon.endDate}
              onChange={(e) =>
                setNewCoupon({ ...newCoupon, endDate: e.target.value })
              }
              className="w-full p-3 rounded-lg border dark:bg-slate-900 dark:border-slate-700"
            />
          </div>

          <div className="md:col-span-2 flex items-center gap-3 bg-dark-900 border border-dark-800 p-4 rounded-xl">
            <input
              type="checkbox"
              id="isFirstOrderOnly"
              checked={newCoupon.isFirstOrderOnly}
              onChange={(e) =>
                setNewCoupon({
                  ...newCoupon,
                  isFirstOrderOnly: e.target.checked,
                })
              }
              className="w-5 h-5 accent-primary-500 rounded bg-dark-800 border-dark-700"
            />
            <label
              htmlFor="isFirstOrderOnly"
              className="font-bold text-slate-300 select-none cursor-pointer"
            >
              First Order Only (Enforce strictly by Phone Number)
            </label>
          </div>

          <button
            type="submit"
            className="md:col-span-2 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg p-4"
          >
            Save Coupon
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {coupons.map((coupon) => (
          <div
            key={coupon.id}
            className="bg-[#1E293B] dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-white/10 flex flex-col gap-4 relative overflow-hidden"
          >
            <div
              className={`absolute top-0 left-0 w-full h-1 ${coupon.isActive ? "bg-green-500" : "bg-slate-300"}`}
            ></div>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-black text-2xl text-white tracking-wider flex items-center gap-2">
                  {coupon.code}
                  {coupon.isFirstOrderOnly && (
                    <span className="text-[10px] bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded-full uppercase tracking-widest font-bold">
                      First Order
                    </span>
                  )}
                </h3>
                <p className="text-xs font-bold text-primary-600 uppercase tracking-widest mt-1">
                  {coupon.type.replace("_", " ")}
                </p>
              </div>

              {(() => {
                const status = getScheduleStatus(coupon);
                const badgeColor =
                  status.color === 'green' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                  status.color === 'red' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                  status.color === 'orange' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                  'bg-slate-500/20 text-slate-400 border-slate-500/30';
                return (
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${badgeColor}`}>
                    {status.label}
                  </span>
                );
              })()}
            </div>

            <div className="text-sm text-slate-300 space-y-1">
              {coupon.type === "percentage" && (
                <p>
                  Discount: {coupon.discountValue}% (Max: ₹{coupon.maxDiscount})
                </p>
              )}
              {coupon.type === "fixed" && (
                <p>Discount: ₹{coupon.discountValue}</p>
              )}
              {coupon.type === "tier" && (
                <div className="mt-2 text-xs border-t pt-2">
                  <p className="font-bold mb-1">Tiers:</p>
                  {coupon.tiers?.map((t: any, i: number) => (
                    <div
                      key={i}
                      className="flex justify-between border-b border-dashed border-white/10 py-1"
                    >
                      <span>≥ ₹{t.minAmount}</span>
                      <span className="font-bold text-green-600">
                        ₹{t.discount} OFF
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {coupon.minOrderValue > 0 && (
                <p>Min Order: ₹{coupon.minOrderValue}</p>
              )}
              {(() => {
                const expiry = getItemExpiryDate(coupon);
                if (!expiry) return null;
                const isPast = expiry < new Date();
                return (
                  <p className={`text-xs mt-2 font-medium ${isPast ? 'text-red-400 font-bold' : 'text-slate-400'}`}>
                    Expires: {expiry.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} {isPast ? '(Expired)' : ''}
                  </p>
                );
              })()}
            </div>

            <div className="flex gap-2 mt-auto pt-4 border-t border-slate-100 dark:border-slate-700">
              <button
                onClick={() => toggleActive(coupon.id, coupon.isActive)}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${coupon.isActive ? "bg-orange-100 text-orange-700 hover:bg-orange-200" : "bg-green-100 text-green-700 hover:bg-green-200"}`}
              >
                {coupon.isActive ? "Deactivate" : "Activate"}
              </button>
              <button
                onClick={() => deleteCoupon(coupon.id)}
                className="flex-1 py-2 text-xs font-bold rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
