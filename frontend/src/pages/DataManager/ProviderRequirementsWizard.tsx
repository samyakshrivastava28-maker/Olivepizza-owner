import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database, Server, Cloud, Layers, HardDrive, Zap,
  CheckCircle2, XCircle, AlertTriangle, ShieldCheck,
  RefreshCw, Plus, Settings, Play, ArrowRight, ArrowLeft,
  Lock, Eye, EyeOff, Info, BarChart3, FileText, Globe,
  Search, ExternalLink, Sliders, Clock, AlertCircle, Sparkles,
  Check, HelpCircle, Terminal
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ProviderRequirementsWizardProps {
  providers: any[];
  onClose: () => void;
  onSaveSuccess: () => void;
  dmFetch: (path: string, options?: any) => Promise<any>;
}

const CATEGORY_TABS = [
  { id: 'all', label: 'All Providers' },
  { id: 'nosql', label: 'NoSQL' },
  { id: 'sql', label: 'SQL' },
  { id: 'storage', label: 'Object / Media' },
  { id: 'vector', label: 'Vector DB' },
  { id: 'api', label: 'API Layer' },
];

const TIER_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  free_tier: { label: 'Free Tier Available', bg: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-400' },
  paid: { label: 'Commercial / Paid', bg: 'bg-amber-500/10 border-amber-500/30', text: 'text-amber-400' },
  self_hosted: { label: 'Self-Hosted / Open-Source', bg: 'bg-blue-500/10 border-blue-500/30', text: 'text-blue-400' },
  api_only: { label: 'Open-Source API Layer', bg: 'bg-cyan-500/10 border-cyan-500/30', text: 'text-cyan-400' },
  custom: { label: 'Custom Integration', bg: 'bg-purple-500/10 border-purple-500/30', text: 'text-purple-400' },
};

const ROLE_LABELS: Record<string, string> = {
  primary_business_db: 'Primary Business DB',
  auth_adjacent: 'Auth-Adjacent Storage',
  catalog_products: 'Product Catalog',
  orders_checkout: 'Orders & Checkout',
  coupons_offers: 'Coupons & Deals',
  website_config: 'Platform Configuration',
  realtime_state: 'Realtime State Sync',
  analytics: 'Analytics & Aggregates',
  reporting: 'Periodic Reporting',
  navigation_telemetry: 'GPS & Telemetry',
  relational_structured: 'Relational Structured Data',
  operational_queues: 'Queues & Logs',
  heavy_sql_workloads: 'Heavy SQL Workloads',
  homepage_packages: 'Homepage Packages',
  knowledge_json: 'AI Knowledge JSON',
  pdf_reports: 'PDF Archives',
  backups_archives: 'Backups & Cold Storage',
  static_assets: 'Static Asset Storage',
  media_assets: 'Media CDN',
  vector_embeddings: 'AI Vector Embeddings',
  temporary_cache: 'Temporary Cache',
  custom_integration: 'Custom Integration',
};

export default function ProviderRequirementsWizard({
  providers,
  onClose,
  onSaveSuccess,
  dmFetch,
}: ProviderRequirementsWizardProps) {
  // Wizard step (1: Choose Provider, 2: What Olive Pizza Needs, 3: Enter Config, 4: Test Connection, 5: Assign Role)
  const [step, setStep] = useState<number>(1);
  const [selectedProvider, setSelectedProvider] = useState<any | null>(null);

  // Search & Category Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Dynamic Form State: key-value store for fields
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [autoDetectedKeys, setAutoDetectedKeys] = useState<Record<string, boolean>>({});
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);

  // Connection Test & Role State
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [roleForm, setRoleForm] = useState({
    id: '',
    name: '',
    currentRole: 'analytics',
    dataClassification: 'operational',
    criticality: 'OPERATIONAL',
    failoverAlternative: 'None',
  });
  const [isSaving, setIsSaving] = useState(false);

  // Filter providers list
  const filteredProviders = useMemo(() => {
    return providers.filter((p) => {
      const matchCategory = selectedCategory === 'all' || p.category === selectedCategory;
      const matchSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.id.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [providers, selectedCategory, searchQuery]);

  // Handle Provider Selection
  const handleSelectProvider = (provider: any) => {
    setSelectedProvider(provider);
    // Initialize default field values
    const initialData: Record<string, any> = {};
    provider.sections?.forEach((sec: any) => {
      sec.fields?.forEach((f: any) => {
        if (f.defaultValue !== undefined) {
          initialData[f.key] = f.defaultValue;
        } else {
          initialData[f.key] = '';
        }
      });
    });

    setFormData(initialData);
    setValidationErrors({});
    setAutoDetectedKeys({});
    setTestResult(null);

    setRoleForm({
      id: `${provider.id}_${Date.now()}`,
      name: provider.name,
      currentRole: provider.defaultRole || provider.availableRoles?.[0] || 'analytics',
      dataClassification: 'operational',
      criticality: 'OPERATIONAL',
      failoverAlternative: 'None',
    });

    // Move to Step 2: What Olive Pizza Needs
    setStep(2);
  };

  // Validate form fields
  const validateForm = () => {
    if (!selectedProvider) return true;
    const errors: Record<string, string> = {};

    selectedProvider.sections?.forEach((sec: any) => {
      sec.fields?.forEach((f: any) => {
        const val = formData[f.key];
        if (f.required && (!val || String(val).trim() === '')) {
          errors[f.key] = `${f.label} is required.`;
        } else if (val && f.validationRegex) {
          const regex = new RegExp(f.validationRegex);
          if (!regex.test(String(val).trim())) {
            errors[f.key] = f.validationMessage || `Invalid format for ${f.label}.`;
          }
        }
      });
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Trigger Auto-Detection
  const handleAutoDetect = async () => {
    if (!selectedProvider) return;
    setIsAutoDetecting(true);
    try {
      const res = await dmFetch(`/providers/${selectedProvider.id}/auto-detect`, {
        method: 'POST',
        body: JSON.stringify({ credentials: formData }),
      });

      if (res?.success && res.discovered) {
        const detected = res.discovered;
        const newFormData = { ...formData };
        const newDetectedKeys: Record<string, boolean> = {};

        Object.keys(detected).forEach((k) => {
          if (detected[k] !== undefined && typeof detected[k] === 'string') {
            newFormData[k] = detected[k];
            newDetectedKeys[k] = true;
          }
        });

        setFormData(newFormData);
        setAutoDetectedKeys(newDetectedKeys);
        toast.success(`Auto-detected: ${res.message || 'Configuration discovered'}`);
      } else {
        toast.error(res?.message || 'Could not auto-detect configuration.');
      }
    } catch (err: any) {
      toast.error(`Auto-detect failed: ${err.message}`);
    } finally {
      setIsAutoDetecting(false);
    }
  };

  // Trigger Connection Test
  const handleTestConnection = async () => {
    if (!validateForm()) {
      toast.error('Please resolve validation errors before testing connection.');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await dmFetch('/databases/test-connection', {
        method: 'POST',
        body: JSON.stringify({
          providerId: selectedProvider.id,
          connectionUri: formData.connectionUri,
          baseUrl: formData.baseUrl || formData.databaseUrl || formData.apiEndpoint,
          apiKey: formData.apiKey || formData.authToken || formData.applicationToken || formData.secretAccessKey,
          healthEndpoint: formData.healthEndpoint,
          projectId: formData.projectId,
          databaseName: formData.databaseName,
          credentials: formData,
        }),
      });

      if (res?.success && res.data) {
        setTestResult(res.data);
        if (res.data.status === 'HEALTHY') {
          toast.success(`Connected! Latency: ${res.data.latencyMs}ms`);
        } else if (res.data.status === 'DEGRADED') {
          toast(`Connected with warnings: ${res.data.message}`, { icon: '⚠️' });
        } else {
          toast.error(`Connection failed: ${res.data.message}`);
        }
      } else {
        setTestResult({
          status: 'UNREACHABLE',
          latencyMs: 0,
          message: res?.error || 'Target database could not be reached.',
          detectedCapabilities: [],
          metricSource: 'Connection Probe',
          breakdown: {
            network: false,
            authentication: false,
            providerIdentity: false,
            databaseAvailability: false,
            permissions: false,
          },
        });
        toast.error('Connection test failed.');
      }
    } catch (err: any) {
      setTestResult({
        status: 'UNREACHABLE',
        latencyMs: 0,
        message: err.message,
        detectedCapabilities: [],
        metricSource: 'Security Probe',
        breakdown: {
          network: false,
          authentication: false,
          providerIdentity: false,
          databaseAvailability: false,
          permissions: false,
        },
      });
      toast.error(`Test error: ${err.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  // Save Configured Database
  const handleSaveDatabase = async () => {
    if (!selectedProvider) return;
    setIsSaving(true);
    try {
      const payload = {
        id: roleForm.id,
        name: roleForm.name,
        providerId: selectedProvider.id,
        category: selectedProvider.category,
        connectionUri: formData.connectionUri || formData.baseUrl || formData.databaseUrl || 'configured',
        baseUrl: formData.baseUrl || formData.apiEndpoint,
        healthEndpoint: formData.healthEndpoint,
        currentRole: roleForm.currentRole,
        dataClassification: roleForm.dataClassification,
        criticality: roleForm.criticality,
        failoverAlternative: roleForm.failoverAlternative,
        automaticFailover: false,
      };

      const res = await dmFetch('/databases', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res?.success) {
        toast.success(`Database [${roleForm.name}] configured and active in Data Manager!`);
        onSaveSuccess();
        onClose();
      } else {
        toast.error(`Failed to save: ${res?.error || 'Unauthorized'}`);
      }
    } catch (err: any) {
      toast.error(`Error saving database: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-xl overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-slate-900 border border-white/15 rounded-3xl p-5 sm:p-8 max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl space-y-6 text-white my-auto"
      >
        {/* Header with Step Tracker */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-primary-500/20 text-primary-400 border border-primary-500/30">
                <Database className="w-4 h-4" />
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Add Database / Provider Configuration
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Step {step} of 5 • {step === 1 && 'Select Database Provider'}
              {step === 2 && 'What Olive Pizza Needs'}
              {step === 3 && 'Enter Configuration'}
              {step === 4 && 'Test Connection & Capabilities'}
              {step === 5 && 'Assign Role & Monitor'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === step
                      ? 'w-6 bg-primary-400'
                      : i < step
                      ? 'w-2 bg-emerald-400'
                      : 'w-2 bg-white/20'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-all"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            STEP 1: SELECT PROVIDER
           ═══════════════════════════════════════════════════════════════════ */}
        {step === 1 && (
          <div className="space-y-4">
            {/* Category Tabs */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {CATEGORY_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedCategory(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    selectedCategory === tab.id
                      ? 'bg-primary-600 text-white shadow-md shadow-primary-600/20'
                      : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search provider (e.g. Firestore, Supabase, MongoDB, Neon, Turso...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-primary-500 transition-all"
              />
            </div>

            {/* Providers Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pr-1">
              {filteredProviders.map((p) => {
                const tierInfo = TIER_LABELS[p.tier] || TIER_LABELS.custom;
                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectProvider(p)}
                    className="bg-black/40 hover:bg-primary-500/10 border border-white/10 hover:border-primary-500/50 p-4 rounded-2xl cursor-pointer transition-all space-y-2.5 group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-white text-sm group-hover:text-primary-300 transition-colors">
                          {p.name}
                        </span>
                        <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full border ${tierInfo.bg} ${tierInfo.text} whitespace-nowrap`}>
                          {p.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {p.description}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-1 pt-2 border-t border-white/5">
                      <div className="flex flex-wrap gap-1">
                        {p.capabilities.slice(0, 3).map((cap: string) => (
                          <span
                            key={cap}
                            className="px-1.5 py-0.5 bg-white/5 rounded text-[9px] font-mono text-slate-400"
                          >
                            {cap}
                          </span>
                        ))}
                      </div>
                      <span className="text-[10px] text-primary-400 font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                        Select <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            STEP 2: WHAT OLIVE PIZZA NEEDS (REQUIREMENTS SUMMARY)
           ═══════════════════════════════════════════════════════════════════ */}
        {step === 2 && selectedProvider && (
          <div className="space-y-5 text-xs">
            {/* Selected Header */}
            <div className="flex items-center justify-between bg-primary-500/10 border border-primary-500/20 p-3.5 rounded-2xl">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-primary-500/20 text-primary-400">
                  <Database className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">{selectedProvider.name}</h3>
                  <p className="text-[11px] text-slate-400">{selectedProvider.whatItIs || selectedProvider.description}</p>
                </div>
              </div>
              <button
                onClick={() => setStep(1)}
                className="text-[11px] text-primary-400 hover:text-white underline font-bold"
              >
                Change Provider
              </button>
            </div>

            {/* What Olive Pizza Needs Summary Card */}
            <div className="bg-black/50 border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>What Olive Pizza Needs from You</span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                {selectedProvider.whatOlivePizzaNeeds?.summary || 'Configure the connection details below to safely connect.'}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Required Items */}
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 space-y-2">
                  <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Required Information
                  </span>
                  <ul className="space-y-1.5 text-slate-300">
                    {selectedProvider.whatOlivePizzaNeeds?.requiredItems?.map((item: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-emerald-400 font-bold">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Optional Items */}
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 space-y-2">
                  <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5" /> Optional Settings
                  </span>
                  <ul className="space-y-1.5 text-slate-300">
                    {selectedProvider.whatOlivePizzaNeeds?.optionalItems?.map((item: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-blue-400 font-bold">○</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Permissions Breakdown */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-2">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-primary-400" /> Required Permissions & Roles
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 font-bold block mb-0.5">For Monitoring Only:</span>
                    <p className="text-slate-300 font-mono">
                      {selectedProvider.whatOlivePizzaNeeds?.monitoringPermissions?.join(', ') || 'Read metadata access'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block mb-0.5">For Active Operations:</span>
                    <p className="text-slate-300 font-mono">
                      {selectedProvider.whatOlivePizzaNeeds?.dataPermissions?.join(', ') || 'Assigned role specific access'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Where to get it guidance */}
              {selectedProvider.documentation?.whereToFindCredentials && (
                <div className="bg-slate-950/60 border border-white/10 rounded-xl p-3.5 space-y-2">
                  <span className="font-bold text-slate-300 flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-cyan-400" /> Where do I find these credentials?
                  </span>
                  <ul className="space-y-1 text-slate-400 text-[11px]">
                    {selectedProvider.documentation.whereToFindCredentials.map((guide: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-cyan-400 font-mono">→</span>
                        <span>{guide}</span>
                      </li>
                    ))}
                  </ul>
                  {selectedProvider.documentation.consoleUrl && (
                    <a
                      href={selectedProvider.documentation.consoleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary-400 hover:text-primary-300 font-bold text-[11px] pt-1"
                    >
                      Open {selectedProvider.name} Console <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2.5 text-slate-400 hover:text-white font-bold flex items-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Providers
              </button>
              <button
                onClick={() => setStep(3)}
                className="px-6 py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-lg shadow-primary-600/30 transition-all"
              >
                Continue to Configuration <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            STEP 3: ENTER CONFIGURATION
           ═══════════════════════════════════════════════════════════════════ */}
        {step === 3 && selectedProvider && (
          <div className="space-y-5 text-xs">
            {/* Auto-Detect Bar if Supported */}
            {selectedProvider.canAutoDetect && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-primary-500/10 border border-primary-500/20 p-3 rounded-2xl">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary-400 flex-shrink-0" />
                  <span className="text-slate-300 text-[11px]">
                    Enter initial credentials and auto-discover project metadata:
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleAutoDetect}
                  disabled={isAutoDetecting}
                  className="px-3 py-1.5 bg-primary-600 hover:bg-primary-500 text-white rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all text-[11px] flex-shrink-0"
                >
                  <RefreshCw className={`w-3 h-3 ${isAutoDetecting ? 'animate-spin' : ''}`} />
                  {isAutoDetecting ? 'Detecting...' : 'Auto-Detect Configuration'}
                </button>
              </div>
            )}

            {/* Dynamic Form Sections */}
            <div className="space-y-4 max-h-[52vh] overflow-y-auto pr-1">
              {selectedProvider.sections?.map((section: any) => (
                <div key={section.id} className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-3">
                  <div className="border-b border-white/10 pb-2">
                    <h4 className="font-bold text-white text-xs">{section.title}</h4>
                    {section.description && (
                      <p className="text-[10px] text-slate-400 mt-0.5">{section.description}</p>
                    )}
                  </div>

                  <div className="space-y-3">
                    {section.fields?.map((field: any) => {
                      const isSecret = field.isSecret;
                      const isDetected = autoDetectedKeys[field.key];
                      const error = validationErrors[field.key];

                      return (
                        <div key={field.key} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-slate-300 font-bold flex items-center gap-1.5">
                              <span>{field.label}</span>
                              {field.required ? (
                                <span className="px-1.5 py-0.2 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-[9px] font-bold">
                                  Required
                                </span>
                              ) : field.conditionalRequirement ? (
                                <span className="px-1.5 py-0.2 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded text-[9px] font-bold">
                                  {field.conditionalRequirement}
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.2 bg-white/10 text-slate-400 rounded text-[9px]">
                                  Optional
                                </span>
                              )}
                            </label>

                            {isDetected && (
                              <span className="text-[9px] text-emerald-400 font-bold flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                                <Check className="w-2.5 h-2.5" /> Detected ✓
                              </span>
                            )}
                          </div>

                          <div className="relative">
                            {field.type === 'select' ? (
                              <select
                                value={formData[field.key] || ''}
                                onChange={(e) => {
                                  setFormData({ ...formData, [field.key]: e.target.value });
                                  if (validationErrors[field.key]) {
                                    setValidationErrors({ ...validationErrors, [field.key]: '' });
                                  }
                                }}
                                className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-primary-500"
                              >
                                {field.options?.map((opt: any) => (
                                  <option key={opt.value} value={opt.value} className="bg-slate-900 text-white">
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            ) : field.type === 'textarea' ? (
                              <textarea
                                rows={3}
                                placeholder={field.placeholder}
                                value={formData[field.key] || ''}
                                onChange={(e) => {
                                  setFormData({ ...formData, [field.key]: e.target.value });
                                  if (validationErrors[field.key]) {
                                    setValidationErrors({ ...validationErrors, [field.key]: '' });
                                  }
                                }}
                                className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-primary-500"
                              />
                            ) : (
                              <input
                                type={isSecret && !showPassword[field.key] ? 'password' : 'text'}
                                placeholder={field.placeholder}
                                value={formData[field.key] || ''}
                                onChange={(e) => {
                                  setFormData({ ...formData, [field.key]: e.target.value });
                                  if (validationErrors[field.key]) {
                                    setValidationErrors({ ...validationErrors, [field.key]: '' });
                                  }
                                }}
                                className={`w-full bg-black/60 border rounded-xl px-3.5 py-2 text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none transition-all ${
                                  error
                                    ? 'border-red-500 focus:border-red-500'
                                    : 'border-white/10 focus:border-primary-500'
                                } ${isSecret ? 'pr-10' : ''}`}
                              />
                            )}

                            {isSecret && (
                              <button
                                type="button"
                                onClick={() =>
                                  setShowPassword({
                                    ...showPassword,
                                    [field.key]: !showPassword[field.key],
                                  })
                                }
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                              >
                                {showPassword[field.key] ? (
                                  <EyeOff className="w-3.5 h-3.5" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>

                          {error && (
                            <p className="text-[10px] text-red-400 font-bold mt-0.5 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> {error}
                            </p>
                          )}

                          {field.helpText && !error && (
                            <p className="text-[10px] text-slate-500 mt-0.5">{field.helpText}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2.5 text-slate-400 hover:text-white font-bold flex items-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Requirements
              </button>
              <button
                onClick={() => {
                  if (validateForm()) {
                    setStep(4);
                    handleTestConnection();
                  }
                }}
                className="px-6 py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-lg shadow-primary-600/30 transition-all"
              >
                Proceed to Test Connection <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            STEP 4: TEST CONNECTION & DETECT CAPABILITIES
           ═══════════════════════════════════════════════════════════════════ */}
        {step === 4 && selectedProvider && (
          <div className="space-y-5 text-xs">
            <div className="bg-black/50 border border-white/10 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Terminal className="w-4 h-4 text-primary-400" />
                  <span>Connection & Capability Verification</span>
                </div>
                <button
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold flex items-center gap-1.5 border border-white/10 transition-all text-xs"
                >
                  <Play className={`w-3.5 h-3.5 text-emerald-400 ${isTesting ? 'animate-spin' : ''}`} />
                  {isTesting ? 'Testing...' : 'Retest Connection'}
                </button>
              </div>

              {isTesting ? (
                <div className="py-8 text-center space-y-3">
                  <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-slate-400 text-xs">
                    Testing network reachability, TLS authentication, database readiness, and permissions...
                  </p>
                </div>
              ) : testResult ? (
                <div className="space-y-4">
                  {/* Status Banner */}
                  <div
                    className={`p-4 rounded-2xl border flex items-start gap-3 ${
                      testResult.status === 'HEALTHY'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : testResult.status === 'DEGRADED'
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                        : 'bg-red-500/10 border-red-500/30 text-red-300'
                    }`}
                  >
                    {testResult.status === 'HEALTHY' ? (
                      <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0 text-emerald-400" />
                    ) : testResult.status === 'DEGRADED' ? (
                      <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0 text-amber-400" />
                    ) : (
                      <XCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-red-400" />
                    )}
                    <div>
                      <h4 className="font-bold text-sm text-white">
                        {testResult.status === 'HEALTHY'
                          ? 'Connection Ready & Verified'
                          : testResult.status === 'DEGRADED'
                          ? 'Connected with Degraded Warnings'
                          : 'Connection Test Failed'}
                      </h4>
                      <p className="text-xs opacity-90 mt-0.5">{testResult.message}</p>
                      <p className="text-[10px] font-mono opacity-70 mt-1">
                        Source: {testResult.metricSource} • Latency: {testResult.latencyMs}ms
                      </p>
                    </div>
                  </div>

                  {/* Step-by-Step Breakdown Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    <div className="bg-white/5 border border-white/10 p-3 rounded-xl flex items-center justify-between">
                      <span className="text-slate-400">Network</span>
                      {testResult.breakdown?.network ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1">✓ Live</span>
                      ) : (
                        <span className="text-red-400 font-bold flex items-center gap-1">✗ Failed</span>
                      )}
                    </div>
                    <div className="bg-white/5 border border-white/10 p-3 rounded-xl flex items-center justify-between">
                      <span className="text-slate-400">Authentication</span>
                      {testResult.breakdown?.authentication ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1">✓ Valid</span>
                      ) : (
                        <span className="text-red-400 font-bold flex items-center gap-1">✗ Failed</span>
                      )}
                    </div>
                    <div className="bg-white/5 border border-white/10 p-3 rounded-xl flex items-center justify-between">
                      <span className="text-slate-400">Provider Identity</span>
                      {testResult.breakdown?.providerIdentity ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1">✓ Verified</span>
                      ) : (
                        <span className="text-red-400 font-bold flex items-center gap-1">—</span>
                      )}
                    </div>
                    <div className="bg-white/5 border border-white/10 p-3 rounded-xl flex items-center justify-between">
                      <span className="text-slate-400">Database Ready</span>
                      {testResult.breakdown?.databaseAvailability ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1">✓ Ready</span>
                      ) : (
                        <span className="text-red-400 font-bold flex items-center gap-1">✗ Error</span>
                      )}
                    </div>
                    <div className="bg-white/5 border border-white/10 p-3 rounded-xl flex items-center justify-between">
                      <span className="text-slate-400">Permissions</span>
                      {testResult.breakdown?.permissions ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1">✓ Granted</span>
                      ) : (
                        <span className="text-red-400 font-bold flex items-center gap-1">✗ Missing</span>
                      )}
                    </div>
                    <div className="bg-white/5 border border-white/10 p-3 rounded-xl flex items-center justify-between">
                      <span className="text-slate-400">Latency</span>
                      <span className="text-cyan-400 font-mono font-bold">{testResult.latencyMs} ms</span>
                    </div>
                  </div>

                  {/* Detected Capabilities */}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-2">
                    <span className="font-bold text-slate-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-primary-400" /> Detected Capabilities
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {testResult.detectedCapabilities?.length > 0 ? (
                        testResult.detectedCapabilities.map((cap: string) => (
                          <span
                            key={cap}
                            className="px-2 py-0.5 bg-primary-500/20 text-primary-300 border border-primary-500/30 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1"
                          >
                            <Check className="w-3 h-3 text-primary-400" /> {cap}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-500 text-[11px]">No capabilities detected.</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-slate-400 text-xs">
                  Click &quot;Retest Connection&quot; to probe the database.
                </div>
              )}
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <button
                onClick={() => setStep(3)}
                className="px-4 py-2.5 text-slate-400 hover:text-white font-bold flex items-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Edit Config
              </button>
              <button
                onClick={() => setStep(5)}
                disabled={testResult?.status === 'UNREACHABLE'}
                className={`px-6 py-2.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
                  testResult?.status === 'UNREACHABLE'
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-primary-600 hover:bg-primary-500 text-white shadow-lg shadow-primary-600/30'
                }`}
              >
                Assign Purpose & Role <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            STEP 5: ASSIGN ROLE & DATA CLASSIFICATION
           ═══════════════════════════════════════════════════════════════════ */}
        {step === 5 && selectedProvider && (
          <div className="space-y-4 text-xs">
            <div className="bg-black/50 border border-white/10 rounded-2xl p-5 space-y-4">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Display Identifier & Name</label>
                <input
                  type="text"
                  value={roleForm.name}
                  onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-bold focus:outline-none focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">
                  What should Olive Pizza use this database for? (Role)
                </label>
                <select
                  value={roleForm.currentRole}
                  onChange={(e) => setRoleForm({ ...roleForm, currentRole: e.target.value })}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-primary-500"
                >
                  {selectedProvider.availableRoles?.map((r: string) => (
                    <option key={r} value={r} className="bg-slate-900 text-white">
                      {ROLE_LABELS[r] || r}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  Connecting a new database does NOT automatically move live orders, users, or payments. Roles govern monitoring and telemetry routing.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Data Classification</label>
                  <select
                    value={roleForm.dataClassification}
                    onChange={(e) => setRoleForm({ ...roleForm, dataClassification: e.target.value })}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-primary-500"
                  >
                    <option value="critical_business" className="bg-slate-900">Critical Business</option>
                    <option value="operational" className="bg-slate-900">Operational</option>
                    <option value="analytics" className="bg-slate-900">Analytics</option>
                    <option value="archive" className="bg-slate-900">Archive</option>
                    <option value="content" className="bg-slate-900">Content</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Criticality</label>
                  <select
                    value={roleForm.criticality}
                    onChange={(e) => setRoleForm({ ...roleForm, criticality: e.target.value })}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-primary-500"
                  >
                    <option value="CRITICAL" className="bg-slate-900">CRITICAL</option>
                    <option value="OPERATIONAL" className="bg-slate-900">OPERATIONAL</option>
                    <option value="ANALYTICS" className="bg-slate-900">ANALYTICS</option>
                    <option value="ARCHIVE" className="bg-slate-900">ARCHIVE</option>
                    <option value="CONTENT" className="bg-slate-900">CONTENT</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Failover / Overflow Alternative</label>
                <input
                  type="text"
                  placeholder="e.g. Supabase PostgreSQL or Cloudflare R2"
                  value={roleForm.failoverAlternative}
                  onChange={(e) => setRoleForm({ ...roleForm, failoverAlternative: e.target.value })}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-primary-500"
                />
              </div>
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <button
                onClick={() => setStep(4)}
                className="px-4 py-2.5 text-slate-400 hover:text-white font-bold flex items-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Test
              </button>
              <button
                onClick={handleSaveDatabase}
                disabled={isSaving}
                className="px-6 py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-lg shadow-primary-600/30 transition-all"
              >
                <Check className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
                {isSaving ? 'Saving...' : 'Save & Begin Monitoring'}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
