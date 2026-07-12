// Procedural 24px terrain tiles for the code-drawn world.
// The generator favours broad, authored clusters over random pixel confetti.
// Everything is baked into canvases by buildTiles(), so rendering stays cheap.

const TS = 24;

const PAL = {
  grass: ["#70b95a", "#69b253", "#77bd60", "#65ac50"],
  grassHi: "#8acb70",
  grassMid: "#5ca34b",
  grassLo: "#4d8f43",
  forest: ["#4f9349", "#498b44", "#57994e"],
  forestHi: "#6fb463",
  forestMid: "#3f7e40",
  forestLo: "#356b3a",
  dirt: ["#bf9160", "#b88958", "#c39968"],
  dirtHi: "#d5aa77",
  dirtMid: "#aa784d",
  dirtLo: "#8e613f",
  sand: ["#ead7a5", "#e4ce99", "#f0deb1"],
  sandHi: "#f7e8c4",
  sandLo: "#cfb77e",
  water: ["#52b5d9", "#49a9d0", "#61bedf"],
  waterLo: "#388fb9",
  waterHi: "#a9e5ef",
  snow: ["#e8f0f5", "#dfe9f0", "#f0f6f9"],
  snowHi: "#ffffff",
  snowLo: "#c3d3df",
};

function C() {
  const cv = document.createElement("canvas");
  cv.width = TS;
  cv.height = TS;
  const ctx = cv.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  return cv;
}

function noise(seed) {
  const x = Math.sin(seed * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function broadGroundPatches(ctx, variant, light, shade, dark = false) {
  const flip = variant & 1;
  ctx.fillStyle = light;
  ctx.globalAlpha = dark ? 0.18 : 0.16;
  ctx.fillRect(flip ? 2 : 13, 2 + (variant % 3), 8, 3);
  ctx.fillRect(flip ? 14 : 4, 12 + ((variant + 1) % 3), 6, 4);
  ctx.fillStyle = shade;
  ctx.globalAlpha = dark ? 0.22 : 0.17;
  ctx.fillRect(flip ? 8 : 1, 19, 9, 3);
  ctx.fillRect(flip ? 1 : 16, 8, 7, 3);
  ctx.globalAlpha = 1;
}

function groundStone(ctx, x, y, mossy = false) {
  ctx.fillStyle = "rgba(57,47,37,0.24)";
  ctx.fillRect(x + 1, y + 4, 6, 1);
  ctx.fillStyle = mossy ? "#77765b" : "#88765e";
  ctx.fillRect(x + 1, y + 1, 5, 3);
  ctx.fillRect(x + 2, y, 3, 1);
  ctx.fillStyle = mossy ? "#a1a87a" : "#b9a487";
  ctx.fillRect(x + 2, y + 1, 3, 1);
  ctx.fillRect(x + 1, y + 2, 1, 1);
  ctx.fillStyle = mossy ? "#56864a" : "#6e5f4e";
  ctx.fillRect(x + 5, y + 3, 1, 1);
  if (mossy) ctx.fillRect(x + 3, y, 2, 1);
}

function grassTuft(ctx, x, y, dark = false, tall = false) {
  const h = tall ? 5 : 4;
  ctx.fillStyle = dark ? PAL.forestMid : PAL.grassLo;
  ctx.fillRect(x, y + 2, 2, h - 1);
  ctx.fillRect(x + 4, y + 2, 1, h - 1);
  ctx.fillStyle = dark ? PAL.forestHi : PAL.grassHi;
  ctx.fillRect(x + 2, y, 1, h + 1);
  ctx.fillRect(x + 3, y + 1, 1, h - 1);
  ctx.fillRect(x + 1, y + 2, 1, h - 2);
}

function tinyFlower(ctx, x, y, petals, core = "#f5d86a") {
  ctx.fillStyle = "#4c9145";
  ctx.fillRect(x + 2, y + 3, 1, 3);
  ctx.fillStyle = petals;
  ctx.fillRect(x + 1, y, 3, 1);
  ctx.fillRect(x, y + 1, 5, 2);
  ctx.fillRect(x + 1, y + 3, 3, 1);
  ctx.fillStyle = core;
  ctx.fillRect(x + 2, y + 1, 1, 1);
}

function meadowMotif(ctx, variant) {
  switch (variant % 8) {
    case 0:
      grassTuft(ctx, 15, 14, false, true);
      break;
    case 1:
      // A single readable clover cluster.
      ctx.fillStyle = "#4c984a";
      ctx.fillRect(17, 15, 1, 5);
      ctx.fillStyle = "#91d275";
      ctx.fillRect(14, 13, 3, 3);
      ctx.fillRect(17, 12, 3, 3);
      ctx.fillRect(18, 15, 3, 3);
      ctx.fillStyle = "#cce7a1";
      ctx.fillRect(16, 14, 1, 1);
      break;
    case 2:
      groundStone(ctx, 14, 16, true);
      break;
    case 3:
      tinyFlower(ctx, 16, 13, "#f2c765");
      break;
    case 4:
      // Fallen leaves grouped as one motif, not scattered noise.
      ctx.fillStyle = "#ba7144";
      ctx.fillRect(4, 17, 4, 2);
      ctx.fillRect(9, 19, 3, 2);
      ctx.fillStyle = "#dc9a54";
      ctx.fillRect(5, 17, 2, 1);
      ctx.fillRect(9, 19, 2, 1);
      break;
    case 5:
      ctx.fillStyle = "#79543a";
      ctx.fillRect(3, 18, 10, 2);
      ctx.fillRect(9, 16, 2, 3);
      ctx.fillStyle = "#a9764b";
      ctx.fillRect(4, 17, 6, 1);
      break;
    case 6:
      grassTuft(ctx, 15, 15);
      ctx.fillStyle = "#b8df8d";
      ctx.fillRect(19, 14, 2, 2);
      ctx.fillRect(14, 17, 2, 2);
      break;
    case 7:
      tinyFlower(ctx, 4, 14, "#e49ab6", "#ffe17a");
      break;
  }
}

function forestMotif(ctx, variant) {
  switch (variant % 8) {
    case 0:
      // Root knot.
      ctx.fillStyle = "#345f38";
      ctx.fillRect(2, 17, 12, 2);
      ctx.fillRect(8, 14, 2, 6);
      ctx.fillRect(12, 19, 5, 1);
      ctx.fillStyle = "#70985a";
      ctx.fillRect(4, 17, 5, 1);
      break;
    case 1:
      // Mushroom pair.
      ctx.fillStyle = "#d7834e";
      ctx.fillRect(15, 7, 5, 2);
      ctx.fillRect(16, 6, 3, 1);
      ctx.fillStyle = "#f1bb72";
      ctx.fillRect(17, 9, 1, 4);
      ctx.fillStyle = "#eee0b9";
      ctx.fillRect(16, 7, 1, 1);
      break;
    case 2:
      ctx.fillStyle = "#2f6e3c";
      ctx.fillRect(13, 18, 9, 4);
      ctx.fillStyle = "#6eb45d";
      ctx.fillRect(14, 18, 6, 1);
      ctx.fillRect(16, 20, 4, 1);
      break;
    case 3:
      // Broad fern silhouette.
      ctx.fillStyle = "#2f7340";
      ctx.fillRect(7, 11, 1, 9);
      ctx.fillRect(4, 12, 4, 2);
      ctx.fillRect(7, 14, 5, 2);
      ctx.fillRect(3, 16, 5, 2);
      ctx.fillStyle = "#69ad59";
      ctx.fillRect(7, 12, 1, 6);
      break;
    case 4:
      groundStone(ctx, 3, 16, true);
      break;
    case 5:
      ctx.fillStyle = "#8a573b";
      ctx.fillRect(5, 16, 11, 2);
      ctx.fillRect(13, 14, 2, 4);
      ctx.fillStyle = "#bb8152";
      ctx.fillRect(6, 16, 6, 1);
      break;
    case 6:
      grassTuft(ctx, 15, 14, true, true);
      break;
    case 7:
      ctx.fillStyle = "#b86a45";
      ctx.fillRect(4, 17, 4, 2);
      ctx.fillRect(9, 14, 3, 2);
      ctx.fillStyle = "#db9558";
      ctx.fillRect(5, 17, 2, 1);
      ctx.fillRect(9, 14, 2, 1);
      break;
  }
}

function grassTile(variant, dark) {
  const cv = C();
  const ctx = cv.getContext("2d");
  const bases = dark ? PAL.forest : PAL.grass;
  ctx.fillStyle = bases[variant % bases.length];
  ctx.fillRect(0, 0, TS, TS);

  broadGroundPatches(
    ctx,
    variant,
    dark ? PAL.forestHi : PAL.grassHi,
    dark ? PAL.forestLo : PAL.grassLo,
    dark,
  );

  // Two quiet, 2px-wide grass marks make the ground feel alive without static.
  ctx.fillStyle = dark ? PAL.forestHi : PAL.grassHi;
  const ax = 3 + ((variant * 5) % 9);
  const ay = 5 + ((variant * 7) % 8);
  ctx.fillRect(ax, ay, 2, 1);
  ctx.fillRect(ax + 1, ay - 2, 1, 2);
  ctx.fillStyle = dark ? PAL.forestMid : PAL.grassMid;
  const bx = 13 + ((variant * 3) % 6);
  const by = 5 + ((variant * 4) % 7);
  ctx.fillRect(bx, by + 1, 3, 1);
  ctx.fillRect(bx + 1, by, 1, 1);

  if (dark) forestMotif(ctx, variant);
  else meadowMotif(ctx, variant);
  return cv;
}

function roadWear(ctx, variant) {
  const mode = variant % 4;
  ctx.fillStyle = PAL.dirtMid;
  if (mode === 0) {
    ctx.fillRect(2, 9, 8, 2);
    ctx.fillRect(12, 10, 9, 2);
    ctx.fillRect(6, 16, 10, 1);
    ctx.fillStyle = PAL.dirtHi;
    ctx.fillRect(3, 8, 6, 1);
    ctx.fillRect(13, 9, 6, 1);
  } else if (mode === 1) {
    ctx.fillRect(7, 2, 2, 8);
    ctx.fillRect(8, 12, 2, 9);
    ctx.fillRect(15, 5, 2, 11);
    ctx.fillStyle = PAL.dirtHi;
    ctx.fillRect(6, 3, 1, 6);
    ctx.fillRect(14, 6, 1, 8);
  } else if (mode === 2) {
    ctx.fillRect(2, 5, 6, 2);
    ctx.fillRect(7, 9, 7, 2);
    ctx.fillRect(13, 14, 8, 2);
    ctx.fillStyle = PAL.dirtHi;
    ctx.fillRect(3, 4, 4, 1);
    ctx.fillRect(8, 8, 5, 1);
  } else {
    // Rounded stepping-cobble rhythm.
    ctx.fillStyle = "#987c5d";
    ctx.fillRect(3, 7, 5, 3);
    ctx.fillRect(10, 12, 6, 3);
    ctx.fillRect(17, 17, 4, 3);
    ctx.fillStyle = "#b8a07d";
    ctx.fillRect(4, 7, 3, 1);
    ctx.fillRect(11, 12, 4, 1);
    ctx.fillRect(18, 17, 2, 1);
  }
}

function dirtMotif(ctx, variant) {
  switch (variant % 8) {
    case 0:
      groundStone(ctx, 15, 17);
      break;
    case 1:
      // Paired hoof prints.
      ctx.fillStyle = PAL.dirtLo;
      ctx.fillRect(17, 4, 3, 3);
      ctx.fillRect(13, 10, 3, 3);
      ctx.fillStyle = PAL.dirtHi;
      ctx.fillRect(18, 4, 1, 1);
      ctx.fillRect(14, 10, 1, 1);
      break;
    case 2:
      groundStone(ctx, 2, 16, true);
      grassTuft(ctx, 1, 17);
      break;
    case 3:
      ctx.fillStyle = "#754d32";
      ctx.fillRect(4, 18, 12, 2);
      ctx.fillRect(12, 15, 2, 4);
      ctx.fillStyle = "#af7648";
      ctx.fillRect(5, 17, 7, 1);
      break;
    case 4:
      // Shallow puddle with a single clean highlight.
      ctx.fillStyle = "#7e765f";
      ctx.fillRect(5, 17, 13, 3);
      ctx.fillRect(8, 15, 8, 2);
      ctx.fillStyle = "#9f9b7a";
      ctx.fillRect(7, 16, 9, 2);
      ctx.fillStyle = "#c7d8c6";
      ctx.fillRect(9, 16, 5, 1);
      break;
    case 5:
      groundStone(ctx, 16, 4, true);
      break;
    case 6:
      ctx.fillStyle = "#846d52";
      ctx.fillRect(3, 5, 6, 4);
      ctx.fillStyle = "#b99d77";
      ctx.fillRect(4, 5, 4, 1);
      break;
    case 7:
      ctx.fillStyle = "#ad6840";
      ctx.fillRect(16, 18, 4, 2);
      ctx.fillStyle = "#d58f4e";
      ctx.fillRect(17, 18, 2, 1);
      break;
  }
}

function dirtTile(variant) {
  const cv = C();
  const ctx = cv.getContext("2d");
  ctx.fillStyle = PAL.dirt[variant % PAL.dirt.length];
  ctx.fillRect(0, 0, TS, TS);

  // Broad packed-earth patches establish a clear worn centre/value hierarchy.
  ctx.fillStyle = "rgba(232,195,149,0.25)";
  ctx.fillRect(3, 4 + (variant % 3), 14, 4);
  ctx.fillRect(8, 8 + (variant % 3), 12, 3);
  ctx.fillStyle = "rgba(123,81,47,0.16)";
  ctx.fillRect(1, 17 - (variant & 1), 10, 4);
  ctx.fillRect(14, 14, 8, 4);

  roadWear(ctx, variant);
  dirtMotif(ctx, variant);
  return cv;
}

function sandTile(variant) {
  const cv = C();
  const ctx = cv.getContext("2d");
  ctx.fillStyle = PAL.sand[variant % PAL.sand.length];
  ctx.fillRect(0, 0, TS, TS);

  // Soft dune bands read as one material instead of salt-and-pepper noise.
  ctx.fillStyle = "rgba(255,246,218,0.42)";
  ctx.fillRect(2, 4 + (variant % 3), 11, 3);
  ctx.fillRect(12, 14 - (variant % 2), 9, 3);
  ctx.fillStyle = PAL.sandLo;
  ctx.globalAlpha = 0.48;
  ctx.fillRect(3, 14, 13, 2);
  ctx.fillRect(8, 17, 11, 1);
  ctx.globalAlpha = 1;
  ctx.fillStyle = PAL.sandHi;
  ctx.fillRect(4, 13, 9, 1);

  if (variant % 4 === 1) {
    // Small shell.
    ctx.fillStyle = "#b99867";
    ctx.fillRect(17, 7, 4, 3);
    ctx.fillRect(18, 6, 2, 1);
    ctx.fillStyle = "#fff0cf";
    ctx.fillRect(18, 7, 1, 2);
  } else if (variant % 4 === 2) {
    groundStone(ctx, 3, 17);
  } else if (variant % 4 === 3) {
    ctx.fillStyle = "#a7774e";
    ctx.fillRect(16, 17, 6, 2);
    ctx.fillRect(19, 15, 2, 3);
    ctx.fillStyle = "#cf9a67";
    ctx.fillRect(17, 16, 3, 1);
  }
  return cv;
}

function waterTile(frame, variant) {
  const cv = C();
  const ctx = cv.getContext("2d");
  ctx.fillStyle = PAL.water[variant % PAL.water.length];
  ctx.fillRect(0, 0, TS, TS);

  // Large depth bands and three moving wavelets replace per-row visual static.
  ctx.fillStyle = "rgba(37,125,172,0.22)";
  ctx.fillRect(0, 15, TS, 9);
  ctx.fillRect((variant * 5) % 11, 7, 10, 3);
  ctx.fillStyle = "rgba(125,215,235,0.28)";
  ctx.fillRect(0, 2, TS, 5);

  const shift = (frame * 3 + variant * 2) % 8;
  const waveY = [5 + (variant % 3), 12 + ((variant + 1) % 3), 19 - (variant % 2)];
  ctx.fillStyle = "rgba(171,232,242,0.72)";
  ctx.fillRect((2 + shift) % 15, waveY[0], 7, 1);
  ctx.fillRect((12 + shift) % 18, waveY[1], 6, 1);
  ctx.fillRect((5 + shift * 2) % 16, waveY[2], 8, 1);
  ctx.fillStyle = "rgba(43,133,181,0.42)";
  ctx.fillRect((5 + shift) % 17, waveY[0] + 1, 5, 1);
  ctx.fillRect((1 + shift * 2) % 15, waveY[1] + 1, 7, 1);

  if ((variant + frame) % 5 === 0) {
    ctx.fillStyle = PAL.waterHi;
    ctx.fillRect(17, 4, 3, 1);
    ctx.fillRect(18, 3, 1, 3);
  }
  return cv;
}

function snowTile(variant) {
  const cv = C();
  const ctx = cv.getContext("2d");
  ctx.fillStyle = PAL.snow[variant % PAL.snow.length];
  ctx.fillRect(0, 0, TS, TS);

  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.fillRect(1, 3 + (variant % 3), 13, 4);
  ctx.fillRect(11, 12, 11, 4);
  ctx.fillStyle = PAL.snowLo;
  ctx.globalAlpha = 0.58;
  ctx.fillRect(2, 17, 15, 2);
  ctx.fillRect(8, 20, 12, 1);
  ctx.globalAlpha = 1;
  ctx.fillStyle = PAL.snowHi;
  ctx.fillRect(3, 16, 10, 1);

  if (variant % 4 === 1) {
    // A twig emerging from the snow.
    ctx.fillStyle = "#74665a";
    ctx.fillRect(16, 8, 2, 8);
    ctx.fillRect(12, 10, 6, 2);
    ctx.fillStyle = "#a29486";
    ctx.fillRect(16, 8, 1, 6);
  } else if (variant % 4 === 2) {
    // Paired paw marks.
    ctx.fillStyle = "#b8cad7";
    ctx.fillRect(5, 7, 3, 3);
    ctx.fillRect(10, 12, 3, 3);
    ctx.fillStyle = "#d7e3eb";
    ctx.fillRect(6, 7, 1, 1);
    ctx.fillRect(11, 12, 1, 1);
  } else if (variant % 4 === 3) {
    groundStone(ctx, 15, 16);
    ctx.fillStyle = "#f7fbfd";
    ctx.fillRect(15, 16, 5, 2);
  }
  return cv;
}

function fringeDepth(index, offset = 0) {
  const pattern = [5, 4, 6, 5, 4, 5];
  return pattern[(index + offset) % pattern.length];
}

// Grass fringe drawn on the neighbouring non-grass tile.
// dir bitmask: 1=N 2=E 4=S 8=W.
function edgeOverlay(dirMask, dark = false) {
  const cv = C();
  const ctx = cv.getContext("2d");
  const top = dark ? PAL.forest[1] : PAL.grass[0];
  const edge = dark ? PAL.forestLo : PAL.grassLo;
  const hi = dark ? PAL.forestHi : PAL.grassHi;
  const shade = dark ? "rgba(31,62,36,0.42)" : "rgba(58,101,44,0.34)";

  for (let segment = 0; segment < 6; segment++) {
    const p = segment * 4;
    if (dirMask & 1) {
      const h = fringeDepth(segment);
      ctx.fillStyle = top; ctx.fillRect(p, 0, 4, h);
      ctx.fillStyle = edge; ctx.fillRect(p, h - 1, 4, 1);
    }
    if (dirMask & 4) {
      const h = fringeDepth(segment, 2);
      ctx.fillStyle = top; ctx.fillRect(p, TS - h, 4, h);
      ctx.fillStyle = edge; ctx.fillRect(p, TS - h, 4, 1);
    }
    if (dirMask & 8) {
      const w = fringeDepth(segment, 1);
      ctx.fillStyle = top; ctx.fillRect(0, p, w, 4);
      ctx.fillStyle = edge; ctx.fillRect(w - 1, p, 1, 4);
    }
    if (dirMask & 2) {
      const w = fringeDepth(segment, 3);
      ctx.fillStyle = top; ctx.fillRect(TS - w, p, w, 4);
      ctx.fillStyle = edge; ctx.fillRect(TS - w, p, 1, 4);
    }
  }

  // A few deliberate blade groups keep the silhouette soft and handmade.
  if (dirMask & 1) {
    ctx.fillStyle = shade; ctx.fillRect(4, 4, 4, 1); ctx.fillRect(15, 4, 5, 1);
    ctx.fillStyle = hi; ctx.fillRect(6, 2, 1, 3); ctx.fillRect(17, 2, 1, 3);
  }
  if (dirMask & 4) {
    ctx.fillStyle = shade; ctx.fillRect(3, 19, 5, 1); ctx.fillRect(14, 20, 4, 1);
    ctx.fillStyle = hi; ctx.fillRect(5, 20, 1, 3); ctx.fillRect(16, 19, 1, 3);
  }
  if (dirMask & 8) {
    ctx.fillStyle = shade; ctx.fillRect(4, 5, 1, 5); ctx.fillRect(4, 16, 1, 4);
    ctx.fillStyle = hi; ctx.fillRect(2, 7, 3, 1); ctx.fillRect(2, 18, 3, 1);
  }
  if (dirMask & 2) {
    ctx.fillStyle = shade; ctx.fillRect(19, 4, 1, 5); ctx.fillRect(20, 15, 1, 5);
    ctx.fillStyle = hi; ctx.fillRect(20, 6, 3, 1); ctx.fillRect(20, 17, 3, 1);
  }
  return cv;
}

// Broken, broad shoreline ribbons; mask 1=N 2=E 4=S 8=W.
function foamOverlay(dirMask) {
  const cv = C();
  const ctx = cv.getContext("2d");
  const foam = "rgba(202,239,244,0.84)";
  const crest = "rgba(255,255,255,0.72)";
  const lengths = [6, 4, 7, 5];

  if (dirMask & 1) {
    for (let x = 0, i = 0; x < TS; x += lengths[i++ % lengths.length] + 2) {
      const w = Math.min(lengths[i % lengths.length], TS - x);
      ctx.fillStyle = foam; ctx.fillRect(x, 0, w, 3);
      ctx.fillStyle = crest; ctx.fillRect(x + 1, 0, Math.max(2, w - 2), 1);
    }
  }
  if (dirMask & 4) {
    for (let x = 1, i = 0; x < TS; x += lengths[i++ % lengths.length] + 2) {
      const w = Math.min(lengths[i % lengths.length], TS - x);
      ctx.fillStyle = foam; ctx.fillRect(x, TS - 3, w, 3);
      ctx.fillStyle = crest; ctx.fillRect(x + 1, TS - 1, Math.max(2, w - 2), 1);
    }
  }
  if (dirMask & 8) {
    for (let y = 0, i = 0; y < TS; y += lengths[i++ % lengths.length] + 2) {
      const h = Math.min(lengths[i % lengths.length], TS - y);
      ctx.fillStyle = foam; ctx.fillRect(0, y, 3, h);
      ctx.fillStyle = crest; ctx.fillRect(0, y + 1, 1, Math.max(2, h - 2));
    }
  }
  if (dirMask & 2) {
    for (let y = 1, i = 0; y < TS; y += lengths[i++ % lengths.length] + 2) {
      const h = Math.min(lengths[i % lengths.length], TS - y);
      ctx.fillStyle = foam; ctx.fillRect(TS - 3, y, 3, h);
      ctx.fillStyle = crest; ctx.fillRect(TS - 1, y + 1, 1, Math.max(2, h - 2));
    }
  }
  return cv;
}

const cache = {
  grass: [],
  forest: [],
  dirt: [],
  sand: [],
  water: [],
  snow: [],
  edge: [],
  forestEdge: [],
  foam: [],
};

export function buildTiles() {
  // Idempotent rebuilds keep the documented counts stable (8/32/16).
  for (const key of Object.keys(cache)) cache[key].length = 0;

  for (let v = 0; v < 8; v++) {
    cache.grass.push(grassTile(v, false));
    cache.forest.push(grassTile(v, true));
    cache.dirt.push(dirtTile(v));
    cache.sand.push(sandTile(v));
    cache.snow.push(snowTile(v));
  }
  for (let f = 0; f < 4; f++) {
    for (let v = 0; v < 8; v++) cache.water.push(waterTile(f, v));
  }
  for (let m = 0; m < 16; m++) {
    cache.edge.push(edgeOverlay(m));
    cache.forestEdge.push(edgeOverlay(m, true));
    cache.foam.push(foamOverlay(m));
  }
  return cache;
}

export function tile(kind, i) {
  const arr = cache[kind];
  if (!arr || !arr.length) return null;
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
