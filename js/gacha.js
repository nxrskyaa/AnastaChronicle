export const RARITIES = Object.freeze([
  { id: "common", name: "Common", color: "#b8c0c7", glow: "#dbe2e8" },
  { id: "uncommon", name: "Uncommon", color: "#65c979", glow: "#a9f5a9" },
  { id: "rare", name: "Rare", color: "#54a9ef", glow: "#9edcff" },
  { id: "epic", name: "Epic", color: "#a66cf0", glow: "#d5a8ff" },
  { id: "ultra_rare", name: "Ultra Rare", color: "#ef67c5", glow: "#ffb8ed" },
  { id: "legendary", name: "Legendary", color: "#f2a633", glow: "#ffe08a" },
  { id: "mythical", name: "Mythical", color: "#ed5353", glow: "#ffae78" },
  { id: "mythical_radiant", name: "Mythical Radiant", color: "#77f7e5", glow: "#fff7a8" },
]);

const rows = [
  ["iron_oath", "Iron Oath", "sword"], ["grove_hunter", "Grove Hunter", "bow"], ["ash_wand", "Ash Wand", "staff"],
  ["verdant_fang", "Verdant Fang", "dagger"], ["tidepiercer", "Tidepiercer", "spear"], ["moonbranch", "Moonbranch", "staff"],
  ["azure_tempest", "Azure Tempest", "sword"], ["falcon_arc", "Falcon Arc", "crossbow"], ["frost_oracle", "Frost Oracle", "scepter"],
  ["void_reaver", "Void Reaver", "greatblade"], ["stormthread", "Stormthread", "bow"], ["amethyst_rite", "Amethyst Rite", "staff"],
  ["astral_cleaver", "Astral Cleaver", "axe"], ["seraph_lance", "Seraph Lance", "spear"], ["witchstar", "Witchstar", "scepter"],
  ["sunfall_edge", "Sunfall Edge", "dragonblade"], ["garuda_string", "Garuda String", "dragonbow"], ["ritual_crown", "Ritual Crown", "dragonstaff"],
  ["oni_eclipse", "Oni Eclipse", "greatblade"], ["blood_comet", "Blood Comet", "spear"], ["phoenix_scripture", "Phoenix Scripture", "dragonstaff"],
  ["anasta_genesis", "Anasta Genesis", "dragonblade"], ["heavenweave", "Heavenweave", "dragonbow"], ["eternal_ritual", "Eternal Ritual", "dragonstaff"],
];

const BASE_STATS = {
  sword: [22, 45, .42, false, "arrow"], bow: [18, 104, .52, true, "arrow"], staff: [17, 98, .5, true, "fire"],
  dagger: [15, 31, .27, false, "arrow"], spear: [21, 64, .48, false, "arrow"], crossbow: [22, 108, .56, true, "arrow"],
  scepter: [18, 100, .5, true, "fire"], greatblade: [33, 51, .64, false, "arrow"], axe: [31, 40, .6, false, "arrow"],
  dragonblade: [43, 55, .4, false, "arrow"], dragonbow: [35, 116, .47, true, "arrow"], dragonstaff: [37, 108, .45, true, "fire"],
};

export const GACHA_WEAPONS = Object.freeze(Object.fromEntries(rows.map(([id, name, base], index) => {
  const rarityIndex = Math.floor(index / 3), rarity = RARITIES[rarityIndex];
  const [baseDmg, range, speed, ranged, projectile] = BASE_STATS[base];
  const dmg = Math.round(baseDmg * (1 + rarityIndex * .18));
  return [id, Object.freeze({
    id, itemId: index + 1, name, base, rarity: rarity.id, rarityIndex,
    color: rarity.color, glow: rarity.glow, weapon: true, gacha: true,
    dmg, range: range + rarityIndex * 3, speed: Math.max(.24, speed - rarityIndex * .012), cost: 8 + rarityIndex,
    ranged, projectile, pierce: base.includes("bow") || base === "crossbow",
  })];
})));

export const GACHA_BY_ITEM_ID = Object.freeze(Object.fromEntries(Object.values(GACHA_WEAPONS).map((weapon) => [weapon.itemId, weapon])));
export const gachaWeapon = (id) => GACHA_WEAPONS[id] || null;

const RARITY_CUTOFFS = Object.freeze([15, 80, 250, 600, 1300, 2500, 5000]);
function secureRoll(max) {
  const values = new Uint32Array(1);
  globalThis.crypto?.getRandomValues?.(values);
  const value = values[0] || Math.floor(Math.random() * 0xffffffff);
  return value % max;
}

// Guest draws mirror the V3 contract's testnet rarity table. They remain local
// inventory items and never pretend to be onchain ownership.
export function drawGuestGacha(count = 1) {
  const pulls = count === 10 ? 10 : 1;
  return Array.from({ length: pulls }, () => {
    const roll = secureRoll(10_000);
    let rarityIndex = 0;
    if (roll < RARITY_CUTOFFS[0]) rarityIndex = 7;
    else if (roll < RARITY_CUTOFFS[1]) rarityIndex = 6;
    else if (roll < RARITY_CUTOFFS[2]) rarityIndex = 5;
    else if (roll < RARITY_CUTOFFS[3]) rarityIndex = 4;
    else if (roll < RARITY_CUTOFFS[4]) rarityIndex = 3;
    else if (roll < RARITY_CUTOFFS[5]) rarityIndex = 2;
    else if (roll < RARITY_CUTOFFS[6]) rarityIndex = 1;
    const itemId = rarityIndex * 3 + secureRoll(3) + 1;
    return GACHA_BY_ITEM_ID[itemId];
  });
}
