// Character classes. Each defines presentation metadata, base stat modifiers,
// and a 4-skill loadout. Skills are resolved in logic.js useSkill() by id.
export const CLASSES = {
  warrior: {
    name: "Warrior",
    path: "Vanguard",
    crest: "W",
    role: "Melee Guard",
    traits: ["70 HP", "MELEE", "GUARD"],
    blurb: "A close-range vanguard built around chained steel, guard breaks, and oni resolve.",
    color: "#d0603a",
    stats: { maxHp: 70, maxStamina: 120, speed: 116, dmgMul: 1.15, defense: 0.85 },
    weapon: "sword",
    skills: [
      { id: "powerstrike", name: "Moon Cleave", cd: 4, icon: "blade", desc: "A committed cleave with a forward crescent wake." },
      { id: "whirlwind", name: "Tempest Wheel", cd: 7, icon: "wheel", desc: "Three steel rings strike every nearby target." },
      { id: "warcry", name: "Oni Resolve", cd: 12, icon: "mask", desc: "Raise damage and briefly harden your guard." },
      { id: "dash", name: "Iron Rush", cd: 5, icon: "rush", desc: "A plated evasive burst with a heavy afterimage." },
    ],
  },
  mage: {
    name: "Mage",
    path: "Arcanist",
    crest: "M",
    role: "Arcane Burst",
    traits: ["44 HP", "RANGED", "BURST"],
    blurb: "An arcane tactician weaving comet fire, winter seals, restorative sutras, and rifts.",
    color: "#8557a8",
    stats: { maxHp: 44, maxStamina: 100, speed: 118, dmgMul: 1.0, defense: 1.1 },
    weapon: "staff",
    skills: [
      { id: "fireball", name: "Ember Comet", cd: 3, icon: "comet", desc: "Launch a focused comet with a burning arcane tail." },
      { id: "frostnova", name: "Winter Lotus", cd: 8, icon: "lotus", desc: "Bloom a freezing lotus that locks nearby enemies." },
      { id: "heal", name: "Verdant Sutra", cd: 6, icon: "sutra", desc: "Consume an herb to restore HP through a healing seal." },
      { id: "blink", name: "Rift Step", cd: 6, icon: "rift", desc: "Fold space forward and leave a fading echo." },
    ],
  },
  archer: {
    name: "Archer",
    path: "Ranger",
    crest: "A",
    role: "Mobile Marksman",
    traits: ["52 HP", "RANGED", "AGILE"],
    blurb: "A mobile ranger combining falcon-line precision, petal volleys, wind wards, and rolls.",
    color: "#4a9678",
    stats: { maxHp: 52, maxStamina: 130, speed: 128, dmgMul: 1.05, defense: 1.0 },
    weapon: "bow",
    skills: [
      { id: "arrowshot", name: "Falcon Pierce", cd: 3, icon: "falcon", desc: "A luminous piercing shot locked to the nearest threat." },
      { id: "multishot", name: "Sakura Volley", cd: 7, icon: "petals", desc: "Fan five arrows through a burst of wind and petals." },
      { id: "windward", name: "Wind Ward", cd: 9, icon: "ward", desc: "Spend stamina for healing and four seconds of protection." },
      { id: "roll", name: "Trail Roll", cd: 4, icon: "roll", desc: "An evasive combat roll that sheds leaf afterimages." },
    ],
  },
  priest: {
    name: "Priest",
    path: "Luminary",
    crest: "P",
    role: "Sacred Support",
    traits: ["58 HP", "SUPPORT", "WARD"],
    blurb: "A radiant keeper who balances guided light, sanctuary wards, exorcism, and party recovery.",
    color: "#d6b85f",
    stats: { maxHp: 58, maxStamina: 112, speed: 116, dmgMul: 0.96, defense: 0.94 },
    weapon: "scepter",
    skills: [
      { id: "dawnbolt", name: "Dawn Bolt", cd: 3, icon: "sunbolt", desc: "Guide a radiant bolt toward the nearest hostile target." },
      { id: "sanctuary", name: "Sanctuary", cd: 10, icon: "sanctuary", desc: "Consecrate the ground with a restorative protective ward." },
      { id: "exorcism", name: "Exorcism", cd: 7, icon: "exorcism", desc: "Release a purifying seal that damages nearby enemies." },
      { id: "benediction", name: "Benediction", cd: 14, icon: "benediction", desc: "Invoke a major blessing that restores health and resolve." },
    ],
  },
  slayer: {
    name: "Slayer",
    path: "Reaver",
    crest: "S",
    role: "Melee Executioner",
    traits: ["56 HP", "MELEE", "BURST"],
    blurb: "A relentless executioner who trades safety for blood-fueled cleaves and finishing pressure.",
    color: "#b54552",
    stats: { maxHp: 56, maxStamina: 124, speed: 123, dmgMul: 1.22, defense: 1.08 },
    weapon: "greatblade",
    skills: [
      { id: "nightrend", name: "Night Rend", cd: 3, icon: "rend", desc: "Carve a dark forward arc that tears through clustered prey." },
      { id: "bloodstorm", name: "Bloodstorm", cd: 8, icon: "bloodstorm", desc: "Spin the greatblade through a violent ring of crimson steel." },
      { id: "execution", name: "Execution", cd: 5, icon: "execution", desc: "Deliver a ruthless finisher that punishes wounded enemies." },
      { id: "bloodoath", name: "Blood Oath", cd: 12, icon: "bloodoath", desc: "Sacrifice composure for a short surge of damage and speed." },
    ],
  },
  hunter: {
    name: "Hunter",
    path: "Wildstalker",
    crest: "H",
    role: "Ranged Controller",
    traits: ["54 HP", "RANGED", "CONTROL"],
    blurb: "A wilderness tracker commanding precision bolts, briar traps, spirit beasts, and vaulting repositioning.",
    color: "#7da653",
    stats: { maxHp: 54, maxStamina: 116, speed: 120, dmgMul: 1.12, defense: 1.02 },
    weapon: "crossbow",
    skills: [
      { id: "predatorbolt", name: "Predator Bolt", cd: 3, icon: "predator", desc: "Fire a high-speed bolt guided toward the nearest marked threat." },
      { id: "briarsnare", name: "Briar Snare", cd: 8, icon: "briar", desc: "Seed a thorn trap that damages and hinders nearby enemies." },
      { id: "spiritflock", name: "Spirit Flock", cd: 9, icon: "flock", desc: "Call spectral birds to sweep through a fan of targets." },
      { id: "wildvault", name: "Wild Vault", cd: 5, icon: "vault", desc: "Vault away from danger while loosing a covering bolt." },
    ],
  },
};

export const CLASS_IDS = Object.keys(CLASSES);

export function applyClass(player, classId) {
  const resolvedId = typeof classId === "string" && Object.hasOwn(CLASSES, classId) ? classId : "warrior";
  const c = CLASSES[resolvedId];
  player.cls = resolvedId;
  player.maxHp = c.stats.maxHp;
  player.hp = c.stats.maxHp;
  player.maxStamina = c.stats.maxStamina;
  player.stamina = c.stats.maxStamina;
  player.speed = c.stats.speed;
  player.dmgMul = c.stats.dmgMul;
  player.defense = c.stats.defense;
  player.equipped = c.weapon || player.equipped;
  return c;
}
