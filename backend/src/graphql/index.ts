import { buildSchema, graphql } from 'graphql';
import { adminDb } from '../config/firebase.js';
import { query } from '../lib/db.js';

export const schema = buildSchema(`
  enum EntityType {
    FRANCHISE
    BRANCH
    SYSTEM
  }

  enum IncidentSeverity {
    CRITICAL
    HIGH
    MEDIUM
    INFORMATIONAL
  }

  enum IncidentStatus {
    OPEN
    ACKNOWLEDGED
    IN_PROGRESS
    RESOLVED
  }

  type IncidentReport {
    id: ID!
    title: String!
    description: String!
    severity: IncidentSeverity!
    status: IncidentStatus!
    entityType: EntityType!
    entityId: String!
    detectedAt: String!
    durationMinutes: Int
    affectedCount: Int
    latestUpdate: String
    resolvedAt: String
    resolvedBy: String
    actionUrl: String
  }

  type FranchisePerformance {
    franchiseId: ID!
    name: String!
    city: String!
    state: String!
    status: String!
    branchesCount: Int!
    totalOrders: Int!
    grossSalesPaise: Float!
    netSalesPaise: Float!
    totalSalesInr: Float!
    averageOrderValueInr: Float!
    cancellationRatePercent: Float!
    activeRidersCount: Int!
    activeOrdersCount: Int!
    unreadAlertsCount: Int!
    lastOrderAt: String
  }

  type CommandCenterSummary {
    totalFranchises: Int!
    activeFranchises: Int!
    totalOrdersToday: Int!
    totalRevenueTodayInr: Float!
    topEarningFranchise: FranchisePerformance
    highestVolumeFranchise: FranchisePerformance
    bestCompletionFranchise: FranchisePerformance
    criticalIncidentsCount: Int!
    unreadAlertsTotal: Int!
  }

  type Query {
    commandCenterSummary(period: String): CommandCenterSummary!
    topFranchises(period: String, limit: Int): [FranchisePerformance!]!
    criticalIncidents(franchiseId: String, status: IncidentStatus): [IncidentReport!]!
    franchisesList(status: String, search: String): [FranchisePerformance!]!
    franchiseWorkspace(franchiseId: ID!): FranchisePerformance
  }

  type Mutation {
    acknowledgeIncident(id: ID!): IncidentReport!
    resolveIncident(id: ID!, resolutionNote: String): IncidentReport!
  }
`);

/**
 * Builds the SQL date period filter expression in Asia/Kolkata timezone
 */
function getPeriodFilterClause(period?: string, columnPrefix: string = 'o.'): string {
  const col = `${columnPrefix}created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata'`;
  const now = `NOW() AT TIME ZONE 'Asia/Kolkata'`;

  switch ((period || 'today').toLowerCase()) {
    case 'today':
      return `${col} >= DATE_TRUNC('day', ${now})`;
    case 'yesterday':
      return `${col} >= DATE_TRUNC('day', ${now} - INTERVAL '1 day') AND ${col} < DATE_TRUNC('day', ${now})`;
    case '7d':
    case 'week':
      return `${col} >= (${now} - INTERVAL '7 days')`;
    case '30d':
    case 'month':
      return `${col} >= (${now} - INTERVAL '30 days')`;
    case 'all':
      return '1=1';
    default:
      return `${col} >= DATE_TRUNC('day', ${now})`;
  }
}

/**
 * Fetch and aggregate franchise telemetry with CTEs to eliminate cartesian multiplication
 */
async function fetchFranchiseTelemetry(period?: string, franchiseFilterId?: string): Promise<any[]> {
  // 1. Fetch authorized franchise entities and branches from Firestore metadata
  const [fSnap, bSnap, riderSnap] = await Promise.all([
    adminDb.collection('franchise_entities').get().catch(() => ({ docs: [] } as any)),
    adminDb.collection('franchises').get().catch(() => ({ docs: [] } as any)),
    adminDb.collection('delivery_partners').get().catch(() => ({ docs: [] } as any))
  ]);

  const franchiseDocs = (fSnap.docs || []).map((d: any) => ({ id: d.id, ...(d.data() || {}) }));
  const branchDocs = (bSnap.docs || []).map((d: any) => ({ id: d.id, ...(d.data() || {}) }));
  const riderDocs = (riderSnap.docs || []).map((d: any) => ({ id: d.id, ...(d.data() || {}) }));

  // Ensure default primary HQ franchise is present if none in Firestore
  if (franchiseDocs.length === 0) {
    franchiseDocs.push({
      id: 'fra_rajnandgaon',
      name: 'Olive Pizza — Rajnandgaon (HQ Branch)',
      city: 'Rajnandgaon',
      state: 'Chhattisgarh',
      status: 'ACTIVE'
    });
  }

  // 2. Fetch order metrics from canonical_orders using CTEs
  const periodClause = getPeriodFilterClause(period, 'o.');
  const sql = `
    WITH scoped_orders AS (
      SELECT 
        o.id,
        o.franchise_id,
        o.branch_id,
        o.total_amount,
        o.order_status,
        o.created_at
      FROM canonical_orders o
      WHERE ${periodClause}
    )
    SELECT
      COALESCE(NULLIF(franchise_id, ''), 'fra_primary') AS franchise_id,
      COUNT(id)::int AS total_orders,
      COALESCE(SUM(total_amount), 0)::float AS gross_sales_inr,
      COALESCE(SUM(total_amount) FILTER (WHERE order_status NOT IN ('CANCELLED', 'REJECTED', 'FAILED')), 0)::float AS net_sales_inr,
      COALESCE(COUNT(id) FILTER (WHERE order_status IN ('CANCELLED', 'REJECTED', 'FAILED')), 0)::int AS cancelled_orders,
      COALESCE(COUNT(id) FILTER (WHERE order_status IN ('PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY')), 0)::int AS active_orders,
      MAX(created_at) AS last_order_at
    FROM scoped_orders
    GROUP BY COALESCE(NULLIF(franchise_id, ''), 'fra_primary');
  `;

  const orderStatsRes = await query(sql);
  const orderStatsRows = orderStatsRes.rows || [];

  // Map and assemble performance object per franchise
  return franchiseDocs
    .filter(f => !franchiseFilterId || f.id === franchiseFilterId || (franchiseFilterId === 'fra_rajnandgaon' && (f.id === 'fra_primary' || f.id === 'fra_rajnandgaon')))
    .map(f => {
      const fId = f.id;
      // Associate branches
      const assignedBranches = branchDocs.filter(b => b.franchiseId === fId || (fId === 'fra_rajnandgaon' && (b.id === 'main_branch' || b.franchiseId === 'fra_primary')));
      const branchIds = assignedBranches.map(b => b.id);
      if (branchIds.length === 0) branchIds.push('main_branch');

      // Associate riders
      const activeRiders = riderDocs.filter(r => (r.franchiseId === fId || branchIds.includes(r.branchId)) && (r.isOnline === true || r.status === 'online'));

      // Aggregate order metrics matching franchise ID or primary HQ alias
      const orderStats = orderStatsRows.filter(r => r.franchise_id === fId || (fId === 'fra_rajnandgaon' && r.franchise_id === 'fra_primary'));
      const totalOrders = orderStats.reduce((acc, r) => acc + Number(r.total_orders || 0), 0);
      const grossSalesInr = Number(orderStats.reduce((acc, r) => acc + Number(r.gross_sales_inr || 0), 0).toFixed(2));
      const netSalesInr = Number(orderStats.reduce((acc, r) => acc + Number(r.net_sales_inr || 0), 0).toFixed(2));
      const cancelledOrders = orderStats.reduce((acc, r) => acc + Number(r.cancelled_orders || 0), 0);
      const activeOrdersCount = orderStats.reduce((acc, r) => acc + Number(r.active_orders || 0), 0);

      const cancellationRatePercent = totalOrders > 0
        ? Number(((cancelledOrders / totalOrders) * 100).toFixed(2))
        : 0;

      const aov = totalOrders > 0 ? Number((grossSalesInr / totalOrders).toFixed(2)) : 0;

      // Find latest order date
      let lastOrderAt: string | null = null;
      for (const r of orderStats) {
        if (r.last_order_at) {
          const dStr = new Date(r.last_order_at).toISOString();
          if (!lastOrderAt || dStr > lastOrderAt) lastOrderAt = dStr;
        }
      }

      return {
        franchiseId: fId,
        name: f.name || 'Olive Pizza Franchise',
        city: f.city || 'Rajnandgaon',
        state: f.region || f.state || 'Chhattisgarh',
        status: f.status || (f.isActive !== false ? 'ACTIVE' : 'SUSPENDED'),
        branchesCount: Math.max(assignedBranches.length, 1),
        totalOrders,
        grossSalesPaise: Math.round(grossSalesInr * 100),
        netSalesPaise: Math.round(netSalesInr * 100),
        totalSalesInr: grossSalesInr,
        averageOrderValueInr: aov,
        cancellationRatePercent,
        activeRidersCount: activeRiders.length,
        activeOrdersCount,
        unreadAlertsCount: 0,
        lastOrderAt
      };
    });
}

export const rootResolver = {
  commandCenterSummary: async ({ period }: { period?: string }, context: any) => {
    if (!context?.isOwner) {
      throw new Error('Forbidden: Command Center access is restricted to authorized platform owners.');
    }

    const franchises = await fetchFranchiseTelemetry(period);

    const sortedBySales = [...franchises].sort((a, b) => b.totalSalesInr - a.totalSalesInr);
    const sortedByVolume = [...franchises].sort((a, b) => b.totalOrders - a.totalOrders);
    const sortedByCompletion = [...franchises]
      .filter(f => f.totalOrders > 0)
      .sort((a, b) => a.cancellationRatePercent - b.cancellationRatePercent);

    const totalRevenueTodayInr = Number(franchises.reduce((acc, f) => acc + f.totalSalesInr, 0).toFixed(2));
    const totalOrdersToday = franchises.reduce((acc, f) => acc + f.totalOrders, 0);

    // Count open/critical incidents
    const incSnap = await adminDb.collection('system_incidents')
      .where('severity', 'in', ['CRITICAL', 'HIGH'])
      .get()
      .catch(() => ({ docs: [] } as any));
    const openIncidents = (incSnap.docs || []).filter((d: any) => {
      const data = d.data();
      return data.status === 'OPEN' || data.status === 'ACKNOWLEDGED';
    });

    return {
      totalFranchises: franchises.length,
      activeFranchises: franchises.filter(f => f.status === 'ACTIVE').length,
      totalOrdersToday,
      totalRevenueTodayInr,
      topEarningFranchise: sortedBySales[0] || null,
      highestVolumeFranchise: sortedByVolume[0] || null,
      bestCompletionFranchise: sortedByCompletion[0] || sortedBySales[0] || null,
      criticalIncidentsCount: openIncidents.length,
      unreadAlertsTotal: openIncidents.length
    };
  },

  topFranchises: async ({ period, limit = 5 }: { period?: string; limit?: number }, context: any) => {
    if (!context?.isOwner) {
      throw new Error('Forbidden: Unauthorized');
    }
    const safeLimit = Math.min(Math.max(Number(limit) || 5, 1), 50);
    const franchises = await fetchFranchiseTelemetry(period);
    return franchises
      .sort((a, b) => b.totalSalesInr - a.totalSalesInr)
      .slice(0, safeLimit);
  },

  criticalIncidents: async ({ franchiseId, status }: { franchiseId?: string; status?: string }, context: any) => {
    if (!context?.user) {
      throw new Error('Unauthorized');
    }

    // Strict scope check: non-owners can only query their own assigned franchise
    if (!context.isOwner) {
      const callerFranchise = context.user.franchiseId;
      if (!callerFranchise || (franchiseId && franchiseId !== callerFranchise)) {
        throw new Error('Forbidden: Cross-franchise incident access denied');
      }
      franchiseId = callerFranchise;
    }

    let incidentQuery: any = adminDb.collection('system_incidents');
    if (franchiseId) {
      incidentQuery = incidentQuery.where('entityId', '==', franchiseId);
    }
    if (status) {
      incidentQuery = incidentQuery.where('status', '==', status);
    }

    const snapshot = await incidentQuery
      .limit(50)
      .get()
      .catch(() => ({ docs: [] } as any));

    return (snapshot?.docs || []).map((d: any) => ({
      id: d.id,
      ...d.data()
    }));
  },

  franchisesList: async ({ status, search }: { status?: string; search?: string }, context: any) => {
    if (!context?.user) {
      throw new Error('Unauthorized');
    }

    const callerFranchise = !context.isOwner ? context.user.franchiseId : undefined;
    let franchises = await fetchFranchiseTelemetry('all', callerFranchise);

    if (status && status !== 'all') {
      franchises = franchises.filter(f => f.status.toUpperCase() === status.toUpperCase());
    }

    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      franchises = franchises.filter(f =>
        f.name.toLowerCase().includes(q) ||
        f.city.toLowerCase().includes(q) ||
        f.franchiseId.toLowerCase().includes(q)
      );
    }

    return franchises.sort((a, b) => b.totalSalesInr - a.totalSalesInr);
  },

  franchiseWorkspace: async ({ franchiseId }: { franchiseId: string }, context: any) => {
    if (!context?.user) {
      throw new Error('Unauthorized');
    }
    if (!context.isOwner && context.user.franchiseId !== franchiseId) {
      throw new Error('Forbidden: Cross-franchise access denied');
    }

    const franchises = await fetchFranchiseTelemetry('all', franchiseId);
    return franchises[0] || null;
  },

  acknowledgeIncident: async ({ id }: { id: string }, context: any) => {
    if (!context?.isOwner) {
      throw new Error('Forbidden: Only platform owners can acknowledge incidents');
    }

    const docRef = adminDb.collection('system_incidents').doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      throw new Error(`Incident with id '${id}' not found`);
    }

    const now = new Date().toISOString();
    await docRef.set({
      status: 'ACKNOWLEDGED',
      acknowledgedBy: context.user?.email || 'owner',
      acknowledgedAt: now,
      updatedAt: now
    }, { merge: true });

    const updatedSnap = await docRef.get();
    return { id, ...updatedSnap.data() };
  },

  resolveIncident: async ({ id, resolutionNote }: { id: string; resolutionNote?: string }, context: any) => {
    if (!context?.isOwner) {
      throw new Error('Forbidden: Only platform owners can resolve incidents');
    }

    const docRef = adminDb.collection('system_incidents').doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      throw new Error(`Incident with id '${id}' not found`);
    }

    const now = new Date().toISOString();
    await docRef.set({
      status: 'RESOLVED',
      resolvedBy: context.user?.email || 'owner',
      resolvedAt: now,
      resolutionNote: resolutionNote || null,
      updatedAt: now
    }, { merge: true });

    const updatedSnap = await docRef.get();
    return { id, ...updatedSnap.data() };
  }
};

export async function executeGraphQL(source: string, variableValues?: any, context?: any) {
  return await graphql({
    schema,
    source,
    rootValue: rootResolver,
    contextValue: context,
    variableValues
  });
}
