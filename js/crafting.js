export const ITEMS = {
  fist: { name: "Fist", glyph: "F" },
  wood: { name: "Wood", glyph: "W", source: "Bamboo shoots and forest plants" },
  ore: { name: "Ore", glyph: "O", source: "Crystal nodes and armored monsters" },
  gel: { name: "Slime Gel", glyph: "G", source: "Slimes, glow vines, and monsters" },
  herb: { name: "Herb", glyph: "H", source: "Herb bushes across the grasslands" },
  fish: { name: "Fish", glyph: "~", source: "Catch fish at a pond or the eastern lake" },
  dragonscale: { name: "Dragon Scale", glyph: "D", rare: true, source: "Defeat Infernyx, the world boss" },
  basicrod: { name: "Willow Rod", glyph: "/", rod: true, source: "Starting fishing gear" },
  ironrod: { name: "Ironwood Rod", glyph: "/", rod: true },
  spiritrod: { name: "Spiritglass Rod", glyph: "*", rod: true, rare: true },
  sword: { name: "Sword", glyph: "/", weapon: true },
  axe: { name: "Axe", glyph: "T", weapon: true },
  spear: { name: "Spear", glyph: "|", weapon: true },
  dagger: { name: "Dagger", glyph: "K", weapon: true },
  bow: { name: "Bow", glyph: ")", weapon: true },
  staff: { name: "Staff", glyph: "*", weapon: true },
  dragonblade: { name: "Dragon Blade", glyph: "/", weapon: true, rare: true },
  dragonbow: { name: "Dragon Bow", glyph: ")", weapon: true, rare: true },
  dragonstaff: { name: "Dragon Staff", glyph: "*", weapon: true, rare: true },
};

export const RECIPES = [
  { id: "sword", result: "sword", need: { wood: 2, ore: 3 }, desc: "Balanced blade with a forgiving attack rhythm.", group: "Field Arsenal", classId: "warrior", tier: 1 },
  { id: "axe", result: "axe", need: { wood: 3, ore: 4 }, desc: "Slow, heavy cleaver built for burst damage.", group: "Field Arsenal", classId: "warrior", tier: 1 },
  { id: "spear", result: "spear", need: { wood: 4, ore: 2 }, desc: "Long reach keeps dangerous monsters outside their bite.", group: "Field Arsenal", classId: "warrior", tier: 1 },
  { id: "dagger", result: "dagger", need: { wood: 1, ore: 1, gel: 2 }, desc: "Rapid strikes with low stamina commitment.", group: "Field Arsenal", classId: "all", tier: 1 },
  { id: "bow", result: "bow", need: { wood: 5, gel: 1 }, desc: "Piercing ranged weapon with nearest-target aim assist.", group: "Class Weapons", classId: "archer", tier: 2 },
  { id: "staff", result: "staff", need: { wood: 4, ore: 2, gel: 2 }, desc: "Fire catalyst with nearest-target aim assist.", group: "Class Weapons", classId: "mage", tier: 2 },
  { id: "ironrod", result: "ironrod", need: { wood: 5, ore: 3 }, desc: "More control, faster reeling, and a wider tension margin.", group: "Fishing Gear", classId: "all", tier: 2 },
  { id: "spiritrod", result: "spiritrod", need: { wood: 7, gel: 5, dragonscale: 1 }, desc: "Master rod that improves control and rare-fish odds.", group: "Fishing Gear", classId: "all", tier: 3 },
  { id: "dragonblade", result: "dragonblade", need: { ore: 8, dragonscale: 1 }, desc: "Legendary melee weapon tempered in dragonfire.", group: "Dragon Relics", classId: "warrior", tier: 3 },
  { id: "dragonbow", result: "dragonbow", need: { wood: 10, dragonscale: 1 }, desc: "Legendary piercing bow with superior projectile speed.", group: "Dragon Relics", classId: "archer", tier: 3 },
  { id: "dragonstaff", result: "dragonstaff", need: { ore: 6, gel: 6, dragonscale: 1 }, desc: "Legendary staff that launches searing dragonfire.", group: "Dragon Relics", classId: "mage", tier: 3 },
];

export function canCraft(inv, recipe) {
  return Object.entries(recipe.need).every(([key, amount]) => (inv[key] || 0) >= amount);
}

export function doCraft(inv, recipe) {
  if (!canCraft(inv, recipe)) return false;
  for (const [key, amount] of Object.entries(recipe.need)) inv[key] -= amount;
  inv[recipe.result] = (inv[recipe.result] || 0) + 1;
  return true;
}

export function xpFor(level) { return 40 + level * level * 18; }
export function applyLevel() {}
