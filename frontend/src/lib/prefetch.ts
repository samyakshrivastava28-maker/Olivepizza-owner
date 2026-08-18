export const prefetchRoute = (path: string) => {
  try {
    // Only prefetch main critical paths
    if (path.startsWith('/menu')) import('../pages/Menu');
    else if (path.startsWith('/cart')) import('../pages/Cart');
    else if (path.startsWith('/contact')) import('../pages/Contact');
    else if (path.startsWith('/login')) import('../pages/Login');
    else if (path.startsWith('/dashboard')) import('../pages/CustomerDashboard');
    else if (path.startsWith('/owner/dashboard')) import('../pages/owner/OwnerDashboard');
    else if (path.startsWith('/delivery/dashboard')) import('../pages/delivery/DeliveryDashboard');
  } catch (e) {
    // Silently ignore prefetch errors
  }
};
