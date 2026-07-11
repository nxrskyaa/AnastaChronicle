// Runtime-generated pixel props and combat FX.
// No external image files are requested; every sprite is cached as an offscreen canvas.
const cache = new Map();

function canvas(w, h) {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  return cv;
}

function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function diamond(ctx, cx, cy, rx, ry, color) {
  for (let y = -ry; y <= ry; y++) {
    const half = Math.max(1, Math.round(rx * (1 - Math.abs(y) / (ry + 1))));
    px(ctx, cx - half, cy + y, half * 2 + 1, 1, color);
  }
}

function shadow(ctx, cx, y, width) {
  const x = Math.round(cx - width / 2);
  px(ctx, x + 4, y - 2, width - 8, 1, "rgba(18,20,22,0.18)");
  px(ctx, x + 1, y - 1, width - 2, 2, "rgba(18,20,22,0.25)");
  px(ctx, x + 5, y + 1, width - 10, 1, "rgba(18,20,22,0.18)");
}

function outlined(source, color = "#202024") {
  const w = source.width, h = source.height;
  const srcCtx = source.getContext("2d");
  const image = srcCtx.getImageData(0, 0, w, h);
  const data = image.data;
  const out = srcCtx.createImageData(w, h);
  out.data.set(data);
  const alpha = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return 0;
    return data[(y * w + x) * 4 + 3];
  };
  const n = parseInt(color.slice(1), 16);
  const cr = (n >> 16) & 255, cg = (n >> 8) & 255, cb = n & 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (alpha(x, y) > 24) continue;
      if (alpha(x - 1, y) > 48 || alpha(x + 1, y) > 48 ||
          alpha(x, y - 1) > 48 || alpha(x, y + 1) > 48) {
        const i = (y * w + x) * 4;
        out.data[i] = cr;
        out.data[i + 1] = cg;
        out.data[i + 2] = cb;
        out.data[i + 3] = 255;
      }
    }
  }
  srcCtx.putImageData(out, 0, 0);
  return source;
}

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function leafMass(ctx, cx, cy, rx, ry, pal, seed) {
  diamond(ctx, cx, cy + 2, rx, ry, pal.dark);
  diamond(ctx, cx, cy - 1, Math.max(2, rx - 2), Math.max(2, ry - 2), pal.mid);
  diamond(ctx, cx - 2, cy - 3, Math.max(2, rx - 4), Math.max(2, ry - 4), pal.light);
  const rnd = seeded(seed);
  for (let i = 0; i < 9; i++) {
    const x = cx - rx + 3 + Math.floor(rnd() * Math.max(1, rx * 2 - 5));
    const y = cy - ry + 3 + Math.floor(rnd() * Math.max(1, ry * 2 - 5));
    px(ctx, x, y, i % 4 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1, i % 3 === 0 ? pal.hi : pal.light);
  }
}

const TREE_PALS = [
  { dark: "#163e30", mid: "#245f43", light: "#3c8354", hi: "#72b765", bark: "#70462e", barkD: "#442b25", barkL: "#a16a3d" },
  { dark: "#183a35", mid: "#20564a", light: "#347663", hi: "#65a981", bark: "#5c4332", barkD: "#352b29", barkL: "#826044" },
  { dark: "#672a2a", mid: "#a3452d", light: "#d66a32", hi: "#f0a548", bark: "#6e422b", barkD: "#3f2924", barkL: "#9c6536" },
  { dark: "#193b3b", mid: "#275b55", light: "#438274", hi: "#73b39b", bark: "#655044", barkD: "#3a3534", barkL: "#92745a" },
];

function treeSprite(variant) {
  const cv = canvas(48, 60);
  const ctx = cv.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  shadow(ctx, 24, 56, variant === 3 ? 34 : 30);

  const sprite = canvas(48, 60);
  const s = sprite.getContext("2d");
  const p = TREE_PALS[variant & 3];

  // Trunk, roots, branch forks, and bark clusters.
  px(s, 20, 25, 9, 31, p.barkD);
  px(s, 22, 24, 6, 31, p.bark);
  px(s, 23, 26, 2, 26, p.barkL);
  px(s, 18, 54, 7, 3, p.barkD);
  px(s, 26, 53, 8, 4, p.barkD);
  px(s, 17, 31, 6, 4, p.barkD);
  px(s, 28, 29, 5, 4, p.barkD);
  px(s, 22, 36, 2, 5, "#3b2b28");
  px(s, 26, 44, 2, 6, p.barkL);

  if (variant === 0) {
    leafMass(s, 14, 25, 10, 10, p, 11);
    leafMass(s, 33, 24, 11, 11, p, 23);
    leafMass(s, 23, 13, 13, 12, p, 37);
    leafMass(s, 23, 29, 15, 10, p, 41);
  } else if (variant === 1) {
    // Japanese cedar: layered, angular tiers.
    for (const tier of [
      { y: 5, w: 6 }, { y: 10, w: 11 }, { y: 17, w: 15 },
      { y: 25, w: 19 }, { y: 34, w: 22 },
    ]) {
      const h = tier.y < 12 ? 8 : 10;
      for (let yy = 0; yy < h; yy++) {
        const hw = Math.max(1, Math.round(tier.w * (yy + 2) / (h + 1)));
        px(s, 24 - hw, tier.y + yy, hw * 2 + 1, 1, yy > h - 3 ? p.dark : p.mid);
      }
      px(s, 22, tier.y + 3, 3, 2, p.light);
      px(s, 18, tier.y + 6, 2, 1, p.hi);
    }
  } else if (variant === 2) {
    // Ember maple: broad, asymmetric autumn canopy.
    leafMass(s, 11, 24, 9, 10, p, 53);
    leafMass(s, 20, 13, 12, 11, p, 59);
    leafMass(s, 35, 20, 10, 12, p, 61);
    leafMass(s, 27, 30, 14, 10, p, 67);
    px(s, 8, 41, 2, 2, p.hi);
    px(s, 38, 38, 2, 2, p.light);
  } else {
    // Ancient spirit tree: cool leaves, split crown, hanging moss.
    leafMass(s, 12, 21, 10, 12, p, 71);
    leafMass(s, 35, 19, 11, 12, p, 73);
    leafMass(s, 24, 10, 12, 10, p, 79);
    leafMass(s, 24, 28, 16, 10, p, 83);
    for (const [x, y, h] of [[8, 27, 8], [14, 33, 7], [34, 29, 9], [40, 25, 7]]) {
      px(s, x, y, 1, h, p.dark);
      px(s, x + 1, y + h - 2, 1, 2, p.hi);
    }
    px(s, 21, 39, 2, 2, "#7dd7b4");
    px(s, 28, 34, 1, 2, "#a4f0c8");
  }

  outlined(sprite, variant === 2 ? "#3b2023" : "#17272a");
  ctx.drawImage(sprite, 0, 0);
  return cv;
}

function bushSprite() {
  const cv = canvas(32, 32);
  const ctx = cv.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  shadow(ctx, 16, 27, 24);
  const sprite = canvas(32, 32);
  const s = sprite.getContext("2d");
  px(s, 8, 21, 17, 5, "#335436");
  px(s, 10, 14, 2, 10, "#5a432c");
  px(s, 20, 13, 2, 11, "#5a432c");
  const pal = { dark: "#18452f", mid: "#286344", light: "#43855a", hi: "#75b86c" };
  leafMass(s, 9, 18, 7, 7, pal, 101);
  leafMass(s, 22, 17, 8, 8, pal, 103);
  leafMass(s, 16, 11, 9, 8, pal, 107);
  leafMass(s, 16, 21, 11, 6, pal, 109);
  px(s, 8, 16, 2, 2, "#d65b5b");
  px(s, 23, 13, 2, 2, "#e67a54");
  px(s, 17, 21, 1, 1, "#f0c866");
  px(s, 12, 8, 1, 2, "#a7e08b");
  outlined(sprite, "#17272a");
  ctx.drawImage(sprite, 0, 0);
  return cv;
}

function resourceSprite(kind) {
  const cv = canvas(28, 32);
  const ctx = cv.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const edge = "#20272a";
  shadow(ctx, 14, 28, kind === "crystal_ore" ? 24 : 20);

  if (kind === "bamboo_shoot") {
    // Three segmented culms and broad folded leaves make the wood source clear.
    px(ctx, 7, 15, 4, 13, edge); px(ctx, 8, 14, 2, 13, "#4f873f"); px(ctx, 8, 15, 1, 11, "#9bd16a");
    px(ctx, 17, 13, 4, 15, edge); px(ctx, 18, 12, 2, 15, "#3f7739"); px(ctx, 18, 13, 1, 12, "#86c65d");
    for (const [x, y] of [[6, 20], [16, 18], [16, 24]]) { px(ctx, x, y, 6, 2, edge); px(ctx, x + 1, y, 4, 1, "#acd977"); }
    px(ctx, 11, 8, 5, 20, edge); px(ctx, 12, 7, 3, 20, "#46763a");
    px(ctx, 13, 8, 1, 18, "#8fcf62");
    for (const y of [13, 19, 24]) { px(ctx, 10, y, 7, 2, edge); px(ctx, 11, y, 5, 1, "#b0dd72"); }
    px(ctx, 12, 4, 3, 4, edge); px(ctx, 13, 3, 2, 4, "#b6e178");
    for (const [x, y, w, flip] of [[2, 9, 9, 0], [16, 11, 10, 1], [3, 17, 8, 0], [16, 20, 8, 1]]) {
      px(ctx, x, y + 1, w, 4, edge);
      px(ctx, x + 1, y + 1, w - 2, 2, flip ? "#5da447" : "#72b856");
      px(ctx, flip ? x + 1 : x + w - 2, y, 2, 2, "#9ad76a");
    }
    px(ctx, 8, 26, 12, 2, "#315e32"); px(ctx, 11, 25, 7, 2, "#639b45");
  } else if (kind === "herb_bush") {
    // A woven root basket shape underneath layered medicinal leaves and flowers.
    px(ctx, 6, 22, 16, 6, edge); px(ctx, 8, 23, 12, 4, "#5a3d29");
    px(ctx, 9, 24, 2, 3, "#a06b3d"); px(ctx, 14, 23, 2, 4, "#8a5a34"); px(ctx, 18, 24, 1, 3, "#c18345");
    for (const [x, y, c] of [[4, 13, "#347a3d"], [9, 8, "#4d9d4e"], [15, 7, "#62ad55"], [20, 12, "#3f8e43"], [11, 15, "#74bd5d"], [17, 16, "#559f48"]]) {
      px(ctx, x, y, 6, 8, edge); px(ctx, x + 1, y + 1, 4, 6, c);
      px(ctx, x + 2, y + 1, 1, 5, "#9bd477");
    }
    for (const [x, y, c] of [[6, 13, "#ffe39b"], [17, 9, "#f5b6c1"], [21, 17, "#d8c6ff"]]) {
      px(ctx, x - 1, y, 4, 2, edge); px(ctx, x, y - 1, 2, 4, edge);
      px(ctx, x, y, 2, 2, c); px(ctx, x + 1, y + 1, 1, 1, "#fff8d0");
    }
  } else if (kind === "crystal_ore") {
    // Heavy ore pedestal with four distinct, faceted crystal teeth.
    px(ctx, 3, 21, 22, 7, edge); px(ctx, 5, 19, 18, 8, "#46535d");
    px(ctx, 7, 20, 7, 3, "#707d84"); px(ctx, 16, 23, 5, 3, "#303c45");
    const shards = [
      [11, 4, 7, 18, "#73b9df", "#d7f5ff"],
      [4, 11, 8, 13, "#578eaf", "#b8e8fb"],
      [17, 9, 7, 15, "#69a6cf", "#c9f1ff"],
      [8, 14, 5, 10, "#8bcbea", "#ecfbff"],
    ];
    for (const [x, y, w, h, mid, hi] of shards) {
      px(ctx, x, y + 3, w, h - 3, edge); px(ctx, x + 2, y, w - 3, 3, edge);
      px(ctx, x + 1, y + 4, w - 2, h - 5, mid); px(ctx, x + 2, y + 2, w - 4, 3, mid);
      px(ctx, x + 2, y + 4, 1, Math.max(3, h - 7), hi);
      px(ctx, x + w - 3, y + 6, 1, Math.max(2, h - 9), "#3f749b");
    }
    px(ctx, 13, 7, 2, 3, "#ffffff"); px(ctx, 20, 12, 1, 2, "#e9fbff");
  } else {
    // Glow-vine: a coiled gel-bearing plant with luminous seed pods.
    px(ctx, 5, 25, 18, 3, edge); px(ctx, 7, 24, 14, 3, "#335d3b");
    const stems = [[13, 26, 8, 7], [14, 25, 20, 5], [12, 25, 4, 8]];
    for (const [x1, y1, x2, y2] of stems) {
      pixelStem(ctx, x1, y1, x2, y2, edge, 3);
      pixelStem(ctx, x1, y1, x2, y2, "#4c8b55", 1);
    }
    for (const [x, y, c] of [[5, 7, "#79e2a7"], [19, 5, "#63dca4"], [2, 15, "#5ac990"], [20, 14, "#92efbd"]]) {
      px(ctx, x - 1, y + 2, 8, 7, edge); px(ctx, x, y + 1, 6, 7, "#328b64");
      px(ctx, x + 1, y, 4, 7, c); px(ctx, x + 2, y + 1, 2, 3, "#e2ffe9");
      px(ctx, x + 1, y + 6, 4, 2, "#286f55");
    }
    px(ctx, 11, 15, 4, 3, "#9dffd0"); px(ctx, 12, 16, 2, 1, "#ffffff");
  }
  return cv;
}

function pixelStem(ctx, x0, y0, x1, y1, color, size = 1) {
  let x = x0, y = y0;
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  while (true) {
    px(ctx, x, y, size, size, color);
    if (x === x1 && y === y1) break;
    const e2 = err * 2;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

function materialSprite(kind) {
  const cv = canvas(20, 20);
  const ctx = cv.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  if (kind === "wood") {
    px(ctx, 3, 5, 14, 11, "#34251f"); px(ctx, 4, 4, 12, 11, "#855333");
    px(ctx, 5, 5, 10, 3, "#b97a45"); px(ctx, 6, 9, 8, 2, "#673b2b");
    px(ctx, 12, 5, 3, 3, "#e0a05c"); px(ctx, 5, 13, 4, 1, "#d08a4d");
  } else if (kind === "ore") {
    px(ctx, 2, 10, 16, 7, "#29323b"); px(ctx, 4, 7, 12, 9, "#596875");
    px(ctx, 7, 3, 6, 11, "#4689b0"); px(ctx, 8, 2, 4, 4, "#a9e8ff");
    px(ctx, 9, 5, 1, 6, "#e5fbff"); px(ctx, 4, 12, 4, 2, "#84939a");
  } else if (kind === "gel") {
    px(ctx, 4, 6, 12, 11, "#214d46"); px(ctx, 3, 9, 14, 6, "#328f73");
    px(ctx, 5, 5, 10, 10, "#61c99a"); px(ctx, 7, 4, 6, 3, "#8be7b7");
    px(ctx, 7, 7, 3, 3, "#d6ffe9"); px(ctx, 13, 11, 2, 3, "#2d775f");
    px(ctx, 6, 15, 3, 2, "#19463f"); px(ctx, 12, 15, 3, 2, "#19463f");
  } else {
    px(ctx, 9, 3, 2, 15, "#2f6034");
    for (const [x, y, c] of [[3, 5, "#60a94e"], [10, 7, "#79be59"], [4, 11, "#4e9344"], [10, 12, "#8acb66"]]) {
      px(ctx, x, y, 7, 5, "#254d2d"); px(ctx, x + 1, y, 5, 4, c); px(ctx, x + 2, y + 1, 3, 1, "#b4df85");
    }
    px(ctx, 8, 8, 4, 4, "#eadb8a"); px(ctx, 9, 9, 2, 2, "#fff4bc");
  }
  return cv;
}

function chestSprite(open, pet = false) {
  const cv = canvas(24, 20);
  const ctx = cv.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  shadow(ctx, 12, 18, 20);
  const edge = pet ? "#231f35" : "#251c25";
  const woodD = pet ? "#49385d" : "#63382b", wood = pet ? "#715184" : "#9a542f", woodL = pet ? "#a77ac0" : "#ca7840";
  const iron = pet ? "#4d4660" : "#423f4a", goldD = pet ? "#8f6823" : "#9c6a24", gold = pet ? "#f0c554" : "#e3ae42", shine = "#fff0a5";

  if (!open) {
    px(ctx, 3, 5, 18, 13, edge);
    px(ctx, 2, 8, 20, 9, edge);
    px(ctx, 4, 5, 16, 3, woodL);
    px(ctx, 3, 8, 18, 8, wood);
    px(ctx, 4, 10, 16, 5, woodD);
    px(ctx, 4, 10, 16, 2, wood);
    px(ctx, 3, 8, 18, 2, goldD);
    px(ctx, 4, 8, 16, 1, gold);
    px(ctx, 4, 14, 16, 2, goldD);
    px(ctx, 3, 6, 2, 10, iron);
    px(ctx, 19, 6, 2, 10, iron);
    px(ctx, 10, 8, 4, 7, goldD);
    px(ctx, 11, 9, 2, 4, shine);
    px(ctx, 7, 6, 5, 1, "#e99a55");
    px(ctx, 5, 12, 2, 1, "#d98a4c");
    px(ctx, 16, 11, 2, 2, pet ? "#dcb6ff" : "#f0a05e");
    px(ctx, 6, 15, 3, 1, pet ? "#8f6cac" : "#7a402c");
    if (pet) {
      // Paw-lock and moonlit corners distinguish companion caches at a glance.
      px(ctx, 7, 3, 2, 2, "#ffe38a"); px(ctx, 15, 3, 2, 2, "#ffe38a");
      px(ctx, 10, 10, 1, 1, "#fff1ad"); px(ctx, 13, 10, 1, 1, "#fff1ad");
      px(ctx, 11, 11, 2, 2, "#fff1ad");
    }
  } else {
    // Raised lid, bright interior, and the same reinforced base.
    px(ctx, 3, 1, 18, 8, edge);
    px(ctx, 4, 2, 16, 5, wood);
    px(ctx, 5, 2, 14, 2, woodL);
    px(ctx, 3, 7, 18, 2, goldD);
    px(ctx, 5, 8, 14, 5, "#1a131c");
    px(ctx, 7, 9, 10, 3, "#7d4d21");
    px(ctx, 2, 11, 20, 7, edge);
    px(ctx, 3, 12, 18, 5, wood);
    px(ctx, 4, 14, 16, 2, woodD);
    px(ctx, 3, 12, 18, 2, gold);
    px(ctx, 3, 15, 2, 2, iron);
    px(ctx, 19, 15, 2, 2, iron);
    px(ctx, 10, 12, 4, 5, goldD);
    px(ctx, 11, 12, 2, 3, shine);
    px(ctx, 7, 8, 2, 2, "#ffe99b");
    px(ctx, 15, 7, 2, 2, "#ffd25b");
    px(ctx, 11, 6, 1, 2, "#fff3bd");
    px(ctx, 6, 10, 2, 1, pet ? "#d8b6ff" : "#f4b25f");
    px(ctx, 16, 9, 2, 1, pet ? "#f6dcff" : "#ffe281");
    if (pet) { px(ctx, 10, 5, 4, 2, "#c98cff"); px(ctx, 11, 4, 2, 1, "#fff1ad"); }
  }
  return cv;
}

function hitSprite(frame) {
  const cv = canvas(16, 16);
  const ctx = cv.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const white = "#fff8d8", gold = "#ffd05a", orange = "#f28a3a", red = "#d94b3d";
  if (frame === 0) {
    px(ctx, 7, 4, 2, 8, white); px(ctx, 4, 7, 8, 2, white);
    px(ctx, 6, 6, 4, 4, gold);
    px(ctx, 3, 3, 2, 2, orange); px(ctx, 11, 3, 2, 2, orange);
    px(ctx, 3, 11, 2, 2, red); px(ctx, 11, 11, 2, 2, red);
  } else if (frame === 1) {
    px(ctx, 7, 1, 2, 5, white); px(ctx, 7, 10, 2, 5, gold);
    px(ctx, 1, 7, 5, 2, gold); px(ctx, 10, 7, 5, 2, white);
    px(ctx, 3, 3, 3, 2, orange); px(ctx, 10, 3, 3, 2, red);
    px(ctx, 3, 11, 3, 2, red); px(ctx, 10, 11, 3, 2, orange);
    px(ctx, 7, 7, 2, 2, white);
  } else if (frame === 2) {
    px(ctx, 5, 2, 6, 2, gold); px(ctx, 5, 12, 6, 2, orange);
    px(ctx, 2, 5, 2, 6, orange); px(ctx, 12, 5, 2, 6, gold);
    px(ctx, 4, 4, 2, 2, white); px(ctx, 10, 4, 2, 2, white);
    px(ctx, 4, 10, 2, 2, red); px(ctx, 10, 10, 2, 2, red);
  } else {
    px(ctx, 2, 3, 2, 2, gold); px(ctx, 12, 2, 1, 2, white);
    px(ctx, 5, 12, 2, 2, orange); px(ctx, 12, 11, 2, 1, red);
    px(ctx, 1, 9, 1, 2, white); px(ctx, 9, 6, 2, 2, gold);
  }
  return cv;
}

function slashSprite(frame) {
  const cv = canvas(40, 40);
  const ctx = cv.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const start = frame * 4;
  const points = [
    [7, 31], [9, 27], [12, 23], [15, 19], [19, 15], [23, 12],
    [27, 9], [31, 7], [34, 6],
  ];
  for (let i = 0; i < points.length; i++) {
    if (i < start / 2 || i > start / 2 + 5) continue;
    const [x, y] = points[i];
    px(ctx, x, y, 4, 2, i < 3 ? "#f08a3c" : "#fff4c0");
    px(ctx, x + 1, y - 1, 3, 1, "#ffffff");
  }
  return cv;
}

function campfireSprite(frame) {
  const cv = canvas(44, 42);
  const ctx = cv.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const f = frame % 6;

  // Ground shadow, uneven stone ring, and crossed split logs.
  shadow(ctx, 22, 36, 34);
  const stones = [
    [6, 30, 7, 4], [13, 34, 7, 4], [22, 35, 7, 4], [31, 31, 7, 4],
    [30, 27, 6, 4], [8, 26, 6, 4],
  ];
  for (let i = 0; i < stones.length; i++) {
    const [x, y, w, h] = stones[i];
    px(ctx, x, y, w, h, i % 2 ? "#5b524b" : "#6f6256");
    px(ctx, x + 1, y, Math.max(2, w - 2), 1, i % 2 ? "#8b7967" : "#9b8873");
  }
  px(ctx, 10, 27, 25, 5, "#3b2722");
  px(ctx, 12, 26, 21, 3, "#7d4229");
  px(ctx, 14, 26, 5, 2, "#b26335");
  px(ctx, 11, 30, 24, 4, "#35231f");
  px(ctx, 14, 29, 18, 3, "#6d3927");
  px(ctx, 27, 29, 4, 2, "#a85831");

  // Six deliberately different stepped silhouettes avoid rubbery ellipse fire.
  const silhouettes = [
    [[18, 6, 8, 19], [14, 13, 7, 13], [24, 12, 6, 14]],
    [[17, 9, 10, 16], [21, 4, 5, 14], [13, 15, 7, 11]],
    [[16, 6, 8, 19], [23, 10, 7, 16], [13, 14, 6, 12]],
    [[19, 4, 7, 21], [14, 11, 7, 15], [25, 15, 5, 11]],
    [[16, 8, 11, 18], [13, 16, 6, 10], [24, 7, 5, 18]],
    [[18, 5, 8, 21], [14, 12, 6, 14], [24, 14, 7, 12]],
  ][f];
  for (const [x, y, w, h] of silhouettes) {
    px(ctx, x, y + 4, w, h - 4, "#b83b22");
    px(ctx, x + 1, y + 2, Math.max(2, w - 2), h - 5, "#ed6c25");
  }
  const innerX = [19, 19, 17, 20, 18, 19][f];
  const innerY = [13, 11, 12, 9, 13, 10][f];
  px(ctx, innerX, innerY, 7, 13, "#ffb52e");
  px(ctx, innerX + 2, innerY + 4, 4, 9, "#ffe77b");
  px(ctx, innerX + 3, innerY + 8, 2, 5, "#fff7cf");
  px(ctx, 14 + (f * 5) % 17, 3 + (f * 3) % 7, 2, 2, f % 2 ? "#ffcf4a" : "#f07127");
  if (f === 1 || f === 4) px(ctx, 29, 7, 1, 2, "#ffd65a");
  return cv;
}

function heartSprite(filled) {
  const cv = canvas(11, 10);
  const ctx = cv.getContext("2d");
  const edge = "#4a2028", red = filled ? "#dc4956" : "#3b3036", hi = filled ? "#ff8790" : "#66545a";
  px(ctx, 1, 2, 4, 5, edge); px(ctx, 6, 2, 4, 5, edge);
  px(ctx, 2, 1, 3, 2, edge); px(ctx, 6, 1, 3, 2, edge);
  px(ctx, 3, 7, 5, 2, edge); px(ctx, 5, 9, 1, 1, edge);
  px(ctx, 2, 3, 7, 4, red); px(ctx, 3, 2, 2, 2, red); px(ctx, 6, 2, 2, 2, red);
  px(ctx, 3, 3, 2, 2, hi);
  return cv;
}

const BUILDERS = [
  ["tree_0", () => treeSprite(0)],
  ["tree_1", () => treeSprite(1)],
  ["tree_2", () => treeSprite(2)],
  ["tree_3", () => treeSprite(3)],
  ["bush_0", bushSprite],
  ["fx/chest", () => chestSprite(false)],
  ["fx/chest_open", () => chestSprite(true)],
  ["fx/chest_pet", () => chestSprite(false, true)],
  ["fx/chest_pet_open", () => chestSprite(true, true)],
  ["resource/bamboo_shoot", () => resourceSprite("bamboo_shoot")],
  ["resource/herb_bush", () => resourceSprite("herb_bush")],
  ["resource/crystal_ore", () => resourceSprite("crystal_ore")],
  ["resource/glow_vine", () => resourceSprite("glow_vine")],
  ["item/wood", () => materialSprite("wood")],
  ["item/ore", () => materialSprite("ore")],
  ["item/gel", () => materialSprite("gel")],
  ["item/herb", () => materialSprite("herb")],
  ["fx/hit_0", () => hitSprite(0)],
  ["fx/hit_1", () => hitSprite(1)],
  ["fx/hit_2", () => hitSprite(2)],
  ["fx/hit_3", () => hitSprite(3)],
  ["fx/slash_0", () => slashSprite(0)],
  ["fx/slash_1", () => slashSprite(1)],
  ["fx/slash_2", () => slashSprite(2)],
  ["fx/slash_3", () => slashSprite(3)],
  ["fx/campfire_0", () => campfireSprite(0)],
  ["fx/campfire_1", () => campfireSprite(1)],
  ["fx/campfire_2", () => campfireSprite(2)],
  ["fx/campfire_3", () => campfireSprite(3)],
  ["fx/campfire_4", () => campfireSprite(4)],
  ["fx/campfire_5", () => campfireSprite(5)],
  ["fx/heart", () => heartSprite(true)],
  ["fx/heart_empty", () => heartSprite(false)],
];

export async function loadAll(onProgress) {
  let done = 0;
  for (const [key, build] of BUILDERS) {
    if (!cache.has(key)) cache.set(key, build());
    onProgress?.(++done, BUILDERS.length);
  }
  // Keep the original asynchronous contract without any network or file request.
  await Promise.resolve();
  return cache;
}

export function img(key) { return cache.get(key); }
export const MONSTERS = [];
export const PET_IDS = [];
