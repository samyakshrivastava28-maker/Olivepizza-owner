import React, { useState, useEffect } from 'react';
import { fetchApi } from '../lib/config';
import toast from 'react-hot-toast';
import {
  ShieldCheck,
  FileText,
  HelpCircle,
  Trash2,
  Database,
  Clock,
  AlertOctagon,
  Activity,
  CheckCircle2,
  RefreshCw,
  Plus,
  Send,
  AlertTriangle,
  Lock,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

export default function PrivacyGovernance() {
  const [activeTab, setActiveTab] = useState<'policy' | 'grievances' | 'deletions' | 'processors' | 'retention' | 'incidents' | 'audit'>('policy');
  const [loading, setLoading] = useState(false);

  // Policy State
  const [policy, setPolicy] = useState<any>(null);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [newVersion, setNewVersion] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newSummary, setNewSummary] = useState('');
  const [newContent, setNewContent] = useState('');
  const [savingPolicy, setSavingPolicy] = useState(false);

  // Grievances State
  const [grievances, setGrievances] = useState<any[]>([]);
  const [selectedGrievance, setSelectedGrievance] = useState<any | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolutionStatus, setResolutionStatus] = useState<'in_review' | 'resolved' | 'closed'>('resolved');
  const [updatingGrievance, setUpdatingGrievance] = useState(false);

  // Deletions State
  const [deletions, setDeletions] = useState<any[]>([]);
  const [executingErasureUid, setExecutingErasureUid] = useState<string | null>(null);

  // Processors & Retention State
  const [processors, setProcessors] = useState<any[]>([]);
  const [retentionPolicies, setRetentionPolicies] = useState<any[]>([]);

  // Incidents State
  const [incidents, setIncidents] = useState<any[]>([]);
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [incTitle, setIncTitle] = useState('');
  const [incSeverity, setIncSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [incDescription, setIncDescription] = useState('');
  const [incSystems, setIncSystems] = useState('');
  const [incContainment, setIncContainment] = useState('');
  const [incRegulatory, setIncRegulatory] = useState(false);
  const [loggingIncident, setLoggingIncident] = useState(false);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'policy') {
        const res = await fetchApi('/api/privacy/policy');
        const data = await res.json();
        if (data.success && data.policy) setPolicy(data.policy);
      } else if (activeTab === 'grievances') {
        const res = await fetchApi('/api/privacy/admin/grievances');
        const data = await res.json();
        if (data.success) setGrievances(data.grievances || []);
      } else if (activeTab === 'deletions') {
        // Fetch deletion requests from audit or dedicated endpoint
        const res = await fetchApi('/api/privacy/admin/audit-logs');
        const data = await res.json();
        if (data.success && Array.isArray(data.logs)) {
          const deletionLogs = data.logs.filter((l: any) => l.action?.includes('DELETION'));
          setDeletions(deletionLogs);
        }
      } else if (activeTab === 'processors') {
        const res = await fetchApi('/api/privacy/admin/processors');
        const data = await res.json();
        if (data.success) setProcessors(data.processors || []);
      } else if (activeTab === 'retention') {
        const res = await fetchApi('/api/privacy/admin/retention');
        const data = await res.json();
        if (data.success) setRetentionPolicies(data.retention || []);
      } else if (activeTab === 'incidents') {
        const res = await fetchApi('/api/privacy/admin/incidents');
        const data = await res.json();
        if (data.success) setIncidents(data.incidents || []);
      } else if (activeTab === 'audit') {
        const res = await fetchApi('/api/privacy/admin/audit-logs');
        const data = await res.json();
        if (data.success) setAuditLogs(data.logs || []);
      }
    } catch (err: any) {
      console.warn('[PrivacyGovernance] Data fetch warning:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePublishPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVersion.trim() || !newTitle.trim() || !newContent.trim()) {
      toast.error('Version, title, and content are required.');
      return;
    }
    setSavingPolicy(true);
    try {
      const res = await fetchApi('/api/privacy/admin/policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: newVersion.trim(),
          title: newTitle.trim(),
          summary: newSummary.trim(),
          content: newContent
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to publish policy');

      toast.success(`Policy version ${newVersion} published successfully.`);
      setShowPolicyModal(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to publish policy.');
    } finally {
      setSavingPolicy(false);
    }
  };

  const handleResolveGrievance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGrievance) return;
    setUpdatingGrievance(true);
    try {
      const res = await fetchApi(`/api/privacy/admin/grievances/${selectedGrievance.ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: resolutionStatus,
          resolutionNotes
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update grievance');

      toast.success(`Ticket ${selectedGrievance.ticketId} updated.`);
      setSelectedGrievance(null);
      setResolutionNotes('');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update grievance.');
    } finally {
      setUpdatingGrievance(false);
    }
  };

  const handleExecuteErasure = async (targetUid: string) => {
    if (!window.confirm(`Are you sure you want to permanently erase customer profile for UID: ${targetUid}? Invoices will be pseudonymized.`)) {
      return;
    }
    setExecutingErasureUid(targetUid);
    try {
      const res = await fetchApi(`/api/privacy/admin/execute-erasure/${targetUid}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to execute erasure');

      toast.success('Account profile erased and historical invoices pseudonymized.');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to execute erasure.');
    } finally {
      setExecutingErasureUid(null);
    }
  };

  const handleLogIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incTitle.trim() || !incDescription.trim()) {
      toast.error('Incident title and description are required.');
      return;
    }
    setLoggingIncident(true);
    try {
      const res = await fetchApi('/api/privacy/admin/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: incTitle.trim(),
          severity: incSeverity,
          description: incDescription.trim(),
          affectedSystems: incSystems.split(',').map(s => s.trim()).filter(Boolean),
          containmentActions: incContainment.trim(),
          regulatoryNotificationRequired: incRegulatory
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to log incident');

      toast.success(`Security incident ${data.incidentId} recorded.`);
      setShowIncidentModal(false);
      setIncTitle('');
      setIncDescription('');
      setIncSystems('');
      setIncContainment('');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to log security incident.');
    } finally {
      setLoggingIncident(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <ShieldCheck className="w-7 h-7 text-rose-500" />
            <span>Privacy & Data Governance</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            DPDP Compliance Console • Data Subject Rights, Vendor Registry, Grievances, Retention & Breach Management
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2 transition-colors self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Records</span>
        </button>
      </div>

      {/* ── Navigation Tabs ─────────────────────────────────────────────────── */}
      <div className="flex bg-[#0E1524] p-1.5 rounded-2xl border border-slate-800 overflow-x-auto scrollbar-none gap-1">
        {[
          { id: 'policy', label: 'Privacy Policy', icon: FileText },
          { id: 'grievances', label: 'Grievance Redressal', icon: HelpCircle },
          { id: 'deletions', label: 'Erasure Requests', icon: Trash2 },
          { id: 'processors', label: 'Processor Registry', icon: Database },
          { id: 'retention', label: 'Retention Rules', icon: Clock },
          { id: 'incidents', label: 'Security Incidents', icon: AlertOctagon },
          { id: 'audit', label: 'Privacy Audit Trail', icon: Activity },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── TAB: PRIVACY POLICY ─────────────────────────────────────────────── */}
      {activeTab === 'policy' && (
        <div className="bg-[#0E1524] rounded-3xl p-6 border border-slate-800 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-black text-white">{policy?.title || 'Olive Pizza Privacy Notice'}</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Version {policy?.version || '1.0.0'} • Effective Date: {policy?.effectiveDate || '2026-06-30'}
              </p>
            </div>
            <button
              onClick={() => {
                setNewVersion(`1.${Date.now().toString().slice(-2)}.0`);
                setNewTitle(policy?.title || 'Olive Pizza Privacy Notice');
                setNewSummary(policy?.summary || '');
                setNewContent(policy?.content || '');
                setShowPolicyModal(true);
              }}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors self-start sm:self-auto cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Publish Revision</span>
            </button>
          </div>

          <div className="prose prose-invert prose-sm max-w-none text-slate-300 space-y-4">
            {policy?.content ? (
              policy.content.split('\n\n').map((para: string, idx: number) => {
                if (para.startsWith('###')) {
                  return (
                    <h4 key={idx} className="text-sm font-black text-rose-400 pt-2 border-t border-slate-800/80">
                      {para.replace(/###\s*/, '')}
                    </h4>
                  );
                }
                return <p key={idx} className="text-xs text-slate-400 leading-relaxed">{para}</p>;
              })
            ) : (
              <p className="text-xs text-slate-500">Loading active privacy notice...</p>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: GRIEVANCE REDRESSAL ────────────────────────────────────────── */}
      {activeTab === 'grievances' && (
        <div className="bg-[#0E1524] rounded-3xl p-6 border border-slate-800 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-white">Registered Customer Privacy Grievances</h3>
              <p className="text-xs text-slate-400 mt-0.5">Statutory 30-day response window under Section 13 of the DPDP Act</p>
            </div>
            <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-300 font-mono text-xs font-bold">
              {grievances.length} Tickets
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/60 text-slate-400 uppercase font-black text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Ticket ID</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">SLA Deadline</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {grievances.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">No active privacy grievances registered.</td>
                  </tr>
                ) : (
                  grievances.map((g, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-white">{g.ticketId}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-200">{g.customerName}</div>
                        <div className="text-[10px] text-slate-500">{g.customerContact}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-bold">
                          {g.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 max-w-xs truncate text-slate-400">{g.description}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-400">{g.slaDeadline ? g.slaDeadline.slice(0, 10) : '30 Days'}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full font-black text-[10px] uppercase ${
                          g.status === 'resolved' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40' : 'bg-amber-950 text-amber-400 border border-amber-800/40'
                        }`}>
                          {g.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedGrievance(g);
                            setResolutionNotes(g.resolutionNotes || '');
                          }}
                          className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors cursor-pointer"
                        >
                          Resolve
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB: ACCOUNT ERASURE & DELETION REQUESTS ────────────────────────── */}
      {activeTab === 'deletions' && (
        <div className="bg-[#0E1524] rounded-3xl p-6 border border-slate-800 space-y-6">
          <div>
            <h3 className="text-base font-black text-white">Account Erasure & Right to Deletion Queue</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Statutory 30-day cooling period before permanent personal data scrubbing. Invoices are retained with PII scrubbed for CGST tax compliance.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Automated Anonymization Safeguard</span>
              <p className="text-amber-200/80 leading-relaxed mt-0.5">
                Executing erasure scrubs customer name, phone, email, and addresses across Firestore while retaining order financial totals (subtotal, taxes, grand total) under Section 36 of the CGST Act.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/60 text-slate-400 uppercase font-black text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Actor UID</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Details</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4 text-right">Execute Erasure</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {deletions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">No active deletion requests in queue.</td>
                  </tr>
                ) : (
                  deletions.map((d, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-white">{d.actor}</td>
                      <td className="py-3.5 px-4 font-bold text-rose-400">{d.action}</td>
                      <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">{JSON.stringify(d.details || {})}</td>
                      <td className="py-3.5 px-4 text-slate-400">{d.timestamp ? d.timestamp.slice(0, 16).replace('T', ' ') : '-'}</td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleExecuteErasure(d.actor)}
                          disabled={executingErasureUid === d.actor}
                          className="px-3 py-1 rounded-lg bg-red-950 hover:bg-red-900 border border-red-800/50 text-red-300 text-xs font-bold transition-colors cursor-pointer"
                        >
                          {executingErasureUid === d.actor ? 'Erasing...' : 'Execute Erasure'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB: PROCESSOR REGISTRY ─────────────────────────────────────────── */}
      {activeTab === 'processors' && (
        <div className="bg-[#0E1524] rounded-3xl p-6 border border-slate-800 space-y-6">
          <div>
            <h3 className="text-base font-black text-white">Third-Party Data Processor Registry</h3>
            <p className="text-xs text-slate-400 mt-0.5">Authoritative ledger of external infrastructure, communication, and payment processors</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {processors.map((proc, idx) => (
              <div key={idx} className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-white">{proc.providerName}</h4>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    proc.active ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {proc.active ? 'Active Processor' : 'Inactive'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{proc.purpose}</p>

                <div className="space-y-1 text-[11px] text-slate-400 pt-2 border-t border-slate-800">
                  <div><strong className="text-slate-300">Data Categories:</strong> {proc.dataCategories?.join(', ')}</div>
                  <div><strong className="text-slate-300">Processing Region:</strong> {proc.processingRegion}</div>
                  <div><strong className="text-slate-300">Contract Status:</strong> {proc.contractStatus}</div>
                  <div><strong className="text-slate-300">Privacy Contact:</strong> {proc.privacyContact}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB: RETENTION RULES ────────────────────────────────────────────── */}
      {activeTab === 'retention' && (
        <div className="bg-[#0E1524] rounded-3xl p-6 border border-slate-800 space-y-6">
          <div>
            <h3 className="text-base font-black text-white">Data Retention Policy Matrix</h3>
            <p className="text-xs text-slate-400 mt-0.5">Centralized category-by-category retention configuration and statutory legal bases</p>
          </div>

          <div className="space-y-3">
            {retentionPolicies.map((r, idx) => (
              <div key={idx} className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-black text-white">{r.title}</h4>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-800 text-rose-400 font-bold">
                      {r.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{r.description}</p>
                  <div className="text-[11px] text-emerald-400 font-medium">
                    Legal Basis: {r.legalBasis}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-200 font-mono text-xs font-bold block">
                    {r.retentionPeriod}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB: SECURITY INCIDENTS ─────────────────────────────────────────── */}
      {activeTab === 'incidents' && (
        <div className="bg-[#0E1524] rounded-3xl p-6 border border-slate-800 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-black text-white">Security Incident & Breach Workflow</h3>
              <p className="text-xs text-slate-400 mt-0.5">Incident detection, containment, affected systems, and regulatory review</p>
            </div>
            <button
              onClick={() => setShowIncidentModal(true)}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <AlertOctagon className="w-3.5 h-3.5" />
              <span>Log Security Incident</span>
            </button>
          </div>

          <div className="space-y-3">
            {incidents.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">No security incidents logged. Platform operating normally.</div>
            ) : (
              incidents.map((inc, idx) => (
                <div key={idx} className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white text-sm">{inc.incidentId}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        inc.severity === 'CRITICAL' ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-amber-950 text-amber-400 border border-amber-800'
                      }`}>
                        {inc.severity}
                      </span>
                      <span className="text-xs font-bold text-slate-300">{inc.title}</span>
                    </div>
                    <span className="font-mono text-xs text-slate-500">{inc.detectedAt ? inc.detectedAt.slice(0, 16).replace('T', ' ') : ''}</span>
                  </div>

                  <p className="text-xs text-slate-400">{inc.description}</p>
                  {inc.containmentActions && (
                    <div className="text-xs text-emerald-400 bg-emerald-950/20 p-2.5 rounded-xl border border-emerald-900/40">
                      <strong>Containment:</strong> {inc.containmentActions}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── TAB: PRIVACY AUDIT TRAIL ────────────────────────────────────────── */}
      {activeTab === 'audit' && (
        <div className="bg-[#0E1524] rounded-3xl p-6 border border-slate-800 space-y-6">
          <div>
            <h3 className="text-base font-black text-white">Immutable Privacy Audit Log</h3>
            <p className="text-xs text-slate-400 mt-0.5">Real-time tamper-resistant log of consent changes, data exports, policy publications, and erasure events</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/60 text-slate-400 uppercase font-black text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Target</th>
                  <th className="py-3 px-4">Details</th>
                  <th className="py-3 px-4 text-right">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium font-mono text-[11px]">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 font-sans text-xs">No audit logs recorded yet.</td>
                  </tr>
                ) : (
                  auditLogs.map((l, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 text-slate-400">{l.timestamp ? l.timestamp.slice(0, 19).replace('T', ' ') : '-'}</td>
                      <td className="py-3 px-4 text-white truncate max-w-[140px]">{l.actor}</td>
                      <td className="py-3 px-4 font-bold text-rose-400">{l.action}</td>
                      <td className="py-3 px-4 text-slate-300">{l.target}</td>
                      <td className="py-3 px-4 text-slate-400 truncate max-w-xs">{JSON.stringify(l.details || {})}</td>
                      <td className="py-3 px-4 text-right">
                        <span className={`px-2 py-0.5 rounded font-black text-[10px] ${
                          l.result === 'SUCCESS' ? 'bg-emerald-950 text-emerald-400' : 'bg-red-950 text-red-400'
                        }`}>
                          {l.result}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MODAL: RESOLVE GRIEVANCE ────────────────────────────────────────── */}
      {selectedGrievance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0E1524] rounded-3xl p-6 border border-slate-800 max-w-lg w-full space-y-4">
            <h3 className="text-base font-black text-white">Resolve Grievance #{selectedGrievance.ticketId}</h3>
            <p className="text-xs text-slate-400">Customer: {selectedGrievance.customerName} ({selectedGrievance.customerContact})</p>
            <p className="text-xs bg-slate-900 p-3 rounded-xl text-slate-300">{selectedGrievance.description}</p>

            <form onSubmit={handleResolveGrievance} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Update Status</label>
                <select
                  value={resolutionStatus}
                  onChange={(e) => setResolutionStatus(e.target.value as any)}
                  className="w-full px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-rose-500"
                >
                  <option value="in_review">In Review / Investigation</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Resolution Summary</label>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-rose-500"
                  placeholder="State the resolution actions taken..."
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedGrievance(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingGrievance}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                >
                  {updatingGrievance ? 'Updating...' : 'Save Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: PUBLISH POLICY ───────────────────────────────────────────── */}
      {showPolicyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0E1524] rounded-3xl p-6 border border-slate-800 max-w-2xl w-full space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-black text-white">Publish New Privacy Notice Revision</h3>

            <form onSubmit={handlePublishPolicy} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Version (SemVer)</label>
                  <input
                    type="text"
                    value={newVersion}
                    onChange={(e) => setNewVersion(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-rose-500"
                    placeholder="e.g. 1.1.0"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Title</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-rose-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Summary of Changes</label>
                <input
                  type="text"
                  value={newSummary}
                  onChange={(e) => setNewSummary(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-rose-500"
                  placeholder="Brief explanation of policy adjustments"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Markdown Policy Content</label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  rows={10}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-rose-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPolicyModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPolicy}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                >
                  {savingPolicy ? 'Publishing...' : 'Publish Active Revision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: LOG INCIDENT ─────────────────────────────────────────────── */}
      {showIncidentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0E1524] rounded-3xl p-6 border border-slate-800 max-w-lg w-full space-y-4">
            <h3 className="text-base font-black text-white">Log Security Incident / Breach Record</h3>

            <form onSubmit={handleLogIncident} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Incident Title</label>
                <input
                  type="text"
                  value={incTitle}
                  onChange={(e) => setIncTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-rose-500"
                  placeholder="e.g. Unauthorized API request rate surge"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Severity Classification</label>
                <select
                  value={incSeverity}
                  onChange={(e) => setIncSeverity(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-rose-500"
                >
                  <option value="LOW">Low (Informational / Confined)</option>
                  <option value="MEDIUM">Medium (Moderate threat)</option>
                  <option value="HIGH">High (Potential data risk)</option>
                  <option value="CRITICAL">Critical (Confirmed breach)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Affected Systems (comma-separated)</label>
                <input
                  type="text"
                  value={incSystems}
                  onChange={(e) => setIncSystems(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-rose-500"
                  placeholder="e.g. Firebase Auth, Render API"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Description</label>
                <textarea
                  value={incDescription}
                  onChange={(e) => setIncDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-rose-500"
                  placeholder="Technical findings..."
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Immediate Containment Actions</label>
                <input
                  type="text"
                  value={incContainment}
                  onChange={(e) => setIncContainment(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-rose-500"
                  placeholder="e.g. Blocked IP range, rotated API secret"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="reg_notif"
                  checked={incRegulatory}
                  onChange={(e) => setIncRegulatory(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-800 bg-slate-900 text-rose-600 focus:ring-rose-500"
                />
                <label htmlFor="reg_notif" className="text-xs text-slate-300">
                  Requires regulatory / Data Protection Board notification
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowIncidentModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loggingIncident}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                >
                  {loggingIncident ? 'Recording...' : 'Log Incident'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
