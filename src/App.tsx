import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from 'react-hot-toast';
import { OwnerGuard } from './components/auth/OwnerGuard';
import { OwnerLayout } from './components/layout/OwnerLayout';
import { PizzaLoader } from './components/ui/PizzaLoader';

// Lazy load owner pages
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const LiveOrders = lazy(() => import('./pages/LiveOrders'));
const OrderHistory = lazy(() => import('./pages/OrderHistory'));
const Products = lazy(() => import('./pages/Products'));
const SpecialCategories = lazy(() => import('./pages/SpecialCategories'));
const Coupons = lazy(() => import('./pages/Coupons'));
const Ads = lazy(() => import('./pages/Ads'));
const MediaLibrary = lazy(() => import('./pages/MediaLibrary'));
const HomePageManager = lazy(() => import('./pages/HomePageManager'));
const DeliveryPartners = lazy(() => import('./pages/DeliveryPartners'));
const Reports = lazy(() => import('./pages/Reports'));
const Customers = lazy(() => import('./pages/Customers'));
const EmailCenter = lazy(() => import('./pages/EmailCenter'));
const NotificationCenter = lazy(() => import('./pages/NotificationCenter'));
const NotificationDiagnostics = lazy(() => import('./pages/NotificationDiagnostics'));
const VerificationMetrics = lazy(() => import('./pages/VerificationMetrics'));
const AIHealthMonitor = lazy(() => import('./pages/AIHealthMonitor'));
const AIKnowledge = lazy(() => import('./pages/AIKnowledge'));
const SecurityLogs = lazy(() => import('./pages/SecurityLogs'));
const VersionManagement = lazy(() => import('./pages/VersionManagement'));
const Events = lazy(() => import('./pages/Events'));
const Analytics = lazy(() => import('./pages/Analytics'));
const DataManager = lazy(() => import('./pages/DataManager'));
const Settings = lazy(() => import('./pages/Settings'));
const Franchises = lazy(() => import('./pages/Franchises'));

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
      <Suspense fallback={<PizzaLoader text="Initializing Owner Platform..." />}>
        <Routes>
          {/* Public Login */}
          <Route path="/login" element={<Login />} />

          {/* Protected Owner Routes */}
          <Route element={<OwnerGuard />}>
            <Route element={<OwnerLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/orders" element={<LiveOrders />} />
              <Route path="/live-orders" element={<Navigate to="/orders" replace />} />
              <Route path="/order-history" element={<OrderHistory />} />
              <Route path="/products" element={<Products />} />
              <Route path="/menu" element={<Navigate to="/products" replace />} />
              <Route path="/special-categories" element={<SpecialCategories />} />
              <Route path="/coupons" element={<Coupons />} />
              <Route path="/ads" element={<Ads />} />
              <Route path="/media" element={<MediaLibrary />} />
              <Route path="/home-page-manager" element={<HomePageManager />} />
              <Route path="/partners" element={<DeliveryPartners />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/email" element={<EmailCenter />} />
              <Route path="/notifications" element={<NotificationCenter />} />
              <Route path="/notification-diagnostics" element={<NotificationDiagnostics />} />
              <Route path="/verification-metrics" element={<VerificationMetrics />} />
              <Route path="/ai-monitor" element={<AIHealthMonitor />} />
              <Route path="/ai-knowledge" element={<AIKnowledge />} />
              <Route path="/security" element={<SecurityLogs />} />
              <Route path="/versions" element={<VersionManagement />} />
              <Route path="/events" element={<Events />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/data-manager" element={<DataManager />} />
              <Route path="/settings" element={<Settings />} />`r`n              <Route path="/franchises" element={<Franchises />} />
            </Route>
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </HelmetProvider>
  );
}
