import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from 'react-hot-toast';
import { OwnerGuard } from './components/auth/OwnerGuard';
import { OwnerLayout } from './components/layout/OwnerLayout';
import { PizzaLoader } from './components/ui/PizzaLoader';
import AuthProvider from './components/auth/AuthProvider';

// Canonical Modules + Public Login
const Login = lazy(() => import('./pages/Login'));
const Analytics = lazy(() => import('./pages/Analytics'));
const OrderManagement = lazy(() => import('./pages/OrderManagement'));
const DeliveryManagement = lazy(() => import('./pages/DeliveryManagement'));
const RestaurantReports = lazy(() => import('./pages/RestaurantReports'));
const NotificationsCenter = lazy(() => import('./pages/NotificationsCenter'));
const EmailCenter = lazy(() => import('./pages/EmailCenter'));
const MediaLibrary = lazy(() => import('./pages/MediaLibrary'));
const ProductMenuManager = lazy(() => import('./pages/ProductMenuManager'));
const RestaurantManagement = lazy(() => import('./pages/RestaurantManagement'));

export default function App() {
  return (
    <HelmetProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#0E1524',
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
            {/* Public Login Route */}
            <Route path="/login" element={<Login />} />

            {/* Protected Owner Operations */}
            <Route element={<OwnerGuard />}>
              <Route element={<OwnerLayout />}>
                {/* 1. Analytics (Default Landing Page) */}
                <Route index element={<Navigate to="/analytics" replace />} />
                <Route path="/dashboard" element={<Navigate to="/analytics" replace />} />
                <Route path="/analytics" element={<Analytics />} />

                {/* 2. Order Management */}
                <Route path="/orders" element={<OrderManagement />} />
                <Route path="/live-orders" element={<Navigate to="/orders" replace />} />
                <Route path="/order-history" element={<Navigate to="/orders" replace />} />

                {/* 3. Live Delivery Fleet Management */}
                <Route path="/delivery" element={<DeliveryManagement />} />
                <Route path="/delivery-management" element={<Navigate to="/delivery" replace />} />
                <Route path="/riders" element={<Navigate to="/delivery" replace />} />
                <Route path="/tracking" element={<Navigate to="/delivery" replace />} />

                {/* 4. Restaurant Reports */}
                <Route path="/reports" element={<RestaurantReports />} />

                {/* 5. Notification Center */}
                <Route path="/notifications" element={<NotificationsCenter />} />
                <Route path="/notification-diagnostics" element={<Navigate to="/notifications" replace />} />

                {/* 6. Email Marketing Center */}
                <Route path="/email" element={<EmailCenter />} />

                {/* 7. Cloudinary Media Library */}
                <Route path="/media" element={<MediaLibrary />} />

                {/* 8. Product & Menu Manager */}
                <Route path="/products" element={<ProductMenuManager />} />
                <Route path="/menu" element={<Navigate to="/products" replace />} />
                <Route path="/special-categories" element={<Navigate to="/products" replace />} />
                <Route path="/coupons" element={<Navigate to="/products" replace />} />
                <Route path="/ads" element={<Navigate to="/products" replace />} />

                {/* 9. Restaurant Management */}
                <Route path="/restaurant" element={<RestaurantManagement />} />
                <Route path="/settings" element={<Navigate to="/restaurant" replace />} />
              </Route>
            </Route>

            {/* Catch-all fallback */}
            <Route path="*" element={<Navigate to="/analytics" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </HelmetProvider>
  );
}
