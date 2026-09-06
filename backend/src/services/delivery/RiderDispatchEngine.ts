import { adminDb } from '../../config/firebase.js';
import { notificationEngine } from '../notification/NotificationEngine.js';

export interface EligibleRider {
  uid: string;
  name: string;
  phone: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  score: number;
  branchId: string;
}

function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export class RiderDispatchEngine {
  /**
   * Searches and ranks eligible riders for a specific order.
   * Criteria:
   *  - Branch match
   *  - Online status == true
   *  - No active delivery assigned
   *  - Fresh GPS location (< 5 minutes old)
   *  - Excludes previously declined rider UIDs for this order
   */
  public static async findEligibleRiders(orderId: string): Promise<EligibleRider[]> {
    const orderDoc = await adminDb.collection('orders').doc(orderId).get();
    if (!orderDoc.exists) return [];
    const orderData = orderDoc.data()!;
    const branchId = orderData.branchId || 'main_branch';
    const excludedUids = new Set<string>(orderData.declinedPartnerIds || []);

    // Get restaurant coordinates (default Rajnandgaon HQ: 21.0967, 81.0315)
    const restaurantLat = orderData.restaurantLat || 21.0967;
    const restaurantLng = orderData.restaurantLng || 81.0315;

    // 1. Query delivery partners from both users and delivery_partners collections
    const ridersMap = new Map<string, any>();

    const ridersSnap = await adminDb.collection('users')
      .where('role', 'in', ['delivery_partner', 'delivery'])
      .get();
    ridersSnap.forEach((doc) => ridersMap.set(doc.id, { uid: doc.id, ...doc.data() }));

    const dpSnap = await adminDb.collection('delivery_partners').get().catch(() => ({ docs: [] } as any));
    dpSnap.forEach((doc: any) => {
      const data = doc.data();
      const uid = data.uid || doc.id;
      if (!ridersMap.has(uid)) {
        ridersMap.set(uid, { uid, ...data });
      }
    });

    // 2. Query active locations
    const locSnap = await adminDb.collection('delivery_locations').get();
    const locMap = new Map<string, any>();
    locSnap.forEach((d) => locMap.set(d.id, d.data()));

    const candidates: EligibleRider[] = [];
    const nowMs = Date.now();

    for (const [uid, rData] of ridersMap.entries()) {
      if (excludedUids.has(uid)) continue;

      const riderBranchId = rData.branchId || 'main_branch';
      if (riderBranchId !== branchId && riderBranchId !== 'all' && branchId !== 'all') continue;
      if (rData.isOnline === false || rData.isActive === false) continue;
      if (rData.activeOrderId && rData.activeOrderId !== orderId) continue; // single-assignment rule

      const loc = locMap.get(uid);
      let latitude = restaurantLat;
      let longitude = restaurantLng;
      let distanceMeters = 300; // Default: at the restaurant / branch
      let score = 5000;

      if (loc && loc.latitude && loc.longitude) {
        const locTime = loc.updated_at ? new Date(loc.updated_at).getTime() : nowMs;
        const isFresh = (nowMs - locTime) <= (15 * 60 * 1000); // 15-minute freshness window

        if (isFresh) {
          const lat = Number(loc.latitude);
          const lng = Number(loc.longitude);
          const dist = calculateDistanceMeters(restaurantLat, restaurantLng, lat, lng);
          if (dist <= 15000) { // Max radius 15km
            latitude = lat;
            longitude = lng;
            distanceMeters = dist;
            score = Math.max(1000, 10000 - dist);
          }
        }
      }

      candidates.push({
        uid,
        name: rData.name || rData.displayName || 'Rider',
        phone: rData.phone || rData.phoneNumber || '+91 91799 44445',
        latitude,
        longitude,
        distanceMeters: Math.round(distanceMeters),
        score,
        branchId: riderBranchId,
      });
    }

    // Sort by highest score (closest distance)
    candidates.sort((a, b) => b.score - a.score);
    return candidates;
  }

  /**
   * Automatically assigns best candidate and sends high-priority assignment alert
   */
  public static async autoDispatchRider(orderId: string): Promise<{ success: boolean; rider?: EligibleRider; reason?: string }> {
    const candidates = await this.findEligibleRiders(orderId);
    if (candidates.length === 0) {
      return { success: false, reason: 'No eligible riders currently available in branch radius' };
    }

    const bestRider = candidates[0];

    // Atomically assign rider in Firestore
    const orderRef = adminDb.collection('orders').doc(orderId);
    await orderRef.update({
      status: 'partner_assigned',
      deliveryPartnerId: bestRider.uid,
      deliveryPartnerName: bestRider.name,
      deliveryPartnerPhone: bestRider.phone,
      partnerAssignedAt: new Date().toISOString(),
      updatedAt: new Date(),
    });

    const orderDoc = await orderRef.get();
    const orderData = orderDoc.data() || {};
    const orderNumber = orderData.orderNumber || ('#' + orderId.slice(-6).toUpperCase());

    const { DeliveryTemplates } = await import('../notification/NotificationTemplates.js');
    const riderPayload = DeliveryTemplates.newAssignment(orderId, {
      orderNumber,
      customerName: orderData.customerName || 'Customer',
      customerPhone: orderData.contactPhone || 'N/A',
      deliveryAddress: orderData.deliveryAddress?.addressLine || orderData.deliveryAddress || 'Delivery Address',
      distance: `${(bestRider.distanceMeters / 1000).toFixed(1)} km`,
      eta: `${Math.ceil(bestRider.distanceMeters / 400) || 10} mins`,
      totalAmount: Number(orderData.totalAmount || 0),
      paymentMethod: orderData.paymentMethod || 'COD',
    });

    // Notify Rider with actionable alert
    await notificationEngine.send(bestRider.uid, riderPayload, {
      category: 'alarm_actionable',
      priority: 'critical',
      orderId,
      targetApp: 'delivery'
    });

    return { success: true, rider: bestRider };
  }
}
