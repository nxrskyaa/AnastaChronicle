// Character classes: warrior / mage / archer. Each defines base stat modifiers
// and a 4-skill loadout. Skills are resolved in logic.js useSkill() by id.
export const CLASSES = {
  warrior: {
    name: "Warrior",
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
};

export const CLASS_IDS = Object.keys(CLASSES);

export function applyClass(player, classId) {
  const c = CLASSES[classId] || CLASSES.warrior;
  player.cls = classId;
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
