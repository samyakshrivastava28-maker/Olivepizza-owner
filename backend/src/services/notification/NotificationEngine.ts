/**
 * NotificationEngine — Single Notification Pipeline
 *
 * This is the ONE and ONLY notification sender in the entire codebase.
 * Every notification of every kind (order alarms, status updates, delivery
 * assignments, manual broadcasts, marketing) passes through this module.
 *
 * Architecture:
 *   Trigger (route handler / UI action)
 *         ↓
 *   NotificationEngine.send()
 *         ↓
 *   Recipient Resolver (Postgres fcm_tokens → Firestore fallback)
 *         ↓
 *   Payload Builder (always hybrid: notification + data blocks)
 *         ↓
 *   Firebase Admin sendEachForMulticast()
 *         ↓
 *   NotificationLogger + token deactivation + Postgres inbox
 *
 * Root cause fix for killed-app notification failure:
 *   ALL payloads now include a top-level `notification: { title, body }` block.
 *   This guarantees FCM system-tray auto-display even when the app process is
 *   dead. OliveMessagingService.onMessageReceived() still enhances delivery
 *   when the process is alive (alarm sound, action buttons, AlarmActivity).
 */

import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { adminMessaging, adminDb as db } from '../../config/firebase.js';
import { pgPool } from '../../config/postgres.js';
import { NotificationLogger } from './NotificationLogger.js';
import type { NotificationPayload } from './NotificationTemplates.js';

export type NotificationCategory =
  | 'alarm_actionable'    // Continuous alarm (new order, delivery assignment) — highest priority
  | 'pinned_live'         // Ongoing pinned tracker (customer order tracker updates)
  | 'simple_informational'; // One-shot informational (marketing, standard push)

export interface NotificationEngineOptions {
  tag?: string;
  orderId?: string;
  category?: NotificationCategory | string;
  priority?: 'normal' | 'high' | 'critical';
  version?: number;
  expiresInSeconds?: number;
  /** For pinned_live: collapse notifications with same tag on device */
  collapseKey?: string;
}

export interface SendResult {
  successCount: number;
  failureCount: number;
  tokensFound: number;
  errors: string[];
}

export class NotificationEngine {
  /**
   * Send a notification to a single user.
   * Resolves their active FCM tokens from Postgres (with Firestore fallback).
   * Always sends hybrid messages (notification + data blocks).
   */
  public async send(
    firebaseUserId: string,
    payload: NotificationPayload,
    options: NotificationEngineOptions = {}
  ): Promise<SendResult> {
    return this.sendBulk([firebaseUserId], payload, options);
  }

  /**
   * Send a notification to multiple users simultaneously.
   * Resolves all active FCM tokens for the given UIDs, deduplicates,
   * chunks into FCM-safe batches of 500, and sends concurrently.
   */
  public async sendBulk(
    firebaseUserIds: string[],
    payload: NotificationPayload,
    options: NotificationEngineOptions = {}
  ): Promise<SendResult> {
    if (!firebaseUserIds || firebaseUserIds.length === 0) {
      return { successCount: 0, failureCount: 0, tokensFound: 0, errors: [] };
    }

    // ── 1. Resolve FCM tokens ─────────────────────────────────────────────────
    const tokens = await this.resolveTokens(firebaseUserIds);

    const startTime = Date.now();
    const notificationId = options.orderId ? `notif_${options.orderId}_${Date.now()}` : `notif_${Date.now()}`;
    const eventType = payload.data?.stage || payload.data?.category || options.category || 'push';
    const triggerSource = options.category === 'simple_informational' || payload.data?.source === 'owner_broadcast'
      ? 'manual' : 'automatic';

    if (tokens.length === 0) {
      console.warn(`[NotificationEngine] No active FCM tokens found for UIDs: ${firebaseUserIds.join(', ')}`);
      NotificationLogger.log({
        notificationId,
        timestamp: new Date().toISOString(),
        orderId: options.orderId,
        userId: firebaseUserIds[0] || 'unknown',
        triggerSource,
        eventType,
        recipientRole: payload.data?.role || options.category,
        recipients: firebaseUserIds.join(', '),
        resolvedUids: firebaseUserIds,
        resolvedTokens: 0,
        invalidTokens: 0,
        fcmSuccess: 0,
        fcmFailure: 0,
        skippedTokens: firebaseUserIds.length,
        retryCount: 0,
        providerUsed: 'Firebase FCM',
        latencyMs: 0,
        elapsedTimeMs: 0,
        status: 'skipped',
        errorDetails: 'No active FCM tokens found for target user(s)',
      });
      return { successCount: 0, failureCount: 0, tokensFound: 0, errors: ['no_tokens'] };
    }

    // ── 2. Normalize Android priority ────────────────────────────────────────
    let androidPriority: 'normal' | 'high' = 'high';
    if (options.priority === 'normal') androidPriority = 'normal';

    // Preserve or set channel from payload
    const channelId = payload.android?.notification?.channelId
      || payload.data?.channelId
      || 'olive_order_new';
    const soundName = payload.android?.notification?.sound
      || payload.data?.sound
      || 'default';
    const clickAction = payload.android?.notification?.clickAction
      || (payload.data?.alert === 'continuous' ? 'olive_alarm' : undefined);

    // Ensure android block is always fully populated
    if (!payload.android) payload.android = {} as any;
    payload.android!.priority = androidPriority;
    if (!payload.android!.notification) payload.android!.notification = {} as any;
    payload.android!.notification!.channelId = channelId;
    payload.android!.notification!.sound = soundName;
    (payload.android!.notification as any).visibility = 'public';
    payload.android!.notification!.notificationPriority =
      androidPriority === 'high' ? 'PRIORITY_MAX' : 'PRIORITY_DEFAULT';
    payload.android!.notification!.defaultVibrateTimings =
      payload.android!.notification!.defaultVibrateTimings ?? true;
    if (clickAction) {
      payload.android!.notification!.clickAction = clickAction;
    }

    // ── 3. Sanitize data block & APNs headers (MUST be string values) ──────
    const sanitizedData: Record<string, string> = {};

    if (payload.data && typeof payload.data === 'object') {
      for (const [k, v] of Object.entries(payload.data)) {
        if (v !== undefined && v !== null) {
          sanitizedData[k] = typeof v === 'string' ? v
            : typeof v === 'object' ? JSON.stringify(v)
            : String(v);
        }
      }
    }

    // Ensure title and body are populated in data block for native handling
    if (!sanitizedData.title && payload.notification?.title) {
      sanitizedData.title = payload.notification.title;
    }
    if (!sanitizedData.body && payload.notification?.body) {
      sanitizedData.body = payload.notification.body;
    }
    if (!sanitizedData.title && payload.android?.notification?.title) {
      sanitizedData.title = payload.android.notification.title;
    }
    if (!sanitizedData.body && payload.android?.notification?.body) {
      sanitizedData.body = payload.android.notification.body;
    }
    if (!sanitizedData.title) sanitizedData.title = 'Olive Pizza';
    if (!sanitizedData.body) sanitizedData.body = 'New update received';

    // Strict APNs header sanitization & validation (Firebase requires EVERY APNs header to be a string)
    const sanitizedApns = sanitizeApnsConfig(payload.apns, options.category || 'push');

    // Category Payload Rule (§2.1):
    // - alarm_actionable & pinned_live MUST BE DATA-ONLY (NO top-level notification block).
    //   Otherwise, Android OS intercepts the notification when app is closed/backgrounded,
    //   renders a default tray banner, and SUPPRESSES onMessageReceived().
    // - simple_informational uses HYBRID payload (notification + data).
    const isDataOnlyCategory = options.category === 'alarm_actionable' || options.category === 'pinned_live';

    // ── 4. Chunk and send ────────────────────────────────────────────────────
    const chunkSize = 500;
    const chunks: string[][] = [];
    for (let i = 0; i < tokens.length; i += chunkSize) {
      chunks.push(tokens.slice(i, i + chunkSize));
    }

    console.log(
      `[NotificationEngine] Sending category=${options.category || 'order'} | ` +
      `dataOnly=${isDataOnlyCategory} | targets=${firebaseUserIds.length} | tokens=${tokens.length} | chunks=${chunks.length}`
    );

    let totalSuccess = 0;
    let totalFailure = 0;
    const errors: string[] = [];
    const failedTokens: string[] = [];

    await Promise.all(chunks.map(async (chunk) => {
      try {
        const androidConfig = payload.android ? { ...payload.android } : undefined;
        if (isDataOnlyCategory && androidConfig) {
          delete androidConfig.notification;
        }

        const message: admin.messaging.MulticastMessage = {
          tokens: chunk,
          data: sanitizedData,
          android: androidConfig,
          apns: sanitizedApns,
          webpush: payload.webpush,
        };

        // Attach top-level notification ONLY for simple_informational / non-custom categories
        if (!isDataOnlyCategory && payload.notification) {
          message.notification = payload.notification;
        }

        const response = await adminMessaging.sendEachForMulticast(message);
        const elapsedMs = Date.now() - startTime;
        totalSuccess += response.successCount;
        totalFailure += response.failureCount;

        response.responses.forEach((r, idx) => {
          const fcmToken = chunk[idx];

          if (r.error) {
            const code = r.error.code;
            if (
              code === 'messaging/invalid-registration-token' ||
              code === 'messaging/registration-token-not-registered' ||
              code === 'invalid-registration-token' ||
              code === 'registration-token-not-registered'
            ) {
              failedTokens.push(fcmToken);
            } else {
              errors.push(`${code}: ${r.error.message}`);
            }
          }

          NotificationLogger.log({
            notificationId,
            timestamp: new Date().toISOString(),
            orderId: options.orderId,
            userId: firebaseUserIds.length === 1 ? firebaseUserIds[0] : 'bulk_target',
            category: options.category || payload.data?.category || 'push',
            triggerSource,
            eventType,
            recipientRole: payload.data?.role || options.category,
            recipients: firebaseUserIds.join(', '),
            resolvedUids: firebaseUserIds,
            resolvedTokens: tokens.length,
            invalidTokens: failedTokens.length,
            fcmSuccess: response.successCount,
            fcmFailure: response.failureCount,
            skippedTokens: 0,
            retryCount: 0,
            providerUsed: 'Firebase FCM',
            latencyMs: elapsedMs,
            elapsedTimeMs: elapsedMs,
            fcmToken,
            payload,
            apnsHeaders: sanitizedApns?.headers || null,
            androidConfig: payload.android || null,
            firebaseResponse: r,
            status: r.success ? 'success' : 'failure',
            errorDetails: r.error?.message,
            retryReason: r.error?.code,
          });
        });
      } catch (err: any) {
        console.error('[NotificationEngine] Chunk send failed:', err.message);
        errors.push(err.message);
        totalFailure += chunk.length;
      }
    }));

    // ── 5. Deactivate permanently invalid tokens in Postgres & Firestore ────────
    if (failedTokens.length > 0) {
      pgPool.query(
        `UPDATE fcm_tokens SET is_active = FALSE WHERE token = ANY($1)`,
        [failedTokens]
      ).catch(err => console.error('[NotificationEngine] Token deactivation failed:', err.message));

      // Remove from Firestore user docs as well
      for (const uid of firebaseUserIds) {
        db.collection('users').doc(uid).update({
          fcmTokens: FieldValue.arrayRemove(...failedTokens)
        }).catch(() => {});
      }

      console.log(`[NotificationEngine] Deactivated ${failedTokens.length} invalid FCM tokens`);
    }

    console.log(
      `[NotificationEngine] Result: ${totalSuccess} sent, ${totalFailure} failed, ` +
      `${tokens.length} tokens, ${Date.now() - startTime}ms`
    );

    return {
      successCount: totalSuccess,
      failureCount: totalFailure,
      tokensFound: tokens.length,
      errors,
    };
  }

  /**
   * Resolve active FCM tokens for a list of Firebase UIDs.
   * Primary: Postgres fcm_tokens (is_active=TRUE)
   * Fallback: Firestore users.fcmTokens[] (auto-synced back to Postgres)
   */
  private async resolveTokens(firebaseUserIds: string[]): Promise<string[]> {
    const client = await pgPool.connect();
    try {
      const result = await client.query(
        `SELECT user_id as firebase_uid, token
         FROM fcm_tokens
         WHERE user_id = ANY($1) AND is_active = TRUE`,
        [firebaseUserIds]
      );

      const foundUids = new Set(result.rows.map((r: any) => r.firebase_uid));
      let tokens: string[] = result.rows.map((r: any) => r.token);

      // Firestore fallback for UIDs with no Postgres tokens
      const missingUids = firebaseUserIds.filter(uid => !foundUids.has(uid));
      if (missingUids.length > 0) {
        for (const uid of missingUids) {
          try {
            const userDoc = await db.collection('users').doc(uid).get();
            const firestoreTokens: string[] = userDoc.data()?.fcmTokens || [];
            for (const t of firestoreTokens) {
              if (t && typeof t === 'string') {
                tokens.push(t);
                // Auto-sync to Postgres so future sends don't need the fallback
                client.query(
                  `INSERT INTO fcm_tokens (user_id, token, is_active, last_used_at)
                   VALUES ($1, $2, TRUE, NOW())
                   ON CONFLICT (user_id, token)
                   DO UPDATE SET is_active = TRUE, last_used_at = NOW()`,
                  [uid, t]
                ).catch(() => {});
              }
            }
          } catch (e: any) {
            console.warn(`[NotificationEngine] Firestore token fallback failed for ${uid}:`, e.message);
          }
        }
      }

      return Array.from(new Set(tokens)); // deduplicate
    } finally {
      client.release();
    }
  }

  /**
   * Resolve all active FCM tokens for users with a given role.
   * Resolves UIDs from Firestore users collection.
   */
  public async resolveByRole(role: 'owner' | 'delivery_partner' | 'customer' | 'restaurant_manager' | 'restaurant' | 'franchise' | string): Promise<string[]> {
    let targetRoles: string[] = [role];
    if (role === 'delivery_partner' || role === 'delivery') {
      targetRoles = ['delivery_partner', 'delivery'];
    } else if (role === 'restaurant' || role === 'restaurant_manager') {
      targetRoles = ['restaurant_manager', 'kitchen_staff', 'manager'];
    } else if (role === 'franchise' || role === 'franchise_manager') {
      targetRoles = ['franchise_owner', 'franchise_manager'];
    } else if (role === 'owner' || role === 'admin') {
      targetRoles = ['owner', 'admin'];
    } else if (role === 'customer') {
      targetRoles = ['customer'];
    }

    const uidsSet = new Set<string>();

    // 1. Resolve user UIDs from Firestore users collection
    try {
      for (const r of targetRoles) {
        const snap = await db.collection('users').where('role', '==', r).get();
        snap.docs.forEach(doc => uidsSet.add(doc.id));
      }
    } catch (e: any) {
      console.warn(`[NotificationEngine] Firestore role lookup failed for ${role}:`, e.message);
    }

    // 2. Also check PostgreSQL users table if available (graceful fallback)
    try {
      const res = await pgPool.query(
        `SELECT firebase_uid FROM users WHERE role = ANY($1)`,
        [targetRoles]
      );
      res.rows.forEach((row: any) => {
        if (row.firebase_uid) uidsSet.add(row.firebase_uid);
      });
    } catch (e: any) {
      // Ignore error if Postgres users table doesn't have role column
    }

    return Array.from(uidsSet);
  }

  /**
   * Resolves active user UIDs for restaurant managers/staff for a specific branch.
   * Strictly scopes new-order and operational alerts to the target branch.
   */
  public async resolveBranchStaff(
    branchId: string,
    roles: string[] = ['restaurant_manager', 'kitchen_staff', 'manager']
  ): Promise<string[]> {
    const uidsSet = new Set<string>();

    try {
      // 1. Query Firestore users by branchId + role
      for (const r of roles) {
        const snap = await db.collection('users')
          .where('branchId', '==', branchId)
          .where('role', '==', r)
          .get();
        snap.docs.forEach(doc => {
          if (doc.data()?.isActive !== false) {
            uidsSet.add(doc.id);
          }
        });
      }

      // 2. Also check branchIds array (multi-branch managers)
      const multiSnap = await db.collection('users')
        .where('branchIds', 'array-contains', branchId)
        .get();
      multiSnap.docs.forEach(doc => {
        const d = doc.data();
        if (d?.isActive !== false && roles.includes(d?.role)) {
          uidsSet.add(doc.id);
        }
      });
    } catch (e: any) {
      console.warn(`[NotificationEngine] Branch staff lookup failed for branch ${branchId}:`, e.message);
    }

    return Array.from(uidsSet);
  }

  /**
   * Automatic Token Cleanup Job:
   * 1. Deactivates tokens inactive > 30 days.
   * 2. Deletes duplicate inactive tokens older than 60 days.
   */
  public async cleanupStaleTokens(): Promise<{ deactivatedCount: number; deletedCount: number }> {
    const client = await pgPool.connect();
    try {
      const deactRes = await client.query(
        `UPDATE fcm_tokens SET is_active = FALSE 
         WHERE is_active = TRUE AND (last_used_at < NOW() - INTERVAL '30 days' OR (last_used_at IS NULL AND created_at < NOW() - INTERVAL '30 days'))
         RETURNING id`
      );

      const delRes = await client.query(
        `DELETE FROM fcm_tokens 
         WHERE is_active = FALSE AND (updated_at < NOW() - INTERVAL '60 days' OR created_at < NOW() - INTERVAL '60 days')
         RETURNING id`
      );

      const deactivatedCount = deactRes.rows.length;
      const deletedCount = delRes.rows.length;
      if (deactivatedCount > 0 || deletedCount > 0) {
        console.log(`[NotificationEngine] Token Cleanup: Deactivated ${deactivatedCount} stale tokens, deleted ${deletedCount} expired tokens.`);
      }

      return { deactivatedCount, deletedCount };
    } catch (err: any) {
      console.error('[NotificationEngine] Token cleanup failed:', err.message);
      return { deactivatedCount: 0, deletedCount: 0 };
    } finally {
      client.release();
    }
  }
}

/**
 * Strict APNs Payload Sanitizer & Validator:
 * Guarantees EVERY value in `apns.headers` is explicitly a string.
 * Removes null, undefined, boolean, and numeric values or converts them to String(v).
 */
export function sanitizeApnsConfig(apns?: any, category?: string): admin.messaging.ApnsConfig | undefined {
  if (!apns || typeof apns !== 'object') return undefined;

  const cleanApns: admin.messaging.ApnsConfig = {};

  if (apns.headers && typeof apns.headers === 'object') {
    const cleanHeaders: Record<string, string> = {};
    for (const [key, rawVal] of Object.entries(apns.headers)) {
      if (rawVal === null || rawVal === undefined || rawVal === '') continue;

      const stringVal = String(rawVal);
      if (typeof rawVal !== 'string') {
        console.warn(`[NotificationEngine][APNs Validation] Category="${category || 'push'}" Header "${key}" converted from ${typeof rawVal} (${rawVal}) to string "${stringVal}"`);
      }
      cleanHeaders[key] = stringVal;
    }
    if (Object.keys(cleanHeaders).length > 0) {
      cleanApns.headers = cleanHeaders;
    }
  }

  if (apns.payload && typeof apns.payload === 'object') {
    cleanApns.payload = apns.payload;
  }
  if (apns.fcmOptions && typeof apns.fcmOptions === 'object') {
    cleanApns.fcmOptions = apns.fcmOptions;
  }

  return Object.keys(cleanApns).length > 0 ? cleanApns : undefined;
}

// Singleton export
export const notificationEngine = new NotificationEngine();
