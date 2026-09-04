import { ColorBlindMode, getSettings } from './settings';

/**
 * Remaps hues so hard-to-distinguish pairs (red/green, blue/yellow) become
 * separable for the selected color vision deficiency. Applied to meteors,
 * particles and power-ups at draw time so gameplay reads correctly.
 */
export const mapHue = (hue: number, mode: ColorBlindMode): number => {
  const h = ((hue % 360) + 360) % 360;
  if (mode === 'off') return h;

  if (mode === 'protanopia' || mode === 'deuteranopia') {
    // Red/green confusion: push reds toward magenta, greens toward cyan/blue.
    if (h < 20 || h >= 340) return 300; // red -> magenta
    if (h >= 20 && h < 70) return 55;   // orange/yellow stays warm yellow
    if (h >= 70 && h < 170) return 195; // green -> cyan
    return h;
  }
  // Tritanopia: blue/yellow confusion -> shift yellows to warm red, blues to purple.
  if (h >= 30 && h < 80) return 12;
  if (h >= 180 && h < 260) return 285;
  return h;
};

export const isReducedMotion = (): boolean => {
  if (getSettings().reducedMotion) return true;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/** Scales all rem-based UI text/spacing. */
export const applyUiScale = (scale: number) => {
  document.documentElement.style.fontSize = `${Math.round(16 * scale)}px`;
};

/** Distinct glyph per power-up type so color is never the only cue. */
export const POWERUP_SHAPE: Record<string, 'circle' | 'square' | 'diamond'> = {
  slowmo: 'circle',
  chaos_reduce: 'square',
  score_multi: 'diamond',
};
