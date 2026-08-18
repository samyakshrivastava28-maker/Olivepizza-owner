import React, { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuthStore, isAuthorizedOwnerEmail } from '../../lib/store';
import { PizzaLoader } from '../ui/PizzaLoader';
import toast from 'react-hot-toast';

export const OwnerGuard: React.FC = () => {
  const { user, role, isAuthenticated, isLoading } = useAuthStore();
  const location = useLocation();

  const isEmailApproved = isAuthorizedOwnerEmail(user?.email);
  const isAuthorized = isAuthenticated && (role === 'owner' || role === 'admin' || role === 'developer' || isEmailApproved);

  useEffect(() => {
    if (!isLoading && isAuthenticated && !isAuthorized) {
      toast.error('Owner access is not available for this account.', { duration: 5000 });
    }
  }, [isLoading, isAuthenticated, isAuthorized]);

  if (isLoading) {
    return <PizzaLoader text="Verifying owner authorization..." />;
  }

  if (!isAuthenticated || !isAuthorized) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  return <Outlet />;
};
