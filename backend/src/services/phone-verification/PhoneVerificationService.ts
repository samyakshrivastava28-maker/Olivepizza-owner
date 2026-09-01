import { PhoneVerificationProvider, OTPRequestResult, VerificationResult } from './PhoneVerificationProvider.js';
import { InfobipPhoneVerificationProvider } from './InfobipPhoneVerificationProvider.js';
import { TruecallerProvider } from './TruecallerProvider.js';

export class PhoneVerificationService {
  private static instance: PhoneVerificationService;
  private infobipProvider: InfobipPhoneVerificationProvider;
  private truecallerProvider: TruecallerProvider;

  private constructor() {
    this.infobipProvider = new InfobipPhoneVerificationProvider();
    this.truecallerProvider = new TruecallerProvider();
  }

  public static getInstance(): PhoneVerificationService {
    if (!PhoneVerificationService.instance) {
      PhoneVerificationService.instance = new PhoneVerificationService();
    }
    return PhoneVerificationService.instance;
  }

  public getInfobipProvider(): InfobipPhoneVerificationProvider {
    return this.infobipProvider;
  }

  public getTruecallerProvider(): TruecallerProvider {
    return this.truecallerProvider;
  }

  public async sendOtp(phone: string, userId: string, ipAddress?: string): Promise<OTPRequestResult> {
    return this.infobipProvider.sendOtp(phone, userId, ipAddress);
  }

  public async verifyOtp(phone: string, code: string, userId: string, pinId?: string): Promise<VerificationResult> {
    return this.infobipProvider.verifyOtp(phone, code, userId, pinId);
  }

  public async getHealthStatus(): Promise<{
    infobip: { ok: boolean; configured: boolean; latencyMs?: number; error?: string };
    truecaller: { ok: boolean; configured: boolean };
  }> {
    const infobipHealth = await this.infobipProvider.getHealthStatus();
    return {
      infobip: {
        ok: infobipHealth.ok,
        configured: infobipHealth.configured,
        latencyMs: infobipHealth.latencyMs,
        error: infobipHealth.error
      },
      truecaller: {
        ok: true,
        configured: Boolean(process.env.TRUECALLER_CLIENT_ID)
      }
    };
  }
}

export const phoneVerificationService = PhoneVerificationService.getInstance();
