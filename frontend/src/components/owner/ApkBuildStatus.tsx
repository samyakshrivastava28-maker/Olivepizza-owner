import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Smartphone, 
  Download, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  GitCommit, 
  TerminalSquare,
  ChevronDown,
  ChevronUp,
  ExternalLink
} from 'lucide-react';

interface JobStep {
  name: string;
  status: "queued" | "in_progress" | "completed";
  conclusion: "success" | "failure" | "skipped" | null;
  started_at: string;
  completed_at: string;
}

interface BuildData {
  runId: number;
  status: "queued" | "in_progress" | "completed";
  conclusion: "success" | "failure" | "cancelled" | null;
  commitHash: string;
  commitMessage: string;
  createdAt: string;
  updatedAt: string;
  duration: number; // in seconds
  steps: JobStep[];
  downloadUrl: string | null;
  githubRunUrl?: string;
}

export default function ApkBuildStatus() {
  const [buildData, setBuildData] = useState<BuildData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLogs, setShowLogs] = useState(false);

  const fetchBuildStatus = async () => {
    try {
      // 1. Fetch latest workflow run
      const runsRes = await fetch("https://api.github.com/repos/samyakshrivastava28-maker/Olive-Pizza/actions/runs?branch=main&per_page=1");
      if (!runsRes.ok) throw new Error("Failed to fetch runs");
      const runsData = await runsRes.json();
      const latestRun = runsData.workflow_runs[0];

      if (!latestRun) {
        setLoading(false);
        return;
      }

      // 2. Fetch jobs for the latest run to get step-by-step logs
      const jobsRes = await fetch(latestRun.jobs_url);
      const jobsData = await jobsRes.ok ? await jobsRes.json() : { jobs: [] };
      const mainJob = jobsData.jobs[0] || { steps: [] };

      // 3. Fetch Release APK URL if completed successfully
      let downloadUrl = null;
      if (latestRun.status === "completed" && latestRun.conclusion === "success") {
        const relRes = await fetch("https://api.github.com/repos/samyakshrivastava28-maker/Olive-Pizza/releases/tags/android-latest");
        if (relRes.ok) {
          const relData = await relRes.json();
          const asset = relData.assets?.find((a: any) => a.name.endsWith('.apk'));
          if (asset) downloadUrl = '/api/github/download-apk';
        }
      }

      const start = new Date(latestRun.created_at).getTime();
      const end = latestRun.status === "completed" ? new Date(latestRun.updated_at).getTime() : Date.now();
      
      setBuildData({
        runId: latestRun.id,
        status: latestRun.status,
        conclusion: latestRun.conclusion,
        commitHash: latestRun.head_sha.substring(0, 7),
        commitMessage: latestRun.head_commit?.message || "Triggered via API",
        createdAt: latestRun.created_at,
        updatedAt: latestRun.updated_at,
        duration: Math.floor((end - start) / 1000),
        steps: mainJob.steps.filter((s: JobStep) => !s.name.includes("Checkout") && !s.name.includes("Set up job") && !s.name.includes("Post ") && !s.name.includes("Complete job")),
        downloadUrl,
        githubRunUrl: latestRun.html_url || "https://github.com/samyakshrivastava28-maker/Olive-Pizza/actions"
      });
    } catch (e) {
      console.error("Failed to fetch GitHub Actions build status", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBuildStatus();
    // Poll every 10 seconds if a build is active
    const interval = setInterval(() => {
      if (buildData?.status !== "completed") {
        fetchBuildStatus();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [buildData?.status]);

  if (loading && !buildData) {
    return (
      <div className="flex items-center gap-3 bg-dark-800/50 border border-dark-700 rounded-2xl px-5 py-4 animate-pulse mb-6">
        <div className="w-10 h-10 rounded-xl bg-dark-700"></div>
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-dark-700 rounded w-1/3"></div>
          <div className="h-3 bg-dark-700 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!buildData) {
    return (
      <div className="flex flex-col border border-dark-700 rounded-2xl overflow-hidden bg-dark-800/80 backdrop-blur-md shadow-xl mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 px-5 py-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-12 h-12 rounded-xl border border-[#3ddc84]/30 bg-[#3ddc84]/15 flex items-center justify-center flex-shrink-0 text-[#3ddc84]">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Android Native APK Center</h3>
              <p className="text-sm text-slate-400 mt-0.5">
                Download the compiled Android APK or view GitHub Actions build runs.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <a
              href="https://github.com/samyakshrivastava28-maker/Olive-Pizza/actions"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-dark-700 hover:bg-dark-600 text-slate-200 px-4 py-2.5 rounded-xl font-medium text-sm transition-all border border-dark-600"
            >
              <ExternalLink className="w-4 h-4 text-blue-400" />
              GitHub Actions
            </a>
            <a
              href="/api/github/download-apk"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#3ddc84] hover:bg-[#34c077] text-black px-5 py-2.5 rounded-xl font-bold text-sm transition-all hover:scale-105 active:scale-95 shadow-lg shadow-[#3ddc84]/20"
            >
              <Download className="w-4 h-4" />
              Download APK
            </a>
          </div>
        </div>
      </div>
    );
  }

  const isBuilding = buildData.status === "in_progress" || buildData.status === "queued";
  const isFailed = buildData.status === "completed" && buildData.conclusion === "failure";

  const getStatusColor = () => {
    if (isBuilding) return "text-blue-400 border-blue-400/30 bg-blue-400/10";
    if (isFailed) return "text-red-400 border-red-400/30 bg-red-400/10";
    return "text-[#3ddc84] border-[#3ddc84]/30 bg-[#3ddc84]/15"; // Android Green
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div className="flex flex-col border border-dark-700 rounded-2xl overflow-hidden bg-dark-800/80 backdrop-blur-md shadow-xl mb-6">
      {/* Banner Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 px-5 py-4">
        <div className="flex items-center gap-3 flex-1">
          <div className={`w-12 h-12 rounded-xl border flex items-center justify-center flex-shrink-0 ${getStatusColor()}`}>
            {isBuilding ? <Loader2 className="w-6 h-6 animate-spin" /> : 
             isFailed ? <XCircle className="w-6 h-6" /> : 
             <Smartphone className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">
                {isBuilding ? "Android APK Build in Progress..." : 
                 isFailed ? "Android APK Build Failed" : 
                 "Android Native APK Available"}
              </h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-dark-700 text-gray-300 font-mono border border-dark-600 flex items-center gap-1">
                <GitCommit className="w-3 h-3" />
                {buildData.commitHash}
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1 line-clamp-1">
              {buildData.commitMessage}
            </p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto mt-4 sm:mt-0">
          <button 
            onClick={() => setShowLogs(!showLogs)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-dark-700 hover:bg-dark-600 text-white px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all border border-dark-600"
          >
            <TerminalSquare className="w-4 h-4 text-gray-400" />
            {showLogs ? "Hide Logs" : "View Logs"}
            {showLogs ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          <a
            href={buildData.githubRunUrl || "https://github.com/samyakshrivastava28-maker/Olive-Pizza/actions"}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-dark-700 hover:bg-dark-600 text-slate-200 px-4 py-2.5 rounded-xl font-medium text-sm transition-all border border-dark-600 hover:border-slate-500"
            title="Open GitHub Actions build run page"
          >
            <ExternalLink className="w-4 h-4 text-blue-400" />
            GitHub Actions
          </a>
          
          <a
            href={buildData.downloadUrl || '/api/github/download-apk'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#3ddc84] hover:bg-[#34c077] text-black px-5 py-2.5 rounded-xl font-bold text-sm transition-all hover:scale-105 active:scale-95 shadow-lg shadow-[#3ddc84]/20"
          >
            <Download className="w-4 h-4" />
            Download APK
          </a>
        </div>
      </div>

      {/* Logs Expansion */}
      <AnimatePresence>
        {showLogs && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-dark-700 bg-dark-900/50 overflow-hidden"
          >
            <div className="p-5">
              <div className="flex items-center gap-6 mb-4 text-sm text-gray-400">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Duration: {formatDuration(buildData.duration)}
                </div>
                <div className="flex items-center gap-2">
                  Status: <span className="uppercase text-xs font-bold tracking-wider text-white">{buildData.status}</span>
                </div>
              </div>

              <div className="space-y-1.5 font-mono text-xs">
                {buildData.steps.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-3 py-1.5 px-3 rounded bg-dark-900 border border-dark-800">
                    <div className="w-4 flex justify-center">
                      {step.status === "queued" ? <div className="w-2 h-2 rounded-full bg-gray-500" /> :
                       step.status === "in_progress" ? <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" /> :
                       step.conclusion === "success" ? <CheckCircle2 className="w-3.5 h-3.5 text-[#3ddc84]" /> :
                       step.conclusion === "failure" ? <XCircle className="w-3.5 h-3.5 text-red-500" /> :
                       <div className="w-2 h-2 rounded-full bg-gray-600" />}
                    </div>
                    <span className={`flex-1 ${
                      step.status === "in_progress" ? "text-blue-300" : 
                      step.conclusion === "failure" ? "text-red-400 font-bold" : 
                      step.status === "queued" ? "text-gray-500" : 
                      "text-gray-300"
                    }`}>
                      {step.name}
                    </span>
                    {step.status === "completed" && (
                      <span className="text-gray-600">
                        {Math.max(1, Math.floor((new Date(step.completed_at).getTime() - new Date(step.started_at).getTime()) / 1000))}s
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
