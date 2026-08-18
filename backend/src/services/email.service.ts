import nodemailer from 'nodemailer';
import { pgPool } from '../config/postgres.js';
import { DevAlertService } from './email/DevAlertService.js';
import dotenv from 'dotenv';
dotenv.config();

// Fast fail on missing env
if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
  console.error("CRITICAL ERROR: SMTP credentials missing in environment variables. Emails will fail.");
}

// Clean and sanitize SMTP credentials
const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
const smtpUser = process.env.SMTP_USER?.trim() || '';
const smtpPass = process.env.SMTP_PASS ? process.env.SMTP_PASS.trim().replace(/\s+/g, '') : '';

// Reusable transporter object using standard SMTP transport with strict timeouts
export const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: smtpUser,
    pass: smtpPass,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
  tls: {
    rejectUnauthorized: false
  }
});

/**
 * Direct Send Immediate Helper — bypasses DB queue for urgent transactional delivery
 */
export const sendEmailDirect = async (
  recipient: string,
  subject: string,
  htmlContent: string,
  attachments?: any[]
) => {
  return await transporter.sendMail({
    from: process.env.SMTP_FROM || '"Olive Pizza" <noreply@olivepizza.app>',
    to: recipient,
    subject: subject,
    html: htmlContent,
    attachments: attachments,
  });
};

// Verify SMTP Connection on Startup (non-blocking)
transporter.verify((error, success) => {
  if (error) {
    console.error("==========================================");
    console.error("FATAL EMAIL ERROR: SMTP Verification Failed!");
    console.error("==========================================");
    console.error("SMTP Response:", error.message);
    console.error("Configuration Used:");
    console.error(`Host: ${smtpHost}`);
    console.error(`Port: ${smtpPort}`);
    console.error(`User: ${smtpUser}`);
    console.error("==========================================");

    // Notify developer via DevAlertService
    DevAlertService.sendAlert({
      service: 'SMTP Transporter',
      action: 'Startup Verification',
      error: error,
      context: { host: smtpHost, user: smtpUser }
    }).catch(() => {});
  } else {
    console.log("📧 SMTP Server is ready to take our messages.");
  }
});

/**
 * Non-Blocking Asynchronous Queue Function
 *
 * Instantly inserts email into PostgreSQL email_queue as 'pending' and returns
 * immediately without blocking the request thread. Triggers background worker.
 */
export const queueEmail = async (
  recipient: string,
  subject: string,
  htmlContent: string,
  type: 'transactional' | 'marketing' | 'auth' = 'transactional',
  campaignId: number | null = null,
  idempotencyKey: string | null = null,
  attachments?: any[]
): Promise<number> => {
  const attachmentsJson = attachments ? JSON.stringify(attachments) : null;
  let queueId = -1;

  try {
    if (idempotencyKey) {
      const res = await pgPool.query(`
        INSERT INTO email_queue (recipient, subject, html_content, type, campaign_id, idempotency_key, attachments, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', CURRENT_TIMESTAMP)
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING id
      `, [recipient, subject, htmlContent, type, campaignId, idempotencyKey, attachmentsJson]);
      queueId = res.rows[0]?.id || -1;
    } else {
      const res = await pgPool.query(`
        INSERT INTO email_queue (recipient, subject, html_content, type, campaign_id, attachments, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, 'pending', CURRENT_TIMESTAMP)
        RETURNING id
      `, [recipient, subject, htmlContent, type, campaignId, attachmentsJson]);
      queueId = res.rows[0]?.id || -1;
    }

    console.log(`[EmailQueue] Enqueued email ID=${queueId} to ${recipient} (type=${type})`);

    // Trigger immediate background drain without awaiting
    setImmediate(() => {
      processEmailQueue().catch(err => console.warn('[EmailQueue] Immediate drain warning:', err.message));
    });

    return queueId;
  } catch (dbErr: any) {
    console.warn('[EmailQueue] DB Queue insert failed. Falling back to non-blocking async direct send:', dbErr.message);
    
    // Direct fallback send if DB table unavailable
    setImmediate(async () => {
      try {
        const info = await transporter.sendMail({
          from: process.env.SMTP_FROM || '"Olive Pizza" <noreply@olivepizza.app>',
          to: recipient,
          subject: subject,
          html: htmlContent,
          attachments: attachments,
        });
        console.log(`[EmailDirectFallback] Sent email to ${recipient}: ${info.messageId}`);
      } catch (directErr: any) {
        console.error(`[EmailDirectFallback] Failed to send email to ${recipient}:`, directErr.message);
        DevAlertService.sendAlert({
          service: 'EmailDirectFallback',
          action: 'SendMail',
          error: directErr,
          context: { recipient, subject, type }
        }).catch(() => {});
      }
    });

    return -1;
  }
};

let isProcessingEmailQueue = false;

/**
 * Background Email Worker Processor
 *
 * Drains pending emails in batches of 20 with exponential backoff retries:
 *   retry_count = 1 → wait 1 min
 *   retry_count = 2 → wait 5 min
 *   retry_count = 3 → wait 15 min
 * Max retries exhausted → Moves to dead_letter_queue & notifies developer.
 */
export const processEmailQueue = async () => {
  if (isProcessingEmailQueue) return;
  isProcessingEmailQueue = true;

  try {
    const { rows: emails } = await pgPool.query(`
      SELECT * FROM email_queue 
      WHERE status = 'pending' 
         OR (status = 'failed' AND retry_count < max_retries 
             AND (retry_timestamp IS NULL OR retry_timestamp <= CURRENT_TIMESTAMP))
      ORDER BY type DESC, created_at ASC 
      LIMIT 20
    `);

    if (emails.length === 0) return;

    console.log(`[EmailQueue] Processing ${emails.length} emails from queue...`);

    for (const email of emails) {
      try {
        await pgPool.query(`UPDATE email_queue SET status = 'processing' WHERE id = $1`, [email.id]);

        let parsedAttachments;
        if (email.attachments) {
          const rawAtt = typeof email.attachments === 'string' ? JSON.parse(email.attachments) : email.attachments;
          if (Array.isArray(rawAtt)) {
            parsedAttachments = rawAtt.map((att: any) => {
              if (att && att.content) {
                if (typeof att.content === 'object' && att.content.type === 'Buffer' && Array.isArray(att.content.data)) {
                  return { ...att, content: Buffer.from(att.content.data) };
                }
                if (typeof att.content === 'object' && Array.isArray(att.content.data)) {
                  return { ...att, content: Buffer.from(att.content.data) };
                }
                if (typeof att.content === 'string' && att.encoding === 'base64') {
                  return { ...att, content: Buffer.from(att.content, 'base64') };
                }
              }
              return att;
            });
          } else {
            parsedAttachments = rawAtt;
          }
        }

        const info = await transporter.sendMail({
          from: process.env.SMTP_FROM || '"Olive Pizza" <noreply@olivepizza.app>',
          to: email.recipient,
          subject: email.subject,
          html: email.html_content,
          attachments: parsedAttachments,
        });

        console.log(`[EmailQueue] ✅ Sent email ID ${email.id} to ${email.recipient} (${info.messageId})`);

        await pgPool.query(`
          UPDATE email_queue 
          SET status = 'sent', sent_at = CURRENT_TIMESTAMP, smtp_response = $2
          WHERE id = $1
        `, [email.id, info.response || info.messageId]);

        if (email.campaign_id) {
          await pgPool.query(`
            UPDATE email_campaigns 
            SET sent_count = sent_count + 1 
            WHERE id = $1
          `, [email.campaign_id]);
        }

      } catch (error: any) {
        console.error(`[EmailQueue] Send failed for Queue ID ${email.id} (${email.recipient}):`, error.message);

        const newRetryCount = (email.retry_count || 0) + 1;
        let nextRetryMinutes = 0;
        if (newRetryCount === 1) nextRetryMinutes = 1;
        else if (newRetryCount === 2) nextRetryMinutes = 5;
        else nextRetryMinutes = 15;

        if (newRetryCount >= (email.max_retries || 3)) {
          console.error(`[EmailQueue] Max retries reached for Queue ID ${email.id}. Moving to Dead Letter Queue.`);
          
          await pgPool.query(`
            INSERT INTO dead_letter_queue (original_queue_id, recipient, subject, payload, final_error)
            VALUES ($1, $2, $3, $4, $5)
          `, [email.id, email.recipient, email.subject, email.html_content, error.message]);

          await pgPool.query(`
            UPDATE email_queue 
            SET status = 'failed', retry_count = $2, last_error = $3, smtp_response = $4, retry_timestamp = NULL
            WHERE id = $1
          `, [email.id, newRetryCount, error.message, error.response || error.message]);

          // Trigger developer alert email for exhausted queue retries
          DevAlertService.sendAlert({
            service: 'EmailQueueWorker',
            action: 'DeadLetterExhaustion',
            error: error,
            context: { queueId: email.id, recipient: email.recipient, subject: email.subject, retries: newRetryCount },
            key: `dead_letter_${email.id}`
          }).catch(() => {});

        } else {
          await pgPool.query(`
            UPDATE email_queue 
            SET status = 'pending', retry_count = $1, last_error = $2, smtp_response = $3, 
                retry_timestamp = CURRENT_TIMESTAMP + ($4::text || ' minutes')::interval
            WHERE id = $5
          `, [newRetryCount, error.message, error.response || error.message, nextRetryMinutes, email.id]);
        }
      }
    }
  } catch (error: any) {
    console.error('[EmailQueue] Worker loop error:', error.message);
  } finally {
    isProcessingEmailQueue = false;
  }
};

// Background polling timer: Drains queued emails every 5 seconds
const emailPollingTimer = setInterval(() => {
  processEmailQueue().catch(err => {
    if (err && err.message !== 'No work') {
      console.warn('[EmailQueue] Polling warning:', err.message);
    }
  });
}, 5000);

if (emailPollingTimer.unref) emailPollingTimer.unref();
console.log('📧 [EmailQueue] Asynchronous background queue worker active (5s polling interval).');
