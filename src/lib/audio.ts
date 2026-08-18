import { useOwnerSettingsStore } from './store';

// Synthesized Web Audio API sound generator for zero-latency alert sounds without external asset dependencies
class SoundSynthesizer {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  playBeep(frequency = 880, duration = 0.2, type: OscillatorType = 'sine') {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const vol = useOwnerSettingsStore.getState().volume || 1.0;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(vol * 0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.warn('Sound play error:', e);
    }
  }

  playNewOrderAlarm() {
    const isSound = useOwnerSettingsStore.getState().soundEnabled;
    if (!isSound) return;

    // Pleasant high-priority dual-chime
    this.playBeep(587.33, 0.15, 'triangle'); // D5
    setTimeout(() => this.playBeep(880, 0.3, 'sine'), 120); // A5
    setTimeout(() => this.playBeep(1174.66, 0.4, 'sine'), 260); // D6
  }

  playStatusUpdate() {
    const isSound = useOwnerSettingsStore.getState().soundEnabled;
    if (!isSound) return;
    this.playBeep(659.25, 0.15, 'sine');
    setTimeout(() => this.playBeep(783.99, 0.25, 'sine'), 100);
  }
}

export const soundPlayer = new SoundSynthesizer();
