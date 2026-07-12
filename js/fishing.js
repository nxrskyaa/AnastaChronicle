// Fishing data and catch rolls stay pure so the minigame can be tuned without
// coupling it to Canvas or DOM state.
export const RODS = {
  basicrod:  { name: "Willow Rod", control: 0,    luck: 0,    reel: 1 },
  ironrod:   { name: "Ironwood Rod", control: .2, luck: .12, reel: 1.12 },
  spiritrod: { name: "Spiritglass Rod", control: .38, luck: .3, reel: 1.25 },
};

export const FISH = [
  { id: "minnow", name: "Silver Minnow", rarity: "common", baseGold: 5,  weight: 32, power: .2,  size: 18, habitats: ["pond", "lake"] },
  { id: "carp", name: "Moss Carp", rarity: "common", baseGold: 10, weight: 24, power: .3,  size: 42, habitats: ["pond"] },
  { id: "trout", name: "Brook Trout", rarity: "common", baseGold: 13, weight: 20, power: .38, size: 36, habitats: ["lake"] },
  { id: "pike", name: "Reed Pike", rarity: "uncommon", baseGold: 22, weight: 12, power: .52, size: 58, habitats: ["lake", "pond"], weather: "rain" },
  { id: "salmon", name: "Sunscale Salmon", rarity: "uncommon", baseGold: 28, weight: 9, power: .58, size: 64, habitats: ["lake"], time: "day" },
  { id: "koi", name: "Crimson Koi", rarity: "rare", baseGold: 42, weight: 5, power: .66, size: 48, habitats: ["pond"], time: "day" },
  { id: "catfish", name: "Ancient Catfish", rarity: "rare", baseGold: 38, weight: 5, power: .72, size: 82, habitats: ["lake"], time: "night" },
  { id: "eel", name: "Crystal Eel", rarity: "rare", baseGold: 68, weight: 2.2, power: .78, size: 70, habitats: ["lake"], weather: "rain", time: "night" },
  { id: "goldfish", name: "Gilded Moonfish", rarity: "legendary", baseGold: 95, weight: 1, power: .86, size: 44, habitats: ["pond", "lake"], time: "night" },
  { id: "spirit", name: "River Spirit", rarity: "legendary", baseGold: 145, weight: .35, power: .94, size: 96, habitats: ["lake"], weather: "rain", time: "night" },
];

const RARITY_LUCK = { common: -0.25, uncommon: .45, rare: 1, legendary: 1.8 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function activeRod(inv = {}) {
  if ((inv.spiritrod || 0) > 0) return { id: "spiritrod", ...RODS.spiritrod };
  if ((inv.ironrod || 0) > 0) return { id: "ironrod", ...RODS.ironrod };
  return { id: "basicrod", ...RODS.basicrod };
}

export function fishingContext(game, spot) {
  const zone = spot.x / 24 > 70 && spot.y / 24 < 45 ? "lake" : "pond";
  const night = game.time >= 19 * 60 || game.time < 5 * 60;
  const time = night ? "night" : "day";
  const weather = game.weather || "clear";
  const baseRod = activeRod(game.player?.inv);
  const rod = { ...baseRod, luck: baseRod.luck + Math.max(0, Number(game.foodBuffTotals?.fishingLuck) || 0) };
  const condition = `${zone === "lake" ? "Lake" : "Pond"} · ${time === "night" ? "Moonlit" : "Daylight"}${weather !== "clear" ? ` · ${weather}` : ""}`;
  return { zone, time, weather, rod, condition };
}

export function rollFish(context, random = Math.random) {
  const weighted = FISH.map((fish) => {
    let weight = fish.weight;
    if (!fish.habitats.includes(context.zone)) weight *= .12;
    if (fish.time) weight *= fish.time === context.time ? 1.75 : .32;
    if (fish.weather) weight *= fish.weather === context.weather ? 2.1 : .42;
    weight *= 1 + context.rod.luck * RARITY_LUCK[fish.rarity];
    return { fish, weight: Math.max(.02, weight) };
  });
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let pick = random() * total;
  let fish = weighted[0].fish;
  for (const entry of weighted) {
    pick -= entry.weight;
    if (pick <= 0) { fish = entry.fish; break; }
  }
  const sizeRoll = .72 + random() * .58 + context.rod.luck * .12;
  const size = Math.round(fish.size * sizeRoll * 10) / 10;
  const difficulty = clamp(fish.power - context.rod.control * .32, .16, .94);
  const gold = Math.max(1, Math.round(fish.baseGold * (size / fish.size) * (1 + context.rod.luck * .35)));
  return {
    ...fish,
    size,
    gold,
    difficulty,
    biteWindow: 1.18 - difficulty * .28 + context.rod.control * .18,
  };
}
