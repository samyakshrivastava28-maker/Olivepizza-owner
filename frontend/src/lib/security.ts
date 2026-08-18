import { addDoc, collection } from 'firebase/firestore';
import { db } from './firebase';

export async function logSecurityEvent(params: {
  action: string;
  route: string;
  uid?: string;
  email?: string;
  role?: string;
}) {
  try {
    await addDoc(collection(db, 'security_logs'), {
      ...params,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    });
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}
