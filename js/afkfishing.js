// Pure AFK fishing jobs. Jobs are JSON-safe and rewards are regenerated from
// their validated seed instead of trusting a reward payload from localStorage.
import { FISH, RODS, rollFish } from "./fishing.js";

export const AFK_FISHING_VERSION = 1;

export const AFK_FISHING_OPTIONS = Object.freeze([
  Object.freeze({ id: "shore-break", label: "Shore Break", minutes: 2, durationMs: 2 * 60 * 1000, baseCatches: 2 }),
  Object.freeze({ id: "quiet-watch", label: "Quiet Watch", minutes: 10, durationMs: 10 * 60 * 1000, baseCatches: 9 }),
  Object.freeze({ id: "deep-water", label: "Deep Water", minutes: 30, durationMs: 30 * 60 * 1000, baseCatches: 25 }),
]);

const OPTION_BY_MINUTES = new Map(AFK_FISHING_OPTIONS.map((option) => [option.minutes, option]));
const OPTION_BY_ID = new Map(AFK_FISHING_OPTIONS.map((option) => [option.id, option]));
const FISH_ORDER = new Map(FISH.map((fish, index) => [fish.id, index]));
const ALLOWED_ZONES = new Set(["pond", "lake"]);
const ALLOWED_TIMES = new Set(["day", "night"]);
const ALLOWED_WEATHER = new Set(["clear", "rain"]);
const MAX_CAPTURED_LUCK = .75;

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
  if (value && typeof value === "object") value = value.minutes ?? value.id;
  if (typeof value === "string") {
    const key = value.trim().toLowerCase();
    if (OPTION_BY_ID.has(key)) return OPTION_BY_ID.get(key);
    value = key.endsWith("m") ? key.slice(0, -1) : key;
  }
  const minutes = finiteNumber(value);
  return minutes === null ? null : OPTION_BY_MINUTES.get(minutes) || null;
}

function durationFrom(raw) {
  const direct = raw?.durationMinutes ?? raw?.minutes ?? raw?.optionId ?? raw?.option;
  const directOption = optionFrom(direct);
  if (directOption) return directOption;

  // Migration for early prototypes that persisted only a millisecond duration.
  const duration = finiteNumber(raw?.durationMs ?? raw?.duration);
  if (duration === null) return null;
  const minutes = duration > 30 ? duration / 60000 : duration;
  return optionFrom(minutes);
}

function normalizeRod(raw = {}) {
  const source = raw?.rod && typeof raw.rod === "object" ? raw.rod : raw;
  const requestedId = String(source?.id ?? raw?.rodId ?? "basicrod").toLowerCase();
  const id = RODS[requestedId] ? requestedId : "basicrod";
  const base = RODS[id];
  const requestedLuck = finiteNumber(source?.luck ?? raw?.rodLuck);
  const luck = Math.round(clamp(requestedLuck ?? base.luck, base.luck, MAX_CAPTURED_LUCK) * 1000) / 1000;
  return { id, name: base.name, control: base.control, reel: base.reel, luck };
}

function normalizeContext(raw = {}) {
  const source = raw?.context && typeof raw.context === "object" ? raw.context : raw;
  const zone = ALLOWED_ZONES.has(source?.zone) ? source.zone : "pond";
  const time = ALLOWED_TIMES.has(source?.time) ? source.time : "day";
  const weather = ALLOWED_WEATHER.has(source?.weather) ? source.weather : "clear";
  return { zone, time, weather };
}

function makeJobId(startedAt, seed) {
  return `afk-${startedAt.toString(36)}-${seed.toString(36)}`;
}

export function afkFishingOption(value) {
  return optionFrom(value) || null;
}

export function createAfkFishingJob({
  durationMinutes = 2,
  minutes,
  option,
  rod,
  rodId,
  rodLuck,
  zone = "pond",
  time = "day",
  weather = "clear",
  now = Date.now(),
  seed,
} = {}) {
  const selected = optionFrom(minutes ?? option ?? durationMinutes);
  const startedAt = safeTimestamp(now);
  if (!selected || startedAt === null) return null;

  const normalizedRod = normalizeRod({ rod, rodId, rodLuck });
  const context = normalizeContext({ zone, time, weather });
  const fallbackSeed = `${startedAt}|${selected.minutes}|${normalizedRod.id}|${normalizedRod.luck}|${context.zone}|${context.time}|${context.weather}`;
  const normalizedSeed = normalizeSeed(seed, fallbackSeed);

  return {
    version: AFK_FISHING_VERSION,
    id: makeJobId(startedAt, normalizedSeed),
    durationMinutes: selected.minutes,
    startedAt,
    endsAt: startedAt + selected.durationMs,
    rod: normalizedRod,
    context,
    seed: normalizedSeed,
    claimedAt: null,
  };
}

export function normalizeAfkFishingJob(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value.job && typeof value.job === "object" ? value.job : value;
  const option = durationFrom(raw);
  if (!option) return null;

  const persistedEnd = safeTimestamp(raw.endsAt ?? raw.endAt ?? raw.completesAt ?? raw.finishAt);
  const startedAt = safeTimestamp(raw.startedAt ?? raw.startTime ?? raw.started ?? raw.createdAt,
    persistedEnd === null ? null : persistedEnd - option.durationMs);
  if (startedAt === null) return null;

  // The canonical end is always derived from the approved duration. This keeps
  // migrated or edited saves from shortening an in-progress expedition.
  const endsAt = startedAt + option.durationMs;
  if (!Number.isSafeInteger(endsAt) || endsAt > 8.64e15) return null;

  const rod = normalizeRod(raw);
  const context = normalizeContext(raw);
  const fallbackSeed = `${startedAt}|${option.minutes}|${rod.id}|${rod.luck}|${context.zone}|${context.time}|${context.weather}`;
  const seed = normalizeSeed(raw.seed, fallbackSeed);
  const claimedValue = safeTimestamp(raw.claimedAt ?? raw.claimedTime);
  const wasClaimed = raw.claimed === true || claimedValue !== null;
  const claimedAt = wasClaimed ? Math.max(endsAt, claimedValue ?? endsAt) : null;
  const storedId = typeof raw.id === "string" ? raw.id.trim().slice(0, 80) : "";

  return {
    version: AFK_FISHING_VERSION,
    id: storedId || makeJobId(startedAt, seed),
    durationMinutes: option.minutes,
    startedAt,
    endsAt,
    rod,
    context,
    seed,
    claimedAt,
  };
}

export function afkFishingStatus(value, now = Date.now()) {
  if (value == null) return { valid: true, state: "idle", job: null, progress: 0, remainingMs: 0, canClaim: false };
  const job = normalizeAfkFishingJob(value);
  if (!job) return { valid: false, state: "invalid", job: null, progress: 0, remainingMs: 0, canClaim: false };

  const current = safeTimestamp(now, job.startedAt);
  const durationMs = job.endsAt - job.startedAt;
  const progress = clamp((current - job.startedAt) / durationMs, 0, 1);
  const remainingMs = Math.max(0, job.endsAt - current);
  const state = job.claimedAt !== null ? "claimed" : remainingMs === 0 ? "ready" : "running";
  return { valid: true, state, job, progress, remainingMs, canClaim: state === "ready" };
}

export function isAfkFishingComplete(value, now = Date.now()) {
  const status = afkFishingStatus(value, now);
  return status.valid && (status.state === "ready" || status.state === "claimed");
}

export function generateAfkFishingRewards(value) {
  const job = normalizeAfkFishingJob(value);
  if (!job) return null;
  const option = OPTION_BY_MINUTES.get(job.durationMinutes);
  const random = seededRandom(job.seed);
  const expectedBonus = option.baseCatches * job.rod.luck * .35;
  const bonusCatches = Math.floor(expectedBonus) + (random() < expectedBonus % 1 ? 1 : 0);
  const catchCount = option.baseCatches + bonusCatches;
  const context = { ...job.context, rod: job.rod };
  const catches = [];
  const records = {};
  const grouped = new Map();
  let gold = 0;
  let bestSize = 0;

  for (let index = 0; index < catchCount; index++) {
    const fish = rollFish(context, random);
    catches.push(fish);
    gold += fish.gold;
    bestSize = Math.max(bestSize, fish.size);
    const record = records[fish.id] || { count: 0, best: 0 };
    record.count++;
    record.best = Math.max(record.best, fish.size);
    records[fish.id] = record;

    const existing = grouped.get(fish.id) || { ...FISH.find((entry) => entry.id === fish.id), count: 0, bestSize: 0, totalGold: 0 };
    existing.count++;
    existing.bestSize = Math.max(existing.bestSize, fish.size);
    existing.totalGold += fish.gold;
    grouped.set(fish.id, existing);
  }

  const summary = [...grouped.values()].sort((a, b) => (FISH_ORDER.get(a.id) ?? 999) - (FISH_ORDER.get(b.id) ?? 999));
  return {
    catches,
    summary,
    records,
    fishCount: catches.length,
    items: { fish: catches.length },
    gold,
    bestSize: Math.round(bestSize * 10) / 10,
  };
}

export function claimAfkFishingJob(value, now = Date.now()) {
  const status = afkFishingStatus(value, now);
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
    rewards: generateAfkFishingRewards(status.job),
    status: afkFishingStatus(job, claimedAt),
  };
}
