// Pure AFK battle expeditions. Jobs are JSON-safe; elapsed time and rewards
// are always rebuilt from canonical expedition data instead of save payloads.

export const AFK_BATTLE_VERSION = 1;

export const AFK_BATTLE_OPTIONS = Object.freeze([
  Object.freeze({
    id: "mosswood-patrol",
    label: "Mosswood Patrol",
    description: "A short sweep through the safer forest paths.",
    minutes: 5,
    durationMs: 5 * 60 * 1000,
    waveCount: 3,
    baseEnemies: 2,
    goldPerKill: 1.8,
    xpPerKill: 4.2,
    materialRolls: 2,
    enemy: "Forest pack",
    difficulty: 1,
  }),
  Object.freeze({
    id: "moonlit-hunt",
    label: "Moonlit Hunt",
    description: "Track stronger packs beyond the lantern road.",
    minutes: 15,
    durationMs: 15 * 60 * 1000,
    waveCount: 7,
    baseEnemies: 3,
    goldPerKill: 2,
    xpPerKill: 4.6,
    materialRolls: 6,
    enemy: "Twilight pack",
    difficulty: 2,
  }),
  Object.freeze({
    id: "ancient-frontier",
    label: "Ancient Frontier",
    description: "Hold the old shrine road against relentless waves.",
    minutes: 30,
    durationMs: 30 * 60 * 1000,
    waveCount: 12,
    baseEnemies: 4,
    goldPerKill: 2.2,
    xpPerKill: 5,
    materialRolls: 14,
    enemy: "Frontier horde",
    difficulty: 3,
  }),
]);

export const AFK_BATTLE_CLASS_PROFILES = Object.freeze({
  warrior: Object.freeze({ name: "Warrior", role: "Steady Vanguard", killMul: 1, goldMul: 1, xpMul: 1, materialMul: 1, survival: 1.16, materialBias: "ore" }),
  mage: Object.freeze({ name: "Mage", role: "Arcane Sweeper", killMul: 1.04, goldMul: 1, xpMul: 1.06, materialMul: 1, survival: .96, materialBias: "gel" }),
  archer: Object.freeze({ name: "Archer", role: "Mobile Ranger", killMul: 1.06, goldMul: 1.02, xpMul: 1, materialMul: 1.03, survival: 1, materialBias: "wood" }),
  priest: Object.freeze({ name: "Priest", role: "Enduring Support", killMul: .93, goldMul: 1, xpMul: 1.08, materialMul: 1.05, survival: 1.3, materialBias: "herb" }),
  slayer: Object.freeze({ name: "Slayer", role: "Relentless Assault", killMul: 1.1, goldMul: 1.04, xpMul: 1.02, materialMul: .96, survival: .88, materialBias: "ore" }),
  hunter: Object.freeze({ name: "Hunter", role: "Resource Tracker", killMul: 1.05, goldMul: 1.04, xpMul: 1, materialMul: 1.1, survival: .98, materialBias: "wood" }),
});

const OPTION_BY_MINUTES = new Map(AFK_BATTLE_OPTIONS.map((option) => [option.minutes, option]));
const OPTION_BY_ID = new Map(AFK_BATTLE_OPTIONS.map((option) => [option.id, option]));
const MATERIAL_IDS = Object.freeze(["wood", "herb", "ore", "gel"]);
const MAX_LEVEL_SNAPSHOT = 100;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function safeTimestamp(value, fallback = null) {
  const number = finiteNumber(value);
  if (number === null || number <= 0 || number > 8.64e15) return fallback;
  return Math.floor(number);
}

function hashString(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normalizeSeed(value, fallbackSource) {
  const number = finiteNumber(value);
  if (number !== null) return Math.floor(number) >>> 0;
  if (typeof value === "string" && value) return hashString(value);
  return hashString(fallbackSource);
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function optionFrom(value) {
  if (value && typeof value === "object") value = value.id ?? value.optionId ?? value.minutes;
  if (typeof value === "string") {
    const key = value.trim().toLowerCase();
    if (OPTION_BY_ID.has(key)) return OPTION_BY_ID.get(key);
    value = key.endsWith("m") ? key.slice(0, -1) : key;
  }
  const minutes = finiteNumber(value);
  return minutes === null ? null : OPTION_BY_MINUTES.get(minutes) || null;
}

function durationFrom(raw) {
  const byId = optionFrom(raw?.optionId ?? raw?.expeditionId);
  if (byId) return byId;

  const direct = optionFrom(raw?.durationMinutes ?? raw?.minutes ?? raw?.option);
  if (direct) return direct;

  // Migration path for prototypes that persisted only a numeric duration.
  const duration = finiteNumber(raw?.durationMs ?? raw?.duration);
  if (duration === null) return null;
  return optionFrom(duration > 30 ? duration / 60000 : duration);
}

function normalizeClassId(value) {
  const id = String(value || "warrior").trim().toLowerCase();
  return AFK_BATTLE_CLASS_PROFILES[id] ? id : "warrior";
}

function normalizeLevel(value) {
  const level = finiteNumber(value);
  return Math.floor(clamp(level ?? 1, 1, MAX_LEVEL_SNAPSHOT));
}

function makeJobId(startedAt, optionId, classId, seed) {
  const identity = hashString(`${optionId}|${classId}|${seed}`).toString(36);
  return `battle-${startedAt.toString(36)}-${identity}`;
}

function pickMaterial(random, profile) {
  const weights = MATERIAL_IDS.map((id) => ({ id, weight: id === profile.materialBias ? 2.25 : 1 }));
  let cursor = random() * weights.reduce((sum, entry) => sum + entry.weight, 0);
  for (const entry of weights) {
    cursor -= entry.weight;
    if (cursor <= 0) return entry.id;
  }
  return weights[weights.length - 1].id;
}

function addMaterial(target, id, amount = 1) {
  target[id] = (target[id] || 0) + amount;
}

export function afkBattleOption(value) {
  return optionFrom(value) || null;
}

export function createAfkBattleJob({
  durationMinutes = 5,
  minutes,
  option,
  optionId,
  classId = "warrior",
  level = 1,
  now = Date.now(),
  seed,
} = {}) {
  const selected = optionFrom(optionId ?? minutes ?? option ?? durationMinutes);
  const startedAt = safeTimestamp(now);
  if (!selected || startedAt === null) return null;

  const normalizedClassId = normalizeClassId(classId);
  const normalizedLevel = normalizeLevel(level);
  const fallbackSeed = `${startedAt}|${selected.id}|${normalizedClassId}|${normalizedLevel}`;
  const normalizedSeed = normalizeSeed(seed, fallbackSeed);

  return {
    version: AFK_BATTLE_VERSION,
    id: makeJobId(startedAt, selected.id, normalizedClassId, normalizedSeed),
    optionId: selected.id,
    durationMinutes: selected.minutes,
    startedAt,
    endsAt: startedAt + selected.durationMs,
    classId: normalizedClassId,
    level: normalizedLevel,
    seed: normalizedSeed,
    claimedAt: null,
  };
}

export function normalizeAfkBattleJob(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value.job && typeof value.job === "object" ? value.job : value;
  const option = durationFrom(raw);
  if (!option) return null;

  const persistedEnd = safeTimestamp(raw.endsAt ?? raw.endAt ?? raw.completesAt ?? raw.finishAt);
  const startedAt = safeTimestamp(
    raw.startedAt ?? raw.startTime ?? raw.started ?? raw.createdAt,
    persistedEnd === null ? null : persistedEnd - option.durationMs,
  );
  if (startedAt === null) return null;

  // Never trust a persisted end time. Only approved options define duration.
  const endsAt = startedAt + option.durationMs;
  if (!Number.isSafeInteger(endsAt) || endsAt > 8.64e15) return null;

  const classId = normalizeClassId(raw.classId ?? raw.class ?? raw.combat?.classId);
  const level = normalizeLevel(raw.level ?? raw.playerLevel ?? raw.combat?.level);
  const fallbackSeed = `${startedAt}|${option.id}|${classId}|${level}`;
  const seed = normalizeSeed(raw.seed, fallbackSeed);
  const claimedValue = safeTimestamp(raw.claimedAt ?? raw.claimedTime);
  const wasClaimed = raw.claimed === true || claimedValue !== null;
  const claimedAt = wasClaimed ? Math.max(endsAt, claimedValue ?? endsAt) : null;

  return {
    version: AFK_BATTLE_VERSION,
    id: makeJobId(startedAt, option.id, classId, seed),
    optionId: option.id,
    durationMinutes: option.minutes,
    startedAt,
    endsAt,
    classId,
    level,
    seed,
    claimedAt,
  };
}

export function afkBattleStatus(value, now = Date.now()) {
  if (value == null) return { valid: true, state: "idle", job: null, progress: 0, remainingMs: 0, canClaim: false };
  const job = normalizeAfkBattleJob(value);
  if (!job) return { valid: false, state: "invalid", job: null, progress: 0, remainingMs: 0, canClaim: false };

  const current = safeTimestamp(now, job.startedAt);
  const durationMs = job.endsAt - job.startedAt;
  const progress = clamp((current - job.startedAt) / durationMs, 0, 1);
  const remainingMs = Math.max(0, job.endsAt - current);
  const state = job.claimedAt !== null ? "claimed" : remainingMs === 0 ? "ready" : "running";
  return { valid: true, state, job, progress, remainingMs, canClaim: state === "ready" };
}

export function isAfkBattleComplete(value, now = Date.now()) {
  const status = afkBattleStatus(value, now);
  return status.valid && (status.state === "ready" || status.state === "claimed");
}

export function generateAfkBattleRewards(value) {
  const job = normalizeAfkBattleJob(value);
  if (!job) return null;

  const option = OPTION_BY_ID.get(job.optionId);
  const profile = AFK_BATTLE_CLASS_PROFILES[job.classId];
  const random = seededRandom(job.seed);
  const levelPace = 1 + Math.min(.14, (job.level - 1) * .0025);
  const rewardScale = 1 + Math.min(.45, (job.level - 1) * .0075);
  const totalMaterialRolls = Math.max(1, Math.round((option.materialRolls + Math.min(3, Math.floor(job.level / 20))) * profile.materialMul));
  const baseRollsPerWave = Math.floor(totalMaterialRolls / option.waveCount);
  let extraRolls = totalMaterialRolls % option.waveCount;
  const materials = {};
  const waves = [];
  let kills = 0;
  let gold = 0;
  let xp = 0;

  for (let index = 0; index < option.waveCount; index++) {
    const pressure = Math.min(1.2, index * .035);
    const enemyRoll = option.baseEnemies + pressure + random() * 1.8;
    const waveKills = Math.max(1, Math.round(enemyRoll * profile.killMul * levelPace));
    const qualityRoll = random() + (profile.survival - 1) * .65;
    const rating = qualityRoll > .77 ? "clean" : qualityRoll > .3 ? "steady" : "hard-fought";
    const qualityMul = rating === "clean" ? 1.04 : rating === "hard-fought" ? .94 : 1;
    const waveGold = Math.max(1, Math.round(waveKills * option.goldPerKill * profile.goldMul * rewardScale * qualityMul * (.93 + random() * .14)));
    const waveXp = Math.max(1, Math.round(waveKills * option.xpPerKill * profile.xpMul * rewardScale * (.94 + random() * .12)));
    const waveMaterials = {};
    let materialRolls = baseRollsPerWave;
    if (extraRolls > 0) { materialRolls++; extraRolls--; }

    for (let roll = 0; roll < materialRolls; roll++) {
      const id = pickMaterial(random, profile);
      const amount = random() < .08 + option.difficulty * .035 ? 2 : 1;
      addMaterial(waveMaterials, id, amount);
      addMaterial(materials, id, amount);
    }

    kills += waveKills;
    gold += waveGold;
    xp += waveXp;
    waves.push({
      number: index + 1,
      enemy: option.enemy,
      rating,
      kills: waveKills,
      gold: waveGold,
      xp: waveXp,
      materials: waveMaterials,
    });
  }

  const cleanWaves = waves.filter((wave) => wave.rating === "clean").length;
  const overallRating = cleanWaves >= Math.ceil(waves.length * .6) ? "flawless" : cleanWaves >= Math.ceil(waves.length * .3) ? "victory" : "hard-won";

  return {
    expedition: { id: option.id, label: option.label, minutes: option.minutes },
    classId: job.classId,
    className: profile.name,
    classRole: profile.role,
    level: job.level,
    overallRating,
    waves,
    waveCount: waves.length,
    kills,
    gold,
    xp,
    materials,
    items: { ...materials },
  };
}

export function claimAfkBattleJob(value, now = Date.now()) {
  const status = afkBattleStatus(value, now);
  if (!status.valid) return { ok: false, code: "invalid_job", job: null, rewards: null, status };
  if (status.state === "idle") return { ok: false, code: "no_job", job: null, rewards: null, status };
  if (status.state === "running") return { ok: false, code: "not_ready", job: status.job, rewards: null, status };
  if (status.state === "claimed") return { ok: false, code: "already_claimed", job: status.job, rewards: null, status };

  const claimedAt = Math.max(status.job.endsAt, safeTimestamp(now, status.job.endsAt));
  const job = { ...status.job, claimedAt };
  return {
    ok: true,
    code: "claimed",
    job,
    rewards: generateAfkBattleRewards(status.job),
    status: afkBattleStatus(job, claimedAt),
  };
}
