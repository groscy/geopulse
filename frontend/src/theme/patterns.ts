/*
 * Stale diagonal-hatch canvas pattern — capability: design-tokens (task 1.2).
 * The CSS equivalent is `.stale-hatch` in styles/global.css. Both render the
 * same 45deg grey hatch so stale reads identically on the map and in the DOM,
 * and NEVER as a solid health color.
 */

let cached: CanvasPattern | null = null;

/**
 * Returns a repeating 45deg hatch pattern (#5b646f 2px on / 2px off) for the
 * canvas globe's stale countries. Cached across calls.
 */
export function staleHatchPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (cached) return cached;
  const size = 4; // 2px stroke + 2px gap
  const tile = document.createElement('canvas');
  tile.width = size;
  tile.height = size;
  const tctx = tile.getContext('2d');
  if (!tctx) return null;
  tctx.strokeStyle = '#5b646f';
  tctx.lineWidth = 2;
  // one diagonal stroke per tile; the repeat produces the 45deg hatch
  tctx.beginPath();
  tctx.moveTo(-1, size + 1);
  tctx.lineTo(size + 1, -1);
  tctx.stroke();
  cached = ctx.createPattern(tile, 'repeat');
  return cached;
}
