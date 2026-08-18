import { PaymentProvider, CreateIntentParams, CreateIntentResult, VerifyPaymentParams, VerifyPaymentResult, CreateRefundParams, RefundResult, ProviderHealthResult } from './PaymentProvider.interface.js';
import crypto from 'crypto';

export class MockSandboxProvider implements PaymentProvider {
  public name: 'mock' = 'mock';

  public async createPaymentIntent(params: CreateIntentParams): Promise<CreateIntentResult> {
    const mockProviderOrderNo = `mock_order_${params.paymentId}_${Date.now()}`;
    return {
      provider: 'mock',
      providerPaymentId: mockProviderOrderNo,
      amount: params.amount,
      currency: params.currency || 'INR',
      sdkPayload: {
        key: 'rzp_test_mock_sandbox_key',
        amount: params.amount * 100,
        currency: params.currency || 'INR',
        name: 'Olive Pizza (Sandbox)',
        description: 'Artisan Pizza Order Sandbox Payment',
        order_id: mockProviderOrderNo,
        prefill: {
          name: params.customerName || 'Gourmet Customer',
          email: params.customerEmail || 'customer@olivepizza.app',
          contact: params.customerPhone || '9876543210',
        },
        theme: { color: '#f97316' },
      },
      checkoutUrl: `/#/checkout?sandbox_intent=${params.paymentId}&mock_order=${mockProviderOrderNo}`,
    };
  }

  public verifySignature(payload: string | object, signature: string): boolean {
    if (!signature) return true; // Mock mode allows test signatures
    return signature.startsWith('mock_sig_') || signature.length > 5;
  }

  public async verifyPayment(params: VerifyPaymentParams): Promise<VerifyPaymentResult> {
    return {
      verified: true,
      providerPaymentId: params.providerPaymentId,
      providerTransactionId: `mock_tx_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      status: 'captured',
      amount: 100, // Normalized
      currency: 'INR',
      rawResponse: { mockStatus: 'SUCCESS', mode: 'sandbox' },
    };
  }

  public async createRefund(params: CreateRefundParams): Promise<RefundResult> {
    return {
      success: true,
      refundTransactionId: `mock_ref_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      amountRefunded: params.refundAmount,
      status: 'processed',
      rawResponse: { mockRefundStatus: 'COMPLETED', mode: 'sandbox' },
    };
  }

  public async getHealthStatus(): Promise<ProviderHealthResult> {
    return {
      provider: 'mock',
      healthy: true,
      latencyMs: 12,
      message: 'Mock Sandbox Provider Operational',
    };
  }
}

export const mockSandboxProvider = new MockSandboxProvider();
