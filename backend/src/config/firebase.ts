import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';
import dotenv from 'dotenv';

dotenv.config();

// Firebase project config — hardcoded as fallback (read from .env if available)
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'olive-pizza-08';
const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL || '';
const FIREBASE_PRIVATE_KEY = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

let adminDbInstance: ReturnType<typeof getFirestore> | null = null;
let adminAuthInstance: ReturnType<typeof getAuth> | null = null;
let adminMessagingInstance: ReturnType<typeof getMessaging> | null = null;

if (getApps().length === 0) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
      // Option 1: Full base64-encoded service account JSON
      const serviceAccount = JSON.parse(
        Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8')
      );
      initializeApp({ credential: cert(serviceAccount) });
      console.log('[Firebase Admin] ✅ Initialized with base64 service account.');
    } else if (FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
      // Option 2: Individual env vars
      initializeApp({
        credential: cert({
          projectId: FIREBASE_PROJECT_ID,
          clientEmail: FIREBASE_CLIENT_EMAIL,
          privateKey: FIREBASE_PRIVATE_KEY,
        }),
      });
      console.log('[Firebase Admin] ✅ Initialized with individual env var credentials.');
    } else {
      // Option 3: No credentials — initialize without auth (limited to public Firestore rules)
      // This prevents the "applicationDefault" crash on local machines without gcloud CLI
      initializeApp({ projectId: FIREBASE_PROJECT_ID });
      console.warn('[Firebase Admin] ⚠️ No service account found. Initialized with projectId only. Set FIREBASE_SERVICE_ACCOUNT_BASE64 in .env for full access.');
    }
  } catch (error) {
    console.error('[Firebase Admin] ❌ Initialization Error:', error);
    // Still call initializeApp with minimal config so getFirestore/getAuth don't crash
    try { initializeApp({ projectId: FIREBASE_PROJECT_ID }); } catch {}
  }
}

try {
  adminDbInstance = getFirestore();
  adminDbInstance.settings({ ignoreUndefinedProperties: true });
  adminAuthInstance = getAuth();
  adminMessagingInstance = getMessaging();
} catch (e) {
  console.error('[Firebase Admin] Could not get Firestore/Auth/Messaging instance:', e);
}

// Export with fallback to avoid null crashes downstream
export const adminDb = adminDbInstance!;
export const adminAuth = adminAuthInstance!;
export const adminMessaging = adminMessagingInstance!;
