import { Outlet, Navigate } from 'react-router';
import { useAuthStore } from '../lib/store';

export default function OnboardingGuard() {
  const { isAuthenticated, user, role, isLoading } = useAuthStore();
  
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-primary-500 font-bold text-xl">Loading...</div>;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Bypass onboarding for Owners, Admins and Delivery Partners
  if (role === 'owner' || role === 'admin' || role === 'delivery_partner') {
    return <Outlet />;
  }
  
  const onboardingComplete = user?.onboardingComplete ?? false;
  
  if (!onboardingComplete) {
    if (!user?.phoneSetupCompleted && !user?.phone) {
      return <Navigate to="/onboarding/phone" replace />;
    } else if (!user?.locationSetupCompleted && !user?.lat) {
      return <Navigate to="/onboarding/location" replace />;
    }
  }

  return <Outlet />;
}
