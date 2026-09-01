import 'dotenv/config';
import { phoneVerificationService } from './services/phone-verification/PhoneVerificationService.js';

const targetPhone = process.argv[2] || '+919179944445';

async function main() {
  console.log(`[Live Test] Attempting to dispatch live Infobip SMS OTP to ${targetPhone}...`);
  const result = await phoneVerificationService.sendOtp(targetPhone, 'local_tester_01');
  console.log('[Live Test Result]:', JSON.stringify(result, null, 2));

  if (result.success) {
    console.log('\n✅ Infobip SMS request was accepted and dispatched to gateway!');
    console.log(`Reference pinId: ${result.pinId}`);
    console.log(`Valid for: ${result.expiresInSeconds} seconds (10 minutes)`);
  } else {
    console.log('\n❌ Infobip dispatch returned error:', result.error);
  }
}

main().catch(console.error);
