import React from 'react';
import { useNotificationDebugger } from '../../hooks/useNotificationDebugger';
import { X, CheckCircle, XCircle, Loader2, Server, Database, Mail, Bell, ShieldAlert, Code } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const NotificationDiagnosticsOverlay: React.FC = () => {
  const { isOpen, activeTrace, closeOverlay, isDebugMode } = useNotificationDebugger();

  if (!isDebugMode) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8"
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            className="bg-[#111111] border border-red-500/30 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl shadow-red-900/20"
          >
            {/* Header */}
            <div className="p-4 border-b border-red-900/30 bg-red-950/20 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-red-400 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5" />
                  Global Diagnostics Trace
                </h2>
                <div className="text-sm text-gray-400 mt-1 font-mono">
                  {activeTrace?.action || 'Tracing...'} • {activeTrace?.route || 'Initializing HTTP...'}
                  {activeTrace?.orderId && ` • Order: ${activeTrace.orderId}`}
                  {activeTrace?.processingTime && ` • ${activeTrace.processingTime}ms`}
                </div>
              </div>
              <button onClick={closeOverlay} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Trace Body */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 custom-scrollbar">
              {!activeTrace ? (
                <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                  <Loader2 className="w-8 h-8 animate-spin mb-3 text-red-500" />
                  <p>Waiting for telemetry...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeTrace.steps.map((step, idx) => (
                    <div key={idx} className={`p-4 rounded-lg border ${
                      step.status === 'success' ? 'bg-green-950/10 border-green-900/30' :
                      step.status === 'failed' || step.status === 'error' ? 'bg-red-950/20 border-red-900/50' :
                      step.status === 'skipped' ? 'bg-gray-900 border-gray-800' :
                      'bg-blue-950/10 border-blue-900/30'
                    }`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          {step.status === 'success' && <CheckCircle className="w-5 h-5 text-green-500" />}
                          {(step.status === 'failed' || step.status === 'error') && <XCircle className="w-5 h-5 text-red-500" />}
                          {step.status === 'started' && <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />}
                          {step.status === 'skipped' && <Server className="w-5 h-5 text-gray-500" />}
                          
                          <span className={`font-semibold ${
                             step.status === 'success' ? 'text-green-400' :
                             step.status === 'failed' || step.status === 'error' ? 'text-red-400' :
                             step.status === 'skipped' ? 'text-gray-400' :
                             'text-blue-400'
                          }`}>
                            {step.step}
                          </span>
                        </div>
                        <span className="text-xs uppercase tracking-wider font-bold opacity-50 text-white">
                          {step.status}
                        </span>
                      </div>

                      {/* Detailed Trace Output */}
                      {(step.reason || step.error || step.email || step.recipients !== undefined || step.trace || step.lockOwner || step.info) && (
                        <div className="mt-3 pl-8 text-sm">
                          {step.info && <div className="text-gray-300">Info: {step.info}</div>}
                          {step.reason && <div className="text-gray-300">Reason: {step.reason}</div>}
                          {step.error && <div className="text-red-300 font-mono text-xs mt-1 bg-red-950/50 p-2 rounded">Error: {step.error}</div>}
                          {step.lockOwner && (
                            <div className="text-gray-400 text-xs mt-2 space-y-1 bg-black/20 p-2 rounded border border-white/5">
                              <div><span className="text-gray-500">Lock Owner:</span> {step.lockOwner}</div>
                              <div><span className="text-gray-500">Action in Progress:</span> {step.lockedAction}</div>
                              <div><span className="text-gray-500">Lock Age:</span> {step.lockAge}</div>
                            </div>
                          )}
                          {step.email && <div className="text-gray-400 flex items-center gap-2 mt-1"><Mail className="w-3 h-3" /> {step.email}</div>}
                          {step.recipients !== undefined && <div className="text-gray-400 flex items-center gap-2 mt-1"><Bell className="w-3 h-3" /> Recipients: {step.recipients}</div>}
                          
                          {step.trace && (
                            <div className="mt-2 bg-black/50 p-3 rounded-lg border border-white/5 font-mono text-[10px] sm:text-xs text-gray-400 overflow-x-auto">
                              <pre>{JSON.stringify(step.trace, null, 2)}</pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-3 border-t border-white/10 bg-black/40 text-xs text-center text-gray-500 font-mono">
              Diagnostic Telemetry Active (Development Mode)
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
