/*
 * Accent tweakability — capability: motion-and-accessibility (task 3.3).
 * Changing the accent drives --em, the operational state color, and the warm
 * tone endpoint together (they all resolve from --accent / accentColor()).
 * Degraded / Disrupted / Stale stay fixed, preserving health contrast.
 *
 * Writing BOTH the CSS variable and the JS color module here is the single
 * point that keeps DOM and canvas in lock-step (design.md decision).
 */
import { _setAccentColor, DEFAULT_ACCENT } from '../theme/colors';

export function setAccent(hex: string): void {
  document.documentElement.style.setProperty('--accent', hex);
  _setAccentColor(hex);
}

export function resetAccent(): void {
  setAccent(DEFAULT_ACCENT);
}
