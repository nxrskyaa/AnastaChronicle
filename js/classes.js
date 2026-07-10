// Character classes: warrior / mage / archer. Each defines base stat modifiers
// and a 4-skill loadout. Skills are resolved in logic.js useSkill() by id.
export const CLASSES = {
  warrior: {
    name: "Warrior",
    blurb: "Tough melee bruiser. High HP, hits hard up close.",
    color: "#d0603a",
    stats: { maxHp: 70, maxStamina: 120, speed: 116, dmgMul: 1.15, defense: 0.85 },
    weapon: "sword",
    skills: [
      { id: "powerstrike", name: "Power Strike", cd: 4, icon: "⚔", desc: "A heavy forward blow." },
      { id: "whirlwind",   name: "Whirlwind",    cd: 7, icon: "🌀", desc: "Spin, hitting all nearby." },
      { id: "warcry",      name: "War Cry",      cd: 12, icon: "🛡", desc: "Buff damage briefly." },
      { id: "dash",        name: "Dash",         cd: 5, icon: "💨", desc: "Quick evasive dash." },
    ],
  },
  mage: {
    name: "Mage",
    blurb: "Ranged caster. Fireballs, frost, and burst magic.",
    color: "#8557a8",
    stats: { maxHp: 44, maxStamina: 100, speed: 118, dmgMul: 1.0, defense: 1.1 },
    weapon: "staff",
    skills: [
      { id: "fireball",  name: "Fireball",  cd: 3, icon: "🔥", desc: "Hurl a fiery projectile." },
      { id: "frostnova", name: "Frost Nova", cd: 8, icon: "❄", desc: "Freeze & damage around you." },
      { id: "heal",      name: "Heal",      cd: 6, icon: "✚", desc: "Restore HP (needs herb)." },
      { id: "blink",     name: "Blink",     cd: 6, icon: "✦", desc: "Teleport-dash forward." },
    ],
  },
  archer: {
    name: "Archer",
    blurb: "Agile ranged attacker. Arrows, traps, and mobility.",
    color: "#4a9678",
    stats: { maxHp: 52, maxStamina: 130, speed: 128, dmgMul: 1.05, defense: 1.0 },
    weapon: "bow",
    skills: [
      { id: "arrowshot", name: "Power Shot", cd: 3, icon: "🏹", desc: "Pierce a line of enemies." },
      { id: "multishot", name: "Multishot",  cd: 7, icon: "☄", desc: "Fan of 3 arrows." },
      { id: "heal",      name: "Field Kit",  cd: 6, icon: "✚", desc: "Restore HP (needs herb)." },
      { id: "roll",      name: "Roll",       cd: 4, icon: "💨", desc: "Evasive combat roll." },
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
