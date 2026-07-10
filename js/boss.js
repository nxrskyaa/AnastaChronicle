// World boss: a code-generated glowing dragon (Charizard-inspired silhouette:
// orange body, cream belly, big membrane wings, horns, flaming tail).
// Rendered to animation frames with a pulsing glow. No external art.
const W = 96, H = 96;
function C() { const cv = document.createElement("canvas"); cv.width = W; cv.height = H; return cv; }
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.min(255, Math.round(r * f)); g = Math.min(255, Math.round(g * f)); b = Math.min(255, Math.round(b * f));
  return `rgb(${r},${g},${b})`;
}
function E(ctx, cx, cy, rx, ry, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 7); ctx.fill(); }

// draw dragon facing 'down' (toward camera), frame f (0..3) animates wings + tail flame
function drawDragon(ctx, f, rage) {
  const body = rage ? "#ff5a2a" : "#f0742a";
  const bodyD = shade(body, 0.72), bodyL = shade(body, 1.2);
  const belly = "#ffd9a0", wing = rage ? "#c03a20" : "#a8502a", wingMem = rage ? "#ff8a4a" : "#e08040";
  const cx = W / 2;
  const wingBeat = [0, -6, 0, -6][f];      // wings flap up
  const tailFlick = [0, 2, 4, 2][f];
  const glowPulse = 0.55 + 0.45 * Math.sin(f / 4 * Math.PI * 2);

  // ---- outer glow aura ----
  const g = ctx.createRadialGradient(cx, 52, 8, cx, 52, 54);
  g.addColorStop(0, `rgba(255,150,60,${0.30 * glowPulse})`);
  g.addColorStop(1, "rgba(255,120,40,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // ground shadow
  ctx.fillStyle = "rgba(20,14,10,0.35)"; ctx.beginPath(); ctx.ellipse(cx, 84, 26, 6, 0, 0, 7); ctx.fill();

  // ---- WINGS (behind body) — large membraned bat-wings ----
  for (const side of [-1, 1]) {
    const sx = cx + side * 10;
    // wing bones
    ctx.strokeStyle = shade(wing, 0.8); ctx.lineWidth = 2.5; ctx.lineCap = "round";
    const tipX = sx + side * 34, tipY = 20 + wingBeat;
    const midX = sx + side * 30, midY = 44 + wingBeat;
    const botX = sx + side * 20, botY = 60 + wingBeat * 0.5;
    // membrane (filled, scalloped bottom edge)
    ctx.fillStyle = wingMem;
    ctx.beginPath();
    ctx.moveTo(sx, 40);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(midX, midY);
    ctx.lineTo(botX, botY);
    // scalloped inner edge back to shoulder
    ctx.quadraticCurveTo(sx + side * 8, 52, sx, 42);
    ctx.closePath(); ctx.fill();
    // darker membrane shading (lower half)
    ctx.fillStyle = wing;
    ctx.beginPath(); ctx.moveTo(sx, 42); ctx.lineTo(midX, midY); ctx.lineTo(botX, botY); ctx.quadraticCurveTo(sx + side * 8, 52, sx, 44); ctx.closePath(); ctx.fill();
    // finger bones over membrane
    ctx.beginPath(); ctx.moveTo(sx, 40); ctx.lineTo(tipX, tipY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx + side * 3, 42); ctx.lineTo(midX, midY); ctx.stroke();
    // wing claw at tip
    ctx.fillStyle = "#e8e0d0"; E(ctx, tipX, tipY, 2, 2.4, "#e8e0d0");
  }

  // ---- TAIL with flame (sweeps out to the right, flame at the far tip) ----
  ctx.strokeStyle = body; ctx.lineWidth = 8; ctx.lineCap = "round";
  const tipTx = cx + 42 + tailFlick, tipTy = 50 - tailFlick;
  ctx.beginPath(); ctx.moveTo(cx + 8, 68); ctx.quadraticCurveTo(cx + 34, 72, tipTx, tipTy); ctx.stroke();
  // taper the tail tip
  ctx.fillStyle = body; E(ctx, tipTx, tipTy, 3, 3, body);
  // big flame clearly at the tail tip; scales up in rage
  const fs = rage ? 1.7 : 1.05;
  E(ctx, tipTx, tipTy - 6 * fs, 6 * fs, 11 * fs, "#ff7a2a");
  E(ctx, tipTx, tipTy - 8 * fs, 4 * fs, 8 * fs, "#ffb43a");
  E(ctx, tipTx, tipTy - 11 * fs, 2.4 * fs, 5 * fs, "#ffe89a");
  P(ctx, tipTx - 1, tipTy - 17 * fs, 2, 3, "#fff8d0");
  function P(c, x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); }

  // ---- BODY ----
  E(ctx, cx, 56, 18, 22, body);
  E(ctx, cx, 60, 11, 15, belly);          // belly
  // body shading
  ctx.fillStyle = bodyD; ctx.beginPath(); ctx.ellipse(cx - 10, 56, 7, 18, 0.3, 0, 7); ctx.fill();

  // ---- LEGS ----
  ctx.fillStyle = bodyD;
  E(ctx, cx - 10, 78, 6, 8, body); E(ctx, cx + 10, 78, 6, 8, body);
  ctx.fillStyle = "#e8e0d0";  // claws
  for (const lx of [cx - 13, cx - 9, cx - 5]) ctx.fillRect(lx, 83, 1.5, 3);
  for (const lx of [cx + 5, cx + 9, cx + 13]) ctx.fillRect(lx, 83, 1.5, 3);

  // ---- ARMS ----
  ctx.fillStyle = body; E(ctx, cx - 16, 54, 4, 8, body); E(ctx, cx + 16, 54, 4, 8, body);

  // ---- NECK + HEAD ---- (angular, angrier)
  ctx.fillStyle = body; ctx.fillRect(cx - 6, 34, 12, 12);
  E(ctx, cx, 30, 13, 12, body);           // head
  // elongated angry snout
  ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(cx - 9, 32); ctx.lineTo(cx - 4, 40); ctx.lineTo(cx + 4, 40); ctx.lineTo(cx + 9, 32); ctx.closePath(); ctx.fill();
  E(ctx, cx, 34, 8, 5, bodyL);            // snout highlight
  // brow ridges (angry angle)
  ctx.strokeStyle = bodyD; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx - 9, 25); ctx.lineTo(cx - 2, 28); ctx.moveTo(cx + 9, 25); ctx.lineTo(cx + 2, 28); ctx.stroke();
  // horns (swept back)
  ctx.fillStyle = "#e8e0d0";
  ctx.beginPath(); ctx.moveTo(cx - 7, 20); ctx.lineTo(cx - 14, 6); ctx.lineTo(cx - 3, 17); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx + 7, 20); ctx.lineTo(cx + 14, 6); ctx.lineTo(cx + 3, 17); ctx.closePath(); ctx.fill();
  // GLOWING eyes — pulse & intensify in rage
  const eyeGlow = rage ? glowPulse : glowPulse * 0.5;
  const eyeCol = rage ? "#fff0a0" : "#ffd24a";
  for (const side of [-1, 1]) {
    const ex = cx + side * 5;
    // glow halo
    ctx.fillStyle = `rgba(255,${rage ? 120 : 200},40,${0.5 * eyeGlow})`;
    ctx.beginPath(); ctx.arc(ex, 28, rage ? 4 : 3, 0, 7); ctx.fill();
    // angry slit eye
    ctx.fillStyle = eyeCol; ctx.beginPath(); ctx.ellipse(ex, 28, 2.6, 1.8, side * 0.4, 0, 7); ctx.fill();
    ctx.fillStyle = "#a02000"; ctx.fillRect(ex - 0.5, 27, 1, 2.5);
  }
  // nostrils + smoke
  ctx.fillStyle = "#5a1808"; ctx.fillRect(cx - 3, 37, 1.5, 1.5); ctx.fillRect(cx + 2, 37, 1.5, 1.5);

  // rage aura extra embers
  if (rage) {
    ctx.fillStyle = `rgba(255,180,80,${0.6 * glowPulse})`;
    for (let i = 0; i < 4; i++) { const a = (f + i) * 1.7; E(ctx, cx + Math.cos(a) * 30, 52 + Math.sin(a) * 26, 2, 2, "#ffd24a"); }
  }
}

const cache = { normal: [], rage: [] };
export function buildBoss() {
  cache.normal = []; cache.rage = [];
  for (let f = 0; f < 4; f++) {
    const cv = C(); const ctx = cv.getContext("2d"); ctx.imageSmoothingEnabled = false; drawDragon(ctx, f, false); cache.normal.push(cv);
    const cv2 = C(); const ctx2 = cv2.getContext("2d"); ctx2.imageSmoothingEnabled = false; drawDragon(ctx2, f, true); cache.rage.push(cv2);
  }
  return cache;
}
export function bossFrame(f, rage) { const arr = rage ? cache.rage : cache.normal; return arr.length ? arr[f % 4] : null; }
export const BOSS_SIZE = W;
