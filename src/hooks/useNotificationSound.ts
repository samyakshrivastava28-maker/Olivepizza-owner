/**
 * useNotificationSound.ts
 *
 * Different sound tones for each notification type using the Web Audio API.
 * No external audio files needed — pure synthesized tones.
 */

type SoundType =
  | 'new_order'
  | 'accepted'
  | 'preparing'
  | 'packed'
  | 'partner_assigned'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'payment_failed'
  | 'security'
  | 'delivery_problem'
  | 'test';

let audioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

export function unlockAudio() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
  } catch (e) {
    console.warn('[NotificationSound] Could not unlock audio:', e);
  }
}

if (typeof window !== 'undefined') {
  const unlockEvents = ['click', 'touchstart', 'keydown', 'pointerdown'];
  const handleUnlock = () => {
    unlockAudio();
    unlockEvents.forEach((e) => window.removeEventListener(e, handleUnlock));
  };
  unlockEvents.forEach((e) => window.addEventListener(e, handleUnlock, { passive: true }));
}

// ── Tone primitives ───────────────────────────────────────────────────────────

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.3,
  startTime = 0,
  ctx?: AudioContext
) {
  const ac = ctx || getAudioContext();
  const osc = ac.createOscillator();
  const gainNode = ac.createGain();

  osc.connect(gainNode);
  gainNode.connect(ac.destination);

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ac.currentTime + startTime);

  gainNode.gain.setValueAtTime(0, ac.currentTime + startTime);
  gainNode.gain.linearRampToValueAtTime(volume, ac.currentTime + startTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + startTime + duration);

  osc.start(ac.currentTime + startTime);
  osc.stop(ac.currentTime + startTime + duration + 0.01);
}

// ── Sound definitions per event ───────────────────────────────────────────────

const SOUNDS: Record<SoundType, (ctx: AudioContext) => void> = {
  /** 🍕 New Order — loud commanding 4-note emergency alarm chime */
  new_order: (ctx) => {
    playTone(880,  0.25, 'triangle', 0.8, 0,    ctx); // A5
    playTone(1174, 0.25, 'sine',     0.8, 0.15, ctx); // D6
    playTone(880,  0.25, 'triangle', 0.8, 0.30, ctx); // A5
    playTone(1174, 0.35, 'sine',     0.9, 0.45, ctx); // D6
  },

  /** ✅ Accepted — warm positive double-bell */
  accepted: (ctx) => {
    playTone(880, 0.25, 'sine', 0.35, 0,    ctx); // A5
    playTone(1047,0.3,  'sine', 0.3,  0.2,  ctx); // C6
  },

  /** 🍳 Preparing — soft kitchen-ding */
  preparing: (ctx) => {
    playTone(698, 0.4, 'triangle', 0.3, 0, ctx); // F5
  },

  /** 📦 Packed — two quick beats */
  packed: (ctx) => {
    playTone(784, 0.15, 'square', 0.15, 0,    ctx); // G5
    playTone(784, 0.15, 'square', 0.15, 0.18, ctx);
  },

  /** 🛵 Partner assigned — bike rev-like sweep */
  partner_assigned: (ctx) => {
    const ac = ctx;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, ac.currentTime);
    osc.frequency.linearRampToValueAtTime(600, ac.currentTime + 0.3);
    gain.gain.setValueAtTime(0.25, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.4);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + 0.4);
  },

  /** 🚀 Out for delivery — rising whoosh */
  out_for_delivery: (ctx) => {
    playTone(440, 0.2, 'sine', 0.3, 0,    ctx); // A4
    playTone(554, 0.2, 'sine', 0.3, 0.12, ctx); // C#5
    playTone(659, 0.2, 'sine', 0.3, 0.24, ctx); // E5
    playTone(880, 0.3, 'sine', 0.3, 0.36, ctx); // A5
  },

  /** 🎉 Delivered — celebratory fanfare */
  delivered: (ctx) => {
    [0, 0.1, 0.2, 0.3, 0.5].forEach((t, i) => {
      const freqs = [523, 659, 784, 1047, 1319];
      playTone(freqs[i], 0.35, 'sine', 0.35, t, ctx);
    });
  },

  /** ❌ Cancelled — descending sad tone */
  cancelled: (ctx) => {
    playTone(523, 0.25, 'sine', 0.3, 0,    ctx); // C5
    playTone(440, 0.25, 'sine', 0.3, 0.2,  ctx); // A4
    playTone(349, 0.4,  'sine', 0.3, 0.4,  ctx); // F4
  },

  /** 💳 Payment Failed — low warning buzz */
  payment_failed: (ctx) => {
    playTone(220, 0.3, 'sawtooth', 0.3, 0,   ctx);
    playTone(185, 0.3, 'sawtooth', 0.3, 0.3, ctx);
  },

  /** 🚨 Security — urgent pulsing alarm */
  security: (ctx) => {
    [0, 0.2, 0.4, 0.6, 0.8].forEach((t) => {
      playTone(880, 0.15, 'square', 0.25, t, ctx);
    });
  },

  /** ⚠️ Delivery problem — urgent triple beep */
  delivery_problem: (ctx) => {
    [0, 0.15, 0.3].forEach((t) => {
      playTone(660, 0.1, 'square', 0.3, t, ctx);
    });
  },

  /** 🔧 Test — neutral ping */
  test: (ctx) => {
    playTone(660, 0.3, 'sine', 0.25, 0, ctx);
  },
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Play a notification sound for the given event type.
 * Silently fails if audio is not supported.
 */
export function playNotificationSound(type: SoundType) {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => SOUNDS[type]?.(ctx));
    } else {
      SOUNDS[type]?.(ctx);
    }
  } catch (e) {
    // Audio not available in this browser
    console.warn('[NotificationSound] Could not play sound:', e);
  }
}

/**
 * Map an order status string to a SoundType
 */
export function statusToSoundType(status: string): SoundType | null {
  const s = (status || '').toLowerCase();
  if (['pending', 'new_order', 'placed', 'order_placed', 'created', 'paid', 'payment_success'].includes(s)) {
    return 'new_order';
  }
  const map: Record<string, SoundType> = {
    accepted:         'accepted',
    preparing:        'preparing',
    packed:           'packed',
    partner_assigned: 'partner_assigned',
    out_for_delivery: 'out_for_delivery',
    delivered:        'delivered',
    cancelled:        'cancelled',
    rejected:         'cancelled',
    payment_failed:   'payment_failed',
    failed:           'payment_failed',
    security_alert:   'security',
  };
  return map[s] || null;
}

// ── Continuous Loop Sequences ──────────────────────────────────────────────────

/**
 * Plays a sharp, commanding double-chime for the Owner POS.
 * Duration: ~0.5s. Intended to be called repeatedly by the AlarmManager.
 */
export function playPOSAlarm() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    // High pitched commanding chime
    playTone(1046, 0.15, 'sine', 0.5, 0, ctx);    // C6
    playTone(1318, 0.25, 'sine', 0.5, 0.15, ctx); // E6
  } catch (e) {
    console.warn('[POSAlarm] Error playing:', e);
  }
}

/**
 * Plays a classic mobile telephone trill sequence for Delivery Partners.
 * Duration: ~1.2s. Intended to be called repeatedly by the AlarmManager.
 */
export function playDeliveryRingtone() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    
    // Fast UK/Euro style ringtone trill
    for (let i = 0; i < 4; i++) {
      playTone(800, 0.05, 'square', 0.2, i * 0.1, ctx);
      playTone(600, 0.05, 'square', 0.2, i * 0.1 + 0.05, ctx);
    }
    for (let i = 0; i < 4; i++) {
      playTone(800, 0.05, 'square', 0.2, 0.6 + (i * 0.1), ctx);
      playTone(600, 0.05, 'square', 0.2, 0.6 + (i * 0.1) + 0.05, ctx);
    }
  } catch (e) {
    console.warn('[DeliveryRingtone] Error playing:', e);
  }
}
