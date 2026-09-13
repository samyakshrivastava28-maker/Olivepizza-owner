import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuthStore, isAuthorizedOwnerEmail } from '../../lib/store';
import { PizzaLoader } from '../ui/PizzaLoader';

export const OwnerGuard: React.FC = () => {
  const { user, role, isAuthenticated, isLoading, isInitialized } = useAuthStore();
  const location = useLocation();

  // If auth is completely uninitialized and no cached session exists, show smooth loader
  if (isLoading && !user) {
    return <PizzaLoader text="Verifying owner authorization..." />;
  }

  // Validate owner / staff role, granted application access, or whitelisted email
  const isEmailApproved = isAuthorizedOwnerEmail(user?.email);
  const hasAppAccess = Boolean(
    (user?.allowedApps && user.allowedApps.length > 0) ||
    (user?.applicationAccess && Object.values(user.applicationAccess).some(Boolean))
  );

  const isAuthorized = !!user && (
    role === 'owner' || 
    role === 'admin' || 
    role === 'developer' || 
    role === 'platform_owner' ||
    role === 'restaurant_manager' ||
    role === 'franchise_owner' ||
    role === 'franchise_manager' ||
    role === 'manager' ||
    role === 'staff' ||
    role === 'cashier' ||
    role === 'delivery_partner' ||
    hasAppAccess ||
    isEmailApproved
  );

  // If initialization complete and user is not authenticated or not authorized, redirect to login
  if (isInitialized && (!user || !isAuthorized)) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  return <Outlet />;
};
