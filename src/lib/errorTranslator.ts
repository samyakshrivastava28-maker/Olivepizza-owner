import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Maps technical error codes or messages to human-readable strings.
 * Ensures users never see "Firebase:", "PostgreSQL", or internal stack traces.
 */
export function translateError(error: any): string {
  if (!error) return "Something went wrong. Please try again.";
  
  const msg = (error.message || error.code || String(error)).toLowerCase();

  // Network and Connectivity Errors
  if (msg.includes('network-request-failed') || msg.includes('failed to fetch') || msg.includes('net::err_internet_disconnected')) {
    return "Please check your internet connection.";
  }
  if (msg.includes('timeout') || msg.includes('deadline-exceeded')) {
    return "The request took too long. Please try again.";
  }

  // Firebase Auth Errors
  if (msg.includes('user-not-found') || msg.includes('wrong-password') || msg.includes('invalid-credential')) {
    return "Invalid email or password. Please try again.";
  }
  if (msg.includes('email-already-in-use')) {
    return "This email is already registered. Please sign in.";
  }
  if (msg.includes('too-many-requests')) {
    return "Too many attempts. Please try again later.";
  }
  if (msg.includes('popup-closed-by-user')) {
    return "Sign-in was cancelled.";
  }
  if (msg.includes('invalid-email')) {
    return "Please enter a valid email address.";
  }
  if (msg.includes('unauthorized-domain')) {
    return "This login method is currently unavailable. Please use email and password.";
  }
  if (msg.includes('session-expired') || msg.includes('auth/invalid-user-token')) {
    return "Your session has expired. Please sign in again.";
  }

  // General Provider/Database Errors
  if (msg.includes('permission-denied') || msg.includes('missing or insufficient permissions')) {
    return "You do not have permission to perform this action.";
  }
  
  // Recaptcha or other 3rd party
  if (msg.includes('recaptcha')) {
    return "Security verification failed. Please try again.";
  }

  // Fallback for everything else
  // Do not return `msg` as it might contain technical details!
  return "Something went wrong. Please try again.";
}

/**
 * Silently logs the detailed technical error to the database for developers.
 * Never shown to users.
 */
export async function logDetailedError(error: any, context?: any) {
  try {
    const errorLog = {
      timestamp: serverTimestamp(),
      type: error?.name || 'Error',
      message: error?.message || String(error),
      code: error?.code || 'unknown',
      stack: error?.stack || null,
      context: context || {},
      device: {
        userAgent: navigator.userAgent,
        appVersion: (window as any).__APP_VERSION__ || 'unknown',
        isOnline: navigator.onLine,
        url: window.location.href,
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight
      }
    };
    
    // Fire and forget
    addDoc(collection(db, 'client_errors'), errorLog).catch(() => {});
  } catch (e) {
    // Failsafe to ensure logging never breaks the main thread
    console.error('Failed to log client error internally');
  }
}
