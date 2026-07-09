// High-quality procedural tile generator. Bright, cozy palette (trailer-inspired).
// Produces base terrain tiles + edge-transition overlays for smooth blending.
// Tiles are 24px to match render size T=24 (crisp, no scaling blur).

const TS = 24;

// bright cozy palette
const PAL = {
  grass:  ["#6fbf5a", "#63b551", "#7cc766", "#5aa848"],   // base greens (variants)
  grassBlade: ["#8ad477", "#57a046"],
  grassHi: "#93da7e",
  grassLo: "#4d9440",
  dirt:   ["#c69a6a", "#bd8f5f", "#cfa576"],
  dirtLo: "#a67c4e",
  dirtHi: "#dcb488",
  sand:   ["#ecd9a8", "#e6d09a", "#f2e2b6"],
  sandLo: "#d4bb82",
  water:  ["#4fb8e0", "#45aed8", "#5cc3ea"],
  waterLo: "#3897c4",
  waterHi: "#a5e6f7",
  snow:   ["#e8f0f6", "#dde8f0", "#f2f8fc"],
  snowLo: "#c4d4e2",
  forest: ["#4f9a48", "#478f42", "#579f4e"],   // darker grass for deep forest
};

function C() { const cv = document.createElement("canvas"); cv.width = TS; cv.height = TS; return cv; }
function noise(seed) { const x = Math.sin(seed * 127.1) * 43758.5453; return x - Math.floor(x); }

// scatter small pixels deterministically for texture
function scatter(ctx, seed, color, count, size) {
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const x = (noise(seed + i * 2.3) * TS) | 0;
    const y = (noise(seed + i * 5.7 + 9) * TS) | 0;
    ctx.fillRect(x, y, size, size);
  }
}

function grassTile(variant, dark) {
  const cv = C(); const ctx = cv.getContext("2d");
  const base = (dark ? PAL.forest : PAL.grass)[variant % (dark ? PAL.forest.length : PAL.grass.length)];
  ctx.fillStyle = base; ctx.fillRect(0, 0, TS, TS);
  // subtle mottle: lighter + darker patches
  scatter(ctx, variant * 11 + 1, dark ? "#57a04e" : PAL.grassHi, 14, 2);
  scatter(ctx, variant * 11 + 4, PAL.grassLo, 12, 2);
  scatter(ctx, variant * 11 + 7, dark ? "#3f8038" : "#84cf6f", 20, 1);
  // a few grass blades
  ctx.strokeStyle = dark ? "#6fbf5a" : PAL.grassBlade[0]; ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const bx = 3 + ((noise(variant * 3 + i) * (TS - 6)) | 0);
    const by = 6 + ((noise(variant * 7 + i) * (TS - 8)) | 0);
    ctx.beginPath(); ctx.moveTo(bx, by + 3); ctx.lineTo(bx - 1, by); ctx.moveTo(bx + 1, by + 3); ctx.lineTo(bx + 1, by - 1); ctx.stroke();
  }
  return cv;
}

function dirtTile(variant) {
  const cv = C(); const ctx = cv.getContext("2d");
  ctx.fillStyle = PAL.dirt[variant % PAL.dirt.length]; ctx.fillRect(0, 0, TS, TS);
  scatter(ctx, variant * 13 + 2, PAL.dirtHi, 12, 2);
  scatter(ctx, variant * 13 + 6, PAL.dirtLo, 14, 2);
  scatter(ctx, variant * 13 + 9, "#8f6a42", 10, 1);   // pebbles
  // small stones
  ctx.fillStyle = "#9a8058";
  for (let i = 0; i < 2; i++) { const sx = 4 + ((noise(variant + i * 4) * 16) | 0); const sy = 4 + ((noise(variant + i * 8) * 16) | 0); ctx.fillRect(sx, sy, 3, 2); ctx.fillStyle = "#b89a6e"; ctx.fillRect(sx, sy, 3, 1); ctx.fillStyle = "#9a8058"; }
  return cv;
}

function sandTile(variant) {
  const cv = C(); const ctx = cv.getContext("2d");
  ctx.fillStyle = PAL.sand[variant % PAL.sand.length]; ctx.fillRect(0, 0, TS, TS);
  scatter(ctx, variant * 17 + 3, "#f7ecc8", 14, 2);
  scatter(ctx, variant * 17 + 8, PAL.sandLo, 12, 1);
  return cv;
}

function waterTile(frame) {
  const cv = C(); const ctx = cv.getContext("2d");
  const base = PAL.water[0];
  ctx.fillStyle = base; ctx.fillRect(0, 0, TS, TS);
  // gentle animated ripples via sine bands offset by frame
  ctx.fillStyle = PAL.waterLo;
  for (let y = 0; y < TS; y++) {
    const off = Math.sin((y + frame * 2) * 0.5) * 2;
    ctx.fillRect(0, y, TS, 1);
    ctx.fillStyle = (y % 4 === (frame % 4)) ? PAL.water[2] : PAL.water[0];
    ctx.fillRect((off + 4) | 0, y, 8, 1);
  }
  // sparkles
  ctx.fillStyle = PAL.waterHi;
  for (let i = 0; i < 4; i++) { const sx = ((noise(i * 3 + frame) * TS) | 0); const sy = ((noise(i * 7 + frame * 2) * TS) | 0); ctx.fillRect(sx, sy, 2, 1); }
  return cv;
}

function snowTile(variant) {
  const cv = C(); const ctx = cv.getContext("2d");
  ctx.fillStyle = PAL.snow[variant % PAL.snow.length]; ctx.fillRect(0, 0, TS, TS);
  scatter(ctx, variant * 19 + 2, "#ffffff", 16, 2);
  scatter(ctx, variant * 19 + 6, PAL.snowLo, 10, 2);
  scatter(ctx, variant * 19 + 9, "#d0dcea", 8, 1);
  return cv;
}

// Edge overlay: a bold, irregular GRASS fringe drawn ON the non-grass tile edge,
// so grass appears to spill over the boundary (classic cozy-RPG autotile look).
// dir bitmask: 1=N 2=E 4=S 8=W. Rendered on the non-grass tile toward grass.
function edgeOverlay(dirMask, kind) {
  const cv = C(); const ctx = cv.getContext("2d");
  const gEdge = PAL.grassLo, gTop = PAL.grass[0], gHi = PAL.grassHi;
  // depth of fringe
  const D = 7;
  // draw a lumpy grass band on each active edge
  const lump = (i, span) => 2 + Math.round(Math.sin(i * 1.7) * 1.5 + Math.cos(i * 0.9) * 1.5);
  if (dirMask & 1) { // north edge -> grass above spilling down
    for (let x = 0; x < TS; x++) { const h = D - lump(x); ctx.fillStyle = gTop; ctx.fillRect(x, 0, 1, h); ctx.fillStyle = gEdge; ctx.fillRect(x, h - 1, 1, 1); }
    for (let x = 1; x < TS; x += 4) { ctx.fillStyle = gHi; ctx.fillRect(x, 0, 1, 2); }
  }
  if (dirMask & 4) { // south
    for (let x = 0; x < TS; x++) { const h = D - lump(x + 5); ctx.fillStyle = gTop; ctx.fillRect(x, TS - h, 1, h); ctx.fillStyle = gEdge; ctx.fillRect(x, TS - h, 1, 1); }
    for (let x = 2; x < TS; x += 4) { ctx.fillStyle = gHi; ctx.fillRect(x, TS - 2, 1, 2); }
  }
  if (dirMask & 8) { // west
    for (let y = 0; y < TS; y++) { const w = D - lump(y + 2); ctx.fillStyle = gTop; ctx.fillRect(0, y, w, 1); ctx.fillStyle = gEdge; ctx.fillRect(w - 1, y, 1, 1); }
    for (let y = 1; y < TS; y += 4) { ctx.fillStyle = gHi; ctx.fillRect(0, y, 2, 1); }
  }
  if (dirMask & 2) { // east
    for (let y = 0; y < TS; y++) { const w = D - lump(y + 7); ctx.fillStyle = gTop; ctx.fillRect(TS - w, y, w, 1); ctx.fillStyle = gEdge; ctx.fillRect(TS - w, y, 1, 1); }
    for (let y = 2; y < TS; y += 4) { ctx.fillStyle = gHi; ctx.fillRect(TS - 2, y, 2, 1); }
  }
  return cv;
}

const cache = { grass: [], forest: [], dirt: [], sand: [], water: [], snow: [], edge: [] };

export function buildTiles() {
  for (let v = 0; v < 4; v++) {
    cache.grass.push(grassTile(v, false));
    cache.forest.push(grassTile(v, true));
    cache.dirt.push(dirtTile(v));
    cache.sand.push(sandTile(v));
    cache.snow.push(snowTile(v));
  }
  for (let f = 0; f < 4; f++) cache.water.push(waterTile(f));
  // grass fringe overlays keyed by neighbor-mask (drawn on non-grass tiles)
  cache.edge = [];
  for (let m = 0; m < 16; m++) cache.edge.push(edgeOverlay(m));
  return cache;
}

export function tile(kind, i) {
  const arr = cache[kind]; if (!arr || !arr.length) return null;
  return arr[i % arr.length];
}
export function grassFringe(mask) {
  return cache.edge ? cache.edge[mask & 15] : null;
}
export const TILE_SIZE = TS;
