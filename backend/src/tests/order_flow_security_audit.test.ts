import assert from 'assert';
import { OrderStateMachine } from '../services/order/OrderStateMachine.js';

async function runSecurityAuditTests() {
  console.log('====================================================');
  console.log('OLIVE PIZZA ORDER FLOW SECURITY & READ-ONLY AUDIT');
  console.log('====================================================\n');

  // 1. Verify Role Authority Table excludes 'owner' and 'admin' for operational transitions
  console.log('--- TEST 1: Owner Operational Mutation Blocked in State Machine ---');
  
  const operationalStages = ['accepted', 'preparing', 'ready', 'partner_assigned', 'picked_up', 'out_for_delivery', 'delivered'] as const;

  for (const stage of operationalStages) {
    const result = await OrderStateMachine.transition(
      'mock_test_order_id',
      stage,
      { uid: 'owner_uid_123', role: 'owner', name: 'Olive Pizza Owner' },
      {}
    );

    assert.strictEqual(
      result.success,
      false,
      `Owner should NEVER succeed transitioning an operational stage (${stage})`
    );

    assert(
      result.error?.includes('Owner has read-only authority') || result.error?.includes('not authorized'),
      `Error message should explicitly mention read-only authority or not authorized for owner. Got: ${result.error}`
    );

    console.log(`  [PASS] Operational transition to '${stage}' correctly rejected for role: 'owner'.`);
  }

  // 2. Verify Admin role is also blocked from operational transitions
  console.log('\n--- TEST 2: Admin Operational Mutation Blocked in State Machine ---');
  for (const stage of operationalStages) {
    const result = await OrderStateMachine.transition(
      'mock_test_order_id',
      stage,
      { uid: 'admin_uid_123', role: 'admin', name: 'Olive Pizza Admin' },
      {}
    );

    assert.strictEqual(
      result.success,
      false,
      `Admin should NEVER succeed transitioning an operational stage (${stage})`
    );
    console.log(`  [PASS] Operational transition to '${stage}' correctly rejected for role: 'admin'.`);
  }

  // 3. Verify Delivery Partner cannot accept/prepare orders
  console.log('\n--- TEST 3: Cross-Role Authority Isolation ---');
  const kitchenStages = ['accepted', 'preparing', 'ready'] as const;
  for (const stage of kitchenStages) {
    const result = await OrderStateMachine.transition(
      'mock_test_order_id',
      stage,
      { uid: 'rider_uid_123', role: 'delivery_partner', name: 'Delivery Rider' },
      {}
    );
    assert.strictEqual(result.success, false, `Rider should not perform kitchen stage (${stage})`);
    console.log(`  [PASS] Kitchen transition to '${stage}' rejected for role: 'delivery_partner'.`);
  }

  console.log('\n====================================================');
  console.log('ALL ORDER FLOW SECURITY & READ-ONLY AUDIT TESTS PASSED');
  console.log('====================================================\n');
}

runSecurityAuditTests().catch((err) => {
  console.error('\n❌ Security audit test failed:', err);
  process.exit(1);
});
