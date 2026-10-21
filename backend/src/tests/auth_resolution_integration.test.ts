import test from 'node:test';
import assert from 'node:assert/strict';
import { FranchiseAccessService } from '../services/franchise/FranchiseAccessService.js';

test('Multi-App Role & Scope Authorization Matrix', async (t) => {
  await t.test('Owner accounts must be authorized for all five operational apps', async () => {
    const ownerAccounts = [
      { email: 'webhub2811@gmail.com', uid: '6tLLR6q7aTYqzTG2blRx3TU5sA42' },
      { email: 'olivepizzarjn@gmail.com', uid: 'ZzMmHLa6fBeDYY7clYNjP70fbiE2' },
      { email: 'samyakshrivastava28@gmail.com', uid: 'Zf1MDESejSPbVLdKdAAB7xGGUV42' },
      { email: 'samyaks695@gmail.com', uid: 'Uln5UKsRyZaCzTePgBmfourQngu1' }
    ];

    const apps = ['POS', 'RESTAURANT_MANAGER', 'FRANCHISE_MANAGER', 'DELIVERY', 'OWNER'];

    for (const acc of ownerAccounts) {
      for (const targetApp of apps) {
        const res = await FranchiseAccessService.resolveAuthorization({
          uid: acc.uid,
          email: acc.email,
          targetApp
        });
        assert.equal(res.authorized, true, `${acc.email} must be authorized for ${targetApp}`);
        assert.ok(res.user?.branchId, `${acc.email} must have a branchId`);
        assert.ok(res.user?.franchiseId, `${acc.email} must have a franchiseId`);
      }
    }
  });

  await t.test('POS cashier account must have access to POS and reject managerial/delivery apps', async () => {
    const cashier = { email: 'cashier@olivepizza.in', uid: 'ONXCYjWmN1hNVv6bVjwCYxi76Sz1' };
    
    const posRes = await FranchiseAccessService.resolveAuthorization({
      uid: cashier.uid,
      email: cashier.email,
      targetApp: 'POS'
    });
    assert.equal(posRes.authorized, true, 'Cashier must be authorized for POS');

    const mgrRes = await FranchiseAccessService.resolveAuthorization({
      uid: cashier.uid,
      email: cashier.email,
      targetApp: 'RESTAURANT_MANAGER'
    });
    assert.equal(mgrRes.authorized, false, 'Cashier must NOT access Restaurant Manager');

    const ownerRes = await FranchiseAccessService.resolveAuthorization({
      uid: cashier.uid,
      email: cashier.email,
      targetApp: 'OWNER'
    });
    assert.equal(ownerRes.authorized, false, 'Cashier must NOT access Owner Console');
  });

  await t.test('Delivery rider account must have access to Delivery app and reject POS/Manager apps', async () => {
    const rider = { email: 'rider@olivepizza.in', uid: 'staff_rider_01' };

    const delRes = await FranchiseAccessService.resolveAuthorization({
      uid: rider.uid,
      email: rider.email,
      targetApp: 'DELIVERY'
    });
    assert.equal(delRes.authorized, true, 'Rider must be authorized for Delivery');

    const mgrRes = await FranchiseAccessService.resolveAuthorization({
      uid: rider.uid,
      email: rider.email,
      targetApp: 'RESTAURANT_MANAGER'
    });
    assert.equal(mgrRes.authorized, false, 'Rider must NOT access Restaurant Manager');

    const ownerRes = await FranchiseAccessService.resolveAuthorization({
      uid: rider.uid,
      email: rider.email,
      targetApp: 'OWNER'
    });
    assert.equal(ownerRes.authorized, false, 'Rider must NOT access Owner Console');
  });
});
