// Procedural monster generator — original cute creatures inspired by monster-taming games.
// Each species drawn to a set of animation-frame canvases (idle bounce). No external art.

const SZ = 40; // canvas size per frame
function C() { const cv = document.createElement("canvas"); cv.width = SZ; cv.height = SZ; return cv; }
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.min(255, Math.round(r * f)); g = Math.min(255, Math.round(g * f)); b = Math.min(255, Math.round(b * f));
  return `rgb(${r},${g},${b})`;
}
function P(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
function E(ctx, cx, cy, rx, ry, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 7); ctx.fill(); }
function outline(ctx) {
  const w = SZ, h = SZ, img = ctx.getImageData(0, 0, w, h), d = img.data;
  const a = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : d[(y * w + x) * 4 + 3];
  const out = ctx.createImageData(w, h); const o = out.data;
  for (let i = 0; i < d.length; i++) o[i] = d[i];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (a(x, y) < 20 && (a(x - 1, y) > 40 || a(x + 1, y) > 40 || a(x, y - 1) > 40 || a(x, y + 1) > 40)) {
      const idx = (y * w + x) * 4; o[idx] = 34; o[idx + 1] = 30; o[idx + 2] = 38; o[idx + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
}
function shadow(ctx, cx, cy, rx) { ctx.fillStyle = "rgba(20,18,22,0.25)"; ctx.beginPath(); ctx.ellipse(cx, cy, rx, rx * 0.35, 0, 0, 7); ctx.fill(); }
function eyes(ctx, lx, rx, y, look) {
  E(ctx, lx, y, 3, 3.4, "#fff"); E(ctx, rx, y, 3, 3.4, "#fff");
  P(ctx, lx - 1 + look, y - 1, 2, 3, "#26222a"); P(ctx, rx - 1 + look, y - 1, 2, 3, "#26222a");
  P(ctx, lx - 1 + look, y - 1, 1, 1, "#fff"); P(ctx, rx - 1 + look, y - 1, 1, 1, "#fff");
}

// species draw fns: (ctx, frame) -> void. frame 0..3 idle bounce
const SPECIES = {
  // Leafling — grass sprout critter
  leaflet: (ctx, f) => {
    const b = [0, -1, 0, 1][f], sx = [1, 1.06, 1, 0.94][f];
    shadow(ctx, 20, 34, 11 * sx);
    const body = "#7ac96a", d = shade(body, 0.75), l = shade(body, 1.18);
    E(ctx, 20, 24 + b, 11 * sx, 9, body); E(ctx, 20, 22 + b, 8 * sx, 6, l);
    E(ctx, 20, 27 + b, 6, 4, "#f0f4d8"); // belly
    // leaf sprout
    P(ctx, 19, 11 + b, 2, 6, "#5a9a4a");
    E(ctx, 16, 11 + b, 4, 2.5, "#8ad86a"); E(ctx, 24, 11 + b, 4, 2.5, "#8ad86a");
    // cheeks
    E(ctx, 13, 25 + b, 1.6, 1.4, "#e88aa0"); E(ctx, 27, 25 + b, 1.6, 1.4, "#e88aa0");
    eyes(ctx, 15, 25, 23 + b, [0, 0, 1, -1][f]);
    P(ctx, 18, 27 + b, 4, 1, d);
    // feet
    P(ctx, 14, 31 + b, 4, 3, d); P(ctx, 22, 31 + b, 4, 3, d);
  },
  // Emberkit — fire fox pup
  emberkit: (ctx, f) => {
    const b = [0, -1, 0, 1][f];
    shadow(ctx, 20, 34, 10);
    const body = "#f08a4a", d = shade(body, 0.8), cream = "#ffe0c0";
    // tail flame
    const ff = [0, 1, 2, 1][f];
    E(ctx, 8, 22 + b - ff, 3.5, 5, "#ff9a3a"); E(ctx, 8, 20 + b - ff, 2, 3, "#ffd24a"); P(ctx, 7, 16 + b - ff, 2, 2, "#fff0a0");
    E(ctx, 20, 24 + b, 10, 8, body); E(ctx, 20, 26 + b, 6, 4, cream);
    // head
    E(ctx, 20, 16 + b, 7, 6, body);
    // ears
    ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(13, 12 + b); ctx.lineTo(16, 6 + b); ctx.lineTo(18, 13 + b); ctx.fill();
    ctx.beginPath(); ctx.moveTo(27, 12 + b); ctx.lineTo(24, 6 + b); ctx.lineTo(22, 13 + b); ctx.fill();
    P(ctx, 15, 9 + b, 2, 3, "#ffd24a"); P(ctx, 23, 9 + b, 2, 3, "#ffd24a");
    eyes(ctx, 17, 23, 16 + b, [0, 0, 1, -1][f]);
    P(ctx, 19, 19 + b, 2, 1, "#7a3a1a"); // nose
    P(ctx, 14, 30 + b, 4, 3, d); P(ctx, 22, 30 + b, 4, 3, d);
  },
  // Aquab — water tadpole/droplet
  aquab: (ctx, f) => {
    const b = [0, -1, 0, 1][f], sx = [1, 1.05, 1, 0.95][f];
    shadow(ctx, 20, 34, 10 * sx);
    const body = "#5ab8e0", d = shade(body, 0.8), l = shade(body, 1.2);
    E(ctx, 20, 24 + b, 10 * sx, 9, body); E(ctx, 20, 22 + b, 7, 5, l);
    E(ctx, 20, 26 + b, 5, 4, "#d8f4ff");
    // water drop crest
    ctx.fillStyle = l; ctx.beginPath(); ctx.moveTo(20, 10 + b); ctx.lineTo(17, 16 + b); ctx.lineTo(23, 16 + b); ctx.fill();
    P(ctx, 12, 22 + b, 3, 5, body); P(ctx, 25, 22 + b, 3, 5, body); // fins
    eyes(ctx, 16, 24, 23 + b, [0, 0, 1, -1][f]);
    E(ctx, 12, 26 + b, 1.4, 1.2, "#7ac8f0"); E(ctx, 28, 26 + b, 1.4, 1.2, "#7ac8f0");
    P(ctx, 18, 27 + b, 4, 1, d);
  },
  // Pebbit — rock critter with facets + stone feet
  pebbit: (ctx, f) => {
    const b = [0, 0, -1, 0][f];
    shadow(ctx, 20, 34, 12);
    const body = "#9a9aa2", d = shade(body, 0.68), l = shade(body, 1.25), m = shade(body, 0.85);
    // faceted crystalline rock body
    ctx.fillStyle = body; ctx.beginPath();
    ctx.moveTo(9, 29 + b); ctx.lineTo(11, 17 + b); ctx.lineTo(16, 12 + b); ctx.lineTo(24, 12 + b); ctx.lineTo(30, 18 + b); ctx.lineTo(31, 29 + b); ctx.closePath(); ctx.fill();
    // top-light facet
    ctx.fillStyle = l; ctx.beginPath(); ctx.moveTo(16, 12 + b); ctx.lineTo(24, 12 + b); ctx.lineTo(26, 18 + b); ctx.lineTo(20, 20 + b); ctx.lineTo(14, 18 + b); ctx.closePath(); ctx.fill();
    // shadow facet
    ctx.fillStyle = d; ctx.beginPath(); ctx.moveTo(9, 29 + b); ctx.lineTo(11, 17 + b); ctx.lineTo(14, 18 + b); ctx.lineTo(15, 29 + b); ctx.closePath(); ctx.fill();
    // cracks
    ctx.strokeStyle = d; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(22, 21 + b); ctx.lineTo(25, 26 + b); ctx.moveTo(18, 24 + b); ctx.lineTo(16, 28 + b); ctx.stroke();
    // little crystal on top
    ctx.fillStyle = l; ctx.beginPath(); ctx.moveTo(20, 6 + b); ctx.lineTo(18, 12 + b); ctx.lineTo(22, 12 + b); ctx.closePath(); ctx.fill();
    // stubby stone feet
    P(ctx, 11, 30 + b, 6, 4, m); P(ctx, 23, 30 + b, 6, 4, m);
    P(ctx, 11, 33 + b, 6, 1, d); P(ctx, 23, 33 + b, 6, 1, d);
    eyes(ctx, 16, 24, 22 + b, 0);
    P(ctx, 18, 26 + b, 4, 1, d);
  },
  // Sparkit — electric bunny
  sparkit: (ctx, f) => {
    const b = [0, -1, 0, 1][f];
    shadow(ctx, 20, 34, 9);
    const body = "#f0d24a", d = shade(body, 0.8);
    E(ctx, 20, 25 + b, 9, 8, body); E(ctx, 20, 27 + b, 5, 4, "#fff4c0");
    E(ctx, 20, 16 + b, 6.5, 6, body);
    // zigzag ears
    ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(15, 12 + b); ctx.lineTo(13, 4 + b); ctx.lineTo(17, 10 + b); ctx.lineTo(18, 13 + b); ctx.fill();
    ctx.beginPath(); ctx.moveTo(25, 12 + b); ctx.lineTo(27, 4 + b); ctx.lineTo(23, 10 + b); ctx.lineTo(22, 13 + b); ctx.fill();
    P(ctx, 13, 5 + b, 2, 2, "#3a3a2a"); P(ctx, 25, 5 + b, 2, 2, "#3a3a2a");
    eyes(ctx, 17, 23, 16 + b, [0, 1, 0, -1][f]);
    E(ctx, 13, 19 + b, 1.6, 1.4, "#e8683a"); E(ctx, 27, 19 + b, 1.6, 1.4, "#e8683a"); // cheeks
    P(ctx, 14, 31 + b, 4, 2, d); P(ctx, 22, 31 + b, 4, 2, d);
  },
  // Mothwing — cute moth
  mothwing: (ctx, f) => {
    const b = [0, -1, 0, 1][f], wg = [0, 1, 2, 1][f];
    shadow(ctx, 20, 33, 8);
    const body = "#b088d8", wing = "#d8b0f0", d = shade(body, 0.8);
    // wings
    E(ctx, 11, 22 + b, 6, 8 - wg, wing); E(ctx, 29, 22 + b, 6, 8 - wg, wing);
    E(ctx, 12, 22 + b, 3, 4, "#f0d8ff"); E(ctx, 28, 22 + b, 3, 4, "#f0d8ff");
    E(ctx, 20, 23 + b, 5, 8, body); // body
    E(ctx, 20, 15 + b, 5, 5, body);
    P(ctx, 17, 9 + b, 1, 4, d); P(ctx, 23, 9 + b, 1, 4, d); // antennae
    E(ctx, 17, 9 + b, 1.5, 1.5, "#f0d8ff"); E(ctx, 24, 9 + b, 1.5, 1.5, "#f0d8ff");
    eyes(ctx, 18, 23, 15 + b, 0);
  },
  // Sludgel — toxic slime with drips + gloss
  sludgel: (ctx, f) => {
    const cyc = [[1, 1, 0], [1.12, 0.9, 0], [1.04, 0.98, -1], [0.9, 1.14, 1]][f];
    const [sx, sy, b] = cyc;
    shadow(ctx, 20, 34, 11 * sx);
    const body = "#a06ad0", d = shade(body, 0.72), l = shade(body, 1.22);
    const rx = 11 * sx, ry = 9 * sy;
    E(ctx, 20, 24 + b, rx, ry, body);
    // drips down the sides
    E(ctx, 20 - rx + 2, 28 + b, 2.5, 4, body); E(ctx, 20 + rx - 2, 27 + b, 2, 3.5, body);
    E(ctx, 20, 24 + b, rx * 0.72, ry * 0.62, l);
    // toxic bubbles
    E(ctx, 24, 20 + b, 1.8, 1.8, "#d8b0f0"); E(ctx, 16, 22 + b, 1.2, 1.2, "#d8b0f0");
    E(ctx, 14, 19 + b, 2, 2, "#f0e0ff"); // gloss shine
    eyes(ctx, 16, 24, 23 + b, [0, 0, 1, -1][f]);
    E(ctx, 12, 26 + b, 1.4, 1.2, "#e888c0"); E(ctx, 28, 26 + b, 1.4, 1.2, "#e888c0");
    P(ctx, 18, 27 + b, 4, 1, d);
  },
  // Cindar — blue-flame fire lizard (differentiated from emberkit)
  cindar: (ctx, f) => {
    const b = [0, -1, 0, 1][f], ff = [0, 1, 2, 1][f];
    shadow(ctx, 20, 34, 10);
    const body = "#6a5ad0", d = shade(body, 0.78), belly = "#a0c0f0";
    E(ctx, 20, 25 + b, 9, 8, body); E(ctx, 20, 27 + b, 5, 4, belly);
    E(ctx, 20, 16 + b, 7, 6, body);
    // blue head flame
    E(ctx, 20, 9 + b - ff, 3, 5, "#5a9af0"); E(ctx, 20, 7 + b - ff, 1.6, 3, "#a0e0ff"); P(ctx, 19, 4 + b - ff, 2, 2, "#e0f4ff");
    eyes(ctx, 17, 23, 16 + b, [0, 0, 1, -1][f]);
    P(ctx, 12, 26 + b, 4, 3, body); P(ctx, 24, 26 + b, 4, 3, body);
    P(ctx, 14, 31 + b, 4, 2, d); P(ctx, 22, 31 + b, 4, 2, d);
    P(ctx, 29, 26 + b, 4, 2, body); E(ctx, 33, 25 + b, 2, 2.5, "#5a9af0");
  },
  // Frostl — ice crystal sprite
  frostl: (ctx, f) => {
    const b = [0, -1, 0, 1][f], sx = [1, 1.05, 1, 0.95][f];
    shadow(ctx, 20, 34, 10 * sx);
    const body = "#7adcf0", d = shade(body, 0.7), l = shade(body, 1.25);
    E(ctx, 20, 24 + b, 10 * sx, 8, body); E(ctx, 20, 22 + b, 7, 5, l);
    // ice crystals on head
    P(ctx, 18, 8 + b, 4, 6, l); P(ctx, 19, 6 + b, 2, 2, "#e0f8ff");
    P(ctx, 13, 12 + b, 2, 5, body); P(ctx, 25, 12 + b, 2, 5, body);
    E(ctx, 20, 27 + b, 5, 3, "#d8f4ff");
    eyes(ctx, 16, 24, 23 + b, [0, 0, 1, -1][f]);
    P(ctx, 14, 31 + b, 4, 3, d); P(ctx, 22, 31 + b, 4, 3, d);
  },
  // Shadown — shadow wraith
  shadown: (ctx, f) => {
    const b = [0, -1, 0, 1][f], fl = [0, 1, 0, -1][f];
    shadow(ctx, 20, 34, 12);
    const body = "#5a4a78", d = shade(body, 0.7), l = shade(body, 1.3);
    // wispy floating body
    E(ctx, 20, 22 + b, 11, 9, body); E(ctx, 20, 20 + b, 7, 5, l);
    // tattered cloak bottom
    P(ctx, 10, 28 + b, 3, 4 + fl, d); P(ctx, 14, 30 + b, 3, 3 - fl, d); P(ctx, 22, 30 + b, 3, 3 + fl, d); P(ctx, 27, 28 + b, 3, 4 - fl, d);
    // glowing eyes
    E(ctx, 17, 22 + b, 1.8, 1.8, "#e050a0"); E(ctx, 23, 22 + b, 1.8, 1.8, "#e050a0");
    P(ctx, 16, 22 + b, 1, 1, "#fff0a0"); P(ctx, 22, 22 + b, 1, 1, "#fff0a0");
  },
  // Volth — electric orb creature
  volth: (ctx, f) => {
    const b = [0, -1, 0, 1][f], el = [0, 1, 2, 1][f];
    shadow(ctx, 20, 34, 10);
    const body = "#f0d040", d = shade(body, 0.7), l = shade(body, 1.2);
    E(ctx, 20, 24 + b, 9, 8, body); E(ctx, 20, 22 + b, 6, 5, l);
    // electric sparks
    ctx.strokeStyle = "#fff8a0"; ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) { const x = 12 + i * 6; ctx.beginPath(); ctx.moveTo(x, 16 + b); ctx.lineTo(x + 1, 12 + b - el); ctx.lineTo(x - 1, 10 + b - el); ctx.stroke(); }
    eyes(ctx, 17, 24, 22 + b, [0, 0, 1, -1][f]);
    P(ctx, 15, 30 + b, 3, 3, d); P(ctx, 22, 30 + b, 3, 3, d);
  },
  // Crysto — rock gem beast
  crysto: (ctx, f) => {
    const b = [0, -1, 0, 1][f];
    shadow(ctx, 20, 34, 12);
    const body = "#c09060", d = shade(body, 0.72), gem = "#d050a0";
    // rocky body
    ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(10, 28 + b); ctx.lineTo(13, 18 + b); ctx.lineTo(20, 15 + b); ctx.lineTo(27, 18 + b); ctx.lineTo(30, 28 + b); ctx.closePath(); ctx.fill();
    ctx.fillStyle = d; ctx.beginPath(); ctx.moveTo(10, 28 + b); ctx.lineTo(13, 18 + b); ctx.lineTo(16, 20 + b); ctx.lineTo(14, 28 + b); ctx.closePath(); ctx.fill();
    // gem on forehead
    E(ctx, 20, 21 + b, 4, 3, gem); E(ctx, 20, 20 + b, 2, 1.5, "#f0a0d0");
    eyes(ctx, 16, 23, 24 + b, [0, 0, 1, -1][f]);
    P(ctx, 13, 31 + b, 4, 3, d); P(ctx, 23, 31 + b, 4, 3, d);
  },
  // Florix — flower fairy
  florix: (ctx, f) => {
    const b = [0, -1, 0, 1][f], fl = [0, 1, 2, 1][f];
    shadow(ctx, 20, 34, 9);
    const body = "#f0a0d0", d = shade(body, 0.75), l = shade(body, 1.2);
    E(ctx, 20, 25 + b, 8, 7, body); E(ctx, 20, 23 + b, 5, 4, l);
    // flower petals on head
    for (let i = 0; i < 5; i++) { const a = i / 5 * 7 - fl * 0.1; E(ctx, 20 + Math.cos(a) * 5, 13 + b + Math.sin(a) * 4, 3, 2.5, "#ffe0f0"); }
    E(ctx, 20, 13 + b, 2.5, 2.5, "#fff8a0");
    // little wings
    ctx.fillStyle = "rgba(255,200,240,0.7)"; E(ctx, 12, 22 + b, 4, 3, "rgba(255,200,240,0.7)"); E(ctx, 28, 22 + b, 4, 3, "rgba(255,200,240,0.7)");
    eyes(ctx, 17, 24, 23 + b, [0, 0, 1, -1][f]);
  },
  // Wraithix — dark armored knight-ling
  wraithix: (ctx, f) => {
    const b = [0, -1, 0, 1][f];
    shadow(ctx, 20, 34, 11);
    const body = "#3a3850", d = shade(body, 0.7), l = shade(body, 1.3), arm = "#5a5878";
    // armored body
    E(ctx, 20, 26 + b, 9, 8, body); E(ctx, 20, 24 + b, 6, 5, l);
    // helmet visor slit
    P(ctx, 15, 22 + b, 10, 2, d); P(ctx, 16, 22 + b, 8, 1, "#e04020");
    // shoulder pauldrons
    E(ctx, 13, 23 + b, 3, 2.5, arm); E(ctx, 27, 23 + b, 3, 2.5, arm);
    // horn
    P(ctx, 17, 13 + b, 2, 4, d); P(ctx, 21, 13 + b, 2, 4, d);
    eyes(ctx, 17, 25, 23 + b, [0, 0, 1, -1][f]);
    P(ctx, 14, 31 + b, 4, 3, d); P(ctx, 22, 31 + b, 4, 3, d);
  },
};

const cache = {};   // id -> [frame canvases]
export const MON_IDS = Object.keys(SPECIES);
export const MON_ELEMENT = { leaflet: "grass", emberkit: "fire", aquab: "water", pebbit: "rock", sparkit: "electric", mothwing: "bug", sludgel: "grass", cindar: "fire", frostl: "ice", shadown: "dark", volth: "electric", crysto: "rock", florix: "grass", wraithix: "dark" };

export function buildMonsters() {
  for (const id of MON_IDS) {
    cache[id] = [];
    for (let f = 0; f < 4; f++) {
      const cv = C(); const ctx = cv.getContext("2d"); ctx.imageSmoothingEnabled = false;
      SPECIES[id](ctx, f);
      outline(ctx);
      cache[id].push(cv);
    }
  }
  return cache;
}
export function monFrame(id, f) { return cache[id] ? cache[id][f % 4] : null; }
export function monHeight() { return SZ; }
