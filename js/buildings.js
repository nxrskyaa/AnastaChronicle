// Village buildings drawn procedurally to offscreen canvases, placed around camp.
function C(w, h) { const cv = document.createElement("canvas"); cv.width = w; cv.height = h; return cv; }
function px(x, y, w, h, col, ctx) { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); }

// palettes
const WOOD = "#8a5a32", WOOD_D = "#6a4324", WOOD_L = "#a6743e";
const ROOF = "#a0433a", ROOF_D = "#7d3029", ROOF_L = "#c05a4e";
const ROOF_B = "#3f6ea0", ROOF_BD = "#2d5480", ROOF_BL = "#5a8fc0";
const STONE = "#8f97a2", STONE_D = "#6d747e", STONE_L = "#aab2bc";
const DOOR = "#4a3324", WIN = "#f5e08a", WIN_N = "#3a4a66", THATCH = "#c8a250", THATCH_D = "#a5813a";

function outlineDraw(ctx, w, h) {
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  const idx = (x, y) => (y * w + x) * 4;
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[idx(x, y) + 3] > 30;
  const out = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!solid(x, y)) continue;
    if (!solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) || !solid(x, y + 1)) {
      const edge = !solid(x - 1, y) && x > 0 || !solid(x, y - 1) && y > 0;
    }
  }
  return ctx;
}

// House: roofColor variant
function house(roof, roofD, roofL, w = 64, h = 68) {
  const cv = C(w, h); const ctx = cv.getContext("2d"); ctx.imageSmoothingEnabled = false;
  // shadow
  ctx.fillStyle = "rgba(20,18,22,0.28)"; ctx.beginPath(); ctx.ellipse(w / 2, h - 4, w / 2 - 4, 5, 0, 0, 7); ctx.fill();
  // walls
  const wx = 8, wy = 30, ww = w - 16, wh = h - 36;
  px(wx, wy, ww, wh, WOOD, ctx);
  for (let y = wy; y < wy + wh; y += 4) px(wx, y, ww, 1, WOOD_D, ctx); // plank lines
  px(wx, wy, 2, wh, WOOD_D, ctx); px(wx + ww - 2, wy, 2, wh, WOOD_D, ctx);
  // corner beams
  px(wx, wy, 3, wh, WOOD_L, ctx); px(wx + ww - 3, wy, 3, wh, WOOD_L, ctx);
  // door
  px(w / 2 - 6, wy + wh - 16, 12, 16, DOOR, ctx);
  px(w / 2 - 6, wy + wh - 16, 12, 2, "#2c2016", ctx);
  px(w / 2 + 3, wy + wh - 9, 2, 2, "#e8c96a", ctx); // knob
  // windows
  px(wx + 6, wy + 6, 9, 9, WIN, ctx); px(wx + 6, wy + 6, 9, 9, WIN, ctx);
  px(wx + ww - 15, wy + 6, 9, 9, WIN, ctx);
  ctx.strokeStyle = WOOD_D; ctx.lineWidth = 1;
  ctx.strokeRect(wx + 6.5, wy + 6.5, 8, 8); ctx.strokeRect(wx + ww - 14.5, wy + 6.5, 8, 8);
  px(wx + 6, wy + 10, 9, 1, WOOD_D, ctx); px(wx + 10, wy + 6, 1, 9, WOOD_D, ctx);
  px(wx + ww - 15, wy + 10, 9, 1, WOOD_D, ctx); px(wx + ww - 11, wy + 6, 1, 9, WOOD_D, ctx);
  // roof (triangular)
  for (let i = 0; i < 30; i++) {
    const rw = w - i * (w / 2 / 30) * 2;
    const rx = (w - rw) / 2;
    const col = i < 3 ? roofL : (i % 6 < 3 ? roof : roofD);
    px(rx, 30 - i, rw, 1, col, ctx);
  }
  px(0, 28, w, 2, roofD, ctx); // eave
  // chimney
  px(w - 20, 6, 6, 12, STONE, ctx); px(w - 20, 6, 6, 2, STONE_L, ctx);
  return cv;
}

// Shop with awning + hanging sign
function shop(w = 68, h = 70) {
  const cv = C(w, h); const ctx = cv.getContext("2d"); ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "rgba(20,18,22,0.28)"; ctx.beginPath(); ctx.ellipse(w / 2, h - 4, w / 2 - 4, 5, 0, 0, 7); ctx.fill();
  const wx = 6, wy = 28, ww = w - 12, wh = h - 34;
  px(wx, wy, ww, wh, STONE, ctx);
  for (let y = wy; y < wy + wh; y += 5) px(wx, y, ww, 1, STONE_D, ctx);
  px(wx, wy, 2, wh, STONE_L, ctx);
  // big shop window (open front)
  px(wx + 6, wy + 8, ww - 12, 14, "#2a3550", ctx);
  px(wx + 6, wy + 8, ww - 12, 2, WIN, ctx);
  for (let x = wx + 8; x < wx + ww - 6; x += 6) px(x, wy + 8, 1, 14, "#4a5a78", ctx);
  // door
  px(w / 2 - 5, wy + wh - 16, 10, 16, DOOR, ctx);
  // striped awning
  for (let i = 0; i < ww; i += 6) { px(wx + i, wy - 2, 3, 7, "#d8524a", ctx); px(wx + i + 3, wy - 2, 3, 7, "#f0f0e8", ctx); }
  px(wx, wy + 4, ww, 1, ROOF_D, ctx);
  // roof
  for (let i = 0; i < 26; i++) { const rw = w - i * (w / 2 / 26) * 2; px((w - rw) / 2, 28 - i, rw, 1, i % 6 < 3 ? ROOF_B : ROOF_BD, ctx); }
  // hanging sign
  px(w - 16, 24, 12, 2, WOOD_D, ctx); px(w - 12, 26, 8, 7, "#caa24a", ctx); px(w - 10, 28, 4, 3, "#6a4324", ctx);
  return cv;
}

// Well
function well(w = 36, h = 40) {
  const cv = C(w, h); const ctx = cv.getContext("2d"); ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "rgba(20,18,22,0.28)"; ctx.beginPath(); ctx.ellipse(w / 2, h - 3, 14, 4, 0, 0, 7); ctx.fill();
  // stone base
  ctx.fillStyle = STONE; ctx.beginPath(); ctx.ellipse(w / 2, h - 8, 13, 8, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#1a2430"; ctx.beginPath(); ctx.ellipse(w / 2, h - 9, 9, 5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = STONE_L; for (let a = 0; a < 6; a++) { const an = a / 6 * 7; px(w / 2 + Math.cos(an) * 11 - 1, h - 8 + Math.sin(an) * 6 - 1, 3, 3, STONE_D, ctx); }
  // posts + roof
  px(6, 6, 3, 22, WOOD, ctx); px(w - 9, 6, 3, 22, WOOD, ctx);
  for (let i = 0; i < 10; i++) { const rw = w - i * (w / 2 / 10) * 2; px((w - rw) / 2, 10 - i, rw, 1, i % 4 < 2 ? THATCH : THATCH_D, ctx); }
  px(w / 2 - 4, 12, 8, 3, WOOD_D, ctx); // bucket bar
  return cv;
}

// Market stall / tent
function stall(w = 54, h = 46) {
  const cv = C(w, h); const ctx = cv.getContext("2d"); ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "rgba(20,18,22,0.25)"; ctx.beginPath(); ctx.ellipse(w / 2, h - 3, w / 2 - 4, 4, 0, 0, 7); ctx.fill();
  px(6, 16, 3, h - 20, WOOD, ctx); px(w - 9, 16, 3, h - 20, WOOD, ctx);
  px(8, h - 16, w - 16, 12, WOOD_L, ctx); // counter
  px(8, h - 16, w - 16, 2, WOOD_D, ctx);
  // striped tent roof
  for (let i = 0; i < w; i += 8) { px(i, 2, 4, 16, "#4a9678", ctx); px(i + 4, 2, 4, 16, "#f0e8d0", ctx); }
  px(0, 16, w, 2, "#2b6b4e", ctx);
  // goods
  px(14, h - 22, 5, 6, "#d8524a", ctx); px(22, h - 21, 5, 5, "#e0b84a", ctx); px(30, h - 22, 5, 6, "#6ec0e0", ctx);
  return cv;
}

// Fence segment (horizontal)
function fenceH(w = 24, h = 16) {
  const cv = C(w, h); const ctx = cv.getContext("2d"); ctx.imageSmoothingEnabled = false;
  px(0, 6, w, 2, WOOD_L, ctx); px(0, 10, w, 2, WOOD_L, ctx);
  for (let x = 2; x < w; x += 10) { px(x, 2, 3, 12, WOOD, ctx); px(x, 2, 1, 12, WOOD_D, ctx); }
  return cv;
}

export function buildVillage() {
  return {
    house_red: house(ROOF, ROOF_D, ROOF_L),
    house_blue: house(ROOF_B, ROOF_BD, ROOF_BL),
    house_thatch: house(THATCH, THATCH_D, "#e0c070"),
    shop: shop(),
    well: well(),
    stall: stall(),
    fenceH: fenceH(),
  };
}
