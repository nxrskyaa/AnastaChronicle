// Infernyx: an original code-generated oni fire-dragon.
// The sprite uses integer pixel clusters only and is cached into four normal
// and four rage frames. No external art is loaded.
const W = 96, H = 96;

function canvas() {
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
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

function pixelLine(ctx, x0, y0, x1, y1, thickness, color) {
  x0 = Math.round(x0); y0 = Math.round(y0);
  x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  const half = Math.floor(thickness / 2);
  while (true) {
    px(ctx, x0 - half, y0 - half, thickness, thickness, color);
    if (x0 === x1 && y0 === y1) break;
    const e2 = err * 2;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

function outline(source, color) {
  const ctx = source.getContext("2d");
  const image = ctx.getImageData(0, 0, W, H);
  const data = image.data;
  const out = ctx.createImageData(W, H);
  out.data.set(data);
  const alpha = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return 0;
    return data[(y * W + x) * 4 + 3];
  };
  const n = parseInt(color.slice(1), 16);
  const cr = (n >> 16) & 255, cg = (n >> 8) & 255, cb = n & 255;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (alpha(x, y) > 24) continue;
      let near = false;
      for (let oy = -1; oy <= 1 && !near; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          if ((ox || oy) && alpha(x + ox, y + oy) > 48) { near = true; break; }
        }
      }
      if (near) {
        const i = (y * W + x) * 4;
        out.data[i] = cr;
        out.data[i + 1] = cg;
        out.data[i + 2] = cb;
        out.data[i + 3] = 255;
      }
    }
  }
  ctx.putImageData(out, 0, 0);
}

function shadow(ctx) {
  px(ctx, 24, 86, 48, 2, "rgba(13,9,14,0.18)");
  px(ctx, 18, 88, 60, 3, "rgba(13,9,14,0.30)");
  px(ctx, 25, 91, 46, 2, "rgba(13,9,14,0.22)");
  px(ctx, 34, 93, 28, 1, "rgba(13,9,14,0.14)");
}

function flame(ctx, x, y, size, pal, lean) {
  const s = Math.max(1, Math.round(size));
  const l = Math.round(lean || 0);
  px(ctx, x - 4 * s, y - 5 * s, 8 * s, 5 * s, pal.outer);
  px(ctx, x - 3 * s + l, y - 9 * s, 6 * s, 5 * s, pal.outer);
  px(ctx, x - 2 * s + l, y - 13 * s, 4 * s, 5 * s, pal.mid);
  px(ctx, x - s + l * 2, y - 16 * s, 2 * s, 4 * s, pal.hot);
  px(ctx, x - 2 * s, y - 6 * s, 4 * s, 5 * s, pal.hot);
  px(ctx, x - s, y - 5 * s, 2 * s, 3 * s, pal.core);
}

const NORMAL = {
  outline: "#1a111b",
  armor: "#321823",
  armorHi: "#59302e",
  bodyD: "#681c20",
  body: "#992823",
  bodyL: "#c54827",
  scale: "#eb6c30",
  bellyD: "#9b572e",
  belly: "#d99145",
  hornD: "#625646",
  horn: "#c7b38b",
  hornHi: "#f0dfb3",
  eye: "#ffd45c",
  flame: { outer: "#9f2920", mid: "#e55022", hot: "#f79632", core: "#ffe06b" },
};

const RAGE = {
  outline: "#160b16",
  armor: "#25101d",
  armorHi: "#5e1b29",
  bodyD: "#8d171d",
  body: "#d52a1c",
  bodyL: "#f14d20",
  scale: "#ff8b2d",
  bellyD: "#b85125",
  belly: "#f09a35",
  hornD: "#6e2a27",
  horn: "#e6a44d",
  hornHi: "#fff0a3",
  eye: "#fff5b0",
  flame: { outer: "#b71c1b", mid: "#ff4020", hot: "#ff9e2f", core: "#fff39a" },
};

function aura(ctx, frame, rage) {
  const embers = rage ? 18 : 8;
  const cols = rage ? ["#ff4424", "#ff8a2c", "#ffd45a"] : ["#bd3c26", "#ef7130", "#ffc457"];
  for (let i = 0; i < embers; i++) {
    const x = 8 + ((i * 29 + frame * 11) % 80);
    const y = 8 + ((i * 17 + frame * 7) % 70);
    if (x > 31 && x < 65 && y > 15 && y < 78) continue;
    const size = rage && i % 5 === 0 ? 3 : 2;
    px(ctx, x, y, size, size, cols[(i + frame) % cols.length]);
    if (rage && i % 4 === 0) px(ctx, x, y - 3, 1, 2, "#ffe58a");
  }
  if (rage) {
    // A stepped corona keeps the rage silhouette broad without soft blur.
    px(ctx, 13, 34, 4, 27, "rgba(217,38,25,0.28)");
    px(ctx, 9, 43, 4, 15, "rgba(255,91,27,0.22)");
    px(ctx, 79, 34, 4, 27, "rgba(217,38,25,0.28)");
    px(ctx, 83, 43, 4, 15, "rgba(255,91,27,0.22)");
    px(ctx, 23, 14, 4, 13, "rgba(255,75,25,0.24)");
    px(ctx, 69, 14, 4, 13, "rgba(255,75,25,0.24)");
  }
}

function drawInfernyx(ctx, frame, rage) {
  const p = rage ? RAGE : NORMAL;
  const bob = [0, -1, -2, 0][frame];
  const tailSway = [-3, 0, 4, 1][frame];
  const armLift = [0, -2, -5, -1][frame];
  const maneLift = [0, -1, -3, -1][frame];
  const roar = frame === 2;

  aura(ctx, frame, rage);
  shadow(ctx);

  const sprite = canvas();
  const s = sprite.getContext("2d");
  s.imageSmoothingEnabled = false;

  // Coiling ryuu tail behind the body, tipped with a living flame.
  pixelLine(s, 51, 68 + bob, 66, 77 + bob, 12, p.bodyD);
  pixelLine(s, 66, 77 + bob, 80 + tailSway, 72 + bob, 10, p.bodyD);
  pixelLine(s, 80 + tailSway, 72 + bob, 86 + tailSway, 59 + bob, 8, p.bodyD);
  pixelLine(s, 52, 67 + bob, 66, 75 + bob, 7, p.body);
  pixelLine(s, 66, 75 + bob, 79 + tailSway, 70 + bob, 6, p.body);
  pixelLine(s, 79 + tailSway, 70 + bob, 85 + tailSway, 58 + bob, 5, p.bodyL);
  flame(s, 85 + tailSway, 55 + bob, rage ? 2 : 1, p.flame, frame === 1 ? 1 : -1);

  // Flame mantle replaces conventional wings: five banner-like tongues.
  const mantleSize = rage ? 2 : 1;
  flame(s, 20, 53 + bob, mantleSize, p.flame, -1);
  flame(s, 76, 53 + bob, mantleSize, p.flame, 1);
  flame(s, 28, 39 + bob, 1, p.flame, -1);
  flame(s, 68, 39 + bob, 1, p.flame, 1);
  if (rage) {
    flame(s, 15, 68 + bob, 1, p.flame, -1);
    flame(s, 81, 68 + bob, 1, p.flame, 1);
  }

  // Heavy feet and talons establish the grounded oni stance.
  diamond(s, 34, 78 + bob, 9, 9, p.bodyD);
  diamond(s, 62, 78 + bob, 9, 9, p.bodyD);
  px(s, 26, 83 + bob, 16, 5, p.armor);
  px(s, 54, 83 + bob, 16, 5, p.armor);
  for (const x of [27, 32, 37, 55, 60, 65]) {
    px(s, x, 87 + bob, 3, 4, p.horn);
    px(s, x + 1, 90 + bob, 2, 2, p.hornHi);
  }

  // Armored serpentine torso.
  diamond(s, 48, 61 + bob, 21, 25, p.bodyD);
  diamond(s, 48, 57 + bob, 17, 21, p.body);
  px(s, 37, 43 + bob, 22, 28, p.body);
  px(s, 39, 45 + bob, 7, 24, p.bodyL);
  px(s, 50, 46 + bob, 7, 23, p.bodyD);
  diamond(s, 48, 63 + bob, 10, 17, p.bellyD);
  for (let y = 51; y <= 73; y += 6) {
    const width = y < 68 ? 14 : 10;
    px(s, 48 - width / 2, y + bob, width, 4, p.belly);
    px(s, 48 - width / 2, y + bob + 3, width, 1, p.bellyD);
  }
  // Interlocking scale diamonds.
  for (const [x, y] of [[34, 51], [62, 51], [32, 59], [64, 59], [34, 68], [62, 68]]) {
    diamond(s, x, y + bob, 3, 3, p.scale);
    px(s, x - 1, y - 2 + bob, 2, 2, p.bodyL);
  }

  // Broad shoulder plates and long clawed arms.
  diamond(s, 29, 49 + bob + armLift, 10, 8, p.armor);
  diamond(s, 67, 49 + bob + armLift, 10, 8, p.armor);
  px(s, 22, 46 + bob + armLift, 10, 4, p.armorHi);
  px(s, 64, 46 + bob + armLift, 10, 4, p.armorHi);
  pixelLine(s, 27, 53 + bob + armLift, 18, 68 + bob + armLift, 8, p.body);
  pixelLine(s, 69, 53 + bob + armLift, 78, 68 + bob + armLift, 8, p.body);
  px(s, 13, 66 + bob + armLift, 11, 6, p.armor);
  px(s, 72, 66 + bob + armLift, 11, 6, p.armor);
  for (const x of [13, 18, 23, 74, 79]) px(s, x, 71 + bob + armLift, 3, 5, p.horn);

  // Neck and fire mane.
  px(s, 39, 29 + bob, 18, 22, p.bodyD);
  px(s, 42, 28 + bob, 12, 23, p.body);
  flame(s, 31, 31 + bob + maneLift, 1, p.flame, -1);
  flame(s, 65, 31 + bob + maneLift, 1, p.flame, 1);
  flame(s, 39, 24 + bob + maneLift, 1, p.flame, -1);
  flame(s, 57, 24 + bob + maneLift, 1, p.flame, 1);
  if (rage) flame(s, 48, 20 + bob + maneLift, 1, p.flame, frame & 1 ? 1 : -1);

  // Oni kabuto horns curve up, then outward.
  pixelLine(s, 40, 26 + bob, 32, 15 + bob, 7, p.hornD);
  pixelLine(s, 32, 15 + bob, 21, 8 + bob, 6, p.hornD);
  pixelLine(s, 21, 8 + bob, 15, 11 + bob, 4, p.hornD);
  pixelLine(s, 40, 25 + bob, 32, 15 + bob, 4, p.horn);
  pixelLine(s, 32, 15 + bob, 21, 8 + bob, 3, p.horn);
  pixelLine(s, 21, 8 + bob, 15, 11 + bob, 2, p.hornHi);
  pixelLine(s, 56, 26 + bob, 64, 15 + bob, 7, p.hornD);
  pixelLine(s, 64, 15 + bob, 75, 8 + bob, 6, p.hornD);
  pixelLine(s, 75, 8 + bob, 81, 11 + bob, 4, p.hornD);
  pixelLine(s, 56, 25 + bob, 64, 15 + bob, 4, p.horn);
  pixelLine(s, 64, 15 + bob, 75, 8 + bob, 3, p.horn);
  pixelLine(s, 75, 8 + bob, 81, 11 + bob, 2, p.hornHi);

  // Wide mask-like head with cheek guards.
  diamond(s, 48, 31 + bob, 18, 14, p.bodyD);
  px(s, 31, 27 + bob, 34, 12, p.body);
  px(s, 35, 22 + bob, 26, 14, p.body);
  px(s, 31, 31 + bob, 8, 12, p.armor);
  px(s, 57, 31 + bob, 8, 12, p.armor);
  px(s, 34, 24 + bob, 10, 4, p.armorHi);
  px(s, 52, 24 + bob, 10, 4, p.armorHi);

  // Brow plates, burning eyes, and a forehead flame crest.
  px(s, 34, 28 + bob, 12, 4, p.armor);
  px(s, 50, 28 + bob, 12, 4, p.armor);
  px(s, 37, 31 + bob, 7, 3, p.eye);
  px(s, 52, 31 + bob, 7, 3, p.eye);
  px(s, 40, 32 + bob, 3, 2, "#5a1018");
  px(s, 53, 32 + bob, 3, 2, "#5a1018");
  px(s, 46, 20 + bob, 4, 9, p.flame.outer);
  px(s, 47, 18 + bob, 2, 7, p.flame.hot);
  px(s, 44, 23 + bob, 8, 3, p.flame.mid);

  // Dragon muzzle, nostrils, tusks, and a frame-specific roar.
  px(s, 37, 35 + bob, 22, 9, p.bodyL);
  px(s, 39, 36 + bob, 18, 7, p.belly);
  px(s, 41, 37 + bob, 3, 2, "#41131a");
  px(s, 52, 37 + bob, 3, 2, "#41131a");
  if (roar) {
    px(s, 36, 42 + bob, 24, 12, p.bodyD);
    px(s, 39, 43 + bob, 18, 8, "#1b1018");
    px(s, 39, 43 + bob, 4, 4, p.hornHi);
    px(s, 53, 43 + bob, 4, 4, p.hornHi);
    px(s, 42, 49 + bob, 12, 3, p.flame.mid);
    px(s, 45, 48 + bob, 6, 3, p.flame.core);
  } else {
    px(s, 38, 43 + bob, 20, 5, p.bodyD);
    px(s, 41, 44 + bob, 14, 2, "#27131a");
  }
  px(s, 34, 40 + bob, 5, 8, p.horn);
  px(s, 57, 40 + bob, 5, 8, p.horn);
  px(s, 35, 46 + bob, 3, 4, p.hornHi);
  px(s, 58, 46 + bob, 3, 4, p.hornHi);

  // Long pixel whiskers evoke a Japanese dragon without borrowing a stock silhouette.
  pixelLine(s, 37, 40 + bob, 24, 42 + bob, 2, p.hornHi);
  pixelLine(s, 24, 42 + bob, 17, 38 + bob, 1, p.horn);
  pixelLine(s, 59, 40 + bob, 72, 42 + bob, 2, p.hornHi);
  pixelLine(s, 72, 42 + bob, 79, 38 + bob, 1, p.horn);

  if (rage) {
    // Molten fissures make the rage frames visibly distinct at gameplay scale.
    px(s, 31, 56 + bob, 3, 7, p.flame.hot);
    px(s, 33, 61 + bob, 4, 3, p.flame.mid);
    px(s, 63, 55 + bob, 3, 8, p.flame.hot);
    px(s, 60, 61 + bob, 5, 3, p.flame.mid);
    px(s, 45, 68 + bob, 2, 7, p.flame.core);
    px(s, 47, 72 + bob, 4, 2, p.flame.hot);
  }

  outline(sprite, p.outline);
  ctx.drawImage(sprite, 0, 0);

  // Crisp eye corona is added after outlining so it remains luminous.
  px(ctx, 35, 30 + bob, 2, 5, rage ? "#ff7a28" : "#d44a24");
  px(ctx, 59, 30 + bob, 2, 5, rage ? "#ff7a28" : "#d44a24");
  px(ctx, 38, 31 + bob, 5, 2, p.eye);
  px(ctx, 53, 31 + bob, 5, 2, p.eye);
  px(ctx, 40, 31 + bob, 2, 1, "#fffce0");
  px(ctx, 54, 31 + bob, 2, 1, "#fffce0");
}

const cache = { normal: [], rage: [] };

export function buildBoss() {
  cache.normal = [];
  cache.rage = [];
  for (let frame = 0; frame < 4; frame++) {
    const normal = canvas();
    const normalCtx = normal.getContext("2d");
    normalCtx.imageSmoothingEnabled = false;
    drawInfernyx(normalCtx, frame, false);
    cache.normal.push(normal);

    const enraged = canvas();
    const rageCtx = enraged.getContext("2d");
    rageCtx.imageSmoothingEnabled = false;
    drawInfernyx(rageCtx, frame, true);
    cache.rage.push(enraged);
  }
  return cache;
}

export function bossFrame(frame, rage) {
  const frames = rage ? cache.rage : cache.normal;
  if (!frames.length) return null;
  const index = ((frame % 4) + 4) % 4;
  return frames[index];
}

export const BOSS_SIZE = W;
