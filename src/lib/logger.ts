import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export type ActivityAction = 
  | 'Product Created' 
  | 'Product Updated' 
  | 'Product Deleted' 
  | 'Coupon Created' 
  | 'Coupon Updated' 
  | 'Ad Created' 
  | 'Ad Updated'
  | 'Order Status Changed' 
  | 'Order Cancelled'
  | 'Delivery Assigned'
  | 'Special Category Created'
  | 'Special Category Updated'
  | 'Special Category Deleted';

export const logActivity = async (
  action: ActivityAction,
  details: string,
  userEmail: string | null = 'System'
) => {
  try {
    await addDoc(collection(db, 'activity_logs'), {
      action,
      details,
      user: userEmail,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
};
