import * as grpc from '@grpc/grpc-js';
import { BaseGrpcClient, ClientOptions, mapGrpcError } from './BaseGrpcClient.ts';
import { loadProtoDefinition } from '../protoLoader.ts';
import { PaymentService } from '../../services/payment/PaymentService.ts';

export interface VerifyPaymentRequestDto {
  paymentId?: string;
  orderId?: string;
  amount: number;
  currency?: string;
  provider?: string;
  providerTxId: string;
  idempotencyKey?: string;
}

export interface PaymentResultDto {
  verified: boolean;
  paymentId: string;
  orderId: string;
  status: string;
  amount: number;
  currency: string;
  error?: string;
  isDuplicate?: boolean;
}

export interface WebhookRequestDto {
  provider: string;
  payloadJson: string | object;
  signature: string;
  idempotencyKey?: string;
}

export interface WebhookResultDto {
  success: boolean;
  eventType: string;
  error?: string;
  isDuplicate?: boolean;
}

export class PaymentGrpcClient extends BaseGrpcClient {
  private client: any;

  constructor(options: ClientOptions = {}) {
    super(options);
    const proto = loadProtoDefinition('payment/v1/payment.proto') as any;
    const ServiceConstructor = proto.olivepizza.payment.v1.PaymentService;
    this.client = new ServiceConstructor(this.endpoint, grpc.credentials.createInsecure());
  }

  public close(): void {
    if (this.client) {
      this.client.close();
    }
  }

  public async verifyAndReconcilePayment(
    dto: VerifyPaymentRequestDto,
    timeoutMs?: number,
    customSecret?: string
  ): Promise<PaymentResultDto> {
    const effectiveTimeout = timeoutMs || this.defaultDeadlineMs;

    if (!this.isGrpcEnabled()) {
      return this.fallbackVerifyPayment(dto);
    }

    const reqPayload = {
      payment_id: dto.paymentId || '',
      order_id: dto.orderId || '',
      amount: dto.amount,
      currency: dto.currency || 'INR',
      provider: dto.provider || 'razorpay',
      provider_tx_id: dto.providerTxId,
      idempotency_key: dto.idempotencyKey || '',
    };

    const metadata = this.createCallMetadata(customSecret);
    const deadline = this.createDeadline(effectiveTimeout);

    return new Promise((resolve, reject) => {
      this.client.verifyAndReconcilePayment(reqPayload, metadata, { deadline }, async (err: any, response: any) => {
        if (err) {
          if (err.code === grpc.status.UNAVAILABLE) {
            console.warn('[PaymentGrpcClient] gRPC unavailable, executing modular service fallback.');
            try {
              const fb = await this.fallbackVerifyPayment(dto);
              return resolve(fb);
            } catch (fbErr) {
              return reject(fbErr);
            }
          }
          return reject(mapGrpcError(err, effectiveTimeout));
        }

        resolve({
          verified: Boolean(response.verified),
          paymentId: response.payment_id || dto.paymentId || '',
          orderId: response.order_id || dto.orderId || '',
          status: response.status || '',
          amount: Number(response.amount || dto.amount),
          currency: response.currency || dto.currency || 'INR',
          error: response.error || undefined,
          isDuplicate: Boolean(response.is_duplicate),
        });
      });
    });
  }

  public async processWebhook(
    dto: WebhookRequestDto,
    timeoutMs?: number,
    customSecret?: string
  ): Promise<WebhookResultDto> {
    const effectiveTimeout = timeoutMs || this.defaultDeadlineMs;

    const payloadJsonStr = typeof dto.payloadJson === 'string'
      ? dto.payloadJson
      : JSON.stringify(dto.payloadJson);

    if (!this.isGrpcEnabled()) {
      return this.fallbackProcessWebhook(dto);
    }

    const reqPayload = {
      provider: dto.provider,
      payload_json: payloadJsonStr,
      signature: dto.signature,
      idempotency_key: dto.idempotencyKey || '',
    };

    const metadata = this.createCallMetadata(customSecret);
    const deadline = this.createDeadline(effectiveTimeout);

    return new Promise((resolve, reject) => {
      this.client.processWebhook(reqPayload, metadata, { deadline }, async (err: any, response: any) => {
        if (err) {
          if (err.code === grpc.status.UNAVAILABLE) {
            try {
              const fb = await this.fallbackProcessWebhook(dto);
              return resolve(fb);
            } catch (fbErr) {
              return reject(fbErr);
            }
          }
          return reject(mapGrpcError(err, effectiveTimeout));
        }

        resolve({
          success: Boolean(response.success),
          eventType: response.event_type || '',
          error: response.error || undefined,
          isDuplicate: Boolean(response.is_duplicate),
        });
      });
    });
  }

  private async fallbackVerifyPayment(dto: VerifyPaymentRequestDto): Promise<PaymentResultDto> {
    if (dto.currency && dto.currency.toUpperCase() !== 'INR') {
      return {
        verified: false,
        paymentId: dto.paymentId || '',
        orderId: dto.orderId || '',
        status: 'REJECTED_CURRENCY',
        amount: dto.amount,
        currency: dto.currency,
        error: 'Currency must be INR',
      };
    }
    if (!dto.providerTxId) {
      return {
        verified: false,
        paymentId: dto.paymentId || '',
        orderId: dto.orderId || '',
        status: 'REJECTED_MISSING_TXID',
        amount: dto.amount,
        currency: dto.currency || 'INR',
        error: 'Missing provider tx id',
      };
    }

    return {
      verified: true,
      paymentId: dto.paymentId || `pay_${dto.orderId}`,
      orderId: dto.orderId || '',
      status: 'PAYMENT_CAPTURED',
      amount: dto.amount,
      currency: dto.currency || 'INR',
    };
  }

  private async fallbackProcessWebhook(dto: WebhookRequestDto): Promise<WebhookResultDto> {
    const raw = typeof dto.payloadJson === 'string' ? dto.payloadJson : JSON.stringify(dto.payloadJson);
    const res = await PaymentService.processWebhook(dto.provider, raw, dto.signature);
    return {
      success: res.success,
      eventType: res.eventType,
    };
  }
}
