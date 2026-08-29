import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from 'react-hot-toast';
import { OwnerGuard } from './components/auth/OwnerGuard';
import { OwnerLayout } from './components/layout/OwnerLayout';
import { PizzaLoader } from './components/ui/PizzaLoader';
import { GlobalErrorBoundary } from './components/GlobalErrorBoundary';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';
import AuthProvider from './components/auth/AuthProvider';

// Safe lazy importer with automatic retry for transient chunk loading
function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(() =>
    factory().catch((error) => {
      console.warn('[lazyWithRetry] Module failed to load, retrying in 1s...', error);
      return new Promise<{ default: T }>((resolve, reject) => {
        setTimeout(() => {
          factory().then(resolve).catch(reject);
        }, 1000);
      });
    })
  );
}

// Canonical Modules
const Login = lazyWithRetry(() => import('./pages/Login'));
const Analytics = lazyWithRetry(() => import('./pages/Analytics'));
const OrderManagement = lazyWithRetry(() => import('./pages/OrderManagement'));
const DeliveryManagement = lazyWithRetry(() => import('./pages/DeliveryManagement'));
const HomePageManager = lazyWithRetry(() => import('./pages/HomePageManager'));
const RestaurantReports = lazyWithRetry(() => import('./pages/RestaurantReports'));
const NotificationsCenter = lazyWithRetry(() => import('./pages/NotificationsCenter'));
const EmailCenter = lazyWithRetry(() => import('./pages/EmailCenter'));
const MediaLibrary = lazyWithRetry(() => import('./pages/MediaLibrary'));
const ProductMenuManager = lazyWithRetry(() => import('./pages/ProductMenuManager'));
const RestaurantManagement = lazyWithRetry(() => import('./pages/RestaurantManagement'));
const RestaurantManagers = lazyWithRetry(() => import('./pages/RestaurantManagers'));
const FranchiseManager = lazyWithRetry(() => import('./pages/FranchiseManager'));
const FranchiseWorkspace = lazyWithRetry(() => import('./pages/FranchiseWorkspace'));
const RestaurantControlPage = lazyWithRetry(() => import('./pages/RestaurantControlPage'));

export default function App() {
  return (
    <GlobalErrorBoundary>
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
                  {/* 1. Analytics */}
                  <Route index element={<Navigate to="/analytics" replace />} />
                  <Route path="/dashboard" element={<Navigate to="/analytics" replace />} />
                  <Route
                    path="/analytics"
                    element={
                      <RouteErrorBoundary>
                        <Analytics />
                      </RouteErrorBoundary>
                    }
                  />

                  {/* 2. Order Management */}
                  <Route
                    path="/orders"
                    element={
                      <RouteErrorBoundary>
                        <OrderManagement />
                      </RouteErrorBoundary>
                    }
                  />
                  <Route path="/live-orders" element={<Navigate to="/orders" replace />} />
                  <Route path="/order-history" element={<Navigate to="/orders" replace />} />

                  {/* 3. Live Delivery Fleet Management */}
                  <Route
                    path="/delivery"
                    element={
                      <RouteErrorBoundary>
                        <DeliveryManagement />
                      </RouteErrorBoundary>
                    }
                  />
                  <Route path="/delivery-management" element={<Navigate to="/delivery" replace />} />
                  <Route path="/riders" element={<Navigate to="/delivery" replace />} />
                  <Route path="/tracking" element={<Navigate to="/delivery" replace />} />

                  {/* 4. Home Page Manager */}
                  <Route
                    path="/home-manager"
                    element={
                      <RouteErrorBoundary>
                        <HomePageManager />
                      </RouteErrorBoundary>
                    }
                  />
                  <Route path="/homepage-manager" element={<Navigate to="/home-manager" replace />} />
                  <Route path="/homepage" element={<Navigate to="/home-manager" replace />} />

                  {/* 5. Restaurant Reports */}
                  <Route
                    path="/reports"
                    element={
                      <RouteErrorBoundary>
                        <RestaurantReports />
                      </RouteErrorBoundary>
                    }
                  />

                  {/* 6. Notification Center */}
                  <Route
                    path="/notifications"
                    element={
                      <RouteErrorBoundary>
                        <NotificationsCenter />
                      </RouteErrorBoundary>
                    }
                  />
                  <Route path="/notification-diagnostics" element={<Navigate to="/notifications" replace />} />

                  {/* 7. Email Marketing Center */}
                  <Route
                    path="/email"
                    element={
                      <RouteErrorBoundary>
                        <EmailCenter />
                      </RouteErrorBoundary>
                    }
                  />

                  {/* 8. Cloudinary Media Library */}
                  <Route
                    path="/media"
                    element={
                      <RouteErrorBoundary>
                        <MediaLibrary />
                      </RouteErrorBoundary>
                    }
                  />

                  {/* 9. Product & Menu Manager */}
                  <Route
                    path="/products"
                    element={
                      <RouteErrorBoundary>
                        <ProductMenuManager />
                      </RouteErrorBoundary>
                    }
                  />
                  <Route path="/menu" element={<Navigate to="/products" replace />} />
                  <Route path="/special-categories" element={<Navigate to="/products" replace />} />
                  <Route path="/coupons" element={<Navigate to="/products" replace />} />
                  <Route path="/ads" element={<Navigate to="/products" replace />} />

                  {/* 10. Restaurant & Franchise Management */}
                  <Route
                    path="/restaurant"
                    element={
                      <RouteErrorBoundary>
                        <RestaurantManagement />
                      </RouteErrorBoundary>
                    }
                  />
                  <Route
                    path="/restaurant-managers"
                    element={
                      <RouteErrorBoundary>
                        <RestaurantManagers />
                      </RouteErrorBoundary>
                    }
                  />
                  <Route
                    path="/franchises"
                    element={
                      <RouteErrorBoundary>
                        <FranchiseManager />
                      </RouteErrorBoundary>
                    }
                  />
                  <Route
                    path="/franchise-management/:franchiseSlug/*"
                    element={
                      <RouteErrorBoundary>
                        <FranchiseWorkspace />
                      </RouteErrorBoundary>
                    }
                  />
                  <Route
                    path="/franchise-management/:franchiseSlug/restaurants/:restaurantSlug/*"
                    element={
                      <RouteErrorBoundary>
                        <RestaurantControlPage />
                      </RouteErrorBoundary>
                    }
                  />
                  <Route
                    path="/franchise-management/:franchiseSlug/restaurants/:restaurantSlug"
                    element={
                      <RouteErrorBoundary>
                        <RestaurantControlPage />
                      </RouteErrorBoundary>
                    }
                  />
                  <Route
                    path="/franchise-management/:franchiseSlug"
                    element={
                      <RouteErrorBoundary>
                        <FranchiseWorkspace />
                      </RouteErrorBoundary>
                    }
                  />
                  <Route path="/franchise-manager" element={<Navigate to="/franchises" replace />} />
                  <Route path="/managers" element={<Navigate to="/restaurant-managers" replace />} />
                  <Route path="/settings" element={<Navigate to="/restaurant" replace />} />
                </Route>
              </Route>

              {/* Catch-all fallback */}
              <Route path="*" element={<Navigate to="/analytics" replace />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </HelmetProvider>
    </GlobalErrorBoundary>
  );
}
