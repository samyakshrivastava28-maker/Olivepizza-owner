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

export const rootResolver = {
  commandCenterSummary: async ({ period }: { period?: string }, context: any) => {
    if (!context.isOwner) {
      throw new Error('Forbidden: Command Center access is restricted to authorized platform owners.');
    }

    const franchisesRes = await query(`
      SELECT 
        f.id as franchise_id,
        f.name,
        f.city,
        f.state,
        f.status,
        COALESCE(COUNT(DISTINCT b.id), 1) as branches_count,
        COALESCE(SUM(o.total_amount_paise), 0) as gross_sales_paise,
        COALESCE(COUNT(o.id), 0) as total_orders
      FROM franchises f
      LEFT JOIN restaurant_branches b ON b.franchise_id = f.id
      LEFT JOIN canonical_orders o ON o.franchise_id = f.id AND o.order_status NOT IN ('CANCELLED', 'FAILED')
      GROUP BY f.id, f.name, f.city, f.state, f.status
    `).catch(() => ({ rows: [] }));

    const rows = franchisesRes.rows || [];
    const franchises: any[] = rows.map((r: any) => ({
      franchiseId: r.franchise_id,
      name: r.name || 'Olive Pizza Franchise',
      city: r.city || 'Rajnandgaon',
      state: r.state || 'Chhattisgarh',
      status: r.status || 'ACTIVE',
      branchesCount: Number(r.branches_count || 1),
      totalOrders: Number(r.total_orders || 0),
      grossSalesPaise: Number(r.gross_sales_paise || 0),
      netSalesPaise: Number(r.gross_sales_paise || 0),
      totalSalesInr: Number((Number(r.gross_sales_paise || 0) / 100).toFixed(2)),
      averageOrderValueInr: Number(r.total_orders) > 0 ? Number(((Number(r.gross_sales_paise || 0) / 100) / Number(r.total_orders)).toFixed(2)) : 0,
      cancellationRatePercent: 0,
      activeRidersCount: 0,
      activeOrdersCount: 0,
      unreadAlertsCount: 0,
      lastOrderAt: new Date().toISOString()
    }));

    const sortedBySales = [...franchises].sort((a, b) => b.totalSalesInr - a.totalSalesInr);
    const sortedByVolume = [...franchises].sort((a, b) => b.totalOrders - a.totalOrders);

    const totalRevenueTodayInr = franchises.reduce((acc, f) => acc + f.totalSalesInr, 0);
    const totalOrdersToday = franchises.reduce((acc, f) => acc + f.totalOrders, 0);

    return {
      totalFranchises: franchises.length,
      activeFranchises: franchises.filter(f => f.status === 'ACTIVE').length,
      totalOrdersToday,
      totalRevenueTodayInr,
      topEarningFranchise: sortedBySales[0] || null,
      highestVolumeFranchise: sortedByVolume[0] || null,
      bestCompletionFranchise: sortedBySales[0] || null,
      criticalIncidentsCount: 0,
      unreadAlertsTotal: 0
    };
  },

  topFranchises: async ({ limit = 5 }: { limit?: number }, context: any) => {
    if (!context.isOwner) throw new Error('Forbidden: Unauthorized');
    const res = await query(`
      SELECT 
        f.id as franchise_id,
        f.name,
        f.city,
        f.state,
        f.status,
        COALESCE(COUNT(DISTINCT b.id), 1) as branches_count,
        COALESCE(SUM(o.total_amount_paise), 0) as gross_sales_paise,
        COALESCE(COUNT(o.id), 0) as total_orders
      FROM franchises f
      LEFT JOIN restaurant_branches b ON b.franchise_id = f.id
      LEFT JOIN canonical_orders o ON o.franchise_id = f.id AND o.order_status NOT IN ('CANCELLED', 'FAILED')
      GROUP BY f.id, f.name, f.city, f.state, f.status
      ORDER BY gross_sales_paise DESC
      LIMIT $1
    `, [limit]).catch(() => ({ rows: [] }));

    return res.rows.map((r: any) => ({
      franchiseId: r.franchise_id,
      name: r.name || 'Olive Pizza Franchise',
      city: r.city || 'Rajnandgaon',
      state: r.state || 'Chhattisgarh',
      status: r.status || 'ACTIVE',
      branchesCount: Number(r.branches_count || 1),
      totalOrders: Number(r.total_orders || 0),
      grossSalesPaise: Number(r.gross_sales_paise || 0),
      netSalesPaise: Number(r.gross_sales_paise || 0),
      totalSalesInr: Number((Number(r.gross_sales_paise || 0) / 100).toFixed(2)),
      averageOrderValueInr: Number(r.total_orders) > 0 ? Number(((Number(r.gross_sales_paise || 0) / 100) / Number(r.total_orders)).toFixed(2)) : 0,
      cancellationRatePercent: 0,
      activeRidersCount: 0,
      activeOrdersCount: 0,
      unreadAlertsCount: 0,
      lastOrderAt: new Date().toISOString()
    }));
  },

  criticalIncidents: async ({ franchiseId, status }: { franchiseId?: string; status?: string }, context: any) => {
    if (!context.user) throw new Error('Unauthorized');
    const snapshot = await adminDb?.collection('system_incidents')
      .where('severity', 'in', ['CRITICAL', 'HIGH'])
      .limit(20)
      .get()
      .catch(() => ({ docs: [] } as any));

    return (snapshot?.docs || []).map((d: any) => ({
      id: d.id,
      ...d.data()
    }));
  },

  franchisesList: async ({ status, search }: { status?: string; search?: string }, context: any) => {
    if (!context.user) throw new Error('Unauthorized');
    let sql = `
      SELECT 
        f.id as franchise_id,
        f.name,
        f.city,
        f.state,
        f.status,
        COALESCE(COUNT(DISTINCT b.id), 1) as branches_count,
        COALESCE(SUM(o.total_amount_paise), 0) as gross_sales_paise,
        COALESCE(COUNT(o.id), 0) as total_orders
      FROM franchises f
      LEFT JOIN restaurant_branches b ON b.franchise_id = f.id
      LEFT JOIN canonical_orders o ON o.franchise_id = f.id AND o.order_status NOT IN ('CANCELLED', 'FAILED')
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (!context.isOwner && context.user.franchiseId) {
      conditions.push(`f.id = $${params.length + 1}`);
      params.push(context.user.franchiseId);
    }

    if (status) {
      conditions.push(`f.status = $${params.length + 1}`);
      params.push(status);
    }

    if (search) {
      conditions.push(`(f.name ILIKE $${params.length + 1} OR f.city ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' GROUP BY f.id, f.name, f.city, f.state, f.status ORDER BY gross_sales_paise DESC';

    const res = await query(sql, params).catch(() => ({ rows: [] }));
    return res.rows.map((r: any) => ({
      franchiseId: r.franchise_id,
      name: r.name || 'Olive Pizza Franchise',
      city: r.city || 'Rajnandgaon',
      state: r.state || 'Chhattisgarh',
      status: r.status || 'ACTIVE',
      branchesCount: Number(r.branches_count || 1),
      totalOrders: Number(r.total_orders || 0),
      grossSalesPaise: Number(r.gross_sales_paise || 0),
      netSalesPaise: Number(r.gross_sales_paise || 0),
      totalSalesInr: Number((Number(r.gross_sales_paise || 0) / 100).toFixed(2)),
      averageOrderValueInr: Number(r.total_orders) > 0 ? Number(((Number(r.gross_sales_paise || 0) / 100) / Number(r.total_orders)).toFixed(2)) : 0,
      cancellationRatePercent: 0,
      activeRidersCount: 0,
      activeOrdersCount: 0,
      unreadAlertsCount: 0,
      lastOrderAt: new Date().toISOString()
    }));
  },

  franchiseWorkspace: async ({ franchiseId }: { franchiseId: string }, context: any) => {
    if (!context.user) throw new Error('Unauthorized');
    if (!context.isOwner && context.user.franchiseId !== franchiseId) {
      throw new Error('Forbidden: Cross-franchise access denied');
    }

    const res = await query(`
      SELECT 
        f.id as franchise_id,
        f.name,
        f.city,
        f.state,
        f.status,
        COALESCE(COUNT(DISTINCT b.id), 1) as branches_count,
        COALESCE(SUM(o.total_amount_paise), 0) as gross_sales_paise,
        COALESCE(COUNT(o.id), 0) as total_orders
      FROM franchises f
      LEFT JOIN restaurant_branches b ON b.franchise_id = f.id
      LEFT JOIN canonical_orders o ON o.franchise_id = f.id AND o.order_status NOT IN ('CANCELLED', 'FAILED')
      WHERE f.id = $1
      GROUP BY f.id, f.name, f.city, f.state, f.status
    `, [franchiseId]).catch(() => ({ rows: [] }));

    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      franchiseId: r.franchise_id,
      name: r.name,
      city: r.city,
      state: r.state,
      status: r.status,
      branchesCount: Number(r.branches_count || 1),
      totalOrders: Number(r.total_orders || 0),
      grossSalesPaise: Number(r.gross_sales_paise || 0),
      netSalesPaise: Number(r.gross_sales_paise || 0),
      totalSalesInr: Number((Number(r.gross_sales_paise || 0) / 100).toFixed(2)),
      averageOrderValueInr: Number(r.total_orders) > 0 ? Number(((Number(r.gross_sales_paise || 0) / 100) / Number(r.total_orders)).toFixed(2)) : 0,
      cancellationRatePercent: 0,
      activeRidersCount: 0,
      activeOrdersCount: 0,
      unreadAlertsCount: 0,
      lastOrderAt: new Date().toISOString()
    };
  },

  acknowledgeIncident: async ({ id }: { id: string }, context: any) => {
    if (!context.isOwner) throw new Error('Forbidden');
    const now = new Date().toISOString();
    await adminDb?.collection('system_incidents').doc(id).set({
      status: 'ACKNOWLEDGED',
      acknowledgedBy: context.user.email,
      acknowledgedAt: now,
      updatedAt: now
    }, { merge: true });

    const snap = await adminDb?.collection('system_incidents').doc(id).get();
    return { id, ...snap?.data() };
  },

  resolveIncident: async ({ id, resolutionNote }: { id: string; resolutionNote?: string }, context: any) => {
    if (!context.isOwner) throw new Error('Forbidden');
    const now = new Date().toISOString();
    await adminDb?.collection('system_incidents').doc(id).set({
      status: 'RESOLVED',
      resolvedBy: context.user.email,
      resolvedAt: now,
      resolutionNote: resolutionNote || null,
      updatedAt: now
    }, { merge: true });

    const snap = await adminDb?.collection('system_incidents').doc(id).get();
    return { id, ...snap?.data() };
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

