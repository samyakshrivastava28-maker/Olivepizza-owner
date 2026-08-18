import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from 'react-hot-toast';
import { OwnerGuard } from './components/auth/OwnerGuard';
import { OwnerLayout } from './components/layout/OwnerLayout';
import { PizzaLoader } from './components/ui/PizzaLoader';
import AuthProvider from './components/auth/AuthProvider';

// Lazy load full-fidelity owner pages
const Login = lazy(() => import('./pages/Login'));
const OwnerDashboard = lazy(() => import('./pages/OwnerDashboard'));
const OwnerOrders = lazy(() => import('./pages/OwnerOrders'));
const OwnerOrderHistory = lazy(() => import('./pages/OwnerOrderHistory'));
const OwnerProducts = lazy(() => import('./pages/OwnerProducts'));
const OwnerSpecialCategories = lazy(() => import('./pages/OwnerSpecialCategories'));
const OwnerCoupons = lazy(() => import('./pages/OwnerCoupons'));
const OwnerAds = lazy(() => import('./pages/OwnerAds'));
const OwnerMediaLibrary = lazy(() => import('./pages/OwnerMediaLibrary'));
const HomePageManager = lazy(() => import('./pages/HomePageManager'));
const DeliveryPartners = lazy(() => import('./pages/DeliveryPartners'));
const OwnerReports = lazy(() => import('./pages/OwnerReports'));
const OwnerCustomers = lazy(() => import('./pages/OwnerCustomers'));
const OwnerEmailCenter = lazy(() => import('./pages/OwnerEmailCenter'));
const OwnerNotificationCenter = lazy(() => import('./pages/OwnerNotificationCenter'));
const OwnerNotificationDiagnostics = lazy(() => import('./pages/OwnerNotificationDiagnostics'));
const OwnerVerificationMetrics = lazy(() => import('./pages/OwnerVerificationMetrics'));
const AIHealthMonitor = lazy(() => import('./pages/AIHealthMonitor'));
const OwnerAIKnowledge = lazy(() => import('./pages/OwnerAIKnowledge'));
const OwnerSecurity = lazy(() => import('./pages/OwnerSecurity'));
const OwnerVersionManagement = lazy(() => import('./pages/OwnerVersionManagement'));
const OwnerEvents = lazy(() => import('./pages/OwnerEvents'));
const OwnerAnalytics = lazy(() => import('./pages/OwnerAnalytics'));
const DataManagerHub = lazy(() => import('./pages/DataManager/DataManagerHub'));
const OwnerSettings = lazy(() => import('./pages/OwnerSettings'));

export default function App() {
  return (
    <HelmetProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#131B2B',
            color: '#fff',
            border: '1px solid #334155',
            fontSize: '12px',
            borderRadius: '12px',
          },
        }}
      />
      <AuthProvider>
        <Suspense fallback={<PizzaLoader text="Initializing Olive Pizza Owner Platform..." />}>
          <Routes>
            {/* Public Login */}
            <Route path="/login" element={<Login />} />

            {/* Protected Owner Routes */}
            <Route element={<OwnerGuard />}>
              <Route element={<OwnerLayout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<OwnerDashboard />} />
                <Route path="/orders" element={<OwnerOrders />} />
                <Route path="/live-orders" element={<Navigate to="/orders" replace />} />
                <Route path="/order-history" element={<OwnerOrderHistory />} />
                <Route path="/products" element={<OwnerProducts />} />
                <Route path="/menu" element={<Navigate to="/products" replace />} />
                <Route path="/special-categories" element={<OwnerSpecialCategories />} />
                <Route path="/coupons" element={<OwnerCoupons />} />
                <Route path="/ads" element={<OwnerAds />} />
                <Route path="/media" element={<OwnerMediaLibrary />} />
                <Route path="/home-page-manager" element={<HomePageManager />} />
                <Route path="/website-manager" element={<HomePageManager />} />
                <Route path="/website-manager/*" element={<HomePageManager />} />
                <Route path="/partners" element={<DeliveryPartners />} />
                <Route path="/reports" element={<OwnerReports />} />
                <Route path="/customers" element={<OwnerCustomers />} />
                <Route path="/email" element={<OwnerEmailCenter />} />
                <Route path="/notifications" element={<OwnerNotificationCenter />} />
                <Route path="/notification-diagnostics" element={<OwnerNotificationDiagnostics />} />
                <Route path="/verification-metrics" element={<OwnerVerificationMetrics />} />
                <Route path="/ai-monitor" element={<AIHealthMonitor />} />
                <Route path="/ai-knowledge" element={<OwnerAIKnowledge />} />
                <Route path="/security" element={<OwnerSecurity />} />
                <Route path="/versions" element={<OwnerVersionManagement />} />
                <Route path="/events" element={<OwnerEvents />} />
                <Route path="/analytics" element={<OwnerAnalytics />} />
                <Route path="/data-manager" element={<DataManagerHub />} />
                <Route path="/data-manager/*" element={<DataManagerHub />} />
                <Route path="/settings" element={<OwnerSettings />} />
              </Route>
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </HelmetProvider>
  );
}
