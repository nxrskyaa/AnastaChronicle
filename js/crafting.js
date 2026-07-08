/** Weapon crafting recipes + gear stats for Anasta Chronicle */

export const ITEMS = {
  wood: { id: "wood", name: "Timber", icon: "items/wood", stack: 99 },
  gel: { id: "gel", name: "Slime Gel", icon: "items/gel", stack: 99 },
  ore: { id: "ore", name: "Iron Ore", icon: "items/ore", stack: 99 },
  herb: { id: "herb", name: "Wild Herb", icon: "items/herb", stack: 99 },
  dagger: {
    id: "dagger",
    name: "Rusty Dagger",
    icon: "items/dagger",
    stack: 1,
    weapon: true,
    dmg: 6,
    range: 28,
    speed: 0.28,
    staminaCost: 8,
  },
  sword: {
    id: "sword",
    name: "Anasta Blade",
    icon: "items/sword",
    stack: 1,
    weapon: true,
    dmg: 12,
    range: 36,
    speed: 0.34,
    staminaCost: 10,
  },
  axe: {
    id: "axe",
    name: "Timber Axe",
    icon: "items/axe",
    stack: 1,
    weapon: true,
    dmg: 16,
    range: 34,
    speed: 0.48,
    staminaCost: 14,
  },
  spear: {
    id: "spear",
    name: "Hunter Spear",
    icon: "items/spear",
    stack: 1,
    weapon: true,
    dmg: 14,
    range: 48,
    speed: 0.4,
    staminaCost: 12,
  },
  bow: {
    id: "bow",
    name: "Ash Bow",
    icon: "items/bow",
    stack: 1,
    weapon: true,
    dmg: 11,
    range: 120,
    speed: 0.45,
    staminaCost: 11,
    ranged: true,
  },
};

export const RECIPES = [
  {
    id: "sword",
    result: "sword",
    qty: 1,
    need: { wood: 4, ore: 3, gel: 2 },
    desc: "Balanced melee blade. Reliable damage.",
  },
  {
    id: "axe",
    result: "axe",
    qty: 1,
    need: { wood: 6, ore: 4 },
    desc: "Heavy chops. Slower, hits harder.",
  },
  {
    id: "spear",
    result: "spear",
    qty: 1,
    need: { wood: 5, ore: 2, herb: 2 },
    desc: "Long reach for keeping slimes at bay.",
  },
  {
    id: "bow",
    result: "bow",
    qty: 1,
    need: { wood: 8, gel: 3, herb: 1 },
    desc: "Ranged shots. Kite the wilds.",
  },
  {
    id: "dagger_up",
    result: "dagger",
    qty: 1,
    need: { ore: 1, gel: 1 },
    desc: "Sharpen a backup blade.",
  },
];

export function canCraft(inv, recipe) {
  for (const [k, n] of Object.entries(recipe.need)) {
    if ((inv[k] || 0) < n) return false;
  }
  return true;
}

export function craft(inv, recipe) {
  if (!canCraft(inv, recipe)) return false;
  for (const [k, n] of Object.entries(recipe.need)) inv[k] -= n;
  inv[recipe.result] = (inv[recipe.result] || 0) + recipe.qty;
  return true;
}

export function xpToLevel(level) {
  return Math.floor(40 + level * 35 + level * level * 8);
}

export function applyLevelStats(player) {
  const L = player.level;
  player.maxHp = 50 + (L - 1) * 12;
  player.maxStamina = 100 + (L - 1) * 6;
  player.baseDmg = 2 + (L - 1);
  player.hp = Math.min(player.hp, player.maxHp);
  player.stamina = Math.min(player.stamina, player.maxStamina);
}
