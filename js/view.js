// Shared, mutable viewport. Recomputed on resize so the canvas fills the
// whole screen (no letterbox bars) while keeping a consistent zoom level.
export const view = { w: 420, h: 236, scale: 3 };

// Target ~236px of vertical "game space" at 3x zoom. We keep tile density
// constant and expand width/height to match the device aspect ratio.
export function computeView(canvas) {
  const sw = window.innerWidth, sh = window.innerHeight;
  const aspect = sw / sh;
  // internal vertical resolution stays ~ constant for consistent zoom
  const baseH = 240;
  let h = baseH;
  let w = Math.round(h * aspect);
  // clamp so we never render absurd widths on ultrawide
  w = Math.max(320, Math.min(720, w));
  // even numbers avoid half-pixel seams
  view.w = w % 2 ? w + 1 : w;
  view.h = h % 2 ? h + 1 : h;
  if (canvas) { canvas.width = view.w; canvas.height = view.h; }
  return view;
}
