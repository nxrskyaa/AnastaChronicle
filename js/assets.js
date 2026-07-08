const MANIFEST = [
  // tiles
  "tiles/grass_0", "tiles/grass_1", "tiles/grass_2", "tiles/grass_3",
  "tiles/dirt", "tiles/path",
  "tiles/water_0", "tiles/water_1", "tiles/water_2", "tiles/water_3",
  "tiles/shadow",
  // sprites
  "sprites/tree_0", "sprites/tree_1", "sprites/tree_2",
  "sprites/torch_0", "sprites/torch_1", "sprites/torch_2", "sprites/torch_3",
  "sprites/player_down_0", "sprites/player_down_1", "sprites/player_down_2", "sprites/player_down_3", "sprites/player_down_atk",
  "sprites/player_up_0", "sprites/player_up_1", "sprites/player_up_2", "sprites/player_up_3", "sprites/player_up_atk",
  "sprites/player_left_0", "sprites/player_left_1", "sprites/player_left_2", "sprites/player_left_3", "sprites/player_left_atk",
  "sprites/player_right_0", "sprites/player_right_1", "sprites/player_right_2", "sprites/player_right_3", "sprites/player_right_atk",
  "sprites/slime_0", "sprites/slime_1", "sprites/slime_2", "sprites/slime_3", "sprites/slime_hurt",
  "sprites/puff_0", "sprites/puff_1", "sprites/puff_2", "sprites/puff_3",
  "sprites/chest", "sprites/chest_open", "sprites/rock",
  // items
  "items/wood", "items/gel", "items/ore", "items/herb",
  "items/sword", "items/axe", "items/spear", "items/bow", "items/dagger",
  // ui
  "ui/heart", "ui/heart_empty", "ui/orb_mana", "ui/orb_stamina", "ui/logo_mark",
];

export const images = {};

export async function loadAll(onProgress) {
  let done = 0;
  const total = MANIFEST.length;
  await Promise.all(
    MANIFEST.map(
      (key) =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            images[key] = img;
            done++;
            onProgress?.(done, total, key);
            resolve();
          };
          img.onerror = () => reject(new Error("Failed asset: " + key));
          img.src = `assets/${key}.png`;
        })
    )
  );
  return images;
}

export function img(key) {
  return images[key];
}
