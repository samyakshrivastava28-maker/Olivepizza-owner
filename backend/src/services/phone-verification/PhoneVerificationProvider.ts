export interface VerificationResult {
  success: boolean;
  phone?: string;
  provider?: string;
  name?: string;
  country?: string;
  error?: string;
}

export interface OTPRequestResult {
  success: boolean;
  message?: string;
  error?: string;
  blockedUntil?: number;
}

export interface PhoneVerificationProvider {
  /**
   * Generates and sends an OTP to the given phone number.
   * Returns a result indicating success or rate-limit blocks.
   */
  sendOtp?(phone: string, userId: string): Promise<OTPRequestResult>;
  
  /**
   * Verifies an OTP code for a phone number.
   */
  verifyOtp?(phone: string, code: string, userId: string): Promise<VerificationResult>;

  /**
   * Verifies a payload natively from a 1-tap provider (like Truecaller).
   */
  verifyNativePayload?(payload: any, signature: string, signatureAlgorithm?: string): Promise<VerificationResult>;
}
