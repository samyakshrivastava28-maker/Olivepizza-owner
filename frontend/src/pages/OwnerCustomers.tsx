import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, getDocs, limit, orderBy } from 'firebase/firestore';
import { Search } from 'lucide-react';

export default function OwnerCustomers() {
  const [identities, setIdentities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchPhone, setSearchPhone] = useState("");

  useEffect(() => {
    const fetchIdentities = async () => {
      try {
        const q = query(
          collection(db, "customer_identities"),
          orderBy("createdAt", "desc"),
          limit(100),
        );
        const snap = await getDocs(q);
        setIdentities(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error fetching customer identities", error);
      } finally {
        setLoading(false);
      }
    };
    fetchIdentities();
  }, []);

  const filteredIdentities = identities.filter((id) =>
    id.id.includes(searchPhone),
  );

  if (loading)
    return (
      <div className="p-8 font-bold text-center animate-pulse">
        Loading Customer Identities...
      </div>
    );

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex justify-between items-end flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black text-white">
            Customer Identity Ledger
          </h1>
          <p className="text-slate-400">
            Strictly track one customer per phone number to prevent coupon
            abuse.
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Phone Number..."
            value={searchPhone}
            onChange={(e) => setSearchPhone(e.target.value)}
            className="pl-10 pr-4 py-2 bg-[#1E293B] border border-white/10 rounded-xl text-white focus:outline-none focus:border-primary-500 w-64 shadow-xl"
          />
        </div>
      </div>

      <div className="bg-[#1E293B] border border-white/10 shadow-xl rounded-2xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#0B0F14] border border-white/5 text-slate-300 text-sm tracking-wider uppercase">
              <th className="p-4 font-bold border-b border-white/10">
                Phone Number (ID)
              </th>
              <th className="p-4 font-bold border-b border-white/10">
                Primary Email
              </th>
              <th className="p-4 font-bold border-b border-white/10 text-center">
                First Order Used?
              </th>
              <th className="p-4 font-bold border-b border-white/10 text-right">
                Total Orders
              </th>
              <th className="p-4 font-bold border-b border-white/10 text-right">
                Total Spent
              </th>
              <th className="p-4 font-bold border-b border-white/10 text-right">
                Joined
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredIdentities.map((c) => (
              <tr
                key={c.id}
                className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <td className="p-4 font-black text-white">{c.id}</td>
                <td className="p-4 text-slate-300 text-sm">
                  {c.primaryEmail || "Unknown"}
                </td>
                <td className="p-4 text-center">
                  {c.firstOrderCouponUsed ? (
                    <span className="bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                      Yes ({c.firstOrderCouponCode})
                    </span>
                  ) : (
                    <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                      Available
                    </span>
                  )}
                </td>
                <td className="p-4 text-slate-300 text-right font-bold">
                  {c.totalOrders || 0}
                </td>
                <td className="p-4 text-slate-300 text-right font-bold text-accent-400">
                  ₹{c.totalSpent || 0}
                </td>
                <td className="p-4 text-slate-400 text-right text-sm">
                  {c.createdAt
                    ? new Date(c.createdAt).toLocaleDateString()
                    : "Unknown"}
                </td>
              </tr>
            ))}
            {filteredIdentities.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="p-8 text-center text-slate-400 font-medium"
                >
                  No customer identities found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
