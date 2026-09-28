import React, { useState, useEffect } from 'react';
import { fetchApi } from '../lib/api';
import { TableSkeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { StatCard } from '../components/ui/StatCard';
import {
  UserCheck,
  UserX,
  Clock,
  Shield,
  Building2,
  Store,
  Bike,
  Search,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Power,
  Users
} from 'lucide-react';
import toast from 'react-hot-toast';

export interface PendingAccount {
  id: string;
  uid: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  targetApp: string;
  appLabel: string;
  franchiseId?: string;
  branchId?: string;
  branchName?: string;
  terminalId?: string;
  status: string;
  createdAt: string;
  invitedBy?: string;
}

export interface StaffAccount {
  id: string;
  uid: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  targetApp: string;
  appLabel: string;
  franchiseId?: string;
  branchId?: string;
  branchName?: string;
  terminalId?: string;
  status: string;
  isActive: boolean;
  createdAt?: string;
  approvedAt?: string;
}

export default function AccountApprovals() {
  const [activeTab, setActiveTab] = useState<'pending' | 'active' | 'all'>('pending');
  const [pendingList, setPendingList] = useState<PendingAccount[]>([]);
  const [allAccounts, setAllAccounts] = useState<StaffAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Reject Modal State
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedForReject, setSelectedForReject] = useState<PendingAccount | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processingAction, setProcessingAction] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [pendingRes, allRes] = await Promise.all([
        fetchApi('/api/admin/accounts/pending'),
        fetchApi('/api/admin/accounts')
      ]);

      if (pendingRes.ok) {
        const pendingData = await pendingRes.json();
        setPendingList(pendingData.pending || []);
      } else {
        throw new Error('Failed to load pending account approvals');
      }

      if (allRes.ok) {
        const allData = await allRes.json();
        setAllAccounts(allData.accounts || []);
      }
    } catch (err: any) {
      console.error('[AccountApprovals] Error fetching data:', err);
      setError(err.message || 'Could not fetch operational accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApprove = async (acc: PendingAccount) => {
    setProcessingAction(true);
    try {
      const res = await fetchApi('/api/admin/accounts/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: acc.uid,
          email: acc.email,
          role: acc.role,
          targetApp: acc.targetApp,
          franchiseId: acc.franchiseId,
          branchId: acc.branchId
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to approve account');

      toast.success(`${acc.name} (${acc.appLabel}) has been approved!`);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Approval failed');
    } finally {
      setProcessingAction(false);
    }
  };

  const handleOpenReject = (acc: PendingAccount) => {
    setSelectedForReject(acc);
    setRejectReason('');
    setRejectModalOpen(true);
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedForReject) return;

    setProcessingAction(true);
    try {
      const res = await fetchApi('/api/admin/accounts/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: selectedForReject.uid,
          email: selectedForReject.email,
          targetApp: selectedForReject.targetApp,
          reason: rejectReason.trim() || 'Application rejected by platform owner'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reject account');

      toast.success(`Account request for ${selectedForReject.name} was rejected.`);
      setRejectModalOpen(false);
      setSelectedForReject(null);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Rejection failed');
    } finally {
      setProcessingAction(false);
    }
  };

  const handleToggleStatus = async (acc: StaffAccount) => {
    const nextActive = !acc.isActive;
    try {
      const res = await fetchApi('/api/admin/accounts/toggle-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: acc.uid,
          email: acc.email,
          targetApp: acc.targetApp,
          isActive: nextActive
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to toggle account status');

      toast.success(`${acc.name} is now ${nextActive ? 'Active' : 'Disabled'}`);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Status toggle failed');
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'restaurant_manager':
        return <Store className="w-4 h-4 text-emerald-400" />;
      case 'pos_operator':
        return <Shield className="w-4 h-4 text-blue-400" />;
      case 'franchise_manager':
        return <Building2 className="w-4 h-4 text-amber-400" />;
      case 'delivery_partner':
        return <Bike className="w-4 h-4 text-purple-400" />;
      default:
        return <Users className="w-4 h-4 text-slate-400" />;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'restaurant_manager':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'pos_operator':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'franchise_manager':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'delivery_partner':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  // Filtered lists
  const filteredPending = pendingList.filter((acc) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      acc.name.toLowerCase().includes(q) ||
      acc.email.toLowerCase().includes(q) ||
      (acc.phone && acc.phone.includes(q));
    const matchesRole = roleFilter === 'all' || acc.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const activeStaff = allAccounts.filter((a) => a.isActive);
  const inactiveStaff = allAccounts.filter((a) => !a.isActive);

  const filteredStaff = (activeTab === 'active' ? activeStaff : allAccounts).filter((acc) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      acc.name.toLowerCase().includes(q) ||
      acc.email.toLowerCase().includes(q) ||
      (acc.phone && acc.phone.includes(q));
    const matchesRole = roleFilter === 'all' || acc.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-white">Staff & Account Approvals</h1>
            {pendingList.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-black animate-pulse">
                {pendingList.length} Pending
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Owner authorization hub: Verify, approve, and manage operational accounts across all applications.
          </p>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Database</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Pending Approvals"
          value={pendingList.length}
          subtitle="Awaiting owner review"
          icon={Clock}
          color={pendingList.length > 0 ? 'orange' : 'slate'}
        />
        <StatCard
          title="Active Staff"
          value={activeStaff.length}
          subtitle="Operating live in branches"
          icon={UserCheck}
          color="green"
        />
        <StatCard
          title="Total Registered"
          value={allAccounts.length}
          subtitle="Across all applications"
          icon={Users}
          color="blue"
        />
        <StatCard
          title="Deactivated / Inactive"
          value={inactiveStaff.length}
          subtitle="Revoked or disabled"
          icon={UserX}
          color="red"
        />
      </div>

      {/* Navigation Tabs & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0E1524] p-3 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'pending'
                ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Pending Verification</span>
            {pendingList.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                activeTab === 'pending' ? 'bg-black text-amber-400' : 'bg-amber-500/20 text-amber-400'
              }`}>
                {pendingList.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('active')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'active'
                ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Active Staff ({activeStaff.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>All Records ({allAccounts.length})</span>
          </button>
        </div>

        {/* Search & Role Filter */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search staff..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-[#070A10] border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-[#070A10] border border-slate-800 text-slate-300 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-orange-500"
          >
            <option value="all">All Roles</option>
            <option value="restaurant_manager">Restaurant Manager</option>
            <option value="pos_operator">POS Operator</option>
            <option value="franchise_manager">Franchise Manager</option>
            <option value="delivery_partner">Delivery Rider</option>
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <TableSkeleton rows={5} />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchData} />
      ) : activeTab === 'pending' ? (
        /* PENDING APPROVALS LIST */
        filteredPending.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="All Caught Up!"
            description={
              searchQuery || roleFilter !== 'all'
                ? 'No pending accounts match your filter criteria.'
                : 'There are no pending operational account requests waiting for approval.'
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {filteredPending.map((acc) => (
              <div
                key={acc.id}
                className="bg-[#0E1524] border border-amber-500/30 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4 hover:border-amber-500/60 transition-colors shadow-lg shadow-black/40"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-slate-800 border border-slate-700">
                        {getRoleIcon(acc.role)}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">{acc.name}</h3>
                        <p className="text-xs text-slate-400 font-mono">{acc.email}</p>
                      </div>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${getRoleBadge(acc.role)}`}>
                      {acc.appLabel}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs bg-[#070A10] p-2.5 rounded-xl border border-slate-800/80">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block font-bold">Branch / Scope</span>
                      <span className="text-slate-300 font-medium">{acc.branchName || acc.branchId || 'Primary Branch'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block font-bold">Contact Phone</span>
                      <span className="text-slate-300 font-mono">{acc.phone || 'Not provided'}</span>
                    </div>
                    {acc.terminalId && (
                      <div className="col-span-2">
                        <span className="text-[10px] text-slate-500 uppercase block font-bold">Terminal ID</span>
                        <span className="text-slate-300 font-mono">{acc.terminalId}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3 text-amber-500" />
                    <span>Requested: {new Date(acc.createdAt).toLocaleDateString()}</span>
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenReject(acc)}
                      disabled={processingAction}
                      className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleApprove(acc)}
                      disabled={processingAction}
                      className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-xs transition-all shadow-md shadow-emerald-500/20 active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* ACTIVE & ALL STAFF TABLE */
        filteredStaff.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No Staff Accounts Found"
            description="No operational staff records match your current search or filters."
          />
        ) : (
          <div className="bg-[#0E1524] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#070A10] border-b border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-4">Application & Role</th>
                    <th className="py-3 px-4">Branch / Scope</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Approved At</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredStaff.map((staff) => (
                    <tr key={staff.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{staff.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{staff.email}</div>
                        {staff.phone && <div className="text-[10px] text-slate-500 font-mono">{staff.phone}</div>}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {getRoleIcon(staff.role)}
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${getRoleBadge(staff.role)}`}>
                            {staff.appLabel}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        <div>{staff.branchName || staff.branchId || 'Primary Branch'}</div>
                        {staff.terminalId && (
                          <div className="text-[10px] text-slate-500 font-mono">Terminal: {staff.terminalId}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {staff.isActive ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                            <XCircle className="w-3 h-3 text-red-400" />
                            Disabled
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                        {staff.approvedAt ? new Date(staff.approvedAt).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleToggleStatus(staff)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            staff.isActive
                              ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30'
                              : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          <Power className="w-3 h-3" />
                          <span>{staff.isActive ? 'Deactivate' : 'Activate'}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Reject Reason Modal */}
      <Modal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Reject Account Request"
        maxWidth="max-w-md"
      >
        {selectedForReject && (
          <form onSubmit={handleConfirmReject} className="space-y-4">
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300">
              Are you sure you want to reject the application for{' '}
              <strong className="text-white">{selectedForReject.name}</strong> ({selectedForReject.email}) as{' '}
              <span className="font-bold text-amber-400">{selectedForReject.appLabel}</span>?
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Reason for Rejection (Optional)</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Unverified identity, duplicate application, or store limit reached."
                rows={3}
                className="w-full p-2.5 bg-[#070A10] border border-slate-800 rounded-xl text-xs text-white focus:border-red-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={processingAction}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
