import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAqkcY-WQrW3WoZWRrv8oo7MTAI_nVrLw4",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "olive-pizza-08.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "olive-pizza-08",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "olive-pizza-08.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1017239455106",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1017239455106:web:ea5dd73d10722020007b9b"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export const getMessagingInstance = async () => {
  if (typeof window === 'undefined' || !('Notification' in window)) return null;
  try {
    const { getMessaging } = await import('firebase/messaging');
    return getMessaging(app);
  } catch {
    return null;
  }
};

export const getFirebaseMessaging = getMessagingInstance;

export const getCurrentAuthToken = async (): Promise<string> => {
  if (auth.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
      if (token) return token;
    } catch {}
  }

  if (typeof (auth as any).authStateReady === 'function') {
    try {
      await (auth as any).authStateReady();
      if (auth.currentUser) {
        const token = await auth.currentUser.getIdToken();
        if (token) return token;
      }
    } catch {}
  }

  return new Promise((resolve, reject) => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      unsubscribe();
      if (user) {
        try {
          const token = await user.getIdToken();
          if (token) {
            resolve(token);
            return;
          }
        } catch (e) {
          reject(e);
          return;
        }
      }
      reject(new Error("User not authenticated with Firebase Auth"));
    });
  });
};
