const PATHS = [];

for (let i = 0; i < 4; i++) {
  PATHS.push(
    `world/grass_${i}`,
    `world/path_${i}`,
    `world/water_${i}`,
    `world/tree_${i}`,
    `world/torch_${i}`,
    `world/camp_${i}`
  );
}
for (let i = 0; i < 3; i++) PATHS.push(`world/rock_${i}`);
PATHS.push("world/chest", "world/chest_open");

for (const d of ["down", "up", "left", "right"]) {
  for (let f = 0; f < 4; f++) PATHS.push(`player/p_${d}_${f}`);
  PATHS.push(`player/p_${d}_atk`);
}
for (const t of [1, 2]) {
  for (let f = 0; f < 4; f++) PATHS.push(`enemy/slime_t${t}_${f}`);
}
for (const id of ["wood", "ore", "gel", "herb", "sword", "axe", "spear", "bow", "dagger"]) {
  PATHS.push(`items/${id}`);
}
PATHS.push("ui/heart", "ui/heart_empty");
for (let f = 0; f < 4; f++) PATHS.push(`fx/slash_${f}`, `fx/hit_${f}`);
for (let f = 0; f < 3; f++) PATHS.push(`fx/dust_${f}`);

const cache = new Map();

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("fail " + src));
    img.src = src;
  });
}

export async function loadAll(onProgress) {
  let done = 0;
  await Promise.all(
    PATHS.map(async (p) => {
      const im = await loadImage(`assets/px/${p}.png`);
      cache.set(p, im);
      done++;
      onProgress?.(done, PATHS.length);
    })
  );
  return cache;
}

export function img(key) {
  return cache.get(key);
}
