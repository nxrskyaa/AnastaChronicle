// Small cached canvases keep every fishing visual code-generated and crisp.
// Shapes and markings are deliberately species-specific rather than recolours.
const W = 36, H = 22;

const SPECIES = {
  minnow:   { body: "#a9c8cf", light: "#edf8ef", dark: "#496d79", accent: "#6aa7b5", shape: "slim", marks: "line" },
  carp:     { body: "#68885a", light: "#b7c981", dark: "#314f3b", accent: "#d7a94a", shape: "deep", marks: "scales" },
  trout:    { body: "#7ca59b", light: "#d9d09a", dark: "#395f62", accent: "#d87861", shape: "slim", marks: "spots" },
  pike:     { body: "#6f8f58", light: "#b8c97b", dark: "#304f32", accent: "#d4d36b", shape: "long", marks: "dashes" },
  salmon:   { body: "#cf7665", light: "#ffd09e", dark: "#704a58", accent: "#e9a36f", shape: "long", marks: "spots" },
  koi:      { body: "#f0e1c3", light: "#fff9dd", dark: "#6d5147", accent: "#d84735", shape: "deep", marks: "koi" },
  catfish:  { body: "#586c73", light: "#a4a997", dark: "#263b45", accent: "#708b8d", shape: "catfish", marks: "mottle" },
  eel:      { body: "#7188a3", light: "#b9e4db", dark: "#30445d", accent: "#75d9cf", shape: "eel", marks: "crystal" },
  goldfish: { body: "#e6a52e", light: "#fff09a", dark: "#8a4b20", accent: "#ffd85b", shape: "fancy", marks: "scales" },
  spirit:   { body: "#77d4e4", light: "#e4ffff", dark: "#385b9a", accent: "#b48cff", shape: "spirit", marks: "runes" },
};

const RARITY_SPARKS = { uncommon: 1, rare: 2, legendary: 4 };
const cache = new Map();

function polygon(ctx, points, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.fill();
}

function pixel(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function bodyBounds(shape) {
  if (shape === "deep" || shape === "fancy") return { left: 9, right: 29, top: 5, bottom: 17 };
  if (shape === "long") return { left: 7, right: 31, top: 8, bottom: 15 };
  if (shape === "eel" || shape === "spirit") return { left: 4, right: 31, top: 9, bottom: 14 };
  if (shape === "catfish") return { left: 8, right: 30, top: 7, bottom: 16 };
  return { left: 8, right: 30, top: 7, bottom: 15 };
}

function paintMarks(ctx, id, spec, b) {
  const mid = Math.round((b.top + b.bottom) / 2);
  if (spec.marks === "line") pixel(ctx, b.left + 3, mid, b.right - b.left - 7, 1, spec.accent);
  if (spec.marks === "spots") {
    for (const [x, y] of [[13, 9], [18, 12], [22, 8], [25, 13]]) pixel(ctx, x, y, 1, 1, spec.dark);
  }
  if (spec.marks === "dashes") {
    for (const [x, y] of [[11, 10], [16, 12], [21, 9], [25, 12]]) pixel(ctx, x, y, 2, 1, spec.light);
  }
  if (spec.marks === "scales") {
    for (const [x, y] of [[13, 8], [17, 10], [21, 8], [14, 13], [19, 14], [24, 12]]) pixel(ctx, x, y, 2, 1, spec.accent);
  }
  if (spec.marks === "koi") {
    pixel(ctx, 12, 6, 5, 4, spec.accent); pixel(ctx, 20, 11, 6, 5, spec.accent); pixel(ctx, 15, 14, 3, 2, spec.dark);
  }
  if (spec.marks === "mottle") {
    pixel(ctx, 11, 9, 4, 2, spec.accent); pixel(ctx, 18, 13, 5, 2, spec.dark); pixel(ctx, 24, 9, 3, 2, spec.accent);
  }
  if (spec.marks === "crystal") {
    for (const x of [10, 15, 20, 25]) { pixel(ctx, x, 9, 2, 1, spec.light); pixel(ctx, x + 1, 10, 1, 2, spec.accent); }
  }
  if (spec.marks === "runes") {
    pixel(ctx, 10, 10, 3, 1, spec.light); pixel(ctx, 12, 11, 1, 2, spec.accent);
    pixel(ctx, 18, 11, 3, 1, spec.light); pixel(ctx, 19, 9, 1, 3, spec.accent);
    pixel(ctx, 25, 10, 2, 2, spec.light);
  }
  if (id === "salmon") pixel(ctx, 8, 10, 4, 1, "#e7bd91");
}

function paintFish(ctx, id, rarity) {
  const spec = SPECIES[id] || SPECIES.minnow;
  const b = bodyBounds(spec.shape);
  const outline = "#17252b";
  const mid = Math.round((b.top + b.bottom) / 2);

  // Tail silhouette and inner colour.
  const tailLeft = spec.shape === "eel" || spec.shape === "spirit" ? 1 : 2;
  polygon(ctx, [[b.left + 1, mid], [tailLeft, b.top - 2], [tailLeft + 1, mid], [tailLeft, b.bottom + 2]], outline);
  polygon(ctx, [[b.left + 1, mid], [tailLeft + 2, b.top], [tailLeft + 3, mid], [tailLeft + 2, b.bottom]], spec.accent);

  // Body outline, then its pixel-inset fill and belly highlight.
  polygon(ctx, [[b.left, mid], [b.left + 4, b.top], [b.right - 4, b.top], [b.right, mid - 2], [b.right, mid + 2], [b.right - 4, b.bottom], [b.left + 4, b.bottom]], outline);
  polygon(ctx, [[b.left + 1, mid], [b.left + 5, b.top + 1], [b.right - 5, b.top + 1], [b.right - 1, mid - 1], [b.right - 1, mid + 1], [b.right - 5, b.bottom - 1], [b.left + 5, b.bottom - 1]], spec.body);
  polygon(ctx, [[b.left + 5, mid + 1], [b.right - 2, mid], [b.right - 5, b.bottom - 2], [b.left + 6, b.bottom - 2]], spec.light);

  // Dorsal and lower fins retain a one-pixel dark rim.
  polygon(ctx, [[b.left + 8, b.top + 1], [b.left + 12, b.top - 3], [b.left + 16, b.top + 1]], outline);
  polygon(ctx, [[b.left + 9, b.top + 1], [b.left + 12, b.top - 1], [b.left + 15, b.top + 1]], spec.accent);
  polygon(ctx, [[b.left + 10, b.bottom - 1], [b.left + 14, b.bottom + 2], [b.left + 17, b.bottom - 1]], spec.dark);

  paintMarks(ctx, id, spec, b);

  // Face, eye and a bright pixel make the tiny sprite readable at 2x scale.
  pixel(ctx, b.right - 5, mid - 3, 2, 2, "#f6fbda");
  pixel(ctx, b.right - 4, mid - 2, 1, 1, "#101419");
  pixel(ctx, b.right - 1, mid + 1, 2, 1, spec.dark);
  pixel(ctx, b.left + 7, b.top + 2, Math.max(3, b.right - b.left - 14), 1, spec.light);

  if (spec.shape === "catfish") {
    ctx.strokeStyle = spec.light; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(b.right - 2, mid + 2); ctx.lineTo(35, mid + 5); ctx.moveTo(b.right - 2, mid + 1); ctx.lineTo(35, mid - 1); ctx.stroke();
  }
  if (spec.shape === "fancy") {
    polygon(ctx, [[b.left + 1, mid], [1, 2], [5, mid], [1, 20]], outline);
    polygon(ctx, [[b.left, mid], [3, 5], [6, mid], [3, 17]], spec.accent);
  }

  const sparks = RARITY_SPARKS[rarity] || 0;
  const sparkPixels = [[32, 3], [5, 3], [32, 18], [14, 2]];
  for (let i = 0; i < sparks; i++) {
    const [x, y] = sparkPixels[i];
    pixel(ctx, x, y, 1, 3, rarity === "legendary" ? "#fff19a" : "#d9c5ff");
    pixel(ctx, x - 1, y + 1, 3, 1, rarity === "legendary" ? "#fff19a" : "#d9c5ff");
  }
}

export function getFishSprite(fish) {
  const id = typeof fish === "string" ? fish : fish?.id || "minnow";
  const rarity = typeof fish === "object" ? fish?.rarity || "common" : "common";
  const key = `${id}:${rarity}`;
  if (cache.has(key)) return cache.get(key);
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  paintFish(ctx, id, rarity);
  cache.set(key, canvas);
  return canvas;
}

export function drawFishSprite(ctx, fish, x, y, { scale = 2, flip = false, alpha = 1 } = {}) {
  const sprite = getFishSprite(fish);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(flip ? -scale : scale, scale);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sprite, -W / 2, -H / 2);
  ctx.restore();
}
