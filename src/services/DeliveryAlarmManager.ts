import { collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { playDeliveryRingtone, unlockAudio } from '../hooks/useNotificationSound';

export type DeliveryAlarmState = {
  isAlarming: boolean;
  needsInteraction: boolean;
  pendingCount: number;
};

type Listener = (state: DeliveryAlarmState) => void;

class DeliveryAlarmManagerClass {
  private pendingCount = 0;
  private isAlarming = false;
  private needsInteraction = false;
  private listeners: Set<Listener> = new Set();
  
  private unsubscribe: (() => void) | null = null;
  private masterLoopTimeout: ReturnType<typeof setTimeout> | null = null;
  private soundInterval: ReturnType<typeof setInterval> | null = null;
  private currentPartnerId: string | null = null;
  
  // Cycle configuration
  private PLAY_DURATION = 60000; // 60 seconds playing
  private PAUSE_DURATION = 30000; // 30 seconds pause

  /**
   * Start listening to Firestore for pending assignments for this specific partner.
   */
  public init(partnerId: string) {
    if (this.unsubscribe && this.currentPartnerId === partnerId) return;
    if (this.unsubscribe) this.destroy();

    this.currentPartnerId = partnerId;

    // Delivery Partner ringtone alarm fires ONLY when status is 'partner_assigned' (pending rider acceptance)
    const q = query(
      collection(db, "orders"),
      where("deliveryPartnerId", "==", partnerId),
      where("status", "==", "partner_assigned")
    );
    
    // First, direct fetch
    getDocs(q).then((snapshot) => {
      this.handleCountChange(snapshot.size);
    }).catch(console.error);

    // Live listener
    this.unsubscribe = onSnapshot(q, (snapshot) => {
      this.handleCountChange(snapshot.size);
    }, (error) => {
      console.error("[DeliveryAlarmManager] Firestore listener error:", error);
    });
  }

  public stopAlarm() {
    this.stopAlarmCycle();
  }

  public destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.stopAlarmCycle();
  }

  public handleUserInteraction() {
    this.needsInteraction = false;
    unlockAudio();
    this.notify();
    
    if (this.pendingCount > 0) {
      this.startAlarmCycle();
    }
  }

  public getState(): DeliveryAlarmState {
    return {
      isAlarming: this.isAlarming,
      needsInteraction: this.needsInteraction,
      pendingCount: this.pendingCount,
    };
  }

  public subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((l) => l(state));
  }

  private handleCountChange(newCount: number) {
    const wasPending = this.pendingCount > 0;
    this.pendingCount = newCount;

    if (newCount > 0 && !wasPending) {
      this.startAlarmCycle();
    } else if (newCount === 0 && wasPending) {
      this.stopAlarmCycle();
    } else {
      this.notify();
    }
  }

  private startAlarmCycle() {
    this.stopAlarmCycle(); // Clear any existing
    this.isAlarming = true;
    this.notify();
    this.runPlayPhase();
  }

  private stopAlarmCycle() {
    this.isAlarming = false;
    this.needsInteraction = false;
    if (this.soundInterval) clearInterval(this.soundInterval);
    if (this.masterLoopTimeout) clearTimeout(this.masterLoopTimeout);
    this.soundInterval = null;
    this.masterLoopTimeout = null;
    this.notify();
  }

  private runPlayPhase = () => {
    if (this.pendingCount === 0) {
      this.stopAlarmCycle();
      return;
    }
    
    this.isAlarming = true;
    this.notify();

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') {
        this.needsInteraction = true;
        this.notify();
      }
    }

    if (navigator.vibrate) {
      navigator.vibrate([300, 100, 300, 100, 300]);
    }

    // Play the ringtone every 4 seconds
    playDeliveryRingtone();
    this.soundInterval = setInterval(() => {
      if (this.pendingCount === 0) {
         if (this.soundInterval) clearInterval(this.soundInterval);
         return;
      }
      playDeliveryRingtone();
    }, 4000);

    this.masterLoopTimeout = setTimeout(this.runPausePhase, this.PLAY_DURATION);
  };

  private runPausePhase = () => {
    if (this.soundInterval) clearInterval(this.soundInterval);
    this.soundInterval = null;
    
    this.isAlarming = true; 
    this.notify();

    this.masterLoopTimeout = setTimeout(this.runPlayPhase, this.PAUSE_DURATION);
  };
}

export const DeliveryAlarmManager = new DeliveryAlarmManagerClass();
