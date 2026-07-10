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
  // subtle gradient for depth
  const grad = ctx.createLinearGradient(0, 0, 0, TS);
  grad.addColorStop(0, base);
  grad.addColorStop(1, dark ? "#3f8038" : PAL.grassLo);
  ctx.fillStyle = grad; ctx.fillRect(0, 0, TS, TS);
  // subtle mottle: lighter + darker patches
  scatter(ctx, variant * 11 + 1, dark ? "#57a04e" : PAL.grassHi, 14, 2);
  scatter(ctx, variant * 11 + 4, PAL.grassLo, 12, 2);
  scatter(ctx, variant * 11 + 7, dark ? "#3f8038" : "#84cf6f", 20, 1);
  // a few grass blades (with slight curve for organic look)
  ctx.strokeStyle = dark ? "#6fbf5a" : PAL.grassBlade[0]; ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const bx = 3 + ((noise(variant * 3 + i) * (TS - 6)) | 0);
    const by = 6 + ((noise(variant * 7 + i) * (TS - 8)) | 0);
    ctx.beginPath(); ctx.moveTo(bx, by + 3); ctx.lineTo(bx - 1, by); ctx.moveTo(bx + 1, by + 3); ctx.lineTo(bx + 1, by - 1); ctx.stroke();
  }
  // occasional tiny flower (1 per ~2 tiles) for visual pop
  if (noise(variant * 31) > 0.5) {
    const fx = 4 + ((noise(variant * 17) * (TS - 8)) | 0);
    const fy = 4 + ((noise(variant * 23) * (TS - 8)) | 0);
    const fcol = [["#f0a0c0", "#e080a0"], ["#f0e080", "#d4b850"], ["#c0a0f0", "#a080d0"]][((variant * 7) | 0) % 3];
    ctx.fillStyle = fcol[0]; ctx.fillRect(fx, fy, 2, 2);
    ctx.fillStyle = fcol[1]; ctx.fillRect(fx, fy, 1, 1);
  }
  if (dark) {
    // Forest floor signatures: roots, leaf litter, mushrooms and moss clusters.
    const motif = variant % 4;
    if (motif === 0) {
      ctx.fillStyle = "#345f35"; ctx.fillRect(3, 17, 8, 2); ctx.fillRect(8, 15, 2, 5);
      ctx.fillStyle = "#8db85d"; ctx.fillRect(4, 17, 3, 1);
    } else if (motif === 1) {
      ctx.fillStyle = "#c77648"; ctx.fillRect(16, 7, 3, 2); ctx.fillStyle = "#e5ab6b"; ctx.fillRect(17, 9, 1, 2);
      ctx.fillStyle = "#5f7842"; ctx.fillRect(5, 19, 2, 1); ctx.fillRect(8, 16, 2, 1);
    } else if (motif === 2) {
      ctx.fillStyle = "#2f6f3d"; ctx.fillRect(14, 18, 7, 3); ctx.fillStyle = "#6ebc62"; ctx.fillRect(15, 18, 4, 1);
      ctx.fillStyle = "#9a6941"; ctx.fillRect(4, 7, 3, 1); ctx.fillRect(7, 10, 2, 1);
    } else {
      ctx.fillStyle = "#8a5739"; ctx.fillRect(5, 12, 5, 2); ctx.fillRect(9, 13, 5, 1);
      ctx.fillStyle = "#bb8150"; ctx.fillRect(6, 12, 3, 1);
    }
  } else if (variant % 4 === 3) {
    ctx.fillStyle = "#4f9f46"; ctx.fillRect(15, 16, 5, 1); ctx.fillRect(17, 14, 1, 4);
    ctx.fillStyle = "#a4e08d"; ctx.fillRect(16, 15, 1, 1); ctx.fillRect(19, 15, 1, 1);
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
  if (variant % 3 === 0) {
    ctx.fillStyle = "#a77649"; ctx.fillRect(2, 17, 8, 1); ctx.fillRect(5, 19, 10, 1);
    ctx.fillStyle = "#d5ab78"; ctx.fillRect(3, 16, 5, 1);
  } else if (variant % 3 === 1) {
    ctx.fillStyle = "#806244"; ctx.fillRect(16, 6, 4, 3); ctx.fillStyle = "#c4a276"; ctx.fillRect(17, 6, 3, 1);
  }
  return cv;
}

function sandTile(variant) {
  const cv = C(); const ctx = cv.getContext("2d");
  ctx.fillStyle = PAL.sand[variant % PAL.sand.length]; ctx.fillRect(0, 0, TS, TS);
  scatter(ctx, variant * 17 + 3, "#f7ecc8", 14, 2);
  scatter(ctx, variant * 17 + 8, PAL.sandLo, 12, 1);
  if (variant % 3 === 0) {
    ctx.fillStyle = "#d8c28f"; ctx.fillRect(3, 14, 13, 1); ctx.fillRect(7, 17, 12, 1);
    ctx.fillStyle = "#f7ecc8"; ctx.fillRect(4, 13, 9, 1);
  } else if (variant % 3 === 1) {
    ctx.fillStyle = "#bc9e69"; ctx.fillRect(17, 7, 3, 2); ctx.fillRect(18, 6, 1, 4);
    ctx.fillStyle = "#fff4d5"; ctx.fillRect(18, 7, 1, 1);
  }
  return cv;
}

function waterTile(frame, variant) {
  const cv = C(); const ctx = cv.getContext("2d");
  // depth gradient: lighter at top, darker at bottom
  const grad = ctx.createLinearGradient(0, 0, 0, TS);
  grad.addColorStop(0, PAL.water[2]);
  grad.addColorStop(0.5, PAL.water[0]);
  grad.addColorStop(1, PAL.waterLo);
  ctx.fillStyle = grad; ctx.fillRect(0, 0, TS, TS);
  // gentle animated ripples via sine bands offset by frame
  const phase = variant * 1.73;
  for (let y = 0; y < TS; y++) {
    const off = Math.sin((y + frame * 2 + phase) * 0.5) * 3;
    ctx.fillStyle = (y + variant) % 5 === (frame % 4) ? `rgba(104,207,239,0.55)` : `rgba(50,151,201,0.22)`;
    const start = ((off + 2 + (variant * 7) % 9) | 0);
    ctx.fillRect(start, y, 6 + (variant % 4), 1);
  }
  // shimmer sparkles (animated by frame)
  ctx.fillStyle = PAL.waterHi;
  for (let i = 0; i < 5; i++) {
    const sx = ((noise(i * 3 + frame + variant * 19) * TS) | 0);
    const sy = ((noise(i * 7 + frame * 2 + variant * 11) * TS) | 0);
    const sz = 1 + ((noise(i * 11 + frame + variant) * 2) | 0);
    ctx.fillRect(sx, sy, sz, 1);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillRect(sx + 1, sy, 1, 1);
    ctx.fillStyle = PAL.waterHi;
  }
  return cv;
}

function snowTile(variant) {
  const cv = C(); const ctx = cv.getContext("2d");
  ctx.fillStyle = PAL.snow[variant % PAL.snow.length]; ctx.fillRect(0, 0, TS, TS);
  scatter(ctx, variant * 19 + 2, "#ffffff", 16, 2);
  scatter(ctx, variant * 19 + 6, PAL.snowLo, 10, 2);
  scatter(ctx, variant * 19 + 9, "#d0dcea", 8, 1);
  if (variant % 3 === 0) {
    ctx.fillStyle = "#c5d4e2"; ctx.fillRect(2, 17, 15, 1); ctx.fillRect(8, 19, 12, 1);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(3, 16, 10, 1);
  } else if (variant % 3 === 1) {
    ctx.fillStyle = "#786c62"; ctx.fillRect(16, 8, 2, 8); ctx.fillRect(12, 10, 6, 1);
    ctx.fillStyle = "#b7c6d5"; ctx.fillRect(15, 15, 4, 1);
  }
  return cv;
}

// Edge overlay: a bold, irregular GRASS fringe drawn ON the non-grass tile edge,
// so grass appears to spill over the boundary (classic cozy-RPG autotile look).
// dir bitmask: 1=N 2=E 4=S 8=W. Rendered on the non-grass tile toward grass.
function edgeOverlay(dirMask, dark = false) {
  const cv = C(); const ctx = cv.getContext("2d");
  const gEdge = dark ? "#315f35" : PAL.grassLo;
  const gTop = dark ? PAL.forest[1] : PAL.grass[0];
  const gHi = dark ? "#68ad5c" : PAL.grassHi;
  // depth of fringe (deeper = more visible)
  const D = 7;
  const lump = (i) => 3 + Math.round(Math.sin(i * 1.7) * 2.2 + Math.cos(i * 0.9) * 1.8);
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

const cache = { grass: [], forest: [], dirt: [], sand: [], water: [], snow: [], edge: [], forestEdge: [], foam: [] };

// foam shoreline: light rim on the water tile toward land. mask 1=N 2=E 4=S 8=W
function foamOverlay(dirMask) {
  const cv = C(); const ctx = cv.getContext("2d");
  const foam = "rgba(200,240,250,0.85)", foam2 = "rgba(255,255,255,0.7)";
  const wob = (i) => Math.round(Math.sin(i * 2.1) * 1.2);
  if (dirMask & 1) { for (let x = 0; x < TS; x++) { ctx.fillStyle = foam; ctx.fillRect(x, 0, 1, 2 + wob(x)); ctx.fillStyle = foam2; ctx.fillRect(x, 0, 1, 1); } }
  if (dirMask & 4) { for (let x = 0; x < TS; x++) { const h = 2 + wob(x + 3); ctx.fillStyle = foam; ctx.fillRect(x, TS - h, 1, h); ctx.fillStyle = foam2; ctx.fillRect(x, TS - 1, 1, 1); } }
  if (dirMask & 8) { for (let y = 0; y < TS; y++) { ctx.fillStyle = foam; ctx.fillRect(0, y, 2 + wob(y), 1); ctx.fillStyle = foam2; ctx.fillRect(0, y, 1, 1); } }
  if (dirMask & 2) { for (let y = 0; y < TS; y++) { const w = 2 + wob(y + 3); ctx.fillStyle = foam; ctx.fillRect(TS - w, y, w, 1); ctx.fillStyle = foam2; ctx.fillRect(TS - 1, y, 1, 1); } }
  return cv;
}

export function buildTiles() {
  for (let v = 0; v < 8; v++) {
    cache.grass.push(grassTile(v, false));
    cache.forest.push(grassTile(v, true));
    cache.dirt.push(dirtTile(v));
    cache.sand.push(sandTile(v));
    cache.snow.push(snowTile(v));
  }
  for (let f = 0; f < 4; f++) for (let v = 0; v < 8; v++) cache.water.push(waterTile(f, v));
  // grass fringe overlays keyed by neighbor-mask (drawn on non-grass tiles)
  cache.edge = [];
  for (let m = 0; m < 16; m++) cache.edge.push(edgeOverlay(m));
  cache.forestEdge = [];
  for (let m = 0; m < 16; m++) cache.forestEdge.push(edgeOverlay(m, true));
  cache.foam = [];
  for (let m = 0; m < 16; m++) cache.foam.push(foamOverlay(m));
  return cache;
}

export function tile(kind, i) {
  const arr = cache[kind]; if (!arr || !arr.length) return null;
  return arr[i % arr.length];
}
export function grassFringe(mask) {
  return cache.edge ? cache.edge[mask & 15] : null;
}
export function forestFringe(mask) {
  return cache.forestEdge ? cache.forestEdge[mask & 15] : null;
}
export function waterFoam(mask) {
  return cache.foam ? cache.foam[mask & 15] : null;
}
export const TILE_SIZE = TS;
