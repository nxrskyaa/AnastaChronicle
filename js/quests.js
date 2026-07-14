// NPCs + quest system for Anasta.
export const QUESTS = [
  { id: "slay5",   giver: "Warden",  title: "Thin the Slimes", desc: "Defeat 5 creatures near camp.", type: "kill", target: 5, reward: { gold: 30, xp: 40 } },
  { id: "gel3",    giver: "Alchemist", title: "Gel for Potions", desc: "Bring 3 Slime Gel.", type: "collect", item: "gel", target: 3, reward: { gold: 25, xp: 30, item: "herb", qty: 3 } },
  { id: "ore5",    giver: "Smith",   title: "Ore for the Forge", desc: "Collect 5 Ore.", type: "collect", item: "ore", target: 5, reward: { gold: 40, xp: 50, item: "sword", qty: 1 } },
  { id: "slay15",  giver: "Warden",  title: "Forest Cull", desc: "Defeat 15 creatures.", type: "kill", target: 15, reward: { gold: 80, xp: 120 } },
  { id: "chest3",  giver: "Explorer", title: "Treasure Hunter", desc: "Open 3 chests.", type: "chest", target: 3, reward: { gold: 60, xp: 70 } },
  { id: "fish3",   giver: "Angler",  title: "Gone Fishing", desc: "Catch 3 fish from the lake.", type: "fish", target: 3, reward: { gold: 45, xp: 55, item: "herb", qty: 2 } },
  { id: "fish8",   giver: "Angler",  title: "Master Angler", desc: "Catch 8 fish.", type: "fish", target: 8, reward: { gold: 120, xp: 160, item: "dagger", qty: 1 } },
  { id: "berry4",  giver: "Cook",    title: "Berry Basket", desc: "Gather 4 Herbs.", type: "collect", item: "herb", target: 4, reward: { gold: 35, xp: 45 } },
  { id: "slay30",  giver: "Knight",  title: "Guardian's Trial", desc: "Defeat 30 creatures.", type: "kill", target: 30, reward: { gold: 150, xp: 240, item: "axe", qty: 1 } },
];

// NPC appearance + role + dialogue. Drawn with the chargen body (varied looks).
export const NPC_DEFS = [
  { name: "Warden",    role: "Guard",    look: { skin: "#c98a63", hair: "#2b2b2f", shirt: "#3d6fa8", pants: "#37503a", boots: "#3a3a42", style: "short" }, dx: -70, dy: -40, line: "The forest grows restless. Cull the beasts and keep camp safe." },
  { name: "Alchemist", role: "Potions",  look: { skin: "#ffd6b4", hair: "#7a5a86", shirt: "#8557a8", pants: "#42486a", boots: "#5c3c2c", style: "long" }, dx: 80, dy: -30, line: "Slime gel makes the finest tonics. Bring me some, won't you?" },
  { name: "Smith",     role: "Forge",    look: { skin: "#8d5a3c", hair: "#b5432f", shirt: "#b0503f", pants: "#2c2c34", boots: "#7a5230", style: "spiky" }, dx: -50, dy: 70, line: "Bring me ore and I'll forge you a blade worth swinging." },
  { name: "Explorer",  role: "Scout",    look: { skin: "#f0b892", hair: "#caa24a", shirt: "#c9a23e", pants: "#5a3f2e", boots: "#5c3c2c", style: "short" }, dx: 90, dy: 60, line: "Chests hide all over these woods. Crack a few open, adventurer!" },
  { name: "Angler",    role: "Fisher",   look: { skin: "#d89b6e", hair: "#4a6ea0", shirt: "#2b8a7a", pants: "#42486a", boots: "#3a3a42", style: "ponytail" }, dx: 192, dy: -120, face: "right", line: "Interact at the water's edge, then choose Manual or Auto. Auto uses the same cast and catch flow while you rest." },
  { name: "Cook",      role: "Kitchen",  look: { skin: "#ffe0c0", hair: "#d7d2c8", shirt: "#e0e0e8", pants: "#7a6a4a", boots: "#5c3c2c", style: "short" }, dx: 40, dy: -80, line: "Fresh herbs make a hearty stew. Gather some from the meadow." },
  { name: "Knight",    role: "Champion", look: { skin: "#a86b45", hair: "#3a8a6a", shirt: "#2f2f38", pants: "#3a3a48", boots: "#2a2a30", style: "mohawk" }, dx: 120, dy: -70, line: "Prove your worth in battle and I'll grant you a warrior's axe." },
  { name: "Merchant",  role: "Trader",   look: { skin: "#6b4228", hair: "#e8d27a", shirt: "#a03a5a", pants: "#5a2a3a", boots: "#8a6a3a", style: "long" }, dx: 10, dy: 90, line: "Gold buys comfort, friend. Slay, forage, and prosper!" },
];

const QUEST_BY_ID = new Map(QUESTS.map(quest => [quest.id, quest]));

function safeCounter(value, fallback = 0) {
  return Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}

function safeStart(value, current) {
  // A start counter ahead of the global counter would produce negative progress.
  // Treat corrupt/missing baselines as a freshly accepted quest instead.
  return Math.min(safeCounter(value, current), current);
}

function knownQuestId(value) {
  return typeof value === "string" && QUEST_BY_ID.has(value) ? value : null;
}

export class QuestLog {
  constructor() {
    this.active = {};      // id -> {quest, progress}
    this.done = {};        // id -> true
    this.killCount = 0;
    this.chestCount = 0;
    this.fishCount = 0;
  }
  isActive(id) { return !!this.active[id]; }
  isDone(id) { return !!this.done[id]; }
  accept(q) {
    if (this.active[q.id] || this.done[q.id]) return false;
    this.active[q.id] = { quest: q, progress: 0, startKills: this.killCount, startChests: this.chestCount, startFish: this.fishCount };
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
        else if (q.type === "fish") progress = Math.min(q.target, this.fishCount - a.startFish);
        else if (q.type === "collect") progress = Math.min(q.target, inv[q.item] || 0);
        ready = progress >= q.target;
      }
      return { q, active: !!a, done: !!this.done[q.id], ready, progress };
    });
  }
  complete(q, player) {
    const active = this.active[q.id];
    if (!active || !q || !player) return null;
    let progress = 0;
    if (q.type === "kill") progress = this.killCount - active.startKills;
    else if (q.type === "chest") progress = this.chestCount - active.startChests;
    else if (q.type === "fish") progress = this.fishCount - active.startFish;
    else if (q.type === "collect") progress = player.inv?.[q.item] || 0;
    if (!Number.isFinite(progress) || progress < q.target) return null;
    if (q.type === "collect") player.inv[q.item] = Math.max(0, (player.inv[q.item] || 0) - q.target);
    delete this.active[q.id];
    this.done[q.id] = true;
    const r = q.reward;
    player.gold += r.gold || 0;
    player.xp += r.xp || 0;
    if (r.item) player.inv[r.item] = (player.inv[r.item] || 0) + (r.qty || 1);
    return r;
  }

  serialize() {
    const killCount = safeCounter(this.killCount);
    const chestCount = safeCounter(this.chestCount);
    const fishCount = safeCounter(this.fishCount);

    return {
      version: 1,
      killCount,
      chestCount,
      fishCount,
      active: QUESTS.flatMap(quest => {
        const entry = this.active[quest.id];
        if (!entry || this.done[quest.id]) return [];
        return [{
          id: quest.id,
          startKills: safeStart(entry.startKills, killCount),
          startChests: safeStart(entry.startChests, chestCount),
          startFish: safeStart(entry.startFish, fishCount),
        }];
      }),
      done: QUESTS.filter(quest => !!this.done[quest.id]).map(quest => quest.id),
    };
  }

  restore(snapshot) {
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return false;

    // Older saves stored counters at the root. Also accept a nested counters
    // object so future save migrations do not need another QuestLog format.
    const counters = snapshot.counters && typeof snapshot.counters === "object"
      ? snapshot.counters
      : {};
    const killCount = safeCounter(snapshot.killCount, safeCounter(counters.kills));
    const chestCount = safeCounter(snapshot.chestCount, safeCounter(counters.chests));
    const fishCount = safeCounter(snapshot.fishCount, safeCounter(counters.fish));
    const restoredDone = {};
    const restoredActive = {};

    const addDone = value => {
      const id = knownQuestId(value);
      if (id) restoredDone[id] = true;
    };
    if (Array.isArray(snapshot.done)) {
      snapshot.done.forEach(addDone);
    } else if (snapshot.done && typeof snapshot.done === "object") {
      // Compatibility with the old raw QuestLog shape: { id: true }.
      Object.entries(snapshot.done).forEach(([id, value]) => {
        if (value === true) addDone(id);
      });
    }

    const addActive = (candidateId, value = {}) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return;
      const entry = value;
      const id = knownQuestId(candidateId)
        || knownQuestId(entry.id)
        || knownQuestId(entry.quest?.id);
      if (!id || restoredDone[id]) return;
      restoredActive[id] = {
        quest: QUEST_BY_ID.get(id),
        progress: 0,
        startKills: safeStart(entry.startKills, killCount),
        startChests: safeStart(entry.startChests, chestCount),
        startFish: safeStart(entry.startFish, fishCount),
      };
    };
    if (Array.isArray(snapshot.active)) {
      snapshot.active.forEach(entry => {
        if (typeof entry === "string") addActive(entry);
        else if (entry && typeof entry === "object") addActive(entry.id, entry);
      });
    } else if (snapshot.active && typeof snapshot.active === "object") {
      // Compatibility with the old raw QuestLog shape: { id: { quest, ... } }.
      Object.entries(snapshot.active).forEach(([id, entry]) => addActive(id, entry));
    }

    // Commit only after normalization so a malformed snapshot cannot leave a
    // half-restored log behind.
    this.killCount = killCount;
    this.chestCount = chestCount;
    this.fishCount = fishCount;
    this.active = restoredActive;
    this.done = restoredDone;
    return true;
  }
}
