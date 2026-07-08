export const ITEMS = {
  wood: { id: "wood", name: "Timber", icon: "🪵", stack: 99 },
  gel: { id: "gel", name: "Slime Gel", icon: "🟢", stack: 99 },
  ore: { id: "ore", name: "Iron Ore", icon: "🪨", stack: 99 },
  herb: { id: "herb", name: "Wild Herb", icon: "🌿", stack: 99 },
  dagger: { id: "dagger", name: "Rusty Dagger", icon: "🗡️", stack: 1, weapon: true, dmg: 7, range: 1.6, speed: 0.28, cost: 8 },
  sword: { id: "sword", name: "Anasta Blade", icon: "⚔️", stack: 1, weapon: true, dmg: 13, range: 1.9, speed: 0.34, cost: 10 },
  axe: { id: "axe", name: "Timber Axe", icon: "🪓", stack: 1, weapon: true, dmg: 17, range: 1.8, speed: 0.48, cost: 14 },
  spear: { id: "spear", name: "Hunter Spear", icon: "🔱", stack: 1, weapon: true, dmg: 14, range: 2.5, speed: 0.4, cost: 12 },
  bow: { id: "bow", name: "Ash Bow", icon: "🏹", stack: 1, weapon: true, dmg: 12, range: 8, speed: 0.45, cost: 11, ranged: true },
};

export const RECIPES = [
  { id: "sword", result: "sword", need: { wood: 4, ore: 3, gel: 2 }, desc: "Balanced steel for the wilds." },
  { id: "axe", result: "axe", need: { wood: 6, ore: 4 }, desc: "Heavy chops. Slow, hard." },
  { id: "spear", result: "spear", need: { wood: 5, ore: 2, herb: 2 }, desc: "Keep slimes at spear-length." },
  { id: "bow", result: "bow", need: { wood: 8, gel: 3, herb: 1 }, desc: "Kite from the treeline." },
  { id: "dagger", result: "dagger", need: { ore: 1, gel: 1 }, desc: "Quick backup blade." },
];

export function canCraft(inv, recipe) {
  return Object.entries(recipe.need).every(([k, n]) => (inv[k] || 0) >= n);
}

export function doCraft(inv, recipe) {
  if (!canCraft(inv, recipe)) return false;
  for (const [k, n] of Object.entries(recipe.need)) inv[k] -= n;
  inv[recipe.result] = (inv[recipe.result] || 0) + 1;
  return true;
}

export function xpFor(level) {
  return Math.floor(40 + level * 35 + level * level * 8);
}

export function applyLevel(p) {
  p.maxHp = 50 + (p.level - 1) * 12;
  p.maxStamina = 100 + (p.level - 1) * 6;
  p.baseDmg = 2 + (p.level - 1);
  p.hp = Math.min(p.hp, p.maxHp);
  p.stamina = Math.min(p.stamina, p.maxStamina);
}
