import { Router, Request, Response } from 'express';
import { emailService } from '../lib/email.service.js';
import { verifyToken, AuthRequest } from '../middleware/auth.middleware.js';
import { adminAuth, adminDb } from '../config/firebase.js';

const router = Router();

router.use(verifyToken);

// Upsert user (Called after Firebase Auth signup/login)
router.post('/sync', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.uid;
    const email = req.user?.email;
    const { name } = req.body;

    if (!userId || !email) {
      res.status(400).json({ error: 'Invalid user token' });
      return;
    }

    const userRef = adminDb.collection('users').doc(userId);
    const doc = await userRef.get();
    
    let userData: any = {
      firebase_uid: userId,
      email,
      name: name || '',
      role: 'customer',
      updatedAt: new Date().toISOString()
    };

    if (!doc.exists) {
      userData.createdAt = new Date().toISOString();
      await userRef.set(userData);
      // Set default custom claim
      await adminAuth.setCustomUserClaims(userId, { role: 'customer' });
    } else {
      userData = doc.data();
      if (name) {
        userData.name = name;
        userData.updatedAt = new Date().toISOString();
        await userRef.update({ name, updatedAt: userData.updatedAt });
      }
    }

    res.json(userData);
  } catch (error) {
    console.error("User sync error", error);
    res.status(500).json({ error: 'Failed to sync user' });
  }
});

// Setup Phone
router.put('/phone', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.uid;
    const email = req.user?.email || '';
    const { phone } = req.body;

    if (!phone) {
      res.status(400).json({ error: 'Phone number is required' });
      return;
    }

    const userRef = adminDb.collection('users').doc(userId!);
    const doc = await userRef.get();

    let userData: any = {
      firebase_uid: userId,
      email,
      name: 'Customer',
      phone,
      phone_setup_completed: true,
      role: 'customer',
      updatedAt: new Date().toISOString()
    };

    if (!doc.exists) {
      userData.createdAt = new Date().toISOString();
      await userRef.set(userData);
      await adminAuth.setCustomUserClaims(userId!, { role: 'customer' });
    } else {
      userData = { ...doc.data(), phone, phone_setup_completed: true, updatedAt: new Date().toISOString() };
      await userRef.update({ phone, phone_setup_completed: true, updatedAt: userData.updatedAt });
    }

    res.json(userData);
  } catch (error: any) {
    console.error("Phone setup error", error);
    res.status(500).json({ error: error.message || 'Failed to save phone' });
  }
});

// Setup Location
router.put('/location', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.uid;
    const email = req.user?.email;
    const { addressLine, city, state, pincode, lat, lng } = req.body;

    const userRef = adminDb.collection('users').doc(userId!);
    const doc = await userRef.get();

    let userData: any = {
      firebase_uid: userId,
      email,
      name: 'Customer',
      full_address: addressLine,
      city,
      state,
      lat,
      lng,
      location_setup_completed: true,
      role: 'customer',
      updatedAt: new Date().toISOString()
    };

    if (!doc.exists) {
      userData.createdAt = new Date().toISOString();
      await userRef.set(userData);
      await adminAuth.setCustomUserClaims(userId!, { role: 'customer' });
    } else {
      userData = { 
        ...doc.data(), 
        full_address: addressLine,
        fullAddress: addressLine, 
        city, 
        state, 
        pincode,
        lat, 
        lng, 
        location_setup_completed: true, 
        locationSetupCompleted: true,
        updatedAt: new Date().toISOString() 
      };
      await userRef.update({ 
        full_address: addressLine,
        fullAddress: addressLine, 
        city, 
        state, 
        pincode,
        lat, 
        lng, 
        location_setup_completed: true, 
        locationSetupCompleted: true,
        updatedAt: userData.updatedAt 
      });
    }

    // Send Welcome Email and Notify Owner
    try {
      if (email) {
        const name = userData.name || 'Customer';
        await emailService.sendWelcomeEmail(email, name);
        await emailService.sendOwnerNotification('New User Signup', `A new user ${name} (${email}) has joined and completed their profile!`);
      }
    } catch (emailErr) {
      console.error("Failed to send welcome emails", emailErr);
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Location setup error", error);
    res.status(500).json({ error: 'Failed to save location' });
  }
});

// Get User Profile
router.get('/profile', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.uid;
    const userRef = adminDb.collection('users').doc(userId!);
    const doc = await userRef.get();
    
    if (!doc.exists) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const u = doc.data() as any;
    res.json({
      ...u,
      address: {
        addressLine: u.full_address,
        city: u.city,
        state: u.state,
        lat: u.lat,
        lng: u.lng
      }
    });
  } catch (error) {
    console.error("Profile fetch error", error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Revoke all sessions
router.post('/revoke-all-sessions', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // 1. Revoke Firebase Auth tokens (forces all devices to re-authenticate when current token expires)
    await adminAuth.revokeRefreshTokens(userId);

    // 2. Mark all Firestore device_heartbeats as inactive (forces realtime listeners to sign out instantly)
    const sessionsSnapshot = await adminDb.collection('device_heartbeats')
      .where('uid', '==', userId)
      .where('isActive', '==', true)
      .get();

    const batch = adminDb.batch();
    sessionsSnapshot.docs.forEach((doc) => {
      batch.update(doc.ref, { isActive: false });
    });
    
    if (!sessionsSnapshot.empty) {
      await batch.commit();
    }

    res.json({ success: true, message: 'All sessions revoked' });
  } catch (error) {
    console.error("Revoke sessions error", error);
    res.status(500).json({ error: 'Failed to revoke sessions' });
  }
});

// ── POST /deletion-request — Customer Account Deletion Request ────────────────
// Records a deletion request with 30-day grace period before actual erasure.
// Any pending active orders are noted on the request but do NOT block it.
router.post('/deletion-request', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { email, reason, downloadData } = req.body;

    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'Email address is required to confirm your identity.' });
      return;
    }

    // Verify email matches authenticated user's registered email
    const userRecord = await adminAuth.getUser(uid).catch(() => null);
    if (userRecord && userRecord.email && userRecord.email.toLowerCase() !== email.toLowerCase()) {
      res.status(400).json({ error: 'The email address provided does not match your registered account email.' });
      return;
    }

    const now = new Date();
    const gracePeriodEnd = new Date(now);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 30);

    // Check for any active orders before logging the request
    const activeOrdersSnap = await adminDb.collection('orders')
      .where('userId', '==', uid)
      .get()
      .catch(() => ({ docs: [] } as any));

    const activeOrders = activeOrdersSnap.docs
      .filter((d: any) => !['delivered', 'cancelled', 'rejected', 'failed'].includes(d.data().status))
      .map((d: any) => d.id);

    const requestData = {
      uid,
      email: email.toLowerCase(),
      reason: reason || 'No reason provided',
      downloadDataRequested: Boolean(downloadData),
      status: 'pending',
      activeOrdersAtRequest: activeOrders,
      requestedAt: now.toISOString(),
      gracePeriodEnd: gracePeriodEnd.toISOString(),
      scheduledErasureAt: gracePeriodEnd.toISOString(),
      source: 'customer_portal',
      ipAddress: req.ip || 'unknown'
    };

    await adminDb.collection('deletion_requests').add(requestData);

    // Mark user account as pending deletion (prevents new orders but doesn't deactivate immediately)
    await adminDb.collection('users').doc(uid).set({
      deletionRequestPending: true,
      deletionRequestedAt: now.toISOString(),
      deletionScheduledFor: gracePeriodEnd.toISOString()
    }, { merge: true });

    console.log(`[UserRoutes] Account deletion request logged for uid=${uid} email=${email} grace_period_end=${gracePeriodEnd.toISOString()}`);

    res.json({
      success: true,
      message: 'Account deletion request recorded. Your account will be permanently erased after the 30-day grace period.',
      gracePeriodEnd: gracePeriodEnd.toISOString(),
      activeOrdersAtRequest: activeOrders.length
    });
  } catch (error: any) {
    console.error('[UserRoutes] Deletion request error:', error);
    res.status(500).json({ error: error.message || 'Failed to submit deletion request' });
  }
});

export default router;

