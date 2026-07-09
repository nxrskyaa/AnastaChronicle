// Shared, mutable viewport. The canvas internal resolution is set to EXACTLY
// match the display area's aspect ratio (display px / integer scale), so the
// CSS "fill 100%" never stretches/distorts. Fullscreen, no letterbox, no gepeng.
export const view = { w: 420, h: 236, scale: 3 };

export function computeView(canvas) {
  const sw = Math.max(1, window.innerWidth);
  const sh = Math.max(1, window.innerHeight);
  // choose a pixel scale so we get a comfortable zoom (~250px of game height)
  let scale = Math.round(sh / 250);
  scale = Math.max(2, Math.min(5, scale));
  // internal resolution = display / scale  -> aspect ratio matches display exactly
  let w = Math.round(sw / scale);
  let h = Math.round(sh / scale);
  view.scale = scale;
  view.w = w;
  view.h = h;
  if (canvas) { canvas.width = w; canvas.height = h; }
  return view;
}
