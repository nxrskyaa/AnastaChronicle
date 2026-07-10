export const ITEMS = {
  fist:   { name: "Fist" },
  wood:   { name: "Wood" },
  ore:    { name: "Ore" },
  gel:    { name: "Slime Gel" },
  herb:   { name: "Herb" },
  fish:   { name: "Fish" },
  dragonscale: { name: "Dragon Scale", rare: true },
  sword:  { name: "Sword", weapon: true },
  axe:    { name: "Axe", weapon: true },
  spear:  { name: "Spear", weapon: true },
  dagger: { name: "Dagger", weapon: true },
  bow:    { name: "Bow", weapon: true },
  staff:  { name: "Staff", weapon: true },
  dragonblade:  { name: "Dragon Blade", weapon: true, rare: true },
  dragonbow:    { name: "Dragon Bow", weapon: true, rare: true },
  dragonstaff:  { name: "Dragon Staff", weapon: true, rare: true },
};

export const RECIPES = [
  { id: "sword",  result: "sword",  need: { wood: 2, ore: 3 },        desc: "Balanced blade" },
  { id: "axe",    result: "axe",    need: { wood: 3, ore: 4 },        desc: "Heavy, high damage" },
  { id: "spear",  result: "spear",  need: { wood: 4, ore: 2 },        desc: "Long reach" },
  { id: "dagger", result: "dagger", need: { wood: 1, ore: 1, gel: 2 },desc: "Fast strikes" },
  { id: "bow",    result: "bow",    need: { wood: 5, gel: 1 },        desc: "Ranged" },
  { id: "staff",  result: "staff",  need: { wood: 4, ore: 2, gel: 2 },desc: "Mage catalyst (ranged)" },
  // Dragon-tier weapons — require rare Dragon Scale from the world boss
  { id: "dragonblade", result: "dragonblade", need: { ore: 8, dragonscale: 1 }, desc: "🔥 Legendary melee" },
  { id: "dragonbow",   result: "dragonbow",   need: { wood: 10, dragonscale: 1 }, desc: "🔥 Legendary bow" },
  { id: "dragonstaff", result: "dragonstaff", need: { ore: 6, gel: 6, dragonscale: 1 }, desc: "🔥 Legendary staff" },
];

export function canCraft(inv, r) {
  return Object.entries(r.need).every(([k, n]) => (inv[k] || 0) >= n);
}
export function doCraft(inv, r) {
  if (!canCraft(inv, r)) return false;
  for (const [k, n] of Object.entries(r.need)) inv[k] -= n;
  inv[r.result] = (inv[r.result] || 0) + 1;
  return true;
}
export function xpFor(level) { return 40 + level * level * 18; }
export function applyLevel() {}
