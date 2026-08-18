/**
 * brandLock.ts — Olive Pizza Brand Color Enforcer
 * Strips any off-brand colours from AI-generated SDUI section styles.
 */

export const BRAND_COLORS = {
  primaryOrange: '#f97316',
  primaryOrangeDeep: '#ea580c',
  oliveGreen: '#55775a',
  oliveGreenDeep: '#3f5943',
  goldAccent: '#f59e0b',
  goldAccentLight: '#fbbf24',
  nearBlack: '#06070a',
  surface: '#0f172a',
  slate900: '#0f172a',
  white: '#ffffff',
  cream: '#fef9f0',
  textMuted: '#94a3b8',
};

/** Approved hex colours for AI-generated layouts. All others are stripped. */
const APPROVED_HEX = new Set([
  '#f97316', '#ea580c', '#fb923c', '#fdba74', // Orange spectrum
  '#55775a', '#3f5943', '#4a6b50', '#6b8f71', // Olive green spectrum
  '#f59e0b', '#d97706', '#fbbf24', '#fef08a', // Gold spectrum
  '#06070a', '#0a0a0a', '#111827', '#0f172a', '#1e293b', '#0d1117', // Near-black surface
  '#ffffff', '#fef9f0', '#f9fafb', '#f8fafc', // White / cream
  '#94a3b8', '#64748b', '#475569', '#334155', // Muted slate
  'transparent', 'rgba(0,0,0,0)', '',
]);

/** Known bad colour keywords/values that AI tends to generate */
const BLOCKED_PATTERNS = [
  /\b(blue|purple|pink|cyan|indigo|violet|magenta|teal|crimson|fuchsia)\b/gi,
  /#(00|33|66|99|cc|ff)(00|33|66|99|cc|ff)(cc|dd|ee|ff)/gi, // pure blue/purple hex
  /rgb\([\d\s,]*\b(0|1|2)[0-9]{0,2}\s*,[\d\s,]*\b(0|1|2)[0-9]{0,2}\s*,\s*([1-9][0-9]{2})\s*\)/gi,
  /#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/gi, // Will be checked below
];

export function enforceBrandColors(style: Record<string, any> = {}): Record<string, any> {
  if (!style) return {};
  const cleaned = { ...style };

  if (cleaned.bgColor && !isApprovedColor(cleaned.bgColor)) {
    cleaned.bgColor = BRAND_COLORS.nearBlack;
  }
  if (cleaned.bgGradient) {
    // Only allow gradients using our approved colour set
    if (hasBlockedColor(cleaned.bgGradient)) {
      cleaned.bgGradient = `linear-gradient(135deg, rgba(249,115,22,0.18), rgba(85,119,90,0.15), rgba(6,7,10,0.9))`;
    }
  }
  if (cleaned.textColor && !isApprovedColor(cleaned.textColor)) {
    cleaned.textColor = '#ffffff';
  }

  return cleaned;
}

function isApprovedColor(color: string): boolean {
  if (!color) return true;
  const lower = color.toLowerCase().trim();
  if (APPROVED_HEX.has(lower)) return true;
  if (lower.startsWith('rgba(') || lower.startsWith('rgb(')) return true; // Trust rgba
  return false;
}

function hasBlockedColor(str: string): boolean {
  const blocked = ['blue', 'purple', 'violet', 'indigo', 'pink', 'cyan', 'teal', 'magenta', 'fuchsia'];
  const lower = str.toLowerCase();
  return blocked.some(b => lower.includes(b));
}

/** Enforce brand across an array of SDUI sections */
export function enforceAllSectionsBrand(sections: any[]): any[] {
  return sections.map(section => ({
    ...section,
    style: enforceBrandColors(section.style || {}),
  }));
}
