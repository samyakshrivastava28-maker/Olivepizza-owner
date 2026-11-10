/**
 * TextToSpeech Service — NVIDIA Chatterbox Multilingual TTS
 *
 * Architecture:
 *   Browser → POST /api/tts/synthesize (backend proxy) → NVIDIA NIM gRPC → audio stream
 *
 * Why a backend proxy:
 *   The NVIDIA Chatterbox Multilingual TTS uses gRPC which cannot be called from
 *   a browser. The backend at /api/tts/synthesize acts as a transparent proxy —
 *   it authenticates to NVIDIA with the server-side API key and streams the MP3
 *   audio back. The API key never touches the client.
 *
 * Fallback chain:
 *   1. NVIDIA Chatterbox Multilingual (via backend proxy) — premium quality, multilingual
 *   2. Web Speech API (window.speechSynthesis) — offline fallback, no API key needed
 *   3. Android Native TextToSpeech (via Capacitor bridge) — native Android fallback
 *
 * Supported languages: en-US, en-IN, hi-IN, en-GB, fr-FR, de-DE, es-ES, pt-BR, ja-JP, zh-CN, ko-KR
 */

import { Capacitor } from '@capacitor/core';
import type { NavLanguage } from './navigationInstructions';
import { getTTSLocale } from './navigationInstructions';

// ─── Config ───────────────────────────────────────────────────────────────────

const TTS_PROXY_URL = '/api/tts/synthesize';
const VOICE_GENDER: 'male' | 'female' = 'female';
// Controls expressiveness of the Chatterbox voice (0.0 = flat, 1.0 = very expressive)
const DEFAULT_EXAGGERATION = 0.45;
const DEFAULT_SPEED = 1.05;

// ─── State ────────────────────────────────────────────────────────────────────

let isMuted = false;
let isSpeaking = false;
let currentLang: NavLanguage = 'en';
const utteranceQueue: string[] = [];
let currentAudio: HTMLAudioElement | null = null;

// ─── NVIDIA Chatterbox TTS (via backend proxy) ────────────────────────────────

/**
 * Synthesizes text using NVIDIA Chatterbox Multilingual via backend proxy.
 * Returns an AudioBuffer URL (blob URL) for playback.
 * Returns null on any failure (caller falls back to Web Speech API).
 */
async function synthesizeChatterbox(text: string, locale: string): Promise<string | null> {
  try {
    const res = await fetch(TTS_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        language: locale,
        gender: VOICE_GENDER,
        exaggeration: DEFAULT_EXAGGERATION,
        speed: DEFAULT_SPEED,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      console.warn(`[TTS] Chatterbox proxy returned ${res.status}, falling back to Web Speech`);
      return null;
    }

    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch (err) {
    console.warn('[TTS] Chatterbox synthesis failed, falling back:', err);
    return null;
  }
}

// ─── Web Speech API Fallback ──────────────────────────────────────────────────

function getVoice(locale: string): SpeechSynthesisVoice | null {
  if (!window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === locale) ||
    voices.find((v) => v.lang.startsWith(locale.split('-')[0])) ||
    null
  );
}

function speakWithWebSpeech(text: string, locale: string): void {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = locale;
  utterance.rate = DEFAULT_SPEED;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  const voice = getVoice(locale);
  if (voice) utterance.voice = voice;

  utterance.onend = () => { isSpeaking = false; processQueue(); };
  utterance.onerror = () => { isSpeaking = false; processQueue(); };

  isSpeaking = true;
  window.speechSynthesis.speak(utterance);
}

// ─── Android Native TTS Fallback ──────────────────────────────────────────────

async function speakNative(text: string, locale: string): Promise<void> {
  try {
    const { registerPlugin } = await import('@capacitor/core');
    const NativeTTS = registerPlugin<{ speak: (opts: { text: string; locale: string; rate: number }) => Promise<void> }>('NativeTTS');
    await NativeTTS.speak({ text, locale, rate: DEFAULT_SPEED });
    isSpeaking = false;
    processQueue();
  } catch {
    // Plugin not installed, fall through to Web Speech
    speakWithWebSpeech(text, locale);
  }
}

// ─── Queue Processor ──────────────────────────────────────────────────────────

function processQueue(): void {
  if (isMuted || isSpeaking || utteranceQueue.length === 0) return;

  const text = utteranceQueue.shift()!;
  const locale = getTTSLocale(currentLang);
  isSpeaking = true;

  // Try Chatterbox first, then fallback
  synthesizeChatterbox(text, locale).then((audioUrl) => {
    if (audioUrl) {
      // Play via HTMLAudioElement (supports MP3 streaming from blob URL)
      const audio = new Audio(audioUrl);
      currentAudio = audio;
      audio.playbackRate = 1.0;
      audio.volume = 1.0;

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        currentAudio = null;
        isSpeaking = false;
        processQueue();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        currentAudio = null;
        // Fallback to Web Speech on playback error
        speakWithWebSpeech(text, locale);
      };

      audio.play().catch(() => {
        // Autoplay blocked — fall back to Web Speech
        URL.revokeObjectURL(audioUrl);
        isSpeaking = false;
        speakWithWebSpeech(text, locale);
      });
    } else {
      // Chatterbox unavailable — use platform-appropriate fallback
      if (Capacitor.isNativePlatform()) {
        speakNative(text, locale);
      } else {
        speakWithWebSpeech(text, locale);
      }
    }
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Speak a navigation instruction using NVIDIA Chatterbox Multilingual TTS.
 * Falls back to Web Speech API if NVIDIA is unavailable or offline.
 *
 * @param text - The text to synthesize
 * @param urgent - If true, clears the queue and interrupts current speech immediately
 */
export function speak(text: string, urgent = false): void {
  if (isMuted) return;

  if (urgent) {
    utteranceQueue.length = 0;
    stopCurrentAudio();
    window.speechSynthesis?.cancel();
    isSpeaking = false;
  }

  utteranceQueue.push(text);
  processQueue();
}

function stopCurrentAudio(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = '';
    currentAudio = null;
  }
}

/** Set the language for subsequent TTS calls */
export function setTTSLanguage(lang: NavLanguage): void {
  currentLang = lang;
}

/**
 * Toggle mute. Returns the new mute state.
 * When muted, any ongoing audio and queued utterances are cleared.
 */
export function toggleMute(): boolean {
  isMuted = !isMuted;
  if (isMuted) {
    utteranceQueue.length = 0;
    stopCurrentAudio();
    window.speechSynthesis?.cancel();
    isSpeaking = false;
  }
  return isMuted;
}

export function getMuted(): boolean { return isMuted; }

/** Stop all speech immediately */
export function stopAll(): void {
  utteranceQueue.length = 0;
  isSpeaking = false;
  stopCurrentAudio();
  window.speechSynthesis?.cancel();
}

/**
 * Pre-warm the Web Speech API voice list on first load.
 * Call this on component mount so voices are ready when the first instruction fires.
 */
export function warmVoices(): void {
  if (window.speechSynthesis && window.speechSynthesis.getVoices().length === 0) {
    window.speechSynthesis.onvoiceschanged = () => { /* voices loaded */ };
  }
}

/**
 * Check if NVIDIA Chatterbox TTS backend proxy is reachable.
 * Useful for a settings screen to show TTS status.
 */
export async function checkTTSHealth(): Promise<{ available: boolean; model: string }> {
  try {
    const res = await fetch('/api/tts/health', { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      return { available: data.configured === true, model: data.model || 'chatterbox-multilingual' };
    }
    return { available: false, model: 'web-speech' };
  } catch {
    return { available: false, model: 'web-speech' };
  }
}
