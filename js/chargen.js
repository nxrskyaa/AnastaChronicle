// Runtime character generator: draws player from parametric parts into cached canvases.
// Enables customization (skin/hair/shirt/pants/boots/hairstyle) + smooth weapon swing.

const DIRS = ["down", "up", "left", "right"];
const CW = 32, CH = 40;

export const PRESETS = {
  skin:  ["#ffe0c0", "#ffd6b4", "#f0b892", "#d89b6e", "#c98a63", "#a86b45", "#8d5a3c", "#6b4228", "#4e2f1e"],
  hair:  ["#2b2b2f", "#4a3225", "#5c3a2e", "#8a5a34", "#caa24a", "#e8d27a", "#b5432f", "#d0603a", "#7a5a86", "#4a6ea0", "#3a8a6a", "#d7d2c8", "#f0f0f0"],
  eyes:  ["#3a2a1e", "#2a4a6a", "#2a6a4a", "#6a2a2a", "#4a2a6a", "#1a1a1a"],
  shirt: ["#4a9678", "#3d6fa8", "#b0503f", "#8557a8", "#c9a23e", "#2f2f38", "#d8683f", "#2b8a7a", "#a03a5a", "#e0e0e8"],
  pants: ["#42486a", "#5a3f2e", "#37503a", "#6a2f3a", "#2c2c34", "#7a6a4a", "#3a3a48", "#5a2a3a"],
  boots: ["#5c3c2c", "#3a3a42", "#7a5230", "#2a2a30", "#8a6a3a"],
};
export const HAIRSTYLES = ["short", "spiky", "long", "mohawk", "bald", "ponytail"];

export const DEFAULT_LOOK = {
  name: "Anasta",
  skin: PRESETS.skin[1],
  hair: PRESETS.hair[2],
  eyes: PRESETS.eyes[0],
  shirt: PRESETS.shirt[0],
  pants: PRESETS.pants[0],
  boots: PRESETS.boots[0],
  style: "short",
};

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.max(0, Math.min(255, Math.round(r * f)));
  g = Math.max(0, Math.min(255, Math.round(g * f)));
  b = Math.max(0, Math.min(255, Math.round(b * f)));
  return `rgb(${r},${g},${b})`;
}

function px(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }

// Draw one body frame. phase: walk bob index; atk: 0..1 swing progress (or null)
// Top-down 3/4 RPG proportions: distinct head, shouldered torso, two legs.
function drawBody(ctx, look, dir, frame, atkPhase) {
  const O = "#211d26";
  const sk = look.skin, sk2 = shade(look.skin, 0.86), sk3 = shade(look.skin, 0.72);
  const hr = look.hair, hr2 = shade(look.hair, 1.22), hr3 = shade(look.hair, 0.72);
  const sh = look.shirt, sh2 = shade(look.shirt, 0.8), sh3 = shade(look.shirt, 0.64);
  const pn = look.pants, pn2 = shade(look.pants, 0.78), pn3 = shade(look.pants, 0.62);
  const bt = look.boots, bt2 = shade(look.boots, 0.72);
  const eyeCol = look.eyes || "#26222a";
  const st = look.style;

  const walking = atkPhase == null;
  const bob = walking ? [0, -1, 0, -1][frame % 4] : 0;      // subtle vertical bob
  const step = walking ? [0, 1, 0, -1][frame % 4] : 0;       // leg stride
  const by = bob;
  const cx = 16;

  // ground shadow
  ctx.fillStyle = "rgba(18,16,20,0.30)";
  ctx.beginPath(); ctx.ellipse(cx, 37, 7, 2.2, 0, 0, 7); ctx.fill();

  // ================= LEGS (distinct, with stride) =================
  const legTop = 27 + by, legLen = 7;
  if (dir === "left" || dir === "right") {
    const front = dir === "right" ? step : -step;
    const back = -front;
    // back leg
    px(ctx, cx - 2, legTop, 3, legLen + back, pn2);
    px(ctx, cx - 3, legTop + legLen + back, 5, 2, bt2);
    // front leg
    px(ctx, cx - 1, legTop, 3, legLen + front, pn);
    px(ctx, cx - 2, legTop + legLen + front, 5, 2, bt);
  } else {
    const lOff = step, rOff = -step;
    // left leg
    px(ctx, cx - 4, legTop, 3, legLen + Math.max(0, lOff), pn);
    px(ctx, cx - 4, legTop, 3, 2, pn2);
    px(ctx, cx - 5, legTop + legLen + Math.max(0, lOff), 5, 2, bt);
    px(ctx, cx - 5, legTop + legLen + 1 + Math.max(0, lOff), 5, 1, bt2);
    // right leg
    px(ctx, cx + 1, legTop, 3, legLen + Math.max(0, rOff), pn);
    px(ctx, cx + 1, legTop, 3, 2, pn2);
    px(ctx, cx, legTop + legLen + Math.max(0, rOff), 5, 2, bt);
    px(ctx, cx, legTop + legLen + 1 + Math.max(0, rOff), 5, 1, bt2);
  }

  // ================= TORSO (trapezoid, shoulders wider than waist) =========
  const tTop = 16 + by, tBot = 27 + by;
  // shirt body as a shouldered trapezoid, NOT a circle
  ctx.fillStyle = sh;
  ctx.beginPath();
  ctx.moveTo(cx - 6, tTop + 1);     // left shoulder
  ctx.lineTo(cx + 6, tTop + 1);     // right shoulder
  ctx.lineTo(cx + 4, tBot);         // right waist
  ctx.lineTo(cx - 4, tBot);         // left waist
  ctx.closePath(); ctx.fill();
  // shading down the left side + center highlight
  ctx.fillStyle = sh2;
  ctx.beginPath(); ctx.moveTo(cx - 6, tTop + 1); ctx.lineTo(cx - 2, tTop + 1); ctx.lineTo(cx - 1, tBot); ctx.lineTo(cx - 4, tBot); ctx.closePath(); ctx.fill();
  ctx.fillStyle = sh3;
  px(ctx, cx - 6, tTop + 1, 12, 1, sh3);      // collar line shade
  // belt
  px(ctx, cx - 4, tBot - 1, 8, 2, pn3);
  px(ctx, cx - 1, tBot - 1, 2, 2, shade(look.boots, 1.1)); // buckle

  // ================= ARMS (at the sides, swing while walking) ==============
  const armSw = walking ? [0, 1, 0, -1][frame % 4] : 0;
  if (dir === "down" || dir === "up") {
    // left arm
    px(ctx, cx - 8, tTop + 1 + armSw, 2, 8, sh2);
    if (dir === "down") px(ctx, cx - 8, tTop + 8 + armSw, 2, 2, sk);
    // right arm
    px(ctx, cx + 6, tTop + 1 - armSw, 2, 8, sh2);
    if (dir === "down") px(ctx, cx + 6, tTop + 8 - armSw, 2, 2, sk);
  } else if (dir === "left") {
    px(ctx, cx - 5, tTop + 2 + armSw, 2, 8, sh2);
    px(ctx, cx - 5, tTop + 9 + armSw, 2, 2, sk);
  } else {
    px(ctx, cx + 3, tTop + 2 - armSw, 2, 8, sh2);
    px(ctx, cx + 3, tTop + 9 - armSw, 2, 2, sk);
  }

  // ================= HEAD (defined, slightly large but not a blob) =========
  const hy = 10 + by;
  // neck
  px(ctx, cx - 1, tTop - 2, 2, 3, sk2);
  // head shape: rounded square, taller than wide feels more human
  ctx.fillStyle = sk;
  roundRect(ctx, cx - 5, hy - 5, 10, 11, 3); ctx.fill();
  // cheek shading (right side away from light)
  ctx.fillStyle = sk2; roundRect(ctx, cx + 1, hy - 3, 4, 8, 2); ctx.fill();
  ctx.fillStyle = sk3; px(ctx, cx - 5, hy + 4, 10, 1, sk3); // jaw shade

  // ---- hair by style ----
  if (st !== "bald") {
    if (dir === "up") {
      // back of head fully covered
      ctx.fillStyle = hr; roundRect(ctx, cx - 5, hy - 6, 10, 9, 3); ctx.fill();
      ctx.fillStyle = hr2; px(ctx, cx - 5, hy - 6, 10, 2, hr2);
      if (st === "long") { px(ctx, cx - 5, hy, 2, 10, hr); px(ctx, cx + 3, hy, 2, 10, hr); }
      if (st === "ponytail") { px(ctx, cx - 1, hy + 3, 2, 8, hr); px(ctx, cx - 1, hy + 9, 2, 2, hr2); }
      if (st === "mohawk") { px(ctx, cx - 1, hy - 7, 2, 8, hr2); }
    } else {
      // top + sides fringe
      ctx.fillStyle = hr; roundRect(ctx, cx - 6, hy - 6, 12, 6, 3); ctx.fill();
      px(ctx, cx - 6, hy - 2, 2, 4, hr);      // left sideburn
      px(ctx, cx + 4, hy - 2, 2, 4, hr);      // right sideburn
      ctx.fillStyle = hr2; px(ctx, cx - 5, hy - 6, 10, 2, hr2);  // top highlight
      // fringe strands over forehead
      ctx.fillStyle = hr3;
      for (let x = cx - 4; x < cx + 5; x += 2) px(ctx, x, hy - 1, 1, 2, hr3);
      if (st === "spiky") { for (let i = 0; i < 5; i++) { px(ctx, cx - 5 + i * 2.4, hy - 9, 2, 4, hr); px(ctx, cx - 5 + i * 2.4, hy - 9, 1, 2, hr2); } }
      if (st === "mohawk") { px(ctx, cx - 1, hy - 10, 3, 6, hr); px(ctx, cx - 1, hy - 10, 3, 2, hr2); }
      if (st === "long") { px(ctx, cx - 7, hy - 2, 2, 12, hr); px(ctx, cx + 5, hy - 2, 2, 12, hr); px(ctx, cx - 7, hy + 8, 2, 2, hr3); px(ctx, cx + 5, hy + 8, 2, 2, hr3); }
      if (st === "ponytail") { px(ctx, cx + 5, hy - 3, 3, 3, hr); px(ctx, cx + 6, hy, 2, 8, hr); }
    }
  }

  // ---- face ----
  if (dir === "down") {
    px(ctx, cx - 3, hy + 1, 2, 2, "#fff"); px(ctx, cx + 1, hy + 1, 2, 2, "#fff");
    px(ctx, cx - 3, hy + 1, 1, 2, eyeCol); px(ctx, cx + 2, hy + 1, 1, 2, eyeCol);
    px(ctx, cx - 4, hy + 3, 1, 1, "#e89aa0"); px(ctx, cx + 3, hy + 3, 1, 1, "#e89aa0"); // cheeks
    px(ctx, cx - 1, hy + 4, 2, 1, sk3);      // mouth
  } else if (dir === "left") {
    px(ctx, cx - 4, hy + 1, 2, 2, "#fff"); px(ctx, cx - 4, hy + 1, 1, 2, eyeCol);
    px(ctx, cx - 5, hy + 3, 1, 1, "#e89aa0");
  } else if (dir === "right") {
    px(ctx, cx + 2, hy + 1, 2, 2, "#fff"); px(ctx, cx + 3, hy + 1, 1, 2, eyeCol);
    px(ctx, cx + 4, hy + 3, 1, 1, "#e89aa0");
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// weapon overlay drawn relative to hand, animated by atkPhase (0..1)
function drawWeapon(ctx, weapon, dir, atkPhase) {
  if (weapon === "fist") return;
  let hx, hy, baseAng;
  if (dir === "down") { hx = 24; hy = 22; baseAng = Math.PI * 0.5; }
  else if (dir === "up") { hx = 9; hy = 20; baseAng = -Math.PI * 0.5; }
  else if (dir === "left") { hx = 9; hy = 22; baseAng = Math.PI; }
  else { hx = 23; hy = 22; baseAng = 0; }
  const sweep = atkPhase != null ? (-1.0 + 2.0 * atkPhase) : -0.55;
  const ang = baseAng + sweep;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(ang);
  const O = "#2a2630";

  if (weapon === "sword") {
    // crossguard sword
    ctx.fillStyle = "#8a5a34"; ctx.fillRect(-1.5, 0, 3, 5);       // grip
    ctx.fillStyle = "#e8c96a"; ctx.fillRect(-1.5, 4, 3, 2);        // pommel
    ctx.fillStyle = "#c9a23e"; ctx.fillRect(-4, -1, 8, 2);         // crossguard
    ctx.fillStyle = "#dfe4ee"; ctx.fillRect(-2, -16, 4, 15);       // blade
    ctx.fillStyle = "#f4f8ff"; ctx.fillRect(-2, -16, 1.5, 15);     // edge highlight
    ctx.fillStyle = "#aab0c0"; ctx.beginPath(); ctx.moveTo(-2, -16); ctx.lineTo(2, -16); ctx.lineTo(0, -19); ctx.fill(); // tip
  } else if (weapon === "axe") {
    ctx.fillStyle = "#6a4324"; ctx.fillRect(-1.5, -14, 3, 20);     // handle
    ctx.fillStyle = "#c9cdd8"; ctx.beginPath();                    // head
    ctx.moveTo(1, -14); ctx.quadraticCurveTo(11, -13, 9, -4); ctx.lineTo(1, -6); ctx.fill();
    ctx.fillStyle = "#9aa0ae"; ctx.beginPath(); ctx.moveTo(1, -12); ctx.quadraticCurveTo(8, -11, 7, -6); ctx.lineTo(1, -7); ctx.fill();
  } else if (weapon === "spear") {
    ctx.fillStyle = "#7a5228"; ctx.fillRect(-1, -20, 2, 26);       // shaft
    ctx.fillStyle = "#dfe4ee"; ctx.beginPath();                    // head
    ctx.moveTo(0, -26); ctx.lineTo(-3, -19); ctx.lineTo(3, -19); ctx.fill();
    ctx.fillStyle = "#c9a23e"; ctx.fillRect(-2, -19, 4, 2);
  } else if (weapon === "dagger") {
    ctx.fillStyle = "#8a5a34"; ctx.fillRect(-1.5, 0, 3, 4);
    ctx.fillStyle = "#c9a23e"; ctx.fillRect(-3, -1, 6, 1.5);
    ctx.fillStyle = "#e2e6f0"; ctx.beginPath(); ctx.moveTo(-2, -1); ctx.lineTo(2, -1); ctx.lineTo(0, -10); ctx.fill();
  } else if (weapon === "bow") {
    ctx.strokeStyle = "#8a5a2e"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 12, -1.1, 1.1); ctx.stroke();   // bow curve
    ctx.strokeStyle = "#e8e2d0"; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(Math.cos(-1.1) * 12, Math.sin(-1.1) * 12); ctx.lineTo(Math.cos(1.1) * 12, Math.sin(1.1) * 12); ctx.stroke();
    if (atkPhase != null && atkPhase < 0.6) { ctx.fillStyle = "#7a5228"; ctx.fillRect(-1, -1, 12, 2); ctx.fillStyle = "#dfe4ee"; ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(8, -2); ctx.lineTo(8, 2); ctx.fill(); }
  }
  ctx.restore();

  if (atkPhase != null && atkPhase > 0.12 && atkPhase < 0.88 && weapon !== "bow") {
    ctx.save(); ctx.globalAlpha = 0.4;
    ctx.strokeStyle = "#eaf2ff"; ctx.lineWidth = 2.5;
    const reach = weapon === "spear" ? 22 : weapon === "dagger" ? 10 : 16;
    ctx.beginPath(); ctx.arc(hx, hy, reach, baseAng - 1.0, ang); ctx.stroke();
    ctx.restore();
  }
}

// Build a cache of canvases for a given look. Returns { walk:{dir:[canvas..]}, atk:{dir:[canvas..]} }
export function buildCharacter(look) {
  const cache = { walk: {}, atk: {}, weaponWalk: {}, weaponAtk: {} };
  for (const dir of DIRS) {
    cache.walk[dir] = [];
    for (let f = 0; f < 4; f++) {
      const cv = document.createElement("canvas"); cv.width = CW; cv.height = CH;
      const c = cv.getContext("2d"); c.imageSmoothingEnabled = false;
      drawBody(c, look, dir, f, null);
      cache.walk[dir].push(cv);
    }
    // attack: 5 frames of swing
    cache.atk[dir] = [];
    for (let s = 0; s < 5; s++) {
      const cv = document.createElement("canvas"); cv.width = CW; cv.height = CH;
      const c = cv.getContext("2d"); c.imageSmoothingEnabled = false;
      const phase = s / 4;
      drawBody(c, look, dir, 0, phase);
      cache.atk[dir].push(cv);
    }
  }
  cache.look = look;
  return cache;
}

// weapon frames layered on top depending on equipped item (built lazily)
export function buildWeapon(weapon) {
  const out = { walk: {}, atk: {} };
  for (const dir of DIRS) {
    out.walk[dir] = document.createElement("canvas");
    out.walk[dir].width = CW; out.walk[dir].height = CH;
    const wc = out.walk[dir].getContext("2d"); wc.imageSmoothingEnabled = false;
    drawWeapon(wc, weapon, dir, null);
    out.atk[dir] = [];
    for (let s = 0; s < 5; s++) {
      const cv = document.createElement("canvas"); cv.width = CW; cv.height = CH;
      const c = cv.getContext("2d"); c.imageSmoothingEnabled = false;
      drawWeapon(c, weapon, dir, s / 4);
      out.atk[dir].push(cv);
    }
  }
  return out;
}
