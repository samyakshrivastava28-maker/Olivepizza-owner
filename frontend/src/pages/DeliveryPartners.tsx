import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  onSnapshot,
} from 'firebase/firestore';

export default function DeliveryPartners() {
  const [partners, setPartners] = useState<any[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // View Work Modal State
  const [selectedPartner, setSelectedPartner] = useState<any>(null);
  const [payoutRate, setPayoutRate] = useState(40);
  const [partnerWork, setPartnerWork] = useState<{
    delivered: any[];
    active: any[];
  }>({ delivered: [], active: [] });
  const [loadingWork, setLoadingWork] = useState(false);
  const [vehicleDetails, setVehicleDetails] = useState({
    type: "",
    number: "",
    image: "",
  });
  const [savingVehicle, setSavingVehicle] = useState(false);

  // Listen to all delivery partners live
  useEffect(() => {
    const q = query(
      collection(db, "users"),
      where("role", "==", "delivery_partner"),
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const livePartners = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setPartners(livePartners);
        setLoading(false);
      },
      (error) => {
        console.error("Failed to listen to delivery partners:", error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const handleAddPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionMessage(null);
    if (!emailInput.trim()) return;

    try {
      const q = query(
        collection(db, "users"),
        where("email", "==", emailInput.trim().toLowerCase()),
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setActionMessage({
          type: "error",
          text: "No registered user found with that email. They must create an account first.",
        });
        return;
      }

      for (const d of snapshot.docs) {
        if (d.data().role === "delivery_partner") {
          setActionMessage({
            type: "error",
            text: "User is already a delivery partner!",
          });
          return;
        }
        await updateDoc(doc(db, "users", d.id), {
          role: "delivery_partner",
          approvalStatus: "approved",
          status: "offline",
          joinedAt: new Date().toISOString(),
        });
      }

      setActionMessage({
        type: "success",
        text: `Successfully upgraded ${emailInput} to Delivery Partner!`,
      });
      setEmailInput("");
      setTimeout(() => setActionMessage(null), 5000);
    } catch (error) {
      console.error("Error adding partner:", error);
      setActionMessage({
        type: "error",
        text: "An error occurred while updating the user role.",
      });
    }
  };

  const handleRemovePartner = async (userId: string) => {
    if (
      !window.confirm(
        "Are you sure you want to demote this delivery partner back to a regular customer?",
      )
    )
      return;
    try {
      await updateDoc(doc(db, "users", userId), { role: "customer" });
      setActionMessage({
        type: "success",
        text: "Partner successfully demoted.",
      });
      setTimeout(() => setActionMessage(null), 5000);
    } catch (error) {
      console.error("Error removing partner:", error);
      setActionMessage({ type: "error", text: "Failed to demote partner." });
    }
  };

  const handleToggleApproval = async (
    userId: string,
    currentStatus: string,
  ) => {
    try {
      const newStatus = currentStatus === "approved" ? "suspended" : "approved";
      await updateDoc(doc(db, "users", userId), { approvalStatus: newStatus });
      setActionMessage({
        type: "success",
        text: `Partner successfully ${newStatus}.`,
      });
      setTimeout(() => setActionMessage(null), 5000);
    } catch (error) {
      console.error("Error toggling approval:", error);
      setActionMessage({
        type: "error",
        text: "Failed to update partner status.",
      });
    }
  };

  const openWorkModal = async (partner: any) => {
    setSelectedPartner(partner);
    setLoadingWork(true);
    try {
      const q = query(
        collection(db, "orders"),
        where("deliveryPartnerId", "==", partner.id),
      );
      const snapshot = await getDocs(q);
      const orders = snapshot.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as any,
      );

      setPartnerWork({
        delivered: orders.filter((o) => o.status === "delivered"),
        active: orders.filter((o) => o.status === "out_for_delivery"),
      });
      setVehicleDetails({
        type: partner.vehicleType || "",
        number: partner.vehicleNumber || "",
        image: partner.vehicleImage || "",
      });
    } catch (error) {
      console.error("Failed to fetch partner work", error);
    } finally {
      setLoadingWork(false);
    }
  };

  const handleSaveVehicle = async () => {
    if (!selectedPartner) return;
    setSavingVehicle(true);
    try {
      await updateDoc(doc(db, "users", selectedPartner.id), {
        vehicleType: vehicleDetails.type,
        vehicleNumber: vehicleDetails.number,
        vehicleImage: vehicleDetails.image,
      });
      alert("Vehicle details updated successfully!");
      // Update local partner object to reflect changes immediately
      setSelectedPartner({
        ...selectedPartner,
        vehicleType: vehicleDetails.type,
        vehicleNumber: vehicleDetails.number,
        vehicleImage: vehicleDetails.image,
      });
    } catch (error) {
      console.error("Error saving vehicle details:", error);
      alert("Failed to update vehicle details.");
    } finally {
      setSavingVehicle(false);
    }
  };

  if (loading)
    return (
      <div className="text-xl font-bold p-8 flex justify-center items-center h-64">
        <div className="animate-pulse text-primary-500">
          Loading Partners...
        </div>
      </div>
    );

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-white">Delivery Partners</h1>
        <p className="text-slate-400">
          Manage your delivery fleet. Promote existing customers to delivery
          partners by their email.
        </p>
      </div>

      {/* Add Partner Form */}
      <div className="bg-[#1E293B] border border-white/10 shadow-xl rounded-2xl p-6 border-l-4 border-primary-500">
        <h2 className="text-xl font-bold text-white mb-4">Add New Partner</h2>
        <form
          onSubmit={handleAddPartner}
          className="flex flex-col sm:flex-row gap-4"
        >
          <input
            type="email"
            placeholder="Enter user's exact email address..."
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            className="flex-1 p-3 border border-slate-300 dark:border-slate-700 rounded-xl bg-[#1E293B] border border-white/10 shadow-2xl focus:ring-2 focus:ring-primary-500 outline-none transition-shadow"
            required
          />
          <button
            type="submit"
            className="bg-primary-500 hover:bg-primary-600 text-white font-bold px-6 py-3 rounded-xl transition-colors shadow-sm whitespace-nowrap"
          >
            Upgrade to Partner
          </button>
        </form>
        {actionMessage && (
          <div
            className={`mt-4 p-3 rounded-lg font-bold text-sm ${actionMessage.type === "error" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}
          >
            {actionMessage.text}
          </div>
        )}
      </div>

      {/* Partners List */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          🛵 Active Fleet
          <span className="bg-slate-200 dark:bg-slate-700 text-slate-300 dark:text-slate-300 text-sm px-2 py-1 rounded-full">
            {partners.length}
          </span>
        </h2>

        <div className="grid grid-cols-1 gap-4">
          {partners.map((partner) => (
            <div
              key={partner.id}
              className="bg-[#1E293B] dark:bg-slate-800/50 p-6 rounded-xl flex flex-col md:flex-row justify-between items-center gap-4 border border-white/10 shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-2xl">
                  🛵
                </div>
                <div>
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    {partner.name || "Unknown Name"}
                    <span
                      className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full ${partner.approvalStatus === "approved" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                    >
                      {partner.approvalStatus || "pending"}
                    </span>
                  </h3>
                  <div className="text-slate-400 text-sm flex gap-4">
                    <span>📧 {partner.email}</span>
                    <span>📞 {partner.phone || "No phone"}</span>
                    {partner.joinedAt && (
                      <span>
                        📅 Joined:{" "}
                        {new Date(partner.joinedAt).toLocaleDateString()}
                      </span>
                    )}
                    {partner.metrics?.ratingCount > 0 && (
                      <span className="text-amber-400 font-bold flex items-center gap-1">
                        ⭐ {(partner.metrics.ratingSum / partner.metrics.ratingCount).toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                <button
                  onClick={() =>
                    handleToggleApproval(partner.id, partner.approvalStatus)
                  }
                  className={`px-4 py-2 rounded-lg font-bold transition-colors text-sm ${partner.approvalStatus === "approved" ? "text-orange-600 bg-orange-50 hover:bg-orange-100" : "text-green-600 bg-green-50 hover:bg-green-100"}`}
                >
                  {partner.approvalStatus === "approved"
                    ? "Suspend"
                    : "Approve"}
                </button>
                <button
                  onClick={() => openWorkModal(partner)}
                  className="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 px-4 py-2 rounded-lg font-bold transition-colors text-sm"
                >
                  View Work
                </button>
                <button
                  onClick={() => handleRemovePartner(partner.id)}
                  className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 px-4 py-2 rounded-lg font-bold transition-colors text-sm"
                >
                  Demote
                </button>
              </div>
            </div>
          ))}
          {partners.length === 0 && (
            <div className="text-slate-400 font-medium p-12 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
              No delivery partners assigned yet. Add one above!
            </div>
          )}
        </div>
      </div>

      {/* VIEW WORK MODAL */}
      {selectedPartner && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1E293B] border border-white/10 shadow-2xl rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-white/10">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center sticky top-0 bg-[#1E293B] border border-white/10 shadow-2xl z-10">
              <div>
                <h2 className="text-2xl font-black">Work Profile</h2>
                <p className="text-slate-400 font-medium">
                  {selectedPartner.name || selectedPartner.email}
                </p>
              </div>
              <button
                onClick={() => setSelectedPartner(null)}
                className="text-slate-400 hover:text-slate-300 text-3xl font-bold leading-none"
              >
                &times;
              </button>
            </div>

            <div className="p-6 space-y-8">
              {/* Payout Settings */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-white/10 flex justify-between items-center">
                <span className="font-bold text-slate-200">
                  Payout per Delivery (₹)
                </span>
                <input
                  type="number"
                  value={payoutRate}
                  onChange={(e) => setPayoutRate(Number(e.target.value) || 0)}
                  className="w-24 p-2 border border-slate-300 dark:border-slate-600 rounded-lg text-center font-bold bg-[#1E293B] border border-white/10 shadow-2xl"
                />
              </div>

              {/* Vehicle Details */}
              <div className="bg-[#1E293B] border border-white/10 p-5 rounded-2xl shadow-xl">
                <h3 className="font-bold text-lg text-white mb-4 border-b border-white/10 pb-2">
                  Vehicle Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">
                      Vehicle Type (e.g., Bike, Scooter)
                    </label>
                    <input
                      type="text"
                      value={vehicleDetails.type}
                      onChange={(e) =>
                        setVehicleDetails({
                          ...vehicleDetails,
                          type: e.target.value,
                        })
                      }
                      className="w-full bg-dark-900 border border-dark-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">
                      Vehicle Number
                    </label>
                    <input
                      type="text"
                      value={vehicleDetails.number}
                      onChange={(e) =>
                        setVehicleDetails({
                          ...vehicleDetails,
                          number: e.target.value,
                        })
                      }
                      className="w-full bg-dark-900 border border-dark-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-primary-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-400 mb-1">
                      Vehicle Image URL
                    </label>
                    <input
                      type="url"
                      value={vehicleDetails.image}
                      onChange={(e) =>
                        setVehicleDetails({
                          ...vehicleDetails,
                          image: e.target.value,
                        })
                      }
                      placeholder="https://..."
                      className="w-full bg-dark-900 border border-dark-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-primary-500"
                    />
                  </div>
                </div>
                <button
                  onClick={handleSaveVehicle}
                  disabled={savingVehicle}
                  className="mt-4 bg-primary-600 hover:bg-primary-500 text-white font-bold px-6 py-2 rounded-xl transition-colors disabled:opacity-50"
                >
                  {savingVehicle ? "Saving..." : "Save Vehicle Details"}
                </button>
              </div>

              {loadingWork ? (
                <div className="text-center font-bold text-primary-500 animate-pulse">
                  Loading work data...
                </div>
              ) : (
                <>
                  {/* Summary Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-[#1E293B] border border-white/10 shadow-xl rounded-2xl p-4 text-center border-b-4 border-green-500">
                      <div className="text-sm font-bold text-slate-400 uppercase">
                        Deliveries Completed
                      </div>
                      <div className="text-3xl font-black text-white">
                        {partnerWork.delivered.length}
                      </div>
                    </div>
                    <div className="bg-[#1E293B] border border-white/10 shadow-xl rounded-2xl p-4 text-center border-b-4 border-amber-500">
                      <div className="text-sm font-bold text-slate-400 uppercase">
                        Avg Rating
                      </div>
                      <div className="text-3xl font-black text-amber-400 flex items-center justify-center gap-1">
                        {selectedPartner.metrics?.ratingCount ? (selectedPartner.metrics.ratingSum / selectedPartner.metrics.ratingCount).toFixed(1) : "N/A"}
                        <span className="text-lg">⭐</span>
                      </div>
                    </div>
                    <div className="bg-[#1E293B] border border-white/10 shadow-xl rounded-2xl p-4 text-center border-b-4 border-blue-500">
                      <div className="text-sm font-bold text-slate-400 uppercase">
                        Total Payout Earned
                      </div>
                      <div className="text-3xl font-black text-blue-400">
                        ₹{partnerWork.delivered.length * payoutRate}
                      </div>
                    </div>
                    <div className="bg-[#1E293B] border border-white/10 shadow-xl rounded-2xl p-4 text-center border-b-4 border-yellow-500 col-span-2">
                      <div className="text-sm font-bold text-slate-400 uppercase">
                        Active Deliveries Right Now
                      </div>
                      <div className="text-2xl font-black">
                        {partnerWork.active.length}
                      </div>
                    </div>
                  </div>

                  {/* Recent Deliveries */}
                  <div>
                    <h3 className="font-bold text-lg mb-3">
                      Recent Deliveries
                    </h3>
                    <div className="space-y-3">
                      {partnerWork.delivered.length === 0 && (
                        <p className="text-slate-400 italic">
                          No deliveries completed yet.
                        </p>
                      )}
                      {partnerWork.delivered.slice(0, 5).map((order) => (
                        <div
                          key={order.id}
                          className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700"
                        >
                          <div>
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-800 dark:text-slate-100">
                                {order.dailyOrderNumber || `Order #${order.id?.slice(-6).toUpperCase()}`}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono mt-0.5">ID: {order.id}</span>
                            </div>
                            <span className="text-xs text-slate-400 block">
                              {new Date(order.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <span className="font-bold text-green-600">
                            Delivered
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
