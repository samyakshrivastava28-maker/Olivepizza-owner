import { InfobipPhoneVerificationProvider } from './services/phone-verification/InfobipPhoneVerificationProvider.js';
import { phoneVerificationService } from './services/phone-verification/PhoneVerificationService.js';
import { TruecallerProvider } from './services/phone-verification/TruecallerProvider.js';

async function runTests() {
  console.log('========================================================');
  console.log('OLIVE PIZZA — INFOBIP & TRUECALLER TEST SUITE');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failed++;
    }
  }

  const provider = new InfobipPhoneVerificationProvider(true);

  // Test 1: Phone Normalization
  console.log('--- 1. Phone Normalization Tests ---');
  const n1 = provider.cleanPhoneNumber('9876543210');
  assert(n1.valid && n1.formattedPhone === '+919876543210' && n1.infobipDestination === '919876543210', 'Normalize 10-digit number');

  const n2 = provider.cleanPhoneNumber('+91 91799 44445');
  assert(n2.valid && n2.formattedPhone === '+919179944445', 'Normalize +91 formatted with spaces');

  const n3 = provider.cleanPhoneNumber('09179944445');
  assert(n3.valid && n3.formattedPhone === '+919179944445', 'Normalize leading 0 number');

  const n4 = provider.cleanPhoneNumber('12345');
  assert(!n4.valid, 'Reject short/malformed number');

  const n5 = provider.cleanPhoneNumber('5555555555');
  assert(!n5.valid, 'Reject invalid Indian prefix (<6)');

  // Test 2: Masking for logs
  console.log('\n--- 2. Phone Masking Security Tests ---');
  const masked = provider.maskPhone('+919179944445');
  assert(masked === '+919****445' && !masked.includes('9179944445'), 'Mask phone number for safe logging');

  // Test 3: Sandbox/Mock OTP Send & Verification
  console.log('\n--- 3. OTP Send & Verification Flow ---');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000).toString();
  const testPhone = `+91987654${randomSuffix}`;
  const sendRes = await provider.sendOtp(testPhone, 'test_user_01');
  assert(sendRes.success && Boolean(sendRes.pinId), 'Send OTP returns success with pinId');

  // Test 4: Cooldown Protection
  console.log('\n--- 4. Cooldown & Rate Limit Protection ---');
  const duplicateSend = await provider.sendOtp(testPhone, 'test_user_01');
  assert(!duplicateSend.success && Boolean(duplicateSend.cooldownSeconds), 'Duplicate send within 60s is blocked by cooldown');

  // Test 5: Invalid OTP Verification
  console.log('\n--- 5. Security & Verification Tests ---');
  const invalidVerify = await provider.verifyOtp(testPhone, '000000', 'test_user_01', sendRes.pinId);
  assert(!invalidVerify.success, 'Invalid OTP is rejected');

  // Test 6: Valid Sandbox OTP Verification
  const validVerify = await provider.verifyOtp(testPhone, '123456', 'test_user_01', sendRes.pinId);
  assert(validVerify.success && validVerify.phone === testPhone, 'Valid OTP is confirmed and phone marked verified');

  // Test 7: Replay Protection (Second attempt with same OTP session)
  const replayVerify = await provider.verifyOtp(testPhone, '123456', 'test_user_01', sendRes.pinId);
  assert(!replayVerify.success, 'Replay attempt with consumed OTP is rejected');

  // Test 8: Truecaller Web Session
  console.log('\n--- 6. Truecaller Web & DeepLink Tests ---');
  const tcProvider = new TruecallerProvider();
  const tcSession = tcProvider.createWebSession(testPhone, 'test_user_01');
  assert(tcSession.status === 'PENDING' && tcSession.deepLink?.includes('truecallersdk://'), 'Truecaller Web/QR session creates valid deepLink');

  const fetchedSession = tcProvider.getWebSession(tcSession.requestId);
  assert(fetchedSession?.requestId === tcSession.requestId, 'Truecaller session is queryable by requestId');

  // Test 9: Provider Service Health Status
  console.log('\n--- 7. Health Status Diagnostics ---');
  const health = await phoneVerificationService.getHealthStatus();
  assert(typeof health.infobip.configured === 'boolean' && health.truecaller.ok, 'Health diagnostics check passes');

  console.log('\n========================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
