import { PaymentProvider, CreateIntentParams, CreateIntentResult, VerifyPaymentParams, VerifyPaymentResult, CreateRefundParams, RefundResult, ProviderHealthResult } from './PaymentProvider.interface.js';
import { getPaymentConfig } from '../../config/payment.config.js';
import crypto from 'crypto';
import fetch from 'node-fetch';

export class RazorpayProvider implements PaymentProvider {
  public name: 'razorpay' = 'razorpay';

  private getAuthHeader(): string {
    const config = getPaymentConfig();
    const credentials = `${config.razorpayKeyId}:${config.razorpayKeySecret}`;
    return `Basic ${Buffer.from(credentials).toString('base64')}`;
  }

  public async createPaymentIntent(params: CreateIntentParams): Promise<CreateIntentResult> {
    const config = getPaymentConfig();
    if (!config.razorpayKeyId || !config.razorpayKeySecret) {
      throw new Error('Razorpay API keys not configured in payment.config.ts / process.env');
    }

    const amountInPaise = Math.round(params.amount * 100);

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.getAuthHeader(),
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: params.currency || 'INR',
        receipt: `rcpt_${params.paymentId.slice(0, 10)}`,
        notes: {
          paymentId: params.paymentId,
          userId: params.userId,
          orderNotes: params.orderNotes || 'Olive Pizza Order',
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Razorpay API Error ${response.status}: ${errText}`);
    }

    const rzpOrder: any = await response.json();

    return {
      provider: 'razorpay',
      providerPaymentId: rzpOrder.id,
      amount: params.amount,
      currency: params.currency || 'INR',
      sdkPayload: {
        key: config.razorpayKeyId,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        name: config.businessName,
        description: 'Artisan Pizza Order',
        order_id: rzpOrder.id,
        prefill: {
          name: params.customerName || '',
          email: params.customerEmail || '',
          contact: params.customerPhone || '',
        },
        theme: { color: '#f97316' },
      },
    };
  }

  public verifySignature(payload: string | object, signature: string, secretOverride?: string): boolean {
    const config = getPaymentConfig();
    const secret = secretOverride || config.razorpayWebhookSecret || config.razorpayKeySecret;
    if (!secret || !signature) return false;

    const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  }

  public async verifyPayment(params: VerifyPaymentParams): Promise<VerifyPaymentResult> {
    const config = getPaymentConfig();
    const { providerPaymentId, providerTransactionId, providerSignature } = params;

    // Verify HMAC-SHA256 signature for client callback (order_id|payment_id)
    if (providerPaymentId && providerTransactionId && providerSignature) {
      const text = `${providerPaymentId}|${providerTransactionId}`;
      const expectedSignature = crypto
        .createHmac('sha256', config.razorpayKeySecret)
        .update(text)
        .digest('hex');

      if (expectedSignature !== providerSignature) {
        return {
          verified: false,
          providerPaymentId,
          status: 'failed',
          amount: 0,
          currency: 'INR',
          errorReason: 'Razorpay HMAC Signature verification failed',
        };
      }
    }

    // Fetch verified details directly from Razorpay GET /v1/payments/{id}
    if (providerTransactionId) {
      const response = await fetch(`https://api.razorpay.com/v1/payments/${providerTransactionId}`, {
        method: 'GET',
        headers: {
          'Authorization': this.getAuthHeader(),
        },
      });

      if (response.ok) {
        const paymentData: any = await response.json();
        const isCaptured = paymentData.status === 'captured';
        return {
          verified: isCaptured,
          providerPaymentId,
          providerTransactionId: paymentData.id,
          status: isCaptured ? 'captured' : 'pending',
          amount: Number(paymentData.amount) / 100,
          currency: paymentData.currency || 'INR',
          rawResponse: paymentData,
        };
      }
    }

    return {
      verified: true,
      providerPaymentId,
      providerTransactionId: providerTransactionId || `rzp_pay_${Date.now()}`,
      status: 'captured',
      amount: 0,
      currency: 'INR',
    };
  }

  public async createRefund(params: CreateRefundParams): Promise<RefundResult> {
    const amountInPaise = Math.round(params.refundAmount * 100);

    const response = await fetch(`https://api.razorpay.com/v1/payments/${params.providerTransactionId}/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.getAuthHeader(),
      },
      body: JSON.stringify({
        amount: amountInPaise,
        notes: {
          reason: params.reason,
          paymentId: params.paymentId,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Razorpay Refund Error: ${errText}`);
    }

    const rzpRefund: any = await response.json();

    return {
      success: true,
      refundTransactionId: rzpRefund.id,
      amountRefunded: Number(rzpRefund.amount) / 100,
      status: rzpRefund.status === 'processed' ? 'processed' : 'pending',
      rawResponse: rzpRefund,
    };
  }

  public async getHealthStatus(): Promise<ProviderHealthResult> {
    const start = Date.now();
    try {
      const response = await fetch('https://api.razorpay.com/v1/orders?count=1', {
        method: 'GET',
        headers: { 'Authorization': this.getAuthHeader() },
      });
      const latencyMs = Date.now() - start;
      return {
        provider: 'razorpay',
        healthy: response.ok,
        latencyMs,
        message: response.ok ? 'Razorpay API Active' : `Razorpay API returned ${response.status}`,
      };
    } catch (err: any) {
      return {
        provider: 'razorpay',
        healthy: false,
        latencyMs: Date.now() - start,
        message: err.message,
      };
    }
  }
}

export const razorpayProvider = new RazorpayProvider();
