// Procedural bestiary — original habitat companions drawn entirely in code.
// Each species owns four readable idle frames. No external art or copied creature designs.

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
function expressiveEyes(ctx, lx, rx, y, f, look = 0, color = "#26222a") {
  if (f === 3) {
    P(ctx, lx - 2, y, 4, 1, color); P(ctx, rx - 2, y, 4, 1, color);
    return;
  }
  E(ctx, lx, y, 2.8, 3.2, "#fff"); E(ctx, rx, y, 2.8, 3.2, "#fff");
  P(ctx, lx - 1 + look, y - 1, 2, 3, color); P(ctx, rx - 1 + look, y - 1, 2, 3, color);
  P(ctx, lx - 1 + look, y - 1, 1, 1, "#fff"); P(ctx, rx - 1 + look, y - 1, 1, 1, "#fff");
}
function smile(ctx, x, y, c = "#5a3440") {
  P(ctx, x - 2, y, 1, 1, c); P(ctx, x + 1, y, 1, 1, c); P(ctx, x - 1, y + 1, 2, 1, c);
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
  // Sparring Dummy — straw training post for the Crimson Duel Court.
  // Stationary combat target so solo travelers can warm up before PvP.
  sparring_dummy: (ctx, f) => {
    const b = [0, -1, 0, 1][f] * 0.35;
    shadow(ctx, 20, 35, 11);
    const wood = "#8a5a34", woodD = shade(wood, 0.72), straw = "#d7b46a", strawL = shade(straw, 1.15), cloth = "#b94543", clothL = "#e07060";
    // stake
    P(ctx, 18, 18 + b, 4, 16, wood); P(ctx, 18, 18 + b, 1, 16, woodD);
    // straw torso
    E(ctx, 20, 20 + b, 9, 11, straw); E(ctx, 20, 18 + b, 7, 7, strawL);
    // rope wraps
    P(ctx, 12, 16 + b, 16, 2, woodD); P(ctx, 13, 24 + b, 14, 2, woodD);
    // crimson practice sash
    P(ctx, 12, 20 + b, 16, 3, cloth); P(ctx, 12, 20 + b, 16, 1, clothL);
    // wooden head block
    E(ctx, 20, 10 + b, 6.5, 5.5, wood); E(ctx, 20, 9 + b, 4.5, 3.5, shade(wood, 1.12));
    // painted target face
    E(ctx, 20, 10 + b, 3.2, 2.8, cloth);
    P(ctx, 19, 9 + b, 2, 2, "#fff0c8");
    // loose straw tufts
    P(ctx, 11, 14 + b, 2, 4, strawL); P(ctx, 27, 15 + b, 2, 4, straw);
    P(ctx, 14, 28 + b, 2, 3, straw); P(ctx, 24, 28 + b, 2, 3, strawL);
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
  // Pinepup — a pinecone-backed forest seed carrier
  pinepup: (ctx, f) => {
    const b = [0, -1, 0, 1][f], wag = [-2, 0, 2, 0][f];
    shadow(ctx, 20, 34, 11);
    const fur = "#b9875c", dark = "#76513d", moss = "#4f8b61", light = "#e7c99b";
    E(ctx, 22, 25 + b, 11, 7, fur);
    // Layered pine scales create a clean, recognizable back silhouette.
    for (let i = 0; i < 4; i++) {
      const x = 18 + i * 4;
      ctx.fillStyle = i % 2 ? "#427956" : moss;
      ctx.beginPath(); ctx.moveTo(x, 17 + b); ctx.lineTo(x - 3, 24 + b); ctx.lineTo(x + 3, 23 + b); ctx.closePath(); ctx.fill();
    }
    E(ctx, 13, 23 + b, 6, 6, light);
    ctx.fillStyle = fur; ctx.beginPath(); ctx.moveTo(9, 19 + b); ctx.lineTo(11, 14 + b); ctx.lineTo(14, 20 + b); ctx.fill();
    E(ctx, 11, 23 + b, 1.8, 2.3, "#fff"); P(ctx, 10, 22 + b, 2, 3, dark); P(ctx, 10, 22 + b, 1, 1, "#fff");
    P(ctx, 7, 25 + b, 2, 2, "#3a2d2d");
    // Wagging twig tail and stepping feet make each frame distinct.
    ctx.strokeStyle = dark; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(31, 24 + b); ctx.lineTo(34, 20 + b + wag); ctx.stroke();
    E(ctx, 35, 19 + b + wag, 2, 1.5, moss);
    P(ctx, 14, 30 + b, 4, 3, dark); P(ctx, 26, 30 - b, 4, 3, dark);
  },
  // Bramblebuck — broad forest mount with living vine antlers
  bramblebuck: (ctx, f) => {
    const b = [0, -1, 0, 1][f], step = [0, 1, 0, -1][f];
    shadow(ctx, 21, 35, 17);
    const body = "#78905b", shadeBody = "#4e6848", belly = "#bdc88a", vine = "#35614a";
    E(ctx, 23, 25 + b, 13, 7.5, body); E(ctx, 22, 27 + b, 10, 4, belly);
    E(ctx, 10, 20 + b, 7, 7, body); E(ctx, 9, 22 + b, 4.5, 3.5, belly);
    // Antlers branch outward instead of reading as generic horns.
    ctx.strokeStyle = vine; ctx.lineWidth = 2; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(8, 15 + b); ctx.lineTo(5, 9 + b); ctx.lineTo(2, 7 + b); ctx.moveTo(5, 10 + b); ctx.lineTo(2, 12 + b); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(12, 15 + b); ctx.lineTo(15, 8 + b); ctx.lineTo(18, 6 + b); ctx.moveTo(15, 10 + b); ctx.lineTo(19, 11 + b); ctx.stroke();
    E(ctx, 3, 7 + b, 2.2, 1.6, "#72ad65"); E(ctx, 19, 6 + b, 2.2, 1.6, "#72ad65");
    // Leaf ears, bright face, and a tiny smile keep the large mount friendly.
    E(ctx, 4, 17 + b, 3.5, 2, "#90ad69"); E(ctx, 16, 17 + b, 3.5, 2, "#90ad69");
    expressiveEyes(ctx, 7, 12, 20 + b, f, f === 2 ? 1 : 0);
    smile(ctx, 10, 24 + b, "#405038");
    P(ctx, 13, 30 + b, 4, 5 + step, shadeBody); P(ctx, 20, 30 + b, 4, 5 - step, shadeBody);
    P(ctx, 28, 30 + b, 4, 5 + step, shadeBody); P(ctx, 34, 29 + b, 3, 5 - step, shadeBody);
    P(ctx, 31, 19 + b, 5, 2, shadeBody); E(ctx, 36, 18 + b + step, 2.5, 2, "#72ad65");
  },
  // Puffalo — cloud-wool meadow grazer and gentle caravan mount.  The saddle
  // blanket and teal face mask give the starter a strong silhouette at the
  // player's scale instead of reading as a pile of pale circles.
  puffalo: (ctx, f) => {
    const b = [0, -1, 0, 1][f], puff = [0, 1, 0, -1][f], step = [-1, 0, 1, 0][f];
    shadow(ctx, 20, 35, 17);
    const wool = "#f2e8ca", woolHi = "#fff6d9", warm = "#c89b66", face = "#a96b58", dark = "#503b3a", teal = "#398c80", gold = "#e4bf66";
    E(ctx, 21, 25 + b, 15, 8.5, warm);
    for (const [x, y, r] of [[8,23,6],[14,20,6],[21,19,7],[28,21,6],[34,25,5],[15,27,7],[25,28,7]]) E(ctx, x, y + b, r, r * .7, wool);
    E(ctx, 22, 18 + b + puff * .25, 8, 7, face);
    // floppy ears and a two-tone forelock
    E(ctx, 14, 15 + b, 4, 2.3, dark); E(ctx, 29, 15 + b, 4, 2.3, dark);
    P(ctx, 18, 11 + b - puff, 3, 6, woolHi); P(ctx, 21, 9 + b - puff, 3, 7, teal); P(ctx, 24, 11 + b - puff, 3, 5, woolHi);
    expressiveEyes(ctx, 19, 25, 18 + b, f, 0, dark); E(ctx, 22, 22 + b, 2, 1.4, "#6b3f45");
    E(ctx, 15, 21 + b, 1.6, 1.3, "#e9968d"); E(ctx, 29, 21 + b, 1.6, 1.3, "#e9968d");
    // A real-looking travel blanket with gold tack and a bouncing bell.
    P(ctx, 12, 24 + b, 18, 7, teal); P(ctx, 12, 24 + b, 18, 2, "#63c3a0");
    P(ctx, 14, 29 + b, 14, 2, dark); P(ctx, 20, 24 + b, 2, 7, gold); P(ctx, 11, 25 + b, 2, 4, gold); P(ctx, 29, 25 + b, 2, 4, gold);
    P(ctx, 10, 30 + b, 5, 5 + puff + step, dark); P(ctx, 18, 31 + b, 5, 4 - puff, dark); P(ctx, 28, 30 + b, 5, 5 + puff - step, dark);
    P(ctx, 34, 25 + b, 4, 2, dark); E(ctx, 37, 23 + b + step, 2, 2, teal); E(ctx, 15, 18 + b, 1.2, 1.2, gold);
  },
  // Reedstrider — long-legged wind bird that opens paths through tall grass
  reedstrider: (ctx, f) => {
    const b = [0, -1, 0, 1][f], stride = [-2, 0, 2, 0][f], wing = [0, -1, 0, 1][f];
    shadow(ctx, 20, 35, 15);
    const body = "#7eb7a4", dark = "#426d68", cream = "#e9e2bd", plume = "#d9a852";
    E(ctx, 19, 24 + b, 13, 7, body); E(ctx, 18, 26 + b, 8, 4, cream);
    E(ctx, 27, 17 + b, 5, 9, body); E(ctx, 29, 11 + b, 6, 5, body);
    ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(34, 11 + b); ctx.lineTo(37, 13 + b); ctx.lineTo(34, 15 + b); ctx.closePath(); ctx.fill();
    E(ctx, 31, 10 + b, 2.2, 2.6, "#fff"); P(ctx, 31, 9 + b, 2, 3, dark); P(ctx, 31, 9 + b, 1, 1, "#fff");
    // Sweeping reed crest and tail feathers animate in opposite directions.
    ctx.strokeStyle = plume; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(27, 7 + b); ctx.quadraticCurveTo(23, 3 + b - wing, 19, 5 + b); ctx.stroke();
    ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(8, 22 + b); ctx.lineTo(1, 17 + b - wing); ctx.lineTo(7, 27 + b); ctx.fill();
    E(ctx, 19, 23 + b + wing, 7, 4, "#62998d");
    P(ctx, 14 + stride, 29 + b, 3, 6, dark); P(ctx, 25 - stride, 29 + b, 3, 6, dark);
    P(ctx, 11 + stride, 35, 7, 2, dark); P(ctx, 23 - stride, 35, 7, 2, dark);
  },
  // Tideback — broad-shelled coastal ferry companion
  tideback: (ctx, f) => {
    const b = [0, -1, 0, 1][f], paddle = [-1, 0, 1, 0][f];
    shadow(ctx, 20, 35, 18);
    const skin = "#62b8aa", shell = "#497c8e", rim = "#8ed2bd", light = "#ccebd4", dark = "#315b6d";
    E(ctx, 19, 25 + b, 15, 8, skin); E(ctx, 18, 22 + b, 14, 9, shell); E(ctx, 18, 21 + b, 10, 6, "#5f96a0");
    // Shell islands make the silhouette and habitat role readable at a glance.
    E(ctx, 14, 19 + b, 4, 2.5, rim); E(ctx, 22, 22 + b, 4, 2.5, rim); E(ctx, 20, 16 + b, 3, 2, light);
    E(ctx, 32, 23 + b, 5, 5, skin); E(ctx, 34, 22 + b, 2.2, 2.5, "#fff"); P(ctx, 34, 21 + b, 2, 3, dark); P(ctx, 34, 21 + b, 1, 1, "#fff");
    smile(ctx, 34, 25 + b, dark);
    ctx.fillStyle = skin; ctx.beginPath(); ctx.moveTo(6, 24 + b); ctx.lineTo(2, 20 + b); ctx.lineTo(4, 28 + b); ctx.fill();
    E(ctx, 10 + paddle, 31 + b, 6, 3, skin); E(ctx, 27 - paddle, 31 + b, 6, 3, skin);
    E(ctx, 8 - paddle, 25 + b, 5, 2.5, skin); E(ctx, 29 + paddle, 27 + b, 5, 2.5, skin);
  },
  // Shellip — tideline shell sorter with busy little claws
  shellip: (ctx, f) => {
    const b = [0, -1, 0, 1][f], clap = [0, 2, 0, -1][f];
    shadow(ctx, 20, 34, 11);
    const crab = "#e78965", dark = "#8d493f", shell = "#8ec9c3", pearl = "#d9f0dd";
    E(ctx, 20, 26 + b, 9, 6, crab); E(ctx, 20, 21 + b, 9, 8, shell);
    ctx.strokeStyle = pearl; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(20, 21 + b, 5, 0.3, 5.8); ctx.stroke();
    P(ctx, 15, 17 + b, 2, 6, dark); P(ctx, 23, 17 + b, 2, 6, dark);
    E(ctx, 16, 17 + b, 2.2, 2.5, "#fff"); E(ctx, 24, 17 + b, 2.2, 2.5, "#fff");
    P(ctx, 15, 16 + b, 2, 3, dark); P(ctx, 23, 16 + b, 2, 3, dark);
    E(ctx, 9 - clap, 25 + b, 3.5, 3, crab); E(ctx, 31 + clap, 25 + b, 3.5, 3, crab);
    P(ctx, 6 - clap, 22 + b, 4, 2, dark); P(ctx, 30 + clap, 22 + b, 4, 2, dark);
    for (let i = 0; i < 3; i++) { P(ctx, 12 + i * 4, 30 + b + (i % 2), 3, 2, dark); }
  },
  // Glimmerfin — a floating coast fish that cleans moonlit tide pools
  glimmerfin: (ctx, f) => {
    const b = [-1, -2, 0, 1][f], swish = [-2, 0, 2, 0][f];
    shadow(ctx, 20, 34, 9);
    const body = "#72cbd2", dark = "#397b8e", glow = "#d4f6d5", coral = "#f09a8f";
    E(ctx, 21, 22 + b, 10, 6, body); E(ctx, 22, 20 + b, 6, 3, glow);
    ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(11, 22 + b); ctx.lineTo(4, 16 + b + swish); ctx.lineTo(5, 28 + b - swish); ctx.closePath(); ctx.fill();
    ctx.fillStyle = coral; ctx.beginPath(); ctx.moveTo(20, 17 + b); ctx.lineTo(24, 11 + b); ctx.lineTo(26, 18 + b); ctx.fill();
    E(ctx, 26, 21 + b, 2.5, 2.8, "#fff"); P(ctx, 26, 20 + b, 2, 3, dark); P(ctx, 26, 20 + b, 1, 1, "#fff");
    P(ctx, 30, 23 + b, 3, 1, dark);
    // Rising bubbles sell the hovering swim cycle.
    ctx.strokeStyle = "rgba(210,246,245,.9)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(31, 13 + b - f, 2, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.arc(35, 8 + b - f, 1.2, 0, 7); ctx.stroke();
  },
  // Snowmuff — massive warm-coated snowfield mount
  snowmuff: (ctx, f) => {
    const b = [0, -1, 0, 1][f], sway = [-1, 0, 1, 0][f];
    shadow(ctx, 20, 35, 18);
    const coat = "#e7eef0", shadeCoat = "#b8ced2", face = "#718a91", horn = "#9fdbe2", dark = "#465d67";
    E(ctx, 21, 25 + b, 16, 9, shadeCoat);
    for (const [x, y, r] of [[8,24,6],[13,20,7],[20,19,7],[27,20,7],[32,24,5],[16,27,8],[26,27,8]]) E(ctx, x, y + b, r, r * 0.7, coat);
    E(ctx, 10, 22 + b, 7, 7, face);
    ctx.strokeStyle = horn; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(7, 17 + b, 7, 2.7, 4.8); ctx.stroke(); ctx.beginPath(); ctx.arc(13, 17 + b, 7, 4.6, 6.7); ctx.stroke();
    E(ctx, 8, 21 + b, 2.3, 2.7, "#fff"); E(ctx, 13, 21 + b, 2.3, 2.7, "#fff");
    P(ctx, 8, 20 + b, 2, 3, dark); P(ctx, 12, 20 + b, 2, 3, dark); P(ctx, 8, 20 + b, 1, 1, "#fff"); P(ctx, 12, 20 + b, 1, 1, "#fff");
    E(ctx, 10, 25 + b, 2.2, 1.5, "#43545b");
    P(ctx, 10 + sway, 30 + b, 5, 5, dark); P(ctx, 20 - sway, 31 + b, 5, 4, dark); P(ctx, 29 + sway, 30 + b, 5, 5, dark);
    // A woven trail bell gives this large creature a domestic role.
    P(ctx, 17, 28 + b, 2, 4, "#b56b50"); E(ctx, 18, 32 + b, 2.5, 2, "#e0b556");
  },
  // Aurorabbit — snowfield scout with ribbon-like polar ears
  aurorabbit: (ctx, f) => {
    const b = [0, -2, 0, 1][f], ear = [-1, 0, 1, 0][f];
    shadow(ctx, 20, 34, 9);
    const fur = "#dceef2", cyan = "#83d5cf", lilac = "#b6a9e0", dark = "#526575";
    E(ctx, 20, 25 + b, 9, 8, fur); E(ctx, 20, 17 + b, 7, 6, fur);
    E(ctx, 16 + ear, 9 + b, 2.8, 8, cyan); E(ctx, 24 - ear, 9 + b, 2.8, 8, lilac);
    E(ctx, 16 + ear, 9 + b, 1.2, 5, "#e9ffff"); E(ctx, 24 - ear, 9 + b, 1.2, 5, "#f4eaff");
    expressiveEyes(ctx, 17, 23, 17 + b, f, f === 2 ? 1 : 0, dark);
    E(ctx, 20, 21 + b, 1.4, 1, "#e08fa0");
    P(ctx, 13, 22 + b, 14, 2, lilac); P(ctx, 27, 22 + b, 5 + ear, 2, cyan);
    P(ctx, 14, 31 + b, 5, 3, dark); P(ctx, 23, 31 + b, 5, 3, dark);
  },
  // Duskstag — calm night mount that carries starlight between clearings
  duskstag: (ctx, f) => {
    const b = [0, -1, 0, 1][f], step = [-1, 0, 1, 0][f];
    shadow(ctx, 21, 35, 17);
    const body = "#54547b", dark = "#32334f", glow = "#c9c7ff", star = "#f4df8a";
    E(ctx, 23, 25 + b, 13, 7, body); E(ctx, 10, 19 + b, 7, 7, body); E(ctx, 8, 22 + b, 4, 3, "#7473a0");
    // Crescent antlers form a distinct night silhouette.
    ctx.strokeStyle = glow; ctx.lineWidth = 2; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(8, 14 + b); ctx.quadraticCurveTo(2, 8 + b, 5, 4 + b); ctx.moveTo(11, 14 + b); ctx.quadraticCurveTo(17, 8 + b, 15, 3 + b); ctx.stroke();
    E(ctx, 4, 7 + b, 1.4, 1.4, star); E(ctx, 16, 6 + b, 1.4, 1.4, star);
    expressiveEyes(ctx, 7, 12, 19 + b, f, 0, dark); smile(ctx, 10, 23 + b, dark);
    // Star freckles stay readable even when the creature is scaled down as a pet.
    P(ctx, 19, 22 + b, 2, 2, star); P(ctx, 25, 25 + b, 1, 1, star); P(ctx, 30, 21 + b, 1, 1, star);
    P(ctx, 13 + step, 30 + b, 4, 5, dark); P(ctx, 21 - step, 30 + b, 4, 5, dark); P(ctx, 29 + step, 30 + b, 4, 5, dark);
    ctx.strokeStyle = dark; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(34, 23 + b); ctx.quadraticCurveTo(39, 18 + b + step, 37, 15 + b); ctx.stroke();
    E(ctx, 37, 14 + b + step, 2, 2, glow);
  },
  // Lanternowl — nocturnal trail guide with a warm bioluminescent chest
  lanternowl: (ctx, f) => {
    const b = [0, -1, 0, 1][f], wing = [0, 2, 0, -1][f];
    shadow(ctx, 20, 34, 10);
    const feather = "#4d536e", dark = "#2e3047", glow = "#f5d879", rim = "#8b86b5";
    E(ctx, 20, 23 + b, 10, 10, feather); E(ctx, 20, 26 + b, 6, 6, glow); E(ctx, 20, 25 + b, 3.5, 4, "#fff1aa");
    ctx.fillStyle = rim; ctx.beginPath(); ctx.moveTo(12, 17 + b); ctx.lineTo(12, 9 + b); ctx.lineTo(17, 15 + b); ctx.fill();
    ctx.beginPath(); ctx.moveTo(28, 17 + b); ctx.lineTo(28, 9 + b); ctx.lineTo(23, 15 + b); ctx.fill();
    E(ctx, 16, 18 + b, 4, 4, "#d8d7ef"); E(ctx, 24, 18 + b, 4, 4, "#d8d7ef");
    if (f === 3) { P(ctx, 14, 18 + b, 4, 1, dark); P(ctx, 22, 18 + b, 4, 1, dark); }
    else { P(ctx, 15, 17 + b, 2, 3, dark); P(ctx, 23, 17 + b, 2, 3, dark); P(ctx, 15, 17 + b, 1, 1, "#fff"); P(ctx, 23, 17 + b, 1, 1, "#fff"); }
    ctx.fillStyle = "#d79a58"; ctx.beginPath(); ctx.moveTo(18, 21 + b); ctx.lineTo(22, 21 + b); ctx.lineTo(20, 24 + b); ctx.closePath(); ctx.fill();
    E(ctx, 10 - wing, 24 + b, 4, 7, dark); E(ctx, 30 + wing, 24 + b, 4, 7, dark);
    P(ctx, 15, 32 + b, 4, 2, dark); P(ctx, 22, 32 + b, 4, 2, dark);
  },
};

const cache = {};   // id -> [frame canvases]
export const MON_IDS = Object.keys(SPECIES);
export const STARTER_MOUNT_ID = "puffalo";
export const MON_META = Object.freeze({
  sparring_dummy: {
    name: "Sparring Dummy", element: "rock", habitat: "ruins", role: "training post", rarity: "common",
    petScale: 0.9, mountable: false, mountScale: 1, mountSpeed: 1,
    description: "A straw-and-wood practice post used to warm up in the Crimson Duel Court."
  },
  leaflet: {
    name: "Leaflet", element: "grass", habitat: "meadow", role: "seed tender", rarity: "common",
    petScale: 0.82, mountable: false, mountScale: 1, mountSpeed: 1,
    description: "A sunny sprout that pats loose seeds back into the soil."
  },
  emberkit: {
    name: "Emberkit", element: "fire", habitat: "forest", role: "hearth keeper", rarity: "uncommon",
    petScale: 0.84, mountable: false, mountScale: 1, mountSpeed: 1,
    description: "Its warm tail relights cold campfires without scorching the moss."
  },
  aquab: {
    name: "Aquab", element: "water", habitat: "coast", role: "rain caller", rarity: "common",
    petScale: 0.82, mountable: false, mountScale: 1, mountSpeed: 1,
    description: "A cheerful droplet that keeps shallow pools fresh after low tide."
  },
  pebbit: {
    name: "Pebbit", element: "rock", habitat: "highland", role: "trail mason", rarity: "common",
    petScale: 0.86, mountable: false, mountScale: 1, mountSpeed: 1,
    description: "It nudges loose stones into tiny stepping paths before every rain."
  },
  sparkit: {
    name: "Sparkit", element: "electric", habitat: "meadow", role: "storm scout", rarity: "uncommon",
    petScale: 0.82, mountable: false, mountScale: 1, mountSpeed: 1,
    description: "Its bright cheeks crackle whenever summer clouds approach."
  },
  mothwing: {
    name: "Mothwing", element: "bug", habitat: "night", role: "moon pollinator", rarity: "uncommon",
    petScale: 0.84, mountable: false, mountScale: 1, mountSpeed: 1,
    description: "Soft wings carry silver pollen between flowers that bloom at dusk."
  },
  sludgel: {
    name: "Sludgel", element: "grass", habitat: "marsh", role: "composter", rarity: "uncommon",
    petScale: 0.86, mountable: false, mountScale: 1, mountSpeed: 1,
    description: "A tidy marsh jelly that turns fallen leaves into rich black soil."
  },
  cindar: {
    name: "Cindar", element: "fire", habitat: "night", role: "mist burner", rarity: "rare",
    petScale: 0.86, mountable: false, mountScale: 1, mountSpeed: 1,
    description: "Its cool blue flame clears heavy fog from mountain crossings."
  },
  frostl: {
    name: "Frostl", element: "ice", habitat: "snow", role: "snow sculptor", rarity: "uncommon",
    petScale: 0.84, mountable: false, mountScale: 1, mountSpeed: 1,
    description: "A crystal sprite that packs powder into safe little snow bridges."
  },
  shadown: {
    name: "Shadown", element: "dark", habitat: "night", role: "dream watcher", rarity: "rare",
    petScale: 0.88, mountable: false, mountScale: 1, mountSpeed: 1,
    description: "A quiet wisp that circles sleeping camps and catches bad dreams."
  },
  volth: {
    name: "Volth", element: "electric", habitat: "meadow", role: "wind chime", rarity: "rare",
    petScale: 0.82, mountable: false, mountScale: 1, mountSpeed: 1,
    description: "Static rings from its round body make old meadow bells sing."
  },
  crysto: {
    name: "Crysto", element: "rock", habitat: "highland", role: "ore finder", rarity: "rare",
    petScale: 0.9, mountable: false, mountScale: 1, mountSpeed: 1,
    description: "Its forehead gem glows beside stone that can be safely quarried."
  },
  florix: {
    name: "Florix", element: "grass", habitat: "meadow", role: "bloom keeper", rarity: "rare",
    petScale: 0.82, mountable: false, mountScale: 1, mountSpeed: 1,
    description: "A tiny flower keeper whose dance wakes fields after winter."
  },
  wraithix: {
    name: "Wraithix", element: "dark", habitat: "ruins", role: "relic sentinel", rarity: "epic",
    petScale: 0.9, mountable: false, mountScale: 1, mountSpeed: 1,
    description: "A pocket-sized old sentinel that still salutes forgotten doorways."
  },
  pinepup: {
    name: "Pinepup", element: "grass", habitat: "forest", role: "seed carrier", rarity: "common",
    petScale: 0.84, mountable: false, mountScale: 1, mountSpeed: 1,
    description: "Pine scales shelter new seeds until this curious pup finds soft earth."
  },
  bramblebuck: {
    name: "Bramblebuck", element: "grass", habitat: "forest", role: "grove pathfinder", rarity: "rare",
    petScale: 0.92, mountable: true, mountScale: 1.3, mountSpeed: 1.16,
    description: "A broad, gentle forest mount whose vine antlers point toward clear trails."
  },
  puffalo: {
    name: "Puffalo", element: "wind", habitat: "meadow", role: "caravan grazer", rarity: "uncommon",
    petScale: 0.94, mountable: true, mountScale: 1.28, mountSpeed: 1.1,
    description: "Warm cloud-wool and patient steps make it a favorite meadow caravan mount."
  },
  reedstrider: {
    name: "Reedstrider", element: "wind", habitat: "meadow", role: "grassland runner", rarity: "rare",
    petScale: 0.94, mountable: true, mountScale: 1.32, mountSpeed: 1.3,
    description: "Long feet skim over tall grass while its crest reads the changing wind."
  },
  tideback: {
    name: "Tideback", element: "water", habitat: "coast", role: "reef ferry", rarity: "rare",
    petScale: 0.96, mountable: true, mountScale: 1.34, mountSpeed: 1.18,
    description: "A living island ferry that carries friends safely through coastal shallows."
  },
  shellip: {
    name: "Shellip", element: "water", habitat: "coast", role: "tideline sorter", rarity: "common",
    petScale: 0.82, mountable: false, mountScale: 1, mountSpeed: 1,
    description: "Busy claws stack shells by color whenever the tide rolls out."
  },
  glimmerfin: {
    name: "Glimmerfin", element: "water", habitat: "coast", role: "pool cleaner", rarity: "uncommon",
    petScale: 0.84, mountable: false, mountScale: 1, mountSpeed: 1,
    description: "It floats above moonlit pools and filters glittering sand from the water."
  },
  snowmuff: {
    name: "Snowmuff", element: "ice", habitat: "snow", role: "winter hauler", rarity: "rare",
    petScale: 0.96, mountable: true, mountScale: 1.36, mountSpeed: 1.12,
    description: "A massive warm-coated mount that calmly hauls supplies through deep snow."
  },
  aurorabbit: {
    name: "Aurorabbit", element: "ice", habitat: "snow", role: "weather scout", rarity: "uncommon",
    petScale: 0.82, mountable: false, mountScale: 1, mountSpeed: 1,
    description: "Its ribbon ears change color before an aurora or sudden snow squall."
  },
  duskstag: {
    name: "Duskstag", element: "dark", habitat: "night", role: "starlight guide", rarity: "epic",
    petScale: 0.94, mountable: true, mountScale: 1.34, mountSpeed: 1.24,
    description: "A serene night mount whose crescent antlers guide travelers between clearings."
  },
  lanternowl: {
    name: "Lanternowl", element: "light", habitat: "night", role: "trail guide", rarity: "uncommon",
    petScale: 0.84, mountable: false, mountScale: 1, mountSpeed: 1,
    description: "Its warm glowing chest marks safe trail turns after sunset."
  }
});

export const MON_ELEMENT = Object.freeze(Object.fromEntries(
  MON_IDS.map(id => [id, MON_META[id].element])
));

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
