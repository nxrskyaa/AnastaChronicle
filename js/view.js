// Shared, mutable viewport. The canvas internal resolution is set to EXACTLY
// match the display area's aspect ratio (display px / integer scale), so the
// CSS "fill 100%" never stretches/distorts. Fullscreen, no letterbox, no gepeng.
export const view = { w: 420, h: 236, scale: 3 };

export function computeView(canvas) {
  const sw = Math.max(1, window.innerWidth);
  const sh = Math.max(1, window.innerHeight);
  const portrait = sh > sw;
  // Aim for MORE visible world on phones (less zoom). Portrait phones get a
  // taller game-space target so the camera pulls back; desktop stays crisp.
  const targetH = portrait ? 400 : 300;
  let scale = Math.round(sh / targetH);
  scale = Math.max(2, Math.min(5, scale));
  // internal resolution = display / scale -> aspect matches display exactly (no stretch)
  const w = Math.round(sw / scale);
  const h = Math.round(sh / scale);
  view.scale = scale;
  view.w = w;
  view.h = h;
  if (canvas) { canvas.width = w; canvas.height = h; }
  return view;
}
