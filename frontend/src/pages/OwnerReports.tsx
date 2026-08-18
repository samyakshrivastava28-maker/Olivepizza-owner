import { useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { 
  FileText, ExternalLink, RefreshCw, Mail, Search, HardDrive, 
  CheckCircle2, AlertTriangle, Cloud, Download, Trash2, Eye, Sparkles, 
  Calendar, Layers, Table
} from 'lucide-react';
import toast from 'react-hot-toast';

export interface MonthlyReport {
  id: string;
  month: string;
  year: number;
  revenue: number;
  orders: number;
  reportUrl?: string;
  downloadUrl?: string;
  cloudflarePath?: string;
  createdTime: string;
  pdfSize?: string;
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
}

interface DiagnosticsData {
  pdfGenerator: { status: string; format: string };
  cloudflareR2: { status: string; bucket: string };
  googleSheets: { status: string; spreadsheetId: string | null };
  emailQueue: { statusBreakdown: any[]; smtpHost: string; recipient: string };
  reportsSummary: { totalGenerated: number };
}

export default function OwnerReports() {
  const [monthlyReports, setMonthlyReports] = useState<MonthlyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"monthly" | "live_sheets" | "diagnostics">("monthly");
  const [diagnostics, setDiagnostics] = useState<DiagnosticsData | null>(null);
  const [liveSheetInfo, setLiveSheetInfo] = useState<{ spreadsheetId: string | null; currentSheetTitle: string; url: string | null } | null>(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);

  // Real-time Firestore sync for monthly_reports
  useEffect(() => {
    setLoading(true);
    const q = collection(db, "monthly_reports");
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as MonthlyReport);
      data.sort((a, b) => new Date(b.createdTime || 0).getTime() - new Date(a.createdTime || 0).getTime());
      setMonthlyReports(data);
      setLoading(false);
    }, () => {
      setLoading(false);
    });

    fetchBackendReports();
    return () => unsubscribe();
  }, []);

  const fetchBackendReports = async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/reports/monthly", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        if (data.reports) setMonthlyReports(data.reports);
        if (data.liveSheet) setLiveSheetInfo(data.liveSheet);
      }
    } catch (err) {
      console.warn("Failed to fetch backend monthly reports:", err);
    }
  };

  const fetchDiagnostics = async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/reports/diagnostics", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setDiagnostics(data);
      }
    } catch (err) {
      console.error("Failed to fetch report diagnostics:", err);
    }
  };

  const handleGenerateMonthlyReport = async () => {
    const toastId = toast.loading("Generating monthly report PDF, emailing owner & syncing...");
    setGenerating(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/reports/generate-monthly", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Monthly Report for ${data.report.id} generated, emailed & archived!`, { id: toastId });
        fetchBackendReports();
      } else {
        throw new Error(data.error || "Failed to generate monthly report");
      }
    } catch (err: any) {
      toast.error(err.message || "Report generation failed", { id: toastId });
    } finally {
      setGenerating(false);
    }
  };

  const handleSyncGoogleSheet = async () => {
    const toastId = toast.loading("Syncing orders to Google Sheets...");
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/reports/google-sheet/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Synced ${data.syncedCount} orders to Google Sheet!`, { id: toastId });
        fetchBackendReports();
      } else {
        throw new Error(data.error || "Google Sheet sync failed");
      }
    } catch (err: any) {
      toast.error(err.message || "Google Sheet sync failed", { id: toastId });
    }
  };

  const handleSetSpreadsheetId = async () => {
    const inputId = window.prompt("Enter Google Spreadsheet ID (from docs.google.com/spreadsheets/d/<ID>/edit):", liveSheetInfo?.spreadsheetId || "");
    if (!inputId) return;

    const toastId = toast.loading("Saving Google Sheet ID...");
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/reports/google-sheet/set-id", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ spreadsheetId: inputId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Google Sheet ID updated!", { id: toastId });
        fetchBackendReports();
      } else {
        throw new Error(data.error || "Failed to set Google Sheet ID");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to set Google Sheet ID", { id: toastId });
    }
  };

  const handleDeleteReport = async (reportId: string, cloudflarePath?: string) => {
    if (!window.confirm(`Are you sure you want to delete monthly report "${reportId}" from Cloudflare R2?`)) return;

    const toastId = toast.loading("Deleting report from R2 storage...");
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/reports/monthly/${reportId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ cloudflarePath }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Report deleted successfully.", { id: toastId });
        setMonthlyReports((prev) => prev.filter((r) => r.id !== reportId));
      } else {
        throw new Error(data.error || "Failed to delete report");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete report", { id: toastId });
    }
  };

  const filteredReports = monthlyReports.filter((r) => {
    const q = searchTerm.toLowerCase();
    return (
      r.id.toLowerCase().includes(q) ||
      r.month.toLowerCase().includes(q) ||
      r.year.toString().includes(q)
    );
  });

  const totalTrackedRevenue = monthlyReports.reduce((acc, r) => acc + (r.revenue || 0), 0);
  const totalTrackedOrders = monthlyReports.reduce((acc, r) => acc + (r.orders || 0), 0);

  return (
    <div className="min-h-screen bg-[#06070a] text-white p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary-500/10 border border-primary-500/30 rounded-xl text-primary-500">
                <Cloud className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
                  Cloudflare R2 & Google Sheets Reports
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                  Live order sync inside Google Sheets + Automated monthly PDF archives in Cloudflare R2
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleGenerateMonthlyReport}
              disabled={generating}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary-500 to-amber-500 hover:from-primary-600 hover:to-amber-600 text-white font-bold rounded-xl shadow-lg shadow-primary-500/20 transition-all disabled:opacity-50 cursor-pointer min-touch-target"
            >
              <Sparkles className={`w-4 h-4 ${generating ? "animate-spin" : ""}`} />
              {generating ? "Generating..." : "Generate Monthly Report"}
            </button>

            <button
              onClick={handleSyncGoogleSheet}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold rounded-xl hover:bg-emerald-500/25 transition-all cursor-pointer min-touch-target"
              title="Sync all orders into live Google Sheet"
            >
              <Table className="w-4 h-4" />
              Sync Google Sheet
            </button>

            <button
              onClick={handleSetSpreadsheetId}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white/5 border border-white/10 text-slate-300 font-semibold rounded-xl hover:bg-white/10 transition-all cursor-pointer min-touch-target text-xs"
              title="Set or update Google Spreadsheet ID"
            >
              Set Sheet ID
            </button>

            {liveSheetInfo?.url && (
              <a
                href={liveSheetInfo.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold rounded-xl hover:bg-emerald-500/20 transition-all min-touch-target text-xs"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open Sheet
              </a>
            )}
          </div>
        </div>

        {/* Quick Performance Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#0b0d13] border border-white/10 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Total Revenue Tracked</span>
              <HardDrive className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-white mt-2">
              ₹{totalTrackedRevenue.toLocaleString("en-IN")}
            </div>
            <p className="text-xs text-slate-400 mt-1">Across archived monthly reports</p>
          </div>

          <div className="bg-[#0b0d13] border border-white/10 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Total Orders Processed</span>
              <Layers className="w-4 h-4 text-primary-400" />
            </div>
            <div className="text-2xl font-black text-white mt-2">
              {totalTrackedOrders.toLocaleString("en-IN")}
            </div>
            <p className="text-xs text-slate-400 mt-1">Logged live in Google Sheets</p>
          </div>

          <div className="bg-[#0b0d13] border border-white/10 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Storage Provider</span>
              <Cloud className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-lg font-bold text-amber-400 mt-2 flex items-center gap-1.5">
              Cloudflare R2
            </div>
            <p className="text-xs text-slate-400 mt-1">Zero Google Drive dependencies</p>
          </div>

          <div className="bg-[#0b0d13] border border-white/10 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Active Monthly Sheet</span>
              <Calendar className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-lg font-bold text-blue-400 mt-2">
              {liveSheetInfo?.currentSheetTitle || "2026-August"}
            </div>
            <p className="text-xs text-slate-400 mt-1">Updating order rows live</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-3">
          <button
            onClick={() => setActiveTab("monthly")}
            className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all cursor-pointer ${
              activeTab === "monthly"
                ? "bg-primary-500 text-white shadow-lg shadow-primary-500/20"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            Monthly PDF Archives ({monthlyReports.length})
          </button>

          <button
            onClick={() => {
              setActiveTab("diagnostics");
              fetchDiagnostics();
            }}
            className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all cursor-pointer ${
              activeTab === "diagnostics"
                ? "bg-primary-500 text-white shadow-lg shadow-primary-500/20"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            System Diagnostics
          </button>
        </div>

        {/* Tab Content: Monthly Reports */}
        {activeTab === "monthly" && (
          <div className="space-y-6">
            {/* Search Bar */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-[#0b0d13] p-4 rounded-2xl border border-white/10">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  type="text"
                  placeholder="Search month or year..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#06070a] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary-500"
                />
              </div>

              <div className="text-xs text-slate-400">
                Showing {filteredReports.length} of {monthlyReports.length} reports
              </div>
            </div>

            {/* Reports List */}
            {loading ? (
              <div className="text-center py-16 bg-[#0b0d13] rounded-3xl border border-white/10">
                <RefreshCw className="w-8 h-8 text-primary-500 animate-spin mx-auto mb-3" />
                <p className="text-sm text-slate-400">Loading Cloudflare R2 reports...</p>
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="text-center py-16 bg-[#0b0d13] rounded-3xl border border-white/10">
                <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-white">No Monthly Reports Found</h3>
                <p className="text-sm text-slate-400 mt-1">Click "Generate Monthly Report" to create your first report!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredReports.map((report) => (
                  <div
                    key={report.id}
                    className="bg-[#0b0d13] border border-white/10 hover:border-primary-500/50 transition-all rounded-3xl p-6 shadow-xl flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="px-3 py-1 bg-primary-500/10 border border-primary-500/30 text-primary-400 text-xs font-bold rounded-full">
                          {report.month} {report.year}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          {report.pdfSize || "1.2 MB"}
                        </span>
                      </div>

                      <h3 className="text-xl font-extrabold text-white mt-4">
                        Olive Pizza Executive Report
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Archived: {new Date(report.createdTime).toLocaleDateString()}
                      </p>

                      <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Gross Revenue:</span>
                          <span className="font-bold text-emerald-400">₹{report.revenue?.toLocaleString("en-IN")}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Total Orders:</span>
                          <span className="font-bold text-white">{report.orders}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {report.reportUrl && (
                          <button
                            onClick={() => setPreviewPdfUrl(report.reportUrl!)}
                            className="p-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all cursor-pointer"
                            title="Preview PDF"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        {report.downloadUrl && (
                          <a
                            href={report.downloadUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2.5 bg-primary-500/10 hover:bg-primary-500/20 text-primary-400 rounded-xl transition-all"
                            title="Download PDF"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        )}
                      </div>

                      <button
                        onClick={() => handleDeleteReport(report.id, report.cloudflarePath)}
                        className="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-all cursor-pointer"
                        title="Delete Report"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab Content: System Diagnostics */}
        {activeTab === "diagnostics" && (
          <div className="bg-[#0b0d13] border border-white/10 rounded-3xl p-6 space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              Reporting & Storage Infrastructure Status
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                <div className="text-xs text-slate-400 font-semibold uppercase">Cloudflare R2 Bucket</div>
                <div className="text-base font-bold text-emerald-400 mt-1">
                  {diagnostics?.cloudflareR2?.bucket || "olive-pizza-r2"}
                </div>
                <p className="text-xs text-slate-400 mt-1">Status: {diagnostics?.cloudflareR2?.status || "Active"}</p>
              </div>

              <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                <div className="text-xs text-slate-400 font-semibold uppercase">Google Sheets Live Sync</div>
                <div className="text-base font-bold text-blue-400 mt-1">
                  {diagnostics?.googleSheets?.status === "active" ? "Connected 🟢" : "Ready"}
                </div>
                <p className="text-xs text-slate-400 mt-1">Incremental row appends active</p>
              </div>

              <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                <div className="text-xs text-slate-400 font-semibold uppercase">Email Notification Queue</div>
                <div className="text-base font-bold text-primary-400 mt-1">
                  {diagnostics?.emailQueue?.smtpHost || "smtp.gmail.com"}
                </div>
                <p className="text-xs text-slate-400 mt-1">Recipient: {diagnostics?.emailQueue?.recipient || "olivepizzarjn@gmail.com"}</p>
              </div>
            </div>
          </div>
        )}

        {/* PDF Preview Modal */}
        {previewPdfUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="w-full max-w-4xl bg-[#0b0d13] border border-white/20 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[85vh]">
              <div className="flex items-center justify-between p-4 border-b border-white/10 bg-slate-950">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary-500" /> PDF Report Preview
                </h3>
                <button
                  onClick={() => setPreviewPdfUrl(null)}
                  className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>

              <div className="flex-1 bg-slate-900">
                <iframe
                  src={previewPdfUrl}
                  className="w-full h-full border-none"
                  title="PDF Preview"
                />
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
