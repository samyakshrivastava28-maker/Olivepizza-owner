/**
 * Navigation Instructions — Multilingual Turn-by-Turn Voice Phrases
 *
 * Supports English, Hindi (hi), and Hinglish (hi-mix).
 * Stored preference persists in localStorage as 'nav_lang'.
 */

import type { RouteStep, TurnManeuver } from './navigationRouting.service';
import { formatDistance } from './navigationRouting.service';

export type NavLanguage = 'en' | 'hi' | 'hinglish';

// ─── Language Stores ─────────────────────────────────────────────────────────

type PhraseMap = {
  depart: string;
  arrive: string;
  straight: string;
  slightRight: string;
  right: string;
  sharpRight: string;
  slightLeft: string;
  left: string;
  sharpLeft: string;
  uturn: string;
  roundabout: string;
  continueOn: (road: string) => string;
  then: string;
  in: string;
  distance: (d: string) => string;
  arrived: string;
};

const PHRASES: Record<NavLanguage, PhraseMap> = {
  en: {
    depart: 'Start heading',
    arrive: 'You have arrived at your destination',
    straight: 'Continue straight',
    slightRight: 'Keep slight right',
    right: 'Turn right',
    sharpRight: 'Turn sharp right',
    slightLeft: 'Keep slight left',
    left: 'Turn left',
    sharpLeft: 'Turn sharp left',
    uturn: 'Make a U-turn',
    roundabout: 'Enter the roundabout',
    continueOn: (road) => road ? `Continue on ${road}` : 'Continue',
    then: 'then',
    in: 'in',
    distance: (d) => d,
    arrived: 'You have arrived',
  },
  hi: {
    depart: 'आगे बढ़ें',
    arrive: 'आप अपने गंतव्य पर पहुँच गए हैं',
    straight: 'सीधे चलते रहें',
    slightRight: 'थोड़ा दाईं ओर रखें',
    right: 'दाईं ओर मुड़ें',
    sharpRight: 'तेज दाईं ओर मुड़ें',
    slightLeft: 'थोड़ा बाईं ओर रखें',
    left: 'बाईं ओर मुड़ें',
    sharpLeft: 'तेज बाईं ओर मुड़ें',
    uturn: 'यू-टर्न लें',
    roundabout: 'गोल चक्कर में प्रवेश करें',
    continueOn: (road) => road ? `${road} पर आगे बढ़ें` : 'आगे बढ़ें',
    then: 'फिर',
    in: 'में',
    distance: (d) => d,
    arrived: 'आप पहुँच गए',
  },
  hinglish: {
    depart: 'Aage badhein',
    arrive: 'Aap apni destination par pahunch gaye hain',
    straight: 'Seedha chalte rahein',
    slightRight: 'Thoda right side rakhein',
    right: 'Right turn lein',
    sharpRight: 'Sharp right turn lein',
    slightLeft: 'Thoda left side rakhein',
    left: 'Left turn lein',
    sharpLeft: 'Sharp left turn lein',
    uturn: 'U-turn lein',
    roundabout: 'Roundabout mein daakhil houn',
    continueOn: (road) => road ? `${road} par chalte rahein` : 'Chalte rahein',
    then: 'phir',
    in: 'mein',
    distance: (d) => d,
    arrived: 'Aap pahunch gaye',
  },
};

// ─── Language Persistence ─────────────────────────────────────────────────────

const STORAGE_KEY = 'nav_lang';

export function getNavLanguage(): NavLanguage {
  const stored = localStorage.getItem(STORAGE_KEY) as NavLanguage | null;
  if (stored && ['en', 'hi', 'hinglish'].includes(stored)) return stored;
  // Auto-detect from browser language
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith('hi')) return 'hinglish';
  return 'en';
}

export function setNavLanguage(lang: NavLanguage): void {
  localStorage.setItem(STORAGE_KEY, lang);
}

// ─── Instruction Builder ──────────────────────────────────────────────────────

function getDirectionPhrase(maneuver: TurnManeuver, phrases: PhraseMap, roadName?: string): string {
  if (maneuver.type === 'depart') return phrases.depart;
  if (maneuver.type === 'arrive') return phrases.arrive;
  if (maneuver.type === 'rotary' || maneuver.type === 'roundabout') return phrases.roundabout;

  switch (maneuver.modifier) {
    case 'uturn':       return phrases.uturn;
    case 'sharp right': return phrases.sharpRight;
    case 'right':       return phrases.right;
    case 'slight right': return phrases.slightRight;
    case 'straight':    return phrases.continueOn(roadName || '');
    case 'slight left': return phrases.slightLeft;
    case 'left':        return phrases.left;
    case 'sharp left':  return phrases.sharpLeft;
    default:            return phrases.continueOn(roadName || '');
  }
}

/**
 * Generates a spoken instruction for a route step.
 * Example (en):  "In 200 m, turn right"
 * Example (hi):  "200 m में, दाईं ओर मुड़ें"
 * Example (hinglish): "200 m mein, right turn lein"
 */
export function buildInstruction(step: RouteStep, lang?: NavLanguage): string {
  const l = lang ?? getNavLanguage();
  const phrases = PHRASES[l];
  const dir = getDirectionPhrase(step.maneuver, phrases, step.name);

  if (step.maneuver.type === 'depart') {
    return `${dir}`;
  }
  if (step.maneuver.type === 'arrive') {
    return phrases.arrive;
  }

  const distStr = formatDistance(step.distance);
  if (l === 'hi') {
    return `${distStr} ${phrases.in}, ${dir}`;
  }
  if (l === 'hinglish') {
    return `${distStr} ${phrases.in}, ${dir}`;
  }
  // English
  return `${phrases.in} ${distStr}, ${dir}`;
}

/**
 * Pre-announcement phrase fired ~300m before a maneuver.
 * Example (en):  "In 300 m, turn right"
 * Example (hinglish): "300 m mein, right turn lein"
 */
export function buildPreAnnouncement(step: RouteStep, lang?: NavLanguage): string {
  return buildInstruction(step, lang);
}

/**
 * Returns the TTS locale string for the given language.
 * Used by TextToSpeech.service.ts to select the correct voice.
 */
export function getTTSLocale(lang: NavLanguage): string {
  switch (lang) {
    case 'hi': return 'hi-IN';
    case 'hinglish': return 'hi-IN'; // Hinglish uses Hindi voice with Latin script
    case 'en':
    default:   return 'en-IN';
  }
}
