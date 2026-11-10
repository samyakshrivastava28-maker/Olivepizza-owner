import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';

import { useAuthStore } from '../../lib/store';
import toast from 'react-hot-toast';
import { logSecurityEvent } from '../../lib/security';
import { motion } from 'framer-motion';
import { auth } from '../../lib/firebase';

const showNotFoundToast = () => {
  toast.custom((t) => (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      className="max-w-md w-full bg-slate-900/90 backdrop-blur-xl shadow-2xl rounded-2xl pointer-events-auto flex ring-1 ring-white/10 overflow-hidden"
    >
      <div className="flex-1 p-5">
        <h3 className="text-lg font-black text-white mb-1">Page Not Found</h3>
        <p className="text-sm text-slate-300 font-medium leading-relaxed">
          The page you are trying to access does not exist or is unavailable.
        </p>
      </div>
      <div className="flex border-l border-white/10 bg-slate-800/50 hover:bg-slate-800 transition-colors">
        <button
          onClick={() => toast.dismiss(t.id)}
          className="w-full h-full px-6 flex items-center justify-center text-sm font-bold text-primary-500 focus:outline-none"
        >
          Close
        </button>
      </div>
    </motion.div>
  ), { duration: 4000 });
};

// 1. Core Auth Guard (Must be logged in)
export function AuthGuard() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) return <div className="h-screen w-full flex items-center justify-center font-bold text-slate-500">Authenticating...</div>;
  if (!isAuthenticated) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  return <Outlet />;
}

// 2. Customer Guard (Must be logged in, prevents guests)
export function CustomerGuard() {
  const { isAuthenticated, isLoading, role } = useAuthStore();
  const location = useLocation();

  if (isLoading) return <div className="h-screen w-full flex items-center justify-center">Authenticating...</div>;
  
  if (!isAuthenticated) {
    toast.error('Please login to access your dashboard');
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  // Prevent delivery partners and owners from accessing the customer dashboard directly
  if ((role as string) === 'delivery_partner') {
    return <Navigate to="/delivery/dashboard" replace />;
  }
  
  if (role === 'owner' || role === 'admin' || (role as string) === 'developer') {
    return <Navigate to="/owner/dashboard" replace />;
  }

  return <Outlet />;
}

// 3. Delivery Guard (Must be delivery_partner or delivery)
export function DeliveryGuard() {
  const { isAuthenticated, user, role, isLoading } = useAuthStore();
  const location = useLocation();

  const isUnauthorized = !isAuthenticated || ((role as string) !== 'delivery_partner');

  React.useEffect(() => {
    if (!isLoading && isUnauthorized) {
      showNotFoundToast();
      if (role && (role as string) !== 'delivery_partner') {
        logSecurityEvent({
          action: 'unauthorized_delivery_access_attempt',
          route: location.pathname,
          uid: user?.uid,
          email: user?.email,
          role: role
        });
      }
    }
  }, [isLoading, isUnauthorized, role, location.pathname, user?.uid, user?.email]);

  if (isLoading) return <div className="h-screen flex items-center justify-center">Verifying Access...</div>;
  if (isUnauthorized) return <Navigate to="/" replace />;

  return <Outlet />;
}

// 4. Owner Guard (Must be confirmed owner or platform_owner)
export function OwnerGuard() {
  const { isAuthenticated, user, role, isLoading } = useAuthStore();
  const location = useLocation();

  const isAllowed = isAuthenticated && (role === 'owner' || role === 'platform_owner');
  const isUnauthorized = !isAuthenticated || !isAllowed;

  React.useEffect(() => {
    if (!isLoading && isUnauthorized) {
      showNotFoundToast();
      if (role && !isAllowed) {
        logSecurityEvent({
          action: 'unauthorized_owner_access_attempt',
          route: location.pathname,
          uid: user?.uid,
          email: user?.email,
          role: role
        });
      }
    }
  }, [isLoading, isUnauthorized, role, isAllowed, location.pathname, user?.uid, user?.email]);

  if (isLoading) return <div className="h-screen flex items-center justify-center">Verifying Access...</div>;
  if (isUnauthorized) return <Navigate to="/" replace />;

  return <Outlet />;
}

// 5. Admin Guard (Platform Owner or Admin)
export function AdminGuard() {
  const { isAuthenticated, user, role, isLoading } = useAuthStore();
  const location = useLocation();

  const isAllowed = isAuthenticated && (role === 'admin' || role === 'owner' || role === 'platform_owner');
  const isUnauthorized = !isAuthenticated || !isAllowed;

  React.useEffect(() => {
    if (!isLoading && isUnauthorized) {
      showNotFoundToast();
      if (role && !isAllowed) {
        logSecurityEvent({
          action: 'unauthorized_admin_access_attempt',
          route: location.pathname,
          uid: user?.uid,
          email: user?.email,
          role: role
        });
      }
    }
  }, [isLoading, isUnauthorized, role, isAllowed, location.pathname, user?.uid, user?.email]);

  if (isLoading) return null;
  if (isUnauthorized) return <Navigate to="/" replace />;

  return <Outlet />;
}

// 6. Developer Guard (strictly developer or platform_owner role confirmed by database)
export function DeveloperGuard() {
  const { isAuthenticated, user, role, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return <div className="h-screen flex items-center justify-center text-slate-400 text-sm font-bold bg-dark-950">Verifying developer access...</div>;
  }

  const isDevUser = isAuthenticated && (role === 'developer' || role === 'platform_owner');

  if (!isAuthenticated || !isDevUser) {
    if (isAuthenticated && user) {
      logSecurityEvent({
        action: 'unauthorized_developer_access_attempt',
        route: location.pathname,
        uid: user?.uid,
        email: user?.email,
        role: role || undefined
      });
      toast.error('Developer dashboard is restricted. Access denied.');
    }
    return <Navigate to="/home" replace />;
  }

  return <Outlet />;
}

