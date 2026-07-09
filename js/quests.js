// NPCs + quest system for Anasta.
export const QUESTS = [
  { id: "slay5",   giver: "Warden",  title: "Thin the Slimes", desc: "Defeat 5 creatures near camp.", type: "kill", target: 5, reward: { gold: 30, xp: 40 } },
  { id: "gel3",    giver: "Alchemist", title: "Gel for Potions", desc: "Bring 3 Slime Gel.", type: "collect", item: "gel", target: 3, reward: { gold: 25, xp: 30, item: "herb", qty: 3 } },
  { id: "ore5",    giver: "Smith",   title: "Ore for the Forge", desc: "Collect 5 Ore.", type: "collect", item: "ore", target: 5, reward: { gold: 40, xp: 50, item: "sword", qty: 1 } },
  { id: "slay15",  giver: "Warden",  title: "Forest Cull", desc: "Defeat 15 creatures.", type: "kill", target: 15, reward: { gold: 80, xp: 120 } },
  { id: "chest3",  giver: "Explorer", title: "Treasure Hunter", desc: "Open 3 chests.", type: "chest", target: 3, reward: { gold: 60, xp: 70 } },
];

// NPC appearance colors (drawn with same chargen body, distinct looks)
export const NPC_DEFS = [
  { name: "Warden",    look: { skin: "#c98a63", hair: "#2b2b2f", shirt: "#3d6fa8", pants: "#37503a", boots: "#3a3a42", style: "short" }, dx: -70, dy: -40 },
  { name: "Alchemist", look: { skin: "#ffd6b4", hair: "#7a5a86", shirt: "#8557a8", pants: "#42486a", boots: "#5c3c2c", style: "long" }, dx: 80, dy: -30 },
  { name: "Smith",     look: { skin: "#8d5a3c", hair: "#b5432f", shirt: "#b0503f", pants: "#2c2c34", boots: "#7a5230", style: "spiky" }, dx: -50, dy: 70 },
  { name: "Explorer",  look: { skin: "#f0b892", hair: "#caa24a", shirt: "#c9a23e", pants: "#5a3f2e", boots: "#5c3c2c", style: "short" }, dx: 90, dy: 60 },
];

export class QuestLog {
  constructor() {
    this.active = {};      // id -> {quest, progress}
    this.done = {};        // id -> true
    this.killCount = 0;
    this.chestCount = 0;
  }
  isActive(id) { return !!this.active[id]; }
  isDone(id) { return !!this.done[id]; }
  accept(q) {
    if (this.active[q.id] || this.done[q.id]) return false;
    this.active[q.id] = { quest: q, progress: 0, startKills: this.killCount, startChests: this.chestCount };
    return true;
  }
  // returns list of {q, ready} for a giver
  forGiver(name, inv) {
    return QUESTS.filter(q => q.giver === name).map(q => {
      const a = this.active[q.id];
      let ready = false, progress = 0;
      if (a) {
        if (q.type === "kill") progress = Math.min(q.target, this.killCount - a.startKills);
        else if (q.type === "chest") progress = Math.min(q.target, this.chestCount - a.startChests);
        else if (q.type === "collect") progress = Math.min(q.target, inv[q.item] || 0);
        ready = progress >= q.target;
      }
      return { q, active: !!a, done: !!this.done[q.id], ready, progress };
    });
  }
  complete(q, player) {
    if (!this.active[q.id]) return null;
    if (q.type === "collect") player.inv[q.item] = Math.max(0, (player.inv[q.item] || 0) - q.target);
    delete this.active[q.id];
    this.done[q.id] = true;
    const r = q.reward;
    player.gold += r.gold || 0;
    player.xp += r.xp || 0;
    if (r.item) player.inv[r.item] = (player.inv[r.item] || 0) + (r.qty || 1);
    return r;
  }
}
