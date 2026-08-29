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

  // Validate owner / staff role or whitelisted email
  const isEmailApproved = isAuthorizedOwnerEmail(user?.email);
  const isAuthorized = !!user && (
    role === 'owner' || 
    role === 'admin' || 
    role === 'developer' || 
    role === 'manager' ||
    role === 'restaurant_manager' ||
    role === 'franchise_owner' ||
    isEmailApproved
  );

  // If initialization complete and user is not authenticated or not authorized, redirect to login
  if (isInitialized && (!user || !isAuthorized)) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  return <Outlet />;
};
