import { adminDb } from '../../config/firebase.js';

export interface CustomerOrderingContext {
  customerId: string;
  franchiseId: string;
  branchId: string;
  branchName: string;
  location: {
    lat: number;
    lng: number;
    addressLine?: string;
  };
  distanceKm: number;
  deliveryRadiusKm: number;
  version: number;
  resolvedAt: string;
  expiresAt: number;
}

export interface OrderingContextResolutionResult {
  isServiceable: boolean;
  context?: CustomerOrderingContext;
  error?: string;
  code?: string;
}

export class CustomerOrderingContextService {
  public static haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Resolves the authoritative Olive Pizza franchise & branch serving the provided GPS coordinates.
   * If customer is outside all active branches' delivery radius, rejects with OUT_OF_DELIVERY_ZONE.
   */
  public static async resolveOrderingContext(params: {
    customerId: string;
    lat: number;
    lng: number;
    addressLine?: string;
  }): Promise<OrderingContextResolutionResult> {
    const { customerId, lat, lng, addressLine } = params;

    if (lat == null || lng == null || isNaN(Number(lat)) || isNaN(Number(lng))) {
      return {
        isServiceable: false,
        error: 'Invalid coordinates provided for delivery location resolution.',
        code: 'INVALID_COORDINATES'
      };
    }

    const custLat = Number(lat);
    const custLng = Number(lng);

    // 1. Fetch active branches across franchises collection
    const branchesSnap = await adminDb.collection('franchises').get();
    let closestBranch: any = null;
    let minDistance = Infinity;

    for (const bDoc of branchesSnap.docs) {
      const bData = bDoc.data();
      if (bData.isActive === false) continue;

      const bLat = Number(bData.lat ?? bData.coordinates?.lat ?? bData.location?.lat);
      const bLng = Number(bData.lng ?? bData.coordinates?.lng ?? bData.location?.lng);

      if (!isNaN(bLat) && !isNaN(bLng)) {
        const dist = this.haversineDistanceKm(custLat, custLng, bLat, bLng);
        const maxRadius = Number(bData.deliveryRadiusKm || bData.maxDeliveryRadiusKm || bData.deliveryRadius || 15);

        if (dist <= maxRadius && dist < minDistance) {
          minDistance = dist;
          closestBranch = {
            id: bDoc.id,
            ...bData,
            computedDistance: dist,
            maxRadius
          };
        }
      }
    }

    // Also check franchise_entities collection if available
    try {
      const entitiesSnap = await adminDb.collection('franchise_entities').get();
      for (const eDoc of entitiesSnap.docs) {
        const eData = eDoc.data();
        if (eData.isActive === false) continue;

        const eLat = Number(eData.lat ?? eData.coordinates?.lat ?? eData.location?.lat);
        const eLng = Number(eData.lng ?? eData.coordinates?.lng ?? eData.location?.lng);

        if (!isNaN(eLat) && !isNaN(eLng)) {
          const dist = this.haversineDistanceKm(custLat, custLng, eLat, eLng);
          const maxRadius = Number(eData.deliveryRadiusKm || eData.maxDeliveryRadiusKm || 15);

          if (dist <= maxRadius && dist < minDistance) {
            minDistance = dist;
            closestBranch = {
              id: eData.mainBranchId || eDoc.id,
              franchiseId: eDoc.id,
              name: eData.name,
              computedDistance: dist,
              maxRadius
            };
          }
        }
      }
    } catch (entityErr) {
      // Non-fatal fallback
    }

    // 2. Strict Delivery Radius Evaluation
    if (!closestBranch) {
      return {
        isServiceable: false,
        error: "We currently don't deliver to this location.",
        code: 'OUT_OF_DELIVERY_ZONE'
      };
    }

    const resolvedFranchiseId = closestBranch.franchiseId || closestBranch.id || 'fra_rajnandgaon';
    const resolvedBranchId = closestBranch.id;
    const resolvedBranchName = closestBranch.name || 'Olive Pizza Branch';
    const now = Date.now();
    const version = now;

    const context: CustomerOrderingContext = {
      customerId: customerId || 'guest',
      franchiseId: resolvedFranchiseId,
      branchId: resolvedBranchId,
      branchName: resolvedBranchName,
      location: {
        lat: custLat,
        lng: custLng,
        addressLine: addressLine || ''
      },
      distanceKm: Math.round(minDistance * 100) / 100,
      deliveryRadiusKm: closestBranch.maxRadius,
      version,
      resolvedAt: new Date().toISOString(),
      expiresAt: now + (60 * 60 * 1000) // 1 hour validity
    };

    // 3. Persist context server-side if customerId is present
    if (customerId && customerId !== 'guest') {
      try {
        await adminDb.collection('customer_ordering_contexts').doc(customerId).set({
          ...context,
          updatedAt: new Date().toISOString()
        });
      } catch (persistErr) {
        console.warn('[CustomerOrderingContext] Notice saving context:', persistErr);
      }
    }

    return {
      isServiceable: true,
      context
    };
  }

  /**
   * Validates whether a given delivery location and targeted franchise are valid
   * according to authoritative server-side radius and single-franchise locking rules.
   */
  public static async validateCustomerOrderLocation(params: {
    lat: number;
    lng: number;
    targetFranchiseId?: string;
    targetBranchId?: string;
    customerId?: string;
  }): Promise<{
    isValid: boolean;
    resolvedFranchiseId: string;
    resolvedBranchId: string;
    distanceKm: number;
    error?: string;
    code?: string;
  }> {
    const { lat, lng, targetFranchiseId, targetBranchId, customerId } = params;

    const resolution = await this.resolveOrderingContext({
      customerId: customerId || 'guest',
      lat,
      lng
    });

    if (!resolution.isServiceable || !resolution.context) {
      return {
        isValid: false,
        resolvedFranchiseId: '',
        resolvedBranchId: '',
        distanceKm: 0,
        error: resolution.error || "We currently don't deliver to this location.",
        code: resolution.code || 'OUT_OF_DELIVERY_ZONE'
      };
    }

    const { franchiseId, branchId, distanceKm } = resolution.context;

    // Single-Franchise Lock Enforcement:
    // If client explicitly supplied a target franchise that differs from the resolved franchise,
    // reject the request as cross-franchise spoofing / unauthorized.
    if (targetFranchiseId && targetFranchiseId.trim() !== '' && targetFranchiseId.trim() !== franchiseId) {
      return {
        isValid: false,
        resolvedFranchiseId: franchiseId,
        resolvedBranchId: branchId,
        distanceKm,
        error: 'The requested order belongs to a different franchise than the confirmed delivery location.',
        code: 'FRANCHISE_MISMATCH'
      };
    }

    // If client explicitly supplied a branchId that does not belong to the resolved branch:
    if (targetBranchId && targetBranchId.trim() !== '' && targetBranchId.trim() !== branchId) {
      return {
        isValid: false,
        resolvedFranchiseId: franchiseId,
        resolvedBranchId: branchId,
        distanceKm,
        error: 'The requested branch does not serve this delivery location.',
        code: 'BRANCH_MISMATCH'
      };
    }

    return {
      isValid: true,
      resolvedFranchiseId: franchiseId,
      resolvedBranchId: branchId,
      distanceKm
    };
  }
}
