/**
 * RiderReplacementSagaService.ts — Multi-Order Rider Replacement Saga & Deactivation
 *
 * Implements approved Gate 1 Business Rules:
 * - BR-02: Automatic deactivation only occurs AFTER all active deliveries are transferred and physical handovers verified.
 * - BR-03: Discovers and transfers all remaining active deliveries assigned to old rider before deactivation.
 * - BR-04: Cancellation after pickup is prohibited.
 * - BR-05: PostgreSQL is the sole authoritative source of truth.
 * - BR-10: Active-trip physical handover protocol with immutable audit logging.
 * - BR-11: Deterministic identity preservation; never re-key or overwrite accounts.
 */

import crypto from 'crypto';
import { pgPool, query } from '../../config/postgres.js';
import { OutboxPublisherService } from '../outbox/OutboxPublisherService.js';

export interface ExecuteReplacementParams {
  targetOrderId: string;
  oldRiderId: string;
  replacementRiderId: string;
  reason: string;
  initiatedByUid: string;
  initiatedByRole: string;
  idempotencyKey?: string;
}

export interface ReplacementSagaResult {
  success: boolean;
  operationId: string;
  status: 'COMPLETED' | 'HANDOVER_PENDING' | 'FAILED_REQUIRES_REVIEW';
  targetOrderId: string;
  oldRiderId: string;
  newRiderId: string;
  ordersTransferredCount: number;
  oldRiderDeactivated: boolean;
  pendingHandoverOrders?: string[];
  message: string;
  cached?: boolean;
}

export interface HandoverConfirmParams {
  handoverId: string;
  orderId: string;
  receivingRiderId: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
}

export class RiderReplacementSagaService {
  /**
   * Executes the multi-order replacement saga within an isolated transactional scope.
   */
  public static async executeReplacementSaga(params: ExecuteReplacementParams): Promise<ReplacementSagaResult> {
    const {
      targetOrderId,
      oldRiderId,
      replacementRiderId,
      reason,
      initiatedByUid,
      initiatedByRole,
      idempotencyKey
    } = params;

    const operationId = idempotencyKey || `repl_${crypto.randomUUID().slice(0, 12)}`;

    // 1. Idempotency Check: return existing operation if already recorded
    const existingOp = await query(
      `SELECT * FROM rider_replacement_operations WHERE id = $1`,
      [operationId]
    );
    if (existingOp.rows.length > 0) {
      const op = existingOp.rows[0];
      return {
        success: op.status !== 'FAILED_REQUIRES_REVIEW',
        operationId: op.id,
        status: op.status,
        targetOrderId,
        oldRiderId: op.old_rider_id,
        newRiderId: op.new_rider_id,
        ordersTransferredCount: op.orders_transferred_count,
        oldRiderDeactivated: op.old_rider_deactivated,
        message: 'Idempotent request: returned cached operation record',
        cached: true
      };
    }

    // 2. Validate Target Order
    const orderRes = await query(
      `SELECT id, order_status, branch_id, franchise_id, delivery_partner_id 
       FROM canonical_orders WHERE id = $1`,
      [targetOrderId]
    );
    if (orderRes.rows.length === 0) {
      const err: any = new Error(`Target order ${targetOrderId} not found in authoritative database`);
      err.statusCode = 404;
      err.code = 'ORDER_NOT_FOUND';
      throw err;
    }
    const targetOrder = orderRes.rows[0];

    // 3. Validate Replacement Rider (app_users + delivery_partners)
    const riderRes = await query(
      `SELECT dp.id, dp.name, dp.phone, dp.branch_id, dp.franchise_id, dp.status as partner_status,
              u.id as user_id, u.is_active, u.status as user_status, u.allowed_apps
       FROM delivery_partners dp
       LEFT JOIN app_users u ON dp.user_id = u.id
       WHERE dp.id = $1`,
      [replacementRiderId]
    );

    if (riderRes.rows.length === 0) {
      const err: any = new Error(`Replacement rider ${replacementRiderId} not registered in database`);
      err.statusCode = 422;
      err.code = 'REPLACEMENT_RIDER_NOT_FOUND';
      throw err;
    }

    const replacementRider = riderRes.rows[0];

    // Verification check: replacement rider must be active and approved
    if (!replacementRider.is_active || replacementRider.user_status !== 'APPROVED') {
      await query(
        `INSERT INTO rider_replacement_operations (
           id, old_rider_id, new_rider_id, branch_id, franchise_id, reason, status,
           initiated_by_uid, initiated_by_role, orders_transferred_count, old_rider_deactivated, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, 'FAILED_REQUIRES_REVIEW', $7, $8, 0, false, NOW())
         ON CONFLICT (id) DO NOTHING`,
        [operationId, oldRiderId, replacementRiderId, targetOrder.branch_id, targetOrder.franchise_id, reason, initiatedByUid, initiatedByRole]
      );

      const err: any = new Error(`Replacement rider ${replacementRiderId} account is inactive or not approved`);
      err.statusCode = 422;
      err.code = 'REPLACEMENT_RIDER_INACTIVE';
      throw err;
    }

    // Grant check: replacement rider must hold DELIVERY app grant
    const allowedApps = Array.isArray(replacementRider.allowed_apps) ? replacementRider.allowed_apps : [];
    if (!allowedApps.includes('DELIVERY')) {
      await query(
        `INSERT INTO rider_replacement_operations (
           id, old_rider_id, new_rider_id, branch_id, franchise_id, reason, status,
           initiated_by_uid, initiated_by_role, orders_transferred_count, old_rider_deactivated, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, 'FAILED_REQUIRES_REVIEW', $7, $8, 0, false, NOW())
         ON CONFLICT (id) DO NOTHING`,
        [operationId, oldRiderId, replacementRiderId, targetOrder.branch_id, targetOrder.franchise_id, reason, initiatedByUid, initiatedByRole]
      );

      const err: any = new Error(`Replacement rider ${replacementRiderId} lacks required DELIVERY app grant`);
      err.statusCode = 403;
      err.code = 'GRANT_UNAUTHORIZED';
      throw err;
    }

    // 4. Query All Active Deliveries Assigned to Old Rider (Rule BR-03)
    const activeDeliveriesRes = await query(
      `SELECT id, order_status, branch_id, franchise_id, delivery_partner_id, delivery_address
       FROM canonical_orders
       WHERE delivery_partner_id = $1 
         AND order_status IN ('accepted', 'preparing', 'ready', 'out_for_delivery', 'delivery_failed')
       ORDER BY created_at ASC`,
      [oldRiderId]
    );

    const allActiveOrders = activeDeliveriesRes.rows;
    const client = await pgPool.connect();

    try {
      await client.query('BEGIN');

      // Create operation record in IN_PROGRESS state
      await client.query(
        `INSERT INTO rider_replacement_operations (
           id, old_rider_id, new_rider_id, branch_id, franchise_id, reason, status,
           initiated_by_uid, initiated_by_role, orders_transferred_count, old_rider_deactivated, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, 'IN_PROGRESS', $7, $8, 0, false, NOW())
         ON CONFLICT (id) DO UPDATE SET
           status = 'IN_PROGRESS',
           updated_at = NOW()`,
        [operationId, oldRiderId, replacementRiderId, targetOrder.branch_id, targetOrder.franchise_id, reason, initiatedByUid, initiatedByRole]
      );

      let transferredCount = 0;
      const pendingHandoverOrderIds: string[] = [];

      // Step 4: Transfer target order
      await client.query(
        `UPDATE canonical_orders 
         SET delivery_partner_id = $1, 
             delivery_partner_name = $2, 
             delivery_partner_phone = $3,
             partner_assigned_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [replacementRider.id, replacementRider.name, replacementRider.phone, targetOrderId]
      );
      transferredCount++;

      // Record handover audit for target order
      const targetHandoverId = `ho_${crypto.randomUUID().slice(0, 10)}`;
      const isTargetInFlight = targetOrder.order_status === 'out_for_delivery';
      await client.query(
        `INSERT INTO delivery_handover_audit (
           id, order_id, from_rider_id, to_rider_id, replacement_operation_id,
           handover_type, handover_status, notes, confirmed_at, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [
          targetHandoverId,
          targetOrderId,
          oldRiderId,
          replacementRider.id,
          operationId,
          isTargetInFlight ? 'ACTIVE_TRIP_PHYSICAL_HANDOVER' : 'PRE_PICKUP_REASSIGNMENT',
          isTargetInFlight ? 'PENDING' : 'CONFIRMED',
          `Target order replacement: ${reason}`,
          isTargetInFlight ? null : new Date()
        ]
      );

      if (isTargetInFlight) {
        pendingHandoverOrderIds.push(targetOrderId);
      }

      // Step 5: Transfer all other active deliveries assigned to old rider (Rule BR-03)
      for (const ord of allActiveOrders) {
        if (ord.id === targetOrderId) continue;

        if (ord.order_status === 'out_for_delivery') {
          // Physical transit order: requires physical handover protocol (Rule BR-10)
          const hoId = `ho_${crypto.randomUUID().slice(0, 10)}`;
          await client.query(
            `INSERT INTO delivery_handover_audit (
               id, order_id, from_rider_id, to_rider_id, replacement_operation_id,
               handover_type, handover_status, notes, created_at
             ) VALUES ($1, $2, $3, $4, $5, 'ACTIVE_TRIP_PHYSICAL_HANDOVER', 'PENDING', $6, NOW())`,
            [hoId, ord.id, oldRiderId, replacementRider.id, operationId, `Multi-order replacement saga: ${reason}`]
          );
          pendingHandoverOrderIds.push(ord.id);
        } else {
          // Pre-pickup order (accepted, preparing, ready): reassign directly to replacement rider
          await client.query(
            `UPDATE canonical_orders 
             SET delivery_partner_id = $1, 
                 delivery_partner_name = $2, 
                 delivery_partner_phone = $3,
                 partner_assigned_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $4`,
            [replacementRider.id, replacementRider.name, replacementRider.phone, ord.id]
          );
          transferredCount++;

          const hoId = `ho_${crypto.randomUUID().slice(0, 10)}`;
          await client.query(
            `INSERT INTO delivery_handover_audit (
               id, order_id, from_rider_id, to_rider_id, replacement_operation_id,
               handover_type, handover_status, notes, confirmed_at, created_at
             ) VALUES ($1, $2, $3, $4, $5, 'PRE_PICKUP_REASSIGNMENT', 'CONFIRMED', $6, NOW(), NOW())`,
            [hoId, ord.id, oldRiderId, replacementRider.id, operationId, `Auto-transfer before deactivation: ${reason}`]
          );
        }
      }

      // Determine final status
      let finalStatus: 'COMPLETED' | 'HANDOVER_PENDING' = 'COMPLETED';
      let oldRiderDeactivated = false;

      if (pendingHandoverOrderIds.length > 0) {
        // Physical handovers are still pending: Old rider MUST REMAIN ACTIVE (Rule BR-02 / BR-10)
        finalStatus = 'HANDOVER_PENDING';
        await client.query(
          `UPDATE rider_replacement_operations 
           SET status = 'HANDOVER_PENDING',
               orders_transferred_count = $1,
               updated_at = NOW()
           WHERE id = $2`,
          [transferredCount, operationId]
        );
      } else {
        // Zero physical handovers pending and all active orders transferred: Deactivate old rider (Rule BR-02)
        // 1. Deactivate app_users record
        await client.query(
          `UPDATE app_users 
           SET is_active = false, 
               allowed_apps = '[]'::jsonb,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = (SELECT COALESCE(user_id, id) FROM delivery_partners WHERE id = $1)
              OR id = $1`,
          [oldRiderId]
        );

        // 2. Deactivate delivery_partners record
        await client.query(
          `UPDATE delivery_partners 
           SET status = 'DEACTIVATED',
               is_online = false,
               active_order_id = null,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [oldRiderId]
        );

        oldRiderDeactivated = true;

        await client.query(
          `UPDATE rider_replacement_operations 
           SET status = 'COMPLETED',
               orders_transferred_count = $1,
               old_rider_deactivated = true,
               completed_at = CURRENT_TIMESTAMP,
               updated_at = NOW()
           WHERE id = $2`,
          [transferredCount, operationId]
        );
      }

      // Record outbox events transactionally
      await OutboxPublisherService.recordEvent(
        client,
        'DELIVERY_PARTNER',
        oldRiderId,
        'RIDER_REPLACED',
        {
          orderId: targetOrderId,
          currentStatus: finalStatus,
          branchId: targetOrder.branch_id,
          franchiseId: targetOrder.franchise_id,
          deliveryPartnerId: replacementRider.id,
          actorUid: initiatedByUid,
          actorRole: initiatedByRole,
          timestamp: new Date().toISOString(),
          metadata: {
            operationId,
            targetOrderId,
            oldRiderId,
            newRiderId: replacementRider.id,
            reason,
            ordersTransferredCount: transferredCount,
            oldRiderDeactivated
          }
        }
      );

      if (oldRiderDeactivated) {
        await OutboxPublisherService.recordEvent(
          client,
          'DELIVERY_PARTNER',
          oldRiderId,
          'RIDER_DEACTIVATED',
          {
            orderId: targetOrderId,
            currentStatus: 'DEACTIVATED',
            branchId: targetOrder.branch_id,
            franchiseId: targetOrder.franchise_id,
            deliveryPartnerId: oldRiderId,
            actorUid: initiatedByUid,
            actorRole: initiatedByRole,
            timestamp: new Date().toISOString(),
            metadata: {
              riderId: oldRiderId,
              reason: `Replaced by ${replacementRider.id}: ${reason}`
            }
          }
        );
      }

      await client.query('COMMIT');

      return {
        success: true,
        operationId,
        status: finalStatus,
        targetOrderId,
        oldRiderId,
        newRiderId: replacementRider.id,
        ordersTransferredCount: transferredCount,
        oldRiderDeactivated,
        pendingHandoverOrders: pendingHandoverOrderIds.length > 0 ? pendingHandoverOrderIds : undefined,
        message: oldRiderDeactivated
          ? `Successfully transferred ${transferredCount} orders and deactivated outgoing rider ${oldRiderId}`
          : `Target order reassigned; ${pendingHandoverOrderIds.length} orders pending physical handover before deactivation`
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Confirms a physical handover for in-flight orders, allowing completion of deactivation.
   */
  public static async confirmPhysicalHandover(params: HandoverConfirmParams): Promise<{
    success: boolean;
    orderId: string;
    handoverStatus: string;
    oldRiderDeactivated: boolean;
    message: string;
  }> {
    const { handoverId, orderId, receivingRiderId, notes } = params;

    const hoRes = await query(
      `SELECT h.*, r.old_rider_id 
       FROM delivery_handover_audit h
       LEFT JOIN rider_replacement_operations r ON h.replacement_operation_id = r.id
       WHERE (h.id = $1 OR h.order_id = $2) AND h.handover_status = 'PENDING'
       ORDER BY h.created_at DESC LIMIT 1`,
      [handoverId || '', orderId]
    );

    if (hoRes.rows.length === 0) {
      const err: any = new Error(`Pending handover record for order ${orderId} not found`);
      err.statusCode = 404;
      err.code = 'HANDOVER_NOT_FOUND';
      throw err;
    }

    const ho = hoRes.rows[0];
    const oldRiderId = ho.from_rider_id || ho.old_rider_id;
    const client = await pgPool.connect();

    try {
      await client.query('BEGIN');

      // 1. Confirm handover in delivery_handover_audit
      await client.query(
        `UPDATE delivery_handover_audit 
         SET handover_status = 'CONFIRMED',
             to_rider_id = $1,
             notes = COALESCE($2, notes),
             confirmed_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [receivingRiderId, notes || 'Physical custody confirmed by receiving rider', ho.id]
      );

      // 2. Transfer order custody in canonical_orders
      const recRiderRes = await client.query(
        `SELECT id, name, phone FROM delivery_partners WHERE id = $1`,
        [receivingRiderId]
      );
      const recRider = recRiderRes.rows[0] || { id: receivingRiderId, name: 'Receiving Partner', phone: '' };

      await client.query(
        `UPDATE canonical_orders 
         SET delivery_partner_id = $1,
             delivery_partner_name = $2,
             delivery_partner_phone = $3,
             partner_assigned_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [recRider.id, recRider.name, recRider.phone, orderId]
      );

      // 3. Check if any remaining pending handovers exist for this replacement operation
      let oldRiderDeactivated = false;
      if (ho.replacement_operation_id) {
        const remainingRes = await client.query(
          `SELECT COUNT(*) as pending_count 
           FROM delivery_handover_audit 
           WHERE replacement_operation_id = $1 AND handover_status = 'PENDING'`,
          [ho.replacement_operation_id]
        );

        const pendingCount = parseInt(remainingRes.rows[0].pending_count, 10);
        if (pendingCount === 0) {
          // Check active deliveries for old rider
          const activeCheck = await client.query(
            `SELECT COUNT(*) as active_cnt 
             FROM canonical_orders 
             WHERE delivery_partner_id = $1 
               AND order_status IN ('accepted', 'preparing', 'ready', 'out_for_delivery')`,
            [oldRiderId]
          );

          if (parseInt(activeCheck.rows[0].active_cnt, 10) === 0) {
            // Safe to deactivate old rider
            await client.query(
              `UPDATE app_users 
               SET is_active = false, 
                   allowed_apps = '[]'::jsonb,
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = (SELECT COALESCE(user_id, id) FROM delivery_partners WHERE id = $1)
                  OR id = $1`,
              [oldRiderId]
            );

            await client.query(
              `UPDATE delivery_partners 
               SET status = 'DEACTIVATED',
                   is_online = false,
                   active_order_id = null,
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = $1`,
              [oldRiderId]
            );

            await client.query(
              `UPDATE rider_replacement_operations 
               SET status = 'COMPLETED',
                   old_rider_deactivated = true,
                   completed_at = CURRENT_TIMESTAMP,
                   updated_at = NOW()
               WHERE id = $1`,
              [ho.replacement_operation_id]
            );

            oldRiderDeactivated = true;

            await OutboxPublisherService.recordEvent(
              client,
              'DELIVERY_PARTNER',
              oldRiderId,
              'RIDER_DEACTIVATED',
              {
                orderId,
                currentStatus: 'DEACTIVATED',
                deliveryPartnerId: oldRiderId,
                actorUid: receivingRiderId,
                actorRole: 'delivery_partner',
                timestamp: new Date().toISOString(),
                metadata: {
                  riderId: oldRiderId,
                  reason: 'Physical handovers confirmed; deactivation finalized'
                }
              }
            );
          }
        }
      }

      await client.query('COMMIT');

      return {
        success: true,
        orderId,
        handoverStatus: 'CONFIRMED',
        oldRiderDeactivated,
        message: oldRiderDeactivated
          ? `Handover confirmed; all active orders cleared and old rider ${oldRiderId} deactivated.`
          : `Handover confirmed for order ${orderId}.`
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
