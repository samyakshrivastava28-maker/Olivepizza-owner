import dotenv from 'dotenv';
dotenv.config();

// Centralized Frontend & Backend URL configuration
export const FRONTEND_URL = process.env.FRONTEND_URL 
  || (process.env.NODE_ENV === 'production' ? 'https://olive-pizza.vercel.app' : 'http://localhost:5173');

export const API_BASE = process.env.BACKEND_URL || process.env.API_BASE
  || (process.env.NODE_ENV === 'production' ? 'https://olive-pizza-owner.onrender.com' : 'http://localhost:5175');

export const MAIN_SITE_BACKEND_URL = process.env.MAIN_SITE_BACKEND_URL || 'https://olive-pizza.onrender.com';

