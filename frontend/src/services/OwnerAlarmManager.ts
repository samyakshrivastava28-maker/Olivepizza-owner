import { collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { playPOSAlarm, unlockAudio } from '../hooks/useNotificationSound';

export type OwnerAlarmState = {
  isAlarming: boolean;
  needsInteraction: boolean;
  pendingCount: number;
};

type Listener = (state: OwnerAlarmState) => void;

class OwnerAlarmManagerClass {
  private pendingCount = 0;
  private isAlarming = false;
  private needsInteraction = false;
  private listeners: Set<Listener> = new Set();
  
  private unsubscribe: (() => void) | null = null;
  private masterLoopTimeout: ReturnType<typeof setTimeout> | null = null;
  private soundInterval: ReturnType<typeof setInterval> | null = null;
  
  // Cycle configuration
  private PLAY_DURATION = 60000; // 60 seconds playing
  private PAUSE_DURATION = 30000; // 30 seconds pause

  /**
   * Start listening to Firestore for pending orders.
   * This should be called once on OwnerLayout mount.
   */
  public init() {
    if (this.unsubscribe) return; // Already initialized

    const q = query(collection(db, "orders"), where("status", "==", "pending"));
    
    // First, try a direct fetch to instantly catch unhandled orders on reload
    getDocs(q).then((snapshot) => {
      this.handleCountChange(snapshot.size);
    }).catch(console.error);

    // Then start the live listener
    this.unsubscribe = onSnapshot(q, (snapshot) => {
      this.handleCountChange(snapshot.size);
    }, (error) => {
      console.error("[OwnerAlarmManager] Firestore listener error:", error);
    });
  }

  /**
   * Cleanup listeners and timers
   */
  public destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.stopAlarmCycle();
  }

  /**
   * The user clicked the interaction button, so we can unlock Audio
   */
  public handleUserInteraction() {
    this.needsInteraction = false;
    unlockAudio();
    this.notify();
    
    // If we have pending orders, restart the loop to play sound immediately
    if (this.pendingCount > 0) {
      this.startAlarmCycle();
    }
  }

  public getState(): OwnerAlarmState {
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
      // Transitioned from 0 to >0 pending orders -> start alarm
      this.startAlarmCycle();
    } else if (newCount === 0 && wasPending) {
      // Transitioned from >0 to 0 -> stop alarm
      this.stopAlarmCycle();
    } else {
      // Just notify count change
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

    // Check AudioContext state to see if we need interaction
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') {
        this.needsInteraction = true;
        this.notify();
      }
    }

    // Attempt to trigger native vibration
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 500]);
    }

    // Play the POS chime every 3 seconds
    playPOSAlarm();
    this.soundInterval = setInterval(() => {
      if (this.pendingCount === 0) {
         if (this.soundInterval) clearInterval(this.soundInterval);
         return;
      }
      playPOSAlarm();
    }, 3000);

    // Schedule the pause phase
    this.masterLoopTimeout = setTimeout(this.runPausePhase, this.PLAY_DURATION);
  };

  private runPausePhase = () => {
    if (this.soundInterval) clearInterval(this.soundInterval);
    this.soundInterval = null;
    
    // Keep isAlarming=true visually (maybe glowing?), but stop the aggressive audio
    // We can choose to toggle it if we want the visual banner to pause too, but user asked for "Pause 30 seconds" for the *alarm* audio.
    // Let's keep the banner visible but stop the sound.
    this.isAlarming = true; 
    this.notify();

    // Schedule next play phase
    this.masterLoopTimeout = setTimeout(this.runPlayPhase, this.PAUSE_DURATION);
  };
}

export const OwnerAlarmManager = new OwnerAlarmManagerClass();
