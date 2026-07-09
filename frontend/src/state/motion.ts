/*
 * Motion + reduceMotion plumbing — capability: motion-and-accessibility (tasks 3.1, 3.2).
 * The reduceMotion flag stamps the root element; CSS (global.css) halts
 * animations and the imperative globe renderer reads shouldAnimate() to stop
 * idle rotation, flow particles, and pulsing while keeping content legible.
 */

/** Globe idle rotation cadence — ~0.05°/frame (design handoff). */
export const IDLE_ROTATION_DEG_PER_FRAME = 0.05;

/** Gentle arc/opacity pulse: 0.72 + 0.28*sin (design handoff). */
export function pulseOpacity(phase: number): number {
  return 0.72 + 0.28 * Math.sin(phase);
}

export function applyReduceMotion(reduce: boolean): void {
  document.documentElement.setAttribute('data-reduce-motion', String(reduce));
}

export function systemPrefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/**
 * Whether imperative animations (rotation, particles, pulsing) should run.
 * Honors both the explicit flag and the OS preference.
 */
export function shouldAnimate(reduceMotion: boolean): boolean {
  return !reduceMotion && !systemPrefersReducedMotion();
}
