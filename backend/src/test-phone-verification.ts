import { FirebasePhoneVerificationProvider } from './services/phone-verification/FirebasePhoneVerificationProvider.js';
import { phoneVerificationService } from './services/phone-verification/PhoneVerificationService.js';
import { TruecallerProvider } from './services/phone-verification/TruecallerProvider.js';

async function runTests() {
  console.log('========================================================');
  console.log('OLIVE PIZZA — FIREBASE AUTH & TRUECALLER TEST SUITE');
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

  const provider = new FirebasePhoneVerificationProvider();

  // Test 1: Phone Normalization
  console.log('--- 1. Phone Normalization Tests ---');
  const n1 = provider.normalizePhone('9876543210');
  assert(n1.valid && n1.formattedPhone === '+919876543210', 'Normalize 10-digit number to E.164');

  const n2 = provider.normalizePhone('+91 91799 44445');
  assert(n2.valid && n2.formattedPhone === '+919179944445', 'Normalize +91 formatted with spaces');

  const n3 = provider.normalizePhone('919179944445');
  assert(n3.valid && n3.formattedPhone === '+919179944445', 'Normalize 12-digit number starting with 91');

  const n4 = provider.normalizePhone('12345');
  assert(!n4.valid, 'Reject short/malformed number');

  // Test 2: Send OTP instructions
  console.log('\n--- 2. Firebase Phone OTP Dispatch ---');
  const sendRes = await provider.sendOtp('+919876543210', 'test_user_01');
  assert(sendRes.success && sendRes.provider === 'firebase', 'Send OTP initiates client-side Firebase flow');

  // Test 3: Sandbox OTP Verification in Dev Mode
  console.log('\n--- 3. Sandbox / Dev OTP Verification ---');
  const validDev = await provider.verifyOtp('+919999999999', '123456', 'test_user_01');
  assert(validDev.success && validDev.phone === '+919999999999', 'Sandbox test phone verifies with default code');

  const invalidDev = await provider.verifyOtp('+919999999999', '999999', 'test_user_01');
  assert(!invalidDev.success, 'Invalid code is rejected');

  // Test 4: Truecaller Web Session & Production Partner Key
  console.log('\n--- 4. Truecaller Web & DeepLink Tests ---');
  const tcProvider = new TruecallerProvider();
  assert(tcProvider.isConfigured(), 'Truecaller is properly configured');
  assert(tcProvider.getClientId() === 'AVweKogL-t1uXDh9DzeAjW_1vQvpMAkoJwt6O4_hm_wsy4tHVFwetNgp4Fdxd0dVjdCgQ_EpD86ZOYKj0QNaCbC3Sy4DAhzDgGv5khcg1yJIi5bX7OX-CS5kOZBeha6f-GQPyQHuJkEu7qSVqQhUVEKJJA', 'Truecaller Client ID matches production key');

  const tcSession = tcProvider.createWebSession('+919876543210', 'test_user_01');
  assert(tcSession.status === 'PENDING' && tcSession.deepLink?.includes('truecallersdk://'), 'Truecaller Web session creates valid deepLink');
  assert(tcSession.deepLink?.includes('partnerKey=AVweKogL'), 'Truecaller deepLink contains production partnerKey');

  const fetchedSession = await tcProvider.getWebSession(tcSession.requestId);
  assert(fetchedSession?.requestId === tcSession.requestId, 'Truecaller session is queryable by requestId');

  // Test 5: Provider Service Health Status
  console.log('\n--- 5. Health Status Diagnostics ---');
  const health = await phoneVerificationService.getHealthStatus();
  assert(typeof health.firebase.configured === 'boolean' && health.truecaller.ok, 'Health diagnostics check passes');

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
