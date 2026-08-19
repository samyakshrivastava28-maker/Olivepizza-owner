export const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  (process.env.NODE_ENV === 'production'
    ? 'https://olivepizza-owner.vercel.app'
    : 'http://localhost:5174');

export const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.RENDER_PUBLIC_URL ||
  (process.env.NODE_ENV === 'production' ? 'https://olivepizza-owner.onrender.com' : 'http://localhost:5175');

export const MAIN_SITE_BACKEND_URL =
  process.env.MAIN_SITE_BACKEND_URL || 'https://olive-pizza.onrender.com';
