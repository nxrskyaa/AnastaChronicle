export const ITEMS = {
  fist:   { name: "Fist" },
  wood:   { name: "Wood" },
  ore:    { name: "Ore" },
  gel:    { name: "Slime Gel" },
  herb:   { name: "Herb" },
  sword:  { name: "Sword", weapon: true },
  axe:    { name: "Axe", weapon: true },
  spear:  { name: "Spear", weapon: true },
  dagger: { name: "Dagger", weapon: true },
  bow:    { name: "Bow", weapon: true },
};

export const RECIPES = [
  { id: "sword",  result: "sword",  need: { wood: 2, ore: 3 },        desc: "Balanced blade" },
  { id: "axe",    result: "axe",    need: { wood: 3, ore: 4 },        desc: "Heavy, high damage" },
  { id: "spear",  result: "spear",  need: { wood: 4, ore: 2 },        desc: "Long reach" },
  { id: "dagger", result: "dagger", need: { wood: 1, ore: 1, gel: 2 },desc: "Fast strikes" },
  { id: "bow",    result: "bow",    need: { wood: 5, gel: 1 },        desc: "Ranged" },
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
