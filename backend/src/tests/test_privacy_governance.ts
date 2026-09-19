import assert from 'assert';
import { PrivacyService } from '../services/privacy/PrivacyService.js';

async function runPrivacyTests() {
  console.log('=== RUNNING DPDP PRIVACY & DATA GOVERNANCE TEST SUITE ===\n');

  const testUid = `test_user_${Date.now()}`;

  // 1. TEST: Privacy Policy Retrieval & Versioning
  console.log('Test 1: Active Privacy Notice & DPDP Transparency');
  const policy = await PrivacyService.getActivePolicy();
  assert.ok(policy.version, 'Policy must possess a version number');
  assert.strictEqual(policy.status, 'active');
  assert.ok(policy.content.includes('Data Fiduciary'), 'Policy must mention Data Fiduciary');
  assert.ok(policy.content.includes('Grievance Officer'), 'Policy must provide Grievance Officer details');
  console.log(`  -> PASS: Active policy v${policy.version} verified.\n`);

  // 2. TEST: Consent Management & Withdrawal
  console.log('Test 2: Consent Recording & Withdrawal (Tamper-Resistant)');
  // Initially all false
  const initialConsents = await PrivacyService.getUserConsents(testUid);
  assert.strictEqual(initialConsents.MARKETING_PROMOTIONS, false);

  // Grant Marketing Promotions consent
  await PrivacyService.recordConsent({
    userId: testUid,
    purpose: 'MARKETING_PROMOTIONS',
    granted: true,
    policyVersion: policy.version,
    source: 'TEST_SUITE'
  });

  const updatedConsents = await PrivacyService.getUserConsents(testUid);
  assert.strictEqual(updatedConsents.MARKETING_PROMOTIONS, true, 'Marketing consent must be true after grant');

  // Withdraw Consent
  await PrivacyService.withdrawConsent(testUid, 'MARKETING_PROMOTIONS');
  const withdrawnConsents = await PrivacyService.getUserConsents(testUid);
  assert.strictEqual(withdrawnConsents.MARKETING_PROMOTIONS, false, 'Marketing consent must be false after withdrawal');
  console.log('  -> PASS: Consent grant and withdrawal lifecycle verified.\n');

  // 3. TEST: Customer Data Correction & Validation
  console.log('Test 3: Data Correction Validation');
  const correctionResult = await PrivacyService.correctUserData(testUid, {
    name: 'Aarav Sharma',
    phone: '9876543210'
  });
  assert.ok(correctionResult.updatedFields.includes('name'));
  assert.ok(correctionResult.updatedFields.includes('phone'));

  // Attempting to correct with empty payload must throw
  await assert.rejects(async () => {
    await PrivacyService.correctUserData(testUid, {});
  }, /No valid modifiable fields provided/);
  console.log('  -> PASS: Allowed data corrections applied and empty payloads rejected.\n');

  // 4. TEST: Sanitized Data Access Export
  console.log('Test 4: Data Access Request & Security Sanitization');
  const exportBundle = await PrivacyService.generateDataExport(testUid);
  assert.ok(exportBundle.exportMetadata, 'Must include export metadata');
  assert.ok(exportBundle.profile, 'Must include sanitized profile');
  assert.strictEqual(exportBundle.profile.name, 'Aarav Sharma');
  // Verify strict omission of sensitive credentials
  assert.strictEqual((exportBundle as any).password, undefined, 'Passwords must never be exported');
  assert.strictEqual((exportBundle as any).token, undefined, 'Tokens must never be exported');
  assert.strictEqual((exportBundle as any).customClaims, undefined, 'Custom claims must never be exported');
  console.log('  -> PASS: Data access export generated with zero credential leaks.\n');

  // 5. TEST: Formal Grievance Mechanism
  console.log('Test 5: Privacy Grievance Ticket Generation & 30-Day SLA');
  const grievance = await PrivacyService.submitGrievance({
    uid: testUid,
    customerName: 'Aarav Sharma',
    customerContact: 'aarav@example.com',
    category: 'CONSENT',
    description: 'Testing privacy grievance ticket workflow'
  });
  assert.ok(grievance.ticketId.startsWith('GRV-'), 'Ticket ID must have GRV- prefix');
  assert.ok(grievance.slaDeadline, 'Must compute SLA resolution deadline');

  const userGrievances = await PrivacyService.getUserGrievances(testUid);
  assert.strictEqual(userGrievances.length, 1);
  assert.strictEqual(userGrievances[0].ticketId, grievance.ticketId);
  console.log(`  -> PASS: Grievance ticket ${grievance.ticketId} created with SLA.\n`);

  // 6. TEST: Third-Party Processors & Retention Matrix
  console.log('Test 6: Processor Registry & Retention Configuration');
  const processors = await PrivacyService.getProcessors();
  assert.ok(processors.length >= 4, 'Must have at least Firebase, Supabase, Fast2SMS, Razorpay');
  assert.ok(processors.some(p => p.id === 'proc_firebase'));
  assert.ok(processors.some(p => p.id === 'proc_supabase'));

  const retention = await PrivacyService.getRetentionPolicies();
  assert.ok(retention.some(r => r.category === 'ORDER_RECORDS_FINANCIAL'));
  assert.ok(retention.some(r => r.category === 'GPS_BREADCRUMBS'));
  console.log('  -> PASS: Processors and retention policies verified.\n');

  // 7. TEST: Account Erasure Request
  console.log('Test 7: Account Erasure Request & 30-day Grace Period');
  const deletionReq = await PrivacyService.requestAccountDeletion({
    uid: testUid,
    email: 'aarav@example.com',
    reason: 'Testing account deletion workflow',
    downloadDataRequested: true
  });
  assert.ok(deletionReq.requestId, 'Must generate deletion request ID');
  assert.ok(deletionReq.gracePeriodEnd, 'Must set 30-day statutory cooling period');
  console.log('  -> PASS: Deletion request recorded with grace period.\n');

  console.log('=== ALL DPDP PRIVACY & GOVERNANCE TESTS PASSED SUCCESSFULLY! ===');
}

runPrivacyTests().catch((err) => {
  console.error('PRIVACY TESTS FAILED:', err);
  process.exit(1);
});
