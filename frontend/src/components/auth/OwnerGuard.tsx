import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuthStore } from '../../lib/store';
import { PizzaLoader } from '../ui/PizzaLoader';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export const OwnerGuard: React.FC = () => {
  const { user, role, isAuthenticated, isLoading, isInitialized, isDatabaseUnavailable } = useAuthStore();
  const location = useLocation();

  // 1. While loading or initializing, display smooth loader
  if (isLoading || !isInitialized) {
    return <PizzaLoader text="Verifying owner authorization..." />;
  }

  // 2. If the authoritative database is down (503), retain session and show reconnect state
  if (isDatabaseUnavailable) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-4 text-amber-400 animate-pulse">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold mb-2">Authoritative Database Temporarily Unavailable (HTTP 503)</h2>
        <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
          Your authenticated session is securely retained. The platform is waiting for the database service to resume.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          Retry Connection
        </button>
      </div>
    );
  }

  // 3. Strict Database-Authoritative Authorization Check:
  // Must be authenticated AND have the platform owner role confirmed by the server
  const isAuthorized = isAuthenticated && !!user && (role === 'owner' || role === 'platform_owner');

  if (!isAuthorized) {
    const shouldAttachRedirect = location.pathname && location.pathname !== '/' && location.pathname !== '/login' && location.pathname !== '/dashboard';
    const redirectParam = shouldAttachRedirect ? `?redirect=${encodeURIComponent(location.pathname)}` : '';
    return <Navigate to={`/login${redirectParam}`} replace />;
  }

  return <Outlet />;
};
