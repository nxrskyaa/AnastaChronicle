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
  accent: ["#e8c96a", "#6ee0b0", "#65b8e8", "#a87ae0", "#e06055", "#e887bd", "#f09b4e", "#d7e2ea"],
};
export const HAIRSTYLES = ["short", "spiky", "long", "mohawk", "bald", "ponytail", "bob", "braids", "undercut", "samurai", "waves", "twintails"];
export const FACE_MARKS = ["none", "scar", "freckles", "warpaint", "rune", "blossom"];
export const ACCESSORIES = ["none", "headband", "leafpin", "earring", "foxmask", "horns", "crown", "ribbon"];
export const OUTFITS = ["wanderer", "vanguard", "mythic"];
export const AURAS = ["none", "ember", "arcane", "verdant", "frost", "void"];

export const DEFAULT_LOOK = {
  name: "Anasta",
  gender: "male",
  cls: "warrior",
  skin: PRESETS.skin[1],
  hair: PRESETS.hair[2],
  eyes: PRESETS.eyes[0],
  shirt: PRESETS.shirt[0],
  pants: PRESETS.pants[0],
  boots: PRESETS.boots[0],
  style: "short",
  mark: "none",
  accessory: "none",
  outfit: "wanderer",
  accent: PRESETS.accent[0],
  aura: "none",
};

export function normalizeLook(value = {}) {
  const input = value && typeof value === "object" ? value : {};
  const look = { ...DEFAULT_LOOK, ...input };
  if (!HAIRSTYLES.includes(look.style)) look.style = DEFAULT_LOOK.style;
  if (!FACE_MARKS.includes(look.mark)) look.mark = DEFAULT_LOOK.mark;
  if (!ACCESSORIES.includes(look.accessory)) look.accessory = DEFAULT_LOOK.accessory;
  if (!OUTFITS.includes(look.outfit)) look.outfit = DEFAULT_LOOK.outfit;
  if (!AURAS.includes(look.aura)) look.aura = DEFAULT_LOOK.aura;
  if (!/^#[0-9a-f]{6}$/i.test(look.accent || "")) look.accent = DEFAULT_LOOK.accent;
  return look;
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.max(0, Math.min(255, Math.round(r * f)));
  g = Math.max(0, Math.min(255, Math.round(g * f)));
  b = Math.max(0, Math.min(255, Math.round(b * f)));
  return `rgb(${r},${g},${b})`;
}

function px(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }

function pixelLine(ctx, x0, y0, x1, y1, color, size = 1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  while (true) {
    px(ctx, x0, y0, size, size, color);
    if (x0 === x1 && y0 === y1) break;
    const e2 = err * 2;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

// Class gear keeps its silhouette, while accent and outfit make the same class
// read as a genuinely different traveler instead of a recolored base sprite.
function drawClassBack(ctx, look, dir, cx, by, frame = 0) {
  const cls = look.cls || "warrior";
  const outfit = look.outfit || "wanderer";
  const accent = look.accent || DEFAULT_LOOK.accent;
  const deep = shade(accent, 0.36), mid = shade(accent, 0.62), hi = shade(accent, 1.18);
  const sway = [-1, 0, 1, 0][frame % 4];

  if (cls === "mage") {
    const hem = outfit === "mythic" ? 35 : 32;
    if (dir === "left") {
      px(ctx, cx + 1, 18 + by, 6, hem - 18, deep); px(ctx, cx + 4, 20 + by, 4, hem - 20, mid);
      px(ctx, cx + 6, hem - 3 + by + sway, 2, 3, accent);
    } else if (dir === "right") {
      px(ctx, cx - 7, 18 + by, 6, hem - 18, deep); px(ctx, cx - 8, 20 + by, 4, hem - 20, mid);
      px(ctx, cx - 8, hem - 3 + by - sway, 2, 3, accent);
    } else {
      px(ctx, cx - 7, 18 + by, 14, hem - 18, deep);
      px(ctx, cx - 6, 20 + by, 12, hem - 19, mid);
      px(ctx, cx - 6, hem - 1 + by + sway, 3, 2, accent); px(ctx, cx + 3, hem - 1 + by - sway, 3, 2, accent);
    }
    if (outfit === "vanguard") {
      px(ctx, cx - 9, 17 + by, 5, 4, deep); px(ctx, cx + 4, 17 + by, 5, 4, deep);
      px(ctx, cx - 8, 17 + by, 3, 2, hi); px(ctx, cx + 5, 17 + by, 3, 2, hi);
    } else if (outfit === "mythic") {
      px(ctx, cx - 5, 23 + by, 2, 2, hi); px(ctx, cx + 3, 27 + by, 2, 2, hi);
      px(ctx, cx - 1, 31 + by, 2, 2, accent);
    }
  } else if (cls === "archer") {
    const leather = "#583b27", rim = outfit === "mythic" ? accent : "#8b6238";
    const qx = dir === "left" ? cx + 3 : dir === "right" ? cx - 6 : dir === "up" ? cx + 4 : cx - 7;
    px(ctx, qx, 13 + by, 4, 15, leather); px(ctx, qx + 1, 15 + by, 2, 11, rim);
    px(ctx, qx - 1, 12 + by, 6, 2, "#2d241e");
    pixelLine(ctx, qx + 1, 12 + by, qx + 1 + sway, 7 + by, hi);
    pixelLine(ctx, qx + 3, 12 + by, qx + 4 - sway, 8 + by, hi);
    px(ctx, qx + sway, 7 + by, 2, 2, accent); px(ctx, qx + 3 - sway, 7 + by, 2, 2, shade(accent, 0.9));
    if (outfit === "vanguard" && (dir === "up" || dir === "down")) {
      px(ctx, cx - 6, 18 + by, 12, 7, deep); px(ctx, cx - 4, 19 + by, 8, 5, mid);
    } else if (outfit === "mythic") {
      const capeX = dir === "right" ? cx - 7 : cx + 3;
      px(ctx, capeX, 20 + by, 4, 12 + sway, deep); px(ctx, capeX + 1, 22 + by, 2, 8 + sway, accent);
    }
  } else if (cls === "warrior") {
    const x = dir === "right" ? cx - 7 : cx + 4;
    if (dir === "left" || dir === "right" || dir === "up") {
      px(ctx, x, 21 + by, 3, 13, "#503226"); px(ctx, x + 1, 23 + by, 1, 9, accent);
      px(ctx, x - 1, 20 + by, 5, 2, hi);
    }
    if (outfit === "vanguard") {
      const sx = dir === "right" ? cx - 8 : cx - 6;
      px(ctx, sx, 18 + by, 12, 10, "#394650"); px(ctx, sx + 1, 19 + by, 10, 8, mid);
      px(ctx, sx + 4, 20 + by, 4, 6, deep); px(ctx, sx + 5, 22 + by, 2, 2, hi);
    } else if (outfit === "mythic") {
      px(ctx, cx - 6, 18 + by, 12, 15, deep); px(ctx, cx - 4, 20 + by, 8, 13, mid);
      px(ctx, cx - 4, 31 + by + sway, 3, 2, accent); px(ctx, cx + 1, 31 + by - sway, 3, 2, accent);
    }
  }
}

function drawClassFront(ctx, look, dir, cx, by, frame = 0) {
  const cls = look.cls || "warrior";
  const outfit = look.outfit || "wanderer";
  const accent = look.accent || DEFAULT_LOOK.accent;
  const deep = shade(accent, 0.36), mid = shade(accent, 0.62), hi = shade(accent, 1.2);
  const tTop = 16 + by, tBot = 27 + by;

  if (cls === "mage") {
    if (dir === "left" || dir === "right") {
      const edge = dir === "left" ? cx - 5 : cx + 3;
      px(ctx, edge, tTop + 1, 3, 9, deep); px(ctx, edge, tTop + 1, 2, 3, hi);
      px(ctx, edge, tBot - 1, 4, outfit === "mythic" ? 8 : 6, mid); px(ctx, edge, tBot + 3, 2, 2, accent);
    } else {
      px(ctx, cx - 6, tTop, 12, 3, deep);
      px(ctx, cx - 4, tTop + 1, 8, 2, hi);
      px(ctx, cx - 4, tBot - 1, 8, outfit === "mythic" ? 8 : 6, mid);
      px(ctx, cx - 4, tBot + 4, 3, 2, deep); px(ctx, cx + 1, tBot + 4, 3, 2, deep);
      if (dir === "down") {
        px(ctx, cx - 1, tTop + 5, 2, 2, accent); px(ctx, cx - 2, tTop + 6, 4, 1, hi);
        px(ctx, cx - 1, tTop + 7, 2, 2, "#ecffff");
      }
    }
    if (outfit === "vanguard") {
      px(ctx, cx - 8, tTop, 4, 4, deep); px(ctx, cx + 4, tTop, 4, 4, deep);
      px(ctx, cx - 7, tTop, 3, 2, hi); px(ctx, cx + 4, tTop, 3, 2, hi);
    } else if (outfit === "mythic" && dir === "down") {
      px(ctx, cx - 4, tBot + 2, 2, 2, hi); px(ctx, cx + 2, tBot + 4, 2, 2, hi);
    }
  } else if (cls === "archer") {
    const leather = "#805638", buckle = accent;
    px(ctx, cx - 6, tTop, 12, outfit === "vanguard" ? 3 : 2, deep);
    if (dir === "down") {
      pixelLine(ctx, cx - 5, tTop + 1, cx + 3, tBot - 2, leather, 2);
      px(ctx, cx + 2, tBot - 3, 3, 3, buckle);
    } else if (dir === "up") {
      pixelLine(ctx, cx + 4, tTop + 1, cx - 3, tBot - 2, leather, 2);
    } else {
      const front = dir === "left" ? cx - 5 : cx + 3;
      px(ctx, front, tTop + 2, 3, 7, mid); px(ctx, front, tTop + 5, 3, 2, leather);
    }
    px(ctx, cx - 5, tBot - 1, 10, 2, leather); px(ctx, cx - 1, tBot - 1, 2, 2, buckle);
    if (outfit === "vanguard") {
      px(ctx, cx - 7, tTop + 2, 3, 7, mid); px(ctx, cx + 4, tTop + 2, 3, 7, mid);
      px(ctx, cx - 7, tTop + 4, 2, 2, hi); px(ctx, cx + 5, tTop + 4, 2, 2, hi);
    } else if (outfit === "mythic") {
      px(ctx, cx - 6, tTop, 3, 5, mid); px(ctx, cx + 3, tTop, 3, 5, mid);
      if (dir === "down") px(ctx, cx - 1, tTop + 3 + (frame % 2), 2, 2, hi);
    }
  } else if (cls === "warrior") {
    const iron = outfit === "mythic" ? mid : "#687783";
    const steel = outfit === "mythic" ? hi : "#a9bac2", dark = outfit === "mythic" ? deep : "#3e4952";
    if (dir === "left" || dir === "right") {
      const front = dir === "left" ? cx - 7 : cx + 4;
      px(ctx, front, tTop, 4, outfit === "vanguard" ? 5 : 4, dark); px(ctx, front, tTop, 3, 2, steel);
      px(ctx, dir === "left" ? cx - 5 : cx + 2, tTop + 3, 4, 8, iron);
    } else {
      px(ctx, cx - 8, tTop, 4, outfit === "vanguard" ? 5 : 4, dark); px(ctx, cx + 4, tTop, 4, outfit === "vanguard" ? 5 : 4, dark);
      px(ctx, cx - 7, tTop, 3, 2, steel); px(ctx, cx + 4, tTop, 3, 2, steel);
      px(ctx, cx - 4, tTop + 2, 8, 8, iron);
      px(ctx, cx - 3, tTop + 3, 6, 2, steel);
      px(ctx, cx - 1, tTop + 5, 2, 4, dark);
      if (dir === "down") px(ctx, cx - 1, tTop + 5, 2, 2, accent);
    }
    if (outfit === "vanguard") {
      px(ctx, cx - 8, tTop + 4, 3, 5, iron); px(ctx, cx + 5, tTop + 4, 3, 5, iron);
      px(ctx, cx - 7, tTop + 5, 2, 2, accent); px(ctx, cx + 5, tTop + 5, 2, 2, accent);
    } else if (outfit === "mythic" && dir === "down") {
      px(ctx, cx - 3, tBot - 1, 6, 7, deep); px(ctx, cx - 1, tBot, 2, 6, accent);
    }
  }
}

const AURA_PALETTES = {
  ember: ["#ff5a2d", "#ffc05a"],
  arcane: ["#8c65e8", "#e6c7ff"],
  verdant: ["#3fd68d", "#bcff8a"],
  frost: ["#6fdcff", "#e7fbff"],
  void: ["#6b3c9b", "#ef69d5"],
};

function drawAura(ctx, look, frame, energy = 0) {
  const pal = AURA_PALETTES[look.aura];
  if (!pal) return;
  const phase = frame % 4;
  const sparks = [[4, 29], [27, 25], [6, 15], [25, 9], [11, 5], [22, 33], [3, 21], [29, 18]];
  ctx.save();
  ctx.globalAlpha = 0.3 + Math.min(0.22, energy * 0.22);
  for (let i = 0; i < 5; i++) {
    const p = sparks[(i + phase * 2) % sparks.length];
    const lift = (phase + i) % 4;
    px(ctx, p[0], p[1] - lift, i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1, pal[i % 2]);
  }
  ctx.globalAlpha *= 0.55;
  px(ctx, 8 - phase % 2, 35, 6, 1, pal[0]);
  px(ctx, 18 + phase % 2, 35, 6, 1, pal[1]);
  ctx.restore();
}

function drawFaceMark(ctx, look, dir, cx, hy, skinShade) {
  const mark = look.mark || "none";
  const accent = look.accent || DEFAULT_LOOK.accent;
  if (mark === "none" || dir === "up") return;
  const side = dir === "left" ? -1 : 1;
  if (mark === "scar") {
    const x = dir === "down" ? cx + 3 : cx + side * 4;
    px(ctx, x, hy, 1, 1, "#7d3b36"); px(ctx, x - side, hy + 2, 1, 1, "#7d3b36");
  } else if (mark === "freckles") {
    if (dir === "down") { px(ctx, cx - 4, hy + 3, 1, 1, skinShade); px(ctx, cx + 3, hy + 3, 1, 1, skinShade); px(ctx, cx, hy + 3, 1, 1, skinShade); }
    else { px(ctx, cx + side * 4, hy + 3, 1, 1, skinShade); px(ctx, cx + side * 2, hy + 4, 1, 1, skinShade); }
  } else if (mark === "warpaint") {
    if (dir === "down") { px(ctx, cx - 5, hy + 2, 2, 1, accent); px(ctx, cx + 3, hy + 2, 2, 1, accent); px(ctx, cx - 4, hy + 4, 1, 1, accent); px(ctx, cx + 3, hy + 4, 1, 1, accent); }
    else px(ctx, cx + side * 3, hy + 2, 2, 1, accent);
  } else if (mark === "rune") {
    px(ctx, cx - 1, hy - 2, 2, 1, accent); px(ctx, cx, hy - 3, 1, 3, shade(accent, 1.2));
  } else if (mark === "blossom") {
    const x = dir === "right" ? cx + 3 : cx - 4;
    px(ctx, x, hy + 2, 2, 2, "#ef8db0"); px(ctx, x + 1, hy + 1, 1, 4, "#ffd0df");
  }
}

function drawAccessory(ctx, look, dir, cx, hy, frame) {
  const accessory = look.accessory || "none";
  const accent = look.accent || DEFAULT_LOOK.accent;
  const hi = shade(accent, 1.22), deep = shade(accent, 0.52);
  const sway = [-1, 0, 1, 0][frame % 4];
  if (accessory === "none") return;

  if (accessory === "headband") {
    px(ctx, cx - 6, hy - 2, 12, 2, deep); px(ctx, cx - 4, hy - 2, 8, 1, accent);
    if (dir === "left") px(ctx, cx + 5, hy - 1, 3, 3, hi);
    else if (dir === "right") px(ctx, cx - 8, hy - 1, 3, 3, hi);
  } else if (accessory === "leafpin") {
    const x = dir === "left" ? cx - 6 : cx + 4;
    px(ctx, x, hy - 4, 2, 4, "#63b75c"); px(ctx, x + (dir === "left" ? -1 : 1), hy - 3, 2, 2, hi);
  } else if (accessory === "earring") {
    if (dir !== "up") {
      const x = dir === "right" ? cx + 5 : cx - 6;
      px(ctx, x, hy + 3, 1, 3, hi); px(ctx, x - 1, hy + 5, 3, 2, accent);
    }
  } else if (accessory === "foxmask") {
    const x = dir === "left" ? cx + 3 : cx - 8;
    px(ctx, x, hy - 4, 5, 6, "#f0e8dc"); px(ctx, x, hy - 6, 2, 3, "#f0e8dc"); px(ctx, x + 3, hy - 6, 2, 3, "#f0e8dc");
    px(ctx, x + 1, hy - 2, 1, 1, "#d65349"); px(ctx, x + 3, hy - 2, 1, 1, "#d65349"); px(ctx, x + 2, hy, 1, 1, deep);
  } else if (accessory === "horns") {
    px(ctx, cx - 5, hy - 9, 3, 5, deep); px(ctx, cx + 2, hy - 9, 3, 5, deep);
    px(ctx, cx - 4, hy - 10, 2, 3, hi); px(ctx, cx + 2, hy - 10, 2, 3, hi);
  } else if (accessory === "crown") {
    px(ctx, cx - 5, hy - 8, 10, 3, deep); px(ctx, cx - 4, hy - 10, 2, 4, hi); px(ctx, cx - 1, hy - 11, 2, 5, accent); px(ctx, cx + 3, hy - 10, 2, 4, hi);
  } else if (accessory === "ribbon") {
    const x = dir === "right" ? cx - 8 : cx + 5;
    px(ctx, x, hy - 2, 3, 3, accent); px(ctx, x + (dir === "right" ? -2 : 2), hy - 3, 3, 3, hi);
    px(ctx, x + sway, hy + 1, 2, 6, deep); px(ctx, x + 2 - sway, hy + 1, 2, 5, accent);
  }
}

// Draw one body frame. Existing callers keep walk/attack behavior; optional poses
// let previews and skills use richer motion without changing that public API.
function drawBody(ctx, look, dir, frame, atkPhase, pose = "walk", posePhase = 0) {
  const O = "#211d26";
  const sk = look.skin, sk2 = shade(look.skin, 0.86), sk3 = shade(look.skin, 0.72);
  const hr = look.hair, hr2 = shade(look.hair, 1.22), hr3 = shade(look.hair, 0.72);
  const sh = look.shirt, sh2 = shade(look.shirt, 0.8), sh3 = shade(look.shirt, 0.64);
  const pn = look.pants, pn2 = shade(look.pants, 0.78), pn3 = shade(look.pants, 0.62);
  const bt = look.boots, bt2 = shade(look.boots, 0.72);
  const eyeCol = look.eyes || "#26222a";
  const st = look.style;

  const attacking = atkPhase != null;
  const walking = !attacking && pose === "walk";
  const idle = !attacking && pose === "idle";
  const actionBeat = attacking ? Math.sin(Math.PI * atkPhase) : Math.sin(Math.PI * posePhase);
  const attackBeat = attacking ? actionBeat : 0;
  const bob = walking ? [0, -1, 0, -1][frame % 4]
    : idle ? [0, 0, -1, 0][frame % 4]
      : pose === "cast" ? -Math.round(actionBeat) : 0;
  const step = walking ? [0, 1, 0, -1][frame % 4] : pose === "dash" ? (frame % 2 ? 1 : 0) : 0;
  const by = bob;
  const lunge = attacking ? Math.round(attackBeat * 2) : pose === "dash" ? Math.round(actionBeat * 3) : 0;
  const cx = 16 + (dir === "right" ? lunge : dir === "left" ? -lunge : 0);

  drawAura(ctx, look, frame, Math.max(attackBeat, pose === "cast" ? actionBeat : 0));

  // ground shadow
  ctx.fillStyle = "rgba(18,16,20,0.30)";
  ctx.beginPath(); ctx.ellipse(cx, 37, 7, 2.2, 0, 0, 7); ctx.fill();

  drawClassBack(ctx, look, dir, cx, by, frame);

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
  const female = look.gender === "female";
  // shirt body as a shouldered trapezoid; female has narrower waist (hourglass)
  ctx.fillStyle = sh;
  ctx.beginPath();
  if (female) {
    ctx.moveTo(cx - 5, tTop + 1);     // slightly narrower shoulders
    ctx.lineTo(cx + 5, tTop + 1);
    ctx.lineTo(cx + 3, tTop + 5);     // chest curve out
    ctx.lineTo(cx + 2.5, tBot);       // nipped waist
    ctx.lineTo(cx - 2.5, tBot);
    ctx.lineTo(cx - 3, tTop + 5);
  } else {
    ctx.moveTo(cx - 6, tTop + 1);     // left shoulder
    ctx.lineTo(cx + 6, tTop + 1);     // right shoulder
    ctx.lineTo(cx + 4, tBot);         // right waist
    ctx.lineTo(cx - 4, tBot);         // left waist
  }
  ctx.closePath(); ctx.fill();
  // shading down the left side + center highlight
  ctx.fillStyle = sh2;
  if (female) { ctx.beginPath(); ctx.moveTo(cx - 5, tTop + 1); ctx.lineTo(cx - 2, tTop + 1); ctx.lineTo(cx - 1, tBot); ctx.lineTo(cx - 2.5, tBot); ctx.closePath(); ctx.fill(); }
  else { ctx.beginPath(); ctx.moveTo(cx - 6, tTop + 1); ctx.lineTo(cx - 2, tTop + 1); ctx.lineTo(cx - 1, tBot); ctx.lineTo(cx - 4, tBot); ctx.closePath(); ctx.fill(); }
  ctx.fillStyle = sh3;
  px(ctx, cx - 6, tTop + 1, 12, 1, sh3);      // collar line shade
  // belt
  px(ctx, cx - 4, tBot - 1, 8, 2, pn3);
  px(ctx, cx - 1, tBot - 1, 2, 2, shade(look.boots, 1.1)); // buckle

  // ================= ARMS (at the sides, swing while walking) ==============
  const armSw = walking ? [0, 1, 0, -1][frame % 4] : 0;
  if (pose === "cast" && !attacking) {
    const lift = 2 + Math.round(actionBeat * 4);
    if (dir === "down" || dir === "up") {
      pixelLine(ctx, cx - 5, tTop + 3, cx - 8, tTop + 3 - lift, sh2, 2);
      pixelLine(ctx, cx + 4, tTop + 3, cx + 7, tTop + 3 - lift, sh2, 2);
      px(ctx, cx - 9, tTop + 2 - lift, 2, 2, sk); px(ctx, cx + 7, tTop + 2 - lift, 2, 2, sk);
    } else {
      const front = dir === "left" ? -1 : 1;
      pixelLine(ctx, cx, tTop + 3, cx + front * (7 + lift), tTop - lift, sh2, 2);
      px(ctx, cx + front * (7 + lift), tTop - lift, 2, 2, sk);
      pixelLine(ctx, cx - front * 3, tTop + 4, cx - front * 5, tTop + 7, sh2, 2);
    }
  } else if (pose === "dash" && !attacking) {
    const trail = dir === "left" || dir === "right" ? (dir === "left" ? 1 : -1) : 0;
    pixelLine(ctx, cx - 5, tTop + 2, cx - 5 + trail * 4, tTop + 7, sh2, 2);
    pixelLine(ctx, cx + 4, tTop + 2, cx + 4 + trail * 4, tTop + 7, sh2, 2);
  } else if (attacking) {
    const reach = 1 + Math.round(attackBeat * 4);
    if (dir === "down") {
      pixelLine(ctx, cx - 6, tTop + 2, cx - 2, tTop + 5, sh2, 2);
      pixelLine(ctx, cx + 5, tTop + 2, cx + 6 + reach, tTop + 5 + Math.round(attackBeat * 2), sh2, 2);
      px(ctx, cx + 6 + reach, tTop + 6 + Math.round(attackBeat * 2), 2, 2, sk);
    } else if (dir === "up") {
      pixelLine(ctx, cx - 5, tTop + 3, cx - 2, tTop + 1, sh2, 2);
      pixelLine(ctx, cx + 4, tTop + 3, cx + 5 + reach, tTop - Math.round(attackBeat * 2), sh2, 2);
    } else if (dir === "left") {
      pixelLine(ctx, cx - 4, tTop + 2, cx - 6 - reach, tTop + 4, sh2, 2);
      px(ctx, cx - 7 - reach, tTop + 4, 2, 2, sk);
      pixelLine(ctx, cx + 3, tTop + 3, cx, tTop + 6, sh2, 2);
    } else {
      pixelLine(ctx, cx + 3, tTop + 2, cx + 5 + reach, tTop + 4, sh2, 2);
      px(ctx, cx + 6 + reach, tTop + 4, 2, 2, sk);
      pixelLine(ctx, cx - 4, tTop + 3, cx - 1, tTop + 6, sh2, 2);
    }
  } else if (dir === "down" || dir === "up") {
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

  drawClassFront(ctx, look, dir, cx, by, frame);

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
  const hairSway = [-1, 0, 1, 0][frame % 4];
  if (st !== "bald") {
    if (dir === "up") {
      // back of head fully covered
      ctx.fillStyle = hr; roundRect(ctx, cx - 5, hy - 6, 10, 9, 3); ctx.fill();
      ctx.fillStyle = hr2; px(ctx, cx - 5, hy - 6, 10, 2, hr2);
      if (st === "long" || st === "waves") { px(ctx, cx - 6, hy, 3, 10 + hairSway, hr); px(ctx, cx + 3, hy, 3, 10 - hairSway, hr); }
      if (st === "ponytail") { px(ctx, cx - 1 + hairSway, hy + 3, 2, 8, hr); px(ctx, cx - 1 + hairSway, hy + 9, 2, 2, hr2); }
      if (st === "mohawk") { px(ctx, cx - 1, hy - 7, 2, 8, hr2); }
      if (st === "bob") { px(ctx, cx - 6, hy - 1, 3, 8, hr); px(ctx, cx + 3, hy - 1, 3, 8, hr); px(ctx, cx - 4, hy + 5, 8, 2, hr3); }
      if (st === "braids") { pixelLine(ctx, cx - 5, hy, cx - 7 + hairSway, hy + 10, hr, 2); pixelLine(ctx, cx + 4, hy, cx + 6 - hairSway, hy + 10, hr, 2); px(ctx, cx - 8 + hairSway, hy + 9, 3, 2, hr2); px(ctx, cx + 5 - hairSway, hy + 9, 3, 2, hr2); }
      if (st === "undercut") { px(ctx, cx - 5, hy - 1, 2, 4, sk2); px(ctx, cx + 3, hy - 1, 2, 4, sk2); px(ctx, cx - 2, hy - 8, 7, 4, hr); }
      if (st === "samurai") { px(ctx, cx - 3, hy - 9, 6, 4, hr3); px(ctx, cx - 2, hy - 11, 4, 3, hr); }
      if (st === "twintails") { px(ctx, cx - 8, hy - 1, 4, 4, hr); px(ctx, cx + 4, hy - 1, 4, 4, hr); px(ctx, cx - 8 + hairSway, hy + 2, 2, 8, hr); px(ctx, cx + 6 - hairSway, hy + 2, 2, 8, hr); }
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
      if (st === "long") { px(ctx, cx - 7, hy - 2, 2, 12 + hairSway, hr); px(ctx, cx + 5, hy - 2, 2, 12 - hairSway, hr); px(ctx, cx - 7, hy + 8 + hairSway, 2, 2, hr3); px(ctx, cx + 5, hy + 8 - hairSway, 2, 2, hr3); }
      if (st === "ponytail") { px(ctx, cx + 5, hy - 3, 3, 3, hr); px(ctx, cx + 6 + hairSway, hy, 2, 8, hr); }
      if (st === "bob") { px(ctx, cx - 7, hy - 2, 3, 9, hr); px(ctx, cx + 4, hy - 2, 3, 9, hr); px(ctx, cx - 5, hy + 5, 10, 2, hr3); }
      if (st === "braids") { pixelLine(ctx, cx - 6, hy, cx - 8 + hairSway, hy + 10, hr, 2); pixelLine(ctx, cx + 5, hy, cx + 7 - hairSway, hy + 10, hr, 2); px(ctx, cx - 9 + hairSway, hy + 9, 3, 2, hr2); px(ctx, cx + 6 - hairSway, hy + 9, 3, 2, hr2); }
      if (st === "undercut") { px(ctx, cx - 6, hy - 2, 2, 4, sk2); px(ctx, cx + 4, hy - 2, 2, 4, sk2); pixelLine(ctx, cx - 4, hy - 6, cx + 5, hy - 3, hr2, 2); }
      if (st === "samurai") { px(ctx, cx - 3, hy - 9, 6, 4, hr3); px(ctx, cx - 2, hy - 11, 4, 3, hr); px(ctx, cx + 4, hy - 2, 3, 5, hr); }
      if (st === "waves") { px(ctx, cx - 7, hy - 2, 3, 5, hr); px(ctx, cx - 8, hy + 2, 3, 4 + hairSway, hr3); px(ctx, cx + 4, hy - 2, 3, 5, hr); px(ctx, cx + 5, hy + 2, 3, 4 - hairSway, hr3); }
      if (st === "twintails") { px(ctx, cx - 9, hy - 2, 4, 4, hr); px(ctx, cx + 5, hy - 2, 4, 4, hr); px(ctx, cx - 9 + hairSway, hy + 1, 2, 9, hr); px(ctx, cx + 7 - hairSway, hy + 1, 2, 9, hr); }
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
  drawFaceMark(ctx, look, dir, cx, hy, sk3);
  drawAccessory(ctx, look, dir, cx, hy, frame);
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

function drawPixelBow(ctx, dragon, atkPhase) {
  const edge = dragon ? "#57251d" : "#432d20";
  const wood = dragon ? "#a54428" : "#98683a";
  const shine = dragon ? "#ff8b3d" : "#d7a85b";
  const string = dragon ? "#ffc35e" : "#e7dfc5";
  const pull = atkPhase == null ? -1 : -1 - Math.round(Math.sin(Math.PI * atkPhase) * 4);

  // Thick stair-step limbs stay legible after directional rotation.
  pixelLine(ctx, -1, -1, 1, -5, edge, 2); pixelLine(ctx, 1, -5, 4, -9, edge, 2);
  pixelLine(ctx, -1, 1, 1, 5, edge, 2); pixelLine(ctx, 1, 5, 4, 9, edge, 2);
  pixelLine(ctx, 0, -2, 2, -5, wood, 1); pixelLine(ctx, 2, -5, 5, -9, wood, 1);
  pixelLine(ctx, 0, 2, 2, 5, wood, 1); pixelLine(ctx, 2, 5, 5, 9, wood, 1);
  px(ctx, -2, -2, 3, 4, shine); px(ctx, -1, -1, 2, 2, "#64412a");
  pixelLine(ctx, 5, -9, pull, 0, string); pixelLine(ctx, pull, 0, 5, 9, string);

  if (dragon) {
    px(ctx, 3, -11, 4, 3, "#e34e27"); px(ctx, 5, -12, 3, 2, "#ffb047");
    px(ctx, 3, 8, 4, 3, "#e34e27"); px(ctx, 5, 10, 3, 2, "#ffb047");
    px(ctx, 1, -6, 2, 2, "#ffcf67"); px(ctx, 1, 5, 2, 2, "#ffcf67");
  }
  if (atkPhase != null && atkPhase < .78) {
    pixelLine(ctx, pull, 0, 12, 0, dragon ? "#ffdc7d" : "#b58a50");
    px(ctx, 10, -2, 3, 5, dragon ? "#ff6a32" : "#dfe6e4");
    px(ctx, pull, -2, 3, 1, dragon ? "#ff8b3d" : "#6c8c70");
    px(ctx, pull, 2, 3, 1, dragon ? "#ffb348" : "#6c8c70");
  }
}

function drawPixelStaff(ctx, dragon, atkPhase) {
  const shaft = dragon ? "#4a2118" : "#51351f";
  const shaftHi = dragon ? "#a84826" : "#9a6a38";
  const metal = dragon ? "#ff7a32" : "#8662aa";
  const crystal = dragon ? "#ffcf5a" : "#9deaff";
  const core = dragon ? "#fff09a" : "#e4fbff";
  const pulse = atkPhase == null ? 0 : Math.round(Math.sin(Math.PI * atkPhase) * 2);

  px(ctx, -2, -16, 4, 22, "#2a2020"); px(ctx, -1, -16, 2, 22, shaft);
  px(ctx, 0, -14, 1, 18, shaftHi); px(ctx, -2, 1, 4, 3, metal);
  pixelLine(ctx, -1, -15, -6, -20, shaft, 2); pixelLine(ctx, 1, -15, 6, -20, shaft, 2);
  px(ctx, -7, -22, 3, 4, metal); px(ctx, 4, -22, 3, 4, metal);
  // Faceted focus crystal, enlarged during the cast without smooth circles.
  px(ctx, -3 - pulse, -23 - pulse, 6 + pulse * 2, 6 + pulse * 2, metal);
  px(ctx, -2 - pulse, -24 - pulse, 4 + pulse * 2, 8 + pulse * 2, crystal);
  px(ctx, -1, -23 - pulse, 2, 6 + pulse * 2, core);
  if (dragon) {
    px(ctx, -8, -24, 3, 3, "#d73f26"); px(ctx, 5, -24, 3, 3, "#d73f26");
    px(ctx, -9, -25, 2, 2, "#ff9d3e"); px(ctx, 7, -25, 2, 2, "#ff9d3e");
    px(ctx, -3, -12, 2, 3, "#ff6b2e"); px(ctx, 1, -8, 2, 3, "#ff9d3e");
  } else {
    px(ctx, -3, -12, 2, 3, "#6f4b93"); px(ctx, 1, -8, 2, 3, "#5bb8c7");
  }
}

// weapon overlay drawn relative to hand, animated by atkPhase (0..1)
function drawWeapon(ctx, weapon, dir, atkPhase) {
  if (weapon === "fist") return;
  const isBow = weapon === "bow" || weapon === "dragonbow";
  const isStaff = weapon === "staff" || weapon === "dragonstaff";
  let hx, hy, baseAng;
  if (isBow) {
    hx = 16; hy = 21;
    baseAng = dir === "down" ? Math.PI * .5 : dir === "up" ? -Math.PI * .5 : dir === "left" ? Math.PI : 0;
  } else if (isStaff) {
    // An upright staff stays inside the compact 32x40 character frame.
    hx = dir === "up" || dir === "left" ? 10 : 22; hy = 28; baseAng = 0;
  } else if (dir === "down") { hx = 24; hy = 22; baseAng = Math.PI * 0.5; }
  else if (dir === "up") { hx = 9; hy = 20; baseAng = -Math.PI * 0.5; }
  else if (dir === "left") { hx = 9; hy = 22; baseAng = Math.PI; }
  else { hx = 23; hy = 22; baseAng = 0; }
  const sweep = isBow ? 0
    : isStaff ? (atkPhase == null ? 0 : Math.sin(Math.PI * atkPhase) * (dir === "up" || dir === "left" ? -.12 : .12))
      : atkPhase == null ? -0.55 : -1.0 + 2.0 * atkPhase;
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
    drawPixelBow(ctx, false, atkPhase);
  } else if (weapon === "staff") {
    drawPixelStaff(ctx, false, atkPhase);
  } else if (weapon === "dragonblade") {
    ctx.fillStyle = "#8a5a34"; ctx.fillRect(-1.5, 0, 3, 5);
    ctx.fillStyle = "#ff7a2a"; ctx.fillRect(-4, -1, 8, 2);          // glowing crossguard
    ctx.fillStyle = "#e05020"; ctx.fillRect(-2, -17, 4, 16);
    ctx.fillStyle = "#ff9050"; ctx.fillRect(-2, -17, 1.5, 16);
    ctx.fillStyle = "#ffce5a"; ctx.beginPath(); ctx.moveTo(-2, -17); ctx.lineTo(2, -17); ctx.lineTo(0, -21); ctx.fill();
  } else if (weapon === "dragonbow") {
    drawPixelBow(ctx, true, atkPhase);
  } else if (weapon === "dragonstaff") {
    drawPixelStaff(ctx, true, atkPhase);
  }
  ctx.restore();

  if (atkPhase != null && atkPhase > 0.12 && atkPhase < 0.88 && !isBow && !isStaff) {
    ctx.save(); ctx.globalAlpha = 0.4;
    ctx.strokeStyle = "#eaf2ff"; ctx.lineWidth = 2.5;
    const reach = weapon === "spear" ? 22 : weapon === "dagger" ? 10 : 16;
    ctx.beginPath(); ctx.arc(hx, hy, reach, baseAng - 1.0, ang); ctx.stroke();
    ctx.restore();
  }
}

function buildPoseSet(look, pose, count) {
  const out = {};
  for (const dir of DIRS) {
    out[dir] = [];
    for (let f = 0; f < count; f++) {
      const cv = document.createElement("canvas"); cv.width = CW; cv.height = CH;
      const c = cv.getContext("2d"); c.imageSmoothingEnabled = false;
      drawBody(c, look, dir, f, null, pose, count > 1 ? f / (count - 1) : 0);
      out[dir].push(cv);
    }
  }
  return out;
}

function addLazyPose(cache, look, pose, count) {
  Object.defineProperty(cache, pose, {
    configurable: true,
    enumerable: true,
    get() {
      const frames = buildPoseSet(look, pose, count);
      Object.defineProperty(cache, pose, { configurable: true, enumerable: true, value: frames });
      return frames;
    },
  });
}

// Existing walk/atk fields remain unchanged. New poses are lazy so older screens
// that rebuild previews frequently do not allocate unused canvases.
export function buildCharacter(look) {
  const resolved = normalizeLook(look);
  const cache = { walk: {}, atk: {}, weaponWalk: {}, weaponAtk: {} };
  for (const dir of DIRS) {
    cache.walk[dir] = [];
    for (let f = 0; f < 4; f++) {
      const cv = document.createElement("canvas"); cv.width = CW; cv.height = CH;
      const c = cv.getContext("2d"); c.imageSmoothingEnabled = false;
      drawBody(c, resolved, dir, f, null);
      cache.walk[dir].push(cv);
    }
    // attack: 5 frames of swing
    cache.atk[dir] = [];
    for (let s = 0; s < 5; s++) {
      const cv = document.createElement("canvas"); cv.width = CW; cv.height = CH;
      const c = cv.getContext("2d"); c.imageSmoothingEnabled = false;
      const phase = s / 4;
      drawBody(c, resolved, dir, 0, phase);
      cache.atk[dir].push(cv);
    }
  }
  addLazyPose(cache, resolved, "idle", 4);
  addLazyPose(cache, resolved, "cast", 6);
  addLazyPose(cache, resolved, "dash", 4);
  cache.look = resolved;
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
