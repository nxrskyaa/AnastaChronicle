// Asset manifest + loader. Tiles from Tuxemon (CC-BY-SA); player/trees/fx generated.
// Monsters & pets are now fully code-generated (see monsters.js) — no PNGs loaded.
const PATHS = [];
for (const d of ["down", "up", "left", "right"]) {
  for (let f = 0; f < 4; f++) PATHS.push(`player/p_${d}_${f}`);
  PATHS.push(`player/p_${d}_atk`);
}
for (let i = 0; i < 4; i++) {
  PATHS.push(`tiles/grass_${i}`, `tiles/path_${i}`, `tiles/water_${i}`, `tiles/sand_${i}`);
}
for (let i = 0; i < 4; i++) PATHS.push(`tree_${i}`);
PATHS.push("bush_0");
for (let f = 0; f < 4; f++) PATHS.push(`fx/slash_${f}`, `fx/hit_${f}`);
PATHS.push("fx/chest", "fx/chest_open", "fx/heart", "fx/heart_empty");

const cache = new Map();
function loadImage(src) {
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });
}
export async function loadAll(onProgress) {
  let done = 0;
  await Promise.all(PATHS.map(async (p) => {
    const im = await loadImage(`assets/tux/${p}.png`);
    if (im) cache.set(p, im);
    onProgress?.(++done, PATHS.length);
  }));
  return cache;
}
export function img(k) { return cache.get(k); }
export const MONSTERS = [];
export const PET_IDS = [];
