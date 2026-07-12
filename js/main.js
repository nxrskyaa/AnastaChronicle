import { loadAll } from "./assets.js";
import { Game } from "./game.js";
import "./logic.js";
import "./interactions.js";
import "./render.js";
import { UI } from "./ui.js";
import {
  buildCharacter, buildWeapon, PRESETS, HAIRSTYLES, FACE_MARKS,
  ACCESSORIES, OUTFITS, AURAS, DEFAULT_LOOK, normalizeLook,
} from "./chargen.js";
import { audio } from "./audio.js";
import { computeView } from "./view.js";
import {
  connectMultiplayer, net, remoteCount, requestBossState,
  sendChat, sendDuel,
} from "./net.js";
import { CLASSES } from "./classes.js";
import { normalizeActiveBuffs } from "./cooking.js";
import { STARTER_MOUNT_ID } from "./monsters.js";
import { afkFishingStatus, normalizeAfkFishingJob } from "./afkfishing.js";

const boot = document.getElementById("boot");
const bootStatus = document.getElementById("boot-status");
const loadingBar = document.getElementById("loading-bar-fill");
const startBtn = document.getElementById("btn-start");
const creator = document.getElementById("creator");
let look = { ...DEFAULT_LOOK };
let game = null;

// ---- Boot screen ambient particles (fireflies + drifting embers) ----
const bootCanvas = document.getElementById("boot-fx");
const bootCtx = bootCanvas?.getContext("2d");
let bootParticles = [];
let bootRAF = null;
function initBootFx() {
  if (!bootCanvas) return;
  const resize = () => { bootCanvas.width = window.innerWidth; bootCanvas.height = window.innerHeight; };
  resize();
  addEventListener("resize", resize);
  bootParticles = [];
  for (let i = 0; i < 40; i++) {
    bootParticles.push({
      x: Math.random() * bootCanvas.width,
      y: Math.random() * bootCanvas.height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.3 - 0.15,
      r: 1 + Math.random() * 2,
      phase: Math.random() * 6.28,
      speed: 0.02 + Math.random() * 0.03,
      hue: Math.random() < 0.6 ? "firefly" : "ember",
    });
  }
  const tick = () => {
    bootCtx.clearRect(0, 0, bootCanvas.width, bootCanvas.height);
    for (const p of bootParticles) {
      p.x += p.vx; p.y += p.vy; p.phase += p.speed;
      if (p.x < -10) p.x = bootCanvas.width + 10;
      if (p.x > bootCanvas.width + 10) p.x = -10;
      if (p.y < -10) p.y = bootCanvas.height + 10;
      if (p.y > bootCanvas.height + 10) p.y = -10;
      const a = 0.3 + Math.sin(p.phase) * 0.35;
      if (p.hue === "firefly") {
        bootCtx.fillStyle = `rgba(150,255,180,${Math.max(0, a)})`;
        bootCtx.beginPath(); bootCtx.arc(p.x, p.y, p.r, 0, 7); bootCtx.fill();
        bootCtx.fillStyle = `rgba(200,255,220,${Math.max(0, a * 0.3)})`;
        bootCtx.beginPath(); bootCtx.arc(p.x, p.y, p.r * 2.5, 0, 7); bootCtx.fill();
      } else {
        bootCtx.fillStyle = `rgba(255,160,80,${Math.max(0, a * 0.6)})`;
        bootCtx.beginPath(); bootCtx.arc(p.x, p.y, p.r, 0, 7); bootCtx.fill();
      }
    }
    bootRAF = requestAnimationFrame(tick);
  };
  tick();
}
initBootFx();

async function preload() {
  try {
    const started = performance.now();
    bootStatus.textContent = "Forging code-born sprites";
    await loadAll((done, total) => {
      const pct = Math.round(done / total * 100);
      if (loadingBar) loadingBar.style.width = `${pct}%`;
      const label = pct < 35 ? "Forging code-born sprites" : pct < 70 ? "Growing the forest realm" : "Binding wild spirits";
      bootStatus.textContent = label;
      const meter = document.getElementById("boot-percent"); if (meter) meter.textContent = `${pct}% GENERATED`;
    });
    const remaining = Math.max(0, 650 - (performance.now() - started));
    if (remaining) await new Promise(r => setTimeout(r, remaining));
    if (loadingBar) loadingBar.style.width = "100%";
    bootStatus.textContent = "Realm ready";
    const meter = document.getElementById("boot-percent"); if (meter) meter.textContent = "100% READY";
    startBtn.disabled = false;
  } catch (e) { bootStatus.textContent = "Load error: " + e.message; console.error(e); }
}

let rotDir = "down";
let previewState = "idle";
let previewCache = null;
let previewWeapon = null;
let previewLookKey = "";
let previewRAF = null;

const PREVIEW_META = {
  warrior: { kicker: "VANGUARD PATH", traits: ["70 HP", "MELEE", "GUARD"] },
  mage: { kicker: "ARCANIST PATH", traits: ["44 HP", "RANGED", "BURST"] },
  archer: { kicker: "RANGER PATH", traits: ["52 HP", "RANGED", "AGILE"] },
};

function invalidatePreview() { previewLookKey = ""; }

function updateCreatorSummary() {
  const cls = CLASSES[look.cls] || CLASSES.warrior;
  const meta = PREVIEW_META[look.cls] || PREVIEW_META.warrior;
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  set("preview-class-kicker", meta.kicker);
  set("preview-class-name", cls.name);
  set("preview-class-desc", cls.blurb);
  const traits = document.getElementById("preview-traits");
  if (traits) traits.innerHTML = meta.traits.map(v => `<span>${v}</span>`).join("");
  document.querySelector(".preview-summary")?.style.setProperty("--preview-accent", look.accent || cls.color);
}

function drawPreview(now = performance.now()) {
  const cv = document.getElementById("char-preview");
  if (!cv) return;
  const ctx = cv.getContext("2d"); ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, cv.width, cv.height);
  const resolved = normalizeLook(look);
  const key = JSON.stringify(resolved);
  if (!previewCache || previewLookKey !== key) {
    previewLookKey = key;
    previewCache = buildCharacter(resolved);
    previewWeapon = buildWeapon((CLASSES[resolved.cls] || CLASSES.warrior).weapon);
  }
  const pulse = now / 1000;
  const phase = previewState === "attack" ? (Math.floor(now / 105) % 5) : previewState === "arcana" ? (Math.floor(now / 125) % 6) : (Math.floor(now / 230) % 4);
  const pose = previewState === "attack" ? previewCache.atk : previewState === "arcana" ? previewCache.cast : previewCache.idle;
  const bodyFrames = pose?.[rotDir] || previewCache.walk[rotDir];
  const body = bodyFrames[phase % bodyFrames.length];
  const x = 32, y = 42, scale = 4;
  if (previewState === "arcana") {
    ctx.save(); ctx.globalAlpha = .32 + Math.sin(pulse * 5) * .08; ctx.strokeStyle = resolved.accent; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) ctx.strokeRect(56 - i * 4, 170 - i * 3, 80 + i * 8, 20 + i * 6);
    ctx.restore();
  }
  ctx.drawImage(body, 0, 0, 32, 40, x, y, 32 * scale, 40 * scale);
  const weapon = previewState === "attack" || previewState === "arcana"
    ? previewWeapon.atk[rotDir][phase % previewWeapon.atk[rotDir].length]
    : previewWeapon.walk[rotDir];
  ctx.drawImage(weapon, 0, 0, 32, 40, x, y, 32 * scale, 40 * scale);
  if (previewState !== "idle") {
    ctx.fillStyle = resolved.accent;
    for (let i = 0; i < 5; i++) {
      const a = pulse * (1.3 + i * .07) + i * 1.26;
      ctx.fillRect(Math.round(96 + Math.cos(a) * (40 + i * 2)), Math.round(116 + Math.sin(a) * (24 + i)), 3, 3);
    }
  }
}

function startPreviewLoop() {
  if (previewRAF) return;
  const tick = (now) => {
    if (creator.classList.contains("hidden")) { previewRAF = null; return; }
    drawPreview(now);
    previewRAF = requestAnimationFrame(tick);
  };
  previewRAF = requestAnimationFrame(tick);
}

function swatch(part) {
  const wrap = document.getElementById("sw-" + part); if (!wrap) return;
  wrap.innerHTML = "";
  const vals = part === "style" ? HAIRSTYLES : part === "mark" ? FACE_MARKS : part === "accessory" ? ACCESSORIES : part === "outfit" ? OUTFITS : part === "aura" ? AURAS : PRESETS[part];
  const textPart = ["style", "mark", "accessory", "outfit", "aura"].includes(part);
  for (const v of vals) {
    const b = document.createElement("button");
    b.className = "swatch" + (look[part] === v ? " sel" : "");
    b.type = "button";
    b.title = `${part}: ${v}`;
    b.setAttribute("aria-label", `${part} ${v}`);
    b.setAttribute("aria-pressed", look[part] === v ? "true" : "false");
    if (textPart) { b.textContent = v; b.classList.add("txt"); }
    else b.style.background = v;
    b.addEventListener("click", () => {
      audio.sfx("ui"); look[part] = v; invalidatePreview();
      wrap.querySelectorAll(".swatch").forEach(s => { s.classList.remove("sel"); s.setAttribute("aria-pressed", "false"); });
      b.classList.add("sel"); b.setAttribute("aria-pressed", "true"); drawPreview();
    });
    wrap.appendChild(b);
  }
}
function initCreator() {
  look = normalizeLook(look);
  const parts = ["style", "hair", "eyes", "skin", "mark", "accessory", "outfit", "accent", "shirt", "pants", "boots", "aura"];
  parts.forEach(swatch);
  updateCreatorSummary();
  if (creator.dataset.wired === "true") { startPreviewLoop(); return; }
  creator.dataset.wired = "true";
  document.getElementById("opt-name").addEventListener("input", (e) => { look.name = e.target.value || "Anasta"; });
  // gender picker
  document.querySelectorAll("#pick-gender .cls-btn").forEach(b => b.addEventListener("click", () => {
    audio.sfx("ui"); look.gender = b.dataset.gender;
    document.querySelectorAll("#pick-gender .cls-btn").forEach(x => { x.classList.remove("sel"); x.setAttribute("aria-pressed", "false"); }); b.classList.add("sel"); b.setAttribute("aria-pressed", "true");
    invalidatePreview(); drawPreview();
  }));
  // class picker
  document.querySelectorAll("#pick-class .cls-btn").forEach(b => b.addEventListener("click", () => {
    audio.sfx("ui"); look.cls = b.dataset.cls;
    document.querySelectorAll("#pick-class .cls-btn").forEach(x => { x.classList.remove("sel"); x.setAttribute("aria-pressed", "false"); }); b.classList.add("sel"); b.setAttribute("aria-pressed", "true");
    invalidatePreview(); updateCreatorSummary(); drawPreview();
  }));
  document.querySelectorAll("#pick-gender .cls-btn, #pick-class .cls-btn").forEach(b => b.setAttribute("aria-pressed", b.classList.contains("sel") ? "true" : "false"));
  document.querySelectorAll(".rot-btn").forEach(b => b.addEventListener("click", () => { audio.sfx("ui"); rotDir = b.dataset.rot; document.querySelectorAll(".rot-btn").forEach(x => x.classList.remove("active")); b.classList.add("active"); drawPreview(); }));
  document.querySelectorAll("[data-preview-state]").forEach(b => b.addEventListener("click", () => {
    previewState = b.dataset.previewState;
    document.querySelectorAll("[data-preview-state]").forEach(x => x.classList.toggle("active", x === b));
    audio.sfx("ui"); drawPreview();
  }));
  document.querySelectorAll("[data-creator-tab]").forEach(b => b.addEventListener("click", () => {
    const tab = b.dataset.creatorTab;
    document.querySelectorAll("[data-creator-tab]").forEach(x => x.classList.toggle("active", x === b));
    document.querySelectorAll("[data-creator-panel]").forEach(x => x.classList.toggle("active", x.dataset.creatorPanel === tab));
    const label = document.querySelector(".creator-progress span"); if (label) label.textContent = tab.toUpperCase();
    audio.sfx("ui");
  }));
  document.getElementById("btn-random").addEventListener("click", () => {
    audio.sfx("ui");
    const pick = a => a[(Math.random() * a.length) | 0];
    look = normalizeLook({
      ...look,
      skin: pick(PRESETS.skin), hair: pick(PRESETS.hair), eyes: pick(PRESETS.eyes),
      shirt: pick(PRESETS.shirt), pants: pick(PRESETS.pants), boots: pick(PRESETS.boots),
      accent: pick(PRESETS.accent), style: pick(HAIRSTYLES), mark: pick(FACE_MARKS),
      accessory: pick(ACCESSORIES), outfit: pick(OUTFITS), aura: pick(AURAS),
    });
    parts.forEach(swatch); invalidatePreview(); updateCreatorSummary(); drawPreview();
  });
  document.getElementById("btn-enter").addEventListener("click", () => startGame());
  drawPreview();
  startPreviewLoop();
}

function wireSettings() {
  const musicR = document.getElementById("set-music");
  const sfxR = document.getElementById("set-sfx");
  musicR?.addEventListener("input", () => audio.setMusicVol(musicR.value / 100));
  sfxR?.addEventListener("input", () => { audio.setSfxVol(sfxR.value / 100); audio.sfx("ui"); });
  const analogBtn = document.getElementById("ctrl-analog-btn"), dpadBtn = document.getElementById("ctrl-dpad-btn");
  const setCtrl = (mode) => {
    document.getElementById("stick").classList.toggle("hidden", mode !== "analog");
    document.getElementById("dpad").classList.toggle("hidden", mode !== "dpad");
    analogBtn.classList.toggle("active", mode === "analog");
    dpadBtn.classList.toggle("active", mode === "dpad");
    audio.sfx("ui");
  };
  analogBtn?.addEventListener("click", () => setCtrl("analog"));
  dpadBtn?.addEventListener("click", () => setCtrl("dpad"));
  const mBtn = document.getElementById("move-btn-btn"), mTap = document.getElementById("move-tap-btn");
  mBtn?.addEventListener("click", () => { if (game) game.moveMode = "button"; mBtn.classList.add("active"); mTap.classList.remove("active"); audio.sfx("ui"); });
  mTap?.addEventListener("click", () => { if (game) { game.moveMode = "tap"; game.moveTarget = null; } mTap.classList.add("active"); mBtn.classList.remove("active"); audio.sfx("ui"); });
  // dpad hold
  const dpadHold = {};
  document.querySelectorAll(".dpad-btn").forEach(b => {
    const dir = b.dataset.dir;
    const on = (e) => { e.preventDefault(); if (!game) return; const map = { up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD" }; game.keys[map[dir]] = true; };
    const off = (e) => { e.preventDefault(); if (!game) return; const map = { up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD" }; game.keys[map[dir]] = false; };
    b.addEventListener("touchstart", on, { passive: false }); b.addEventListener("touchend", off, { passive: false });
    b.addEventListener("mousedown", on); b.addEventListener("mouseup", off); b.addEventListener("mouseleave", off);
  });
}

function showArrivalGuide(isReturning) {
  const banner = document.getElementById("arrival-banner");
  if (!banner) return;
  const title = document.getElementById("arrival-title");
  const kicker = document.getElementById("arrival-kicker");
  const guide = document.getElementById("arrival-guide-text");
  if (title) title.textContent = isReturning ? `Chronicle resumed, ${look.name}` : `Welcome to Anasta, ${look.name}`;
  if (kicker) kicker.textContent = isReturning ? "THE FOREST REMEMBERS" : "THE FOREST AGE";
  if (guide) guide.textContent = isReturning && game?.flags?.starterCache
    ? "Open Sanctuary to switch bonds. Press M or tap the saddle button to ride a mount."
    : "Claim the golden cache just south of camp to bond Puffalo, your guaranteed starter mount.";
  banner.classList.remove("hidden", "leaving");
  const hide = () => {
    if (banner.classList.contains("hidden")) return;
    banner.classList.add("leaving");
    setTimeout(() => banner.classList.add("hidden"), 340);
  };
  document.getElementById("arrival-dismiss")?.addEventListener("click", hide, { once: true });
  clearTimeout(banner._hideTimer);
  banner._hideTimer = setTimeout(hide, isReturning ? 4200 : 8500);
}

function savePayload(g) {
  const p = g.player;
  return {
    name: look.name,
    look: normalizeLook(look),
    stats: { level: p.level, xp: p.xp, gold: p.gold, hp: p.hp, cls: p.cls },
    inv: p.inv,
    fishing: g.fishingStats,
    quests: g.quests?.serialize?.(),
    afkFishing: g.afkFishingJob || null,
    flags: g.flags,
    equipped: p.equipped,
    pets: Array.isArray(g.pets) ? [...g.pets] : [],
    activePetId: g.activePetId || g.pet?.id || null,
    mountId: g.mountId || null,
    mounted: !!g.mounted,
    activeFoodBuffs: Array.isArray(g.activeFoodBuffs) ? g.activeFoodBuffs : [],
    ts: Date.now(),
  };
}

function wireMultiplayer(g, ui) {
  ui.setChatSender(sendChat);
  ui.setDuelSender(sendDuel);
  ui.setDuelSupported(false);
  ui.setOnlineState(false, 1);

  net.onWelcome = (message) => {
    ui.setDuelSupported((Number(message.protocol) || 1) >= 2);
    if (!Number.isFinite(message.x) || !Number.isFinite(message.y)) return;
    const drift = Math.hypot(g.player.x - message.x, g.player.y - message.y);
    if (drift > 32) {
      g.player.x = message.x; g.player.y = message.y; g.player.vx = 0; g.player.vy = 0;
      g.moveTarget = null;
      if (!message.resumed) ui.toast("Realm session restored at Hearth Camp");
    }
  };
  net.onChat = (message) => {
    ui.receiveChat(message, message.id === net.selfId);
    const text = String(message.text || "").slice(0, 96);
    if (message.id === net.selfId) {
      g.player.chatText = text;
      g.player.chatBorn = g.t;
      g.player.chatUntil = g.t + 5.5;
    } else {
      const remote = net.remote[message.id];
      if (remote) {
        remote.chatText = text;
        remote.chatBorn = g.t;
        remote.chatUntil = g.t + 5.5;
      }
    }
  };
  net.onDuel = (message) => {
    if (message.id === net.selfId) {
      ui.updateDuel(message.active);
      ui.receiveSystemChat(message.active ? "Duel Mode armed. Only other armed travelers can damage you." : "Safe Mode restored. Player damage disabled.");
    } else {
      const traveler = net.remote[message.id];
      if (traveler && Math.hypot(traveler.x - g.player.x, traveler.y - g.player.y) < 420) {
        ui.receiveSystemChat(`${traveler.name || "A traveler"} ${message.active ? "armed Duel Mode" : "returned to Safe Mode"}.`);
      }
    }
  };
  net.onPvpHit = (message) => {
    if (message.target === net.selfId) {
      g.damagePlayerPvp(message.damage);
      g.spawnHit(g.player.x, g.player.y - 22);
      g.fx.push({ kind: "slashbig", x: g.player.x, y: g.player.y - 6, dir: g.player.dir, t: 0, dur: .25 });
      const now = performance.now();
      if (!g._lastDuelToast || now - g._lastDuelToast > 1100) { ui.toast(`${message.sourceName || "Traveler"} struck you · ${message.damage}`); g._lastDuelToast = now; }
    } else if (message.source === net.selfId) {
      const target = net.remote[message.target];
      if (target) {
        g.spawnHit(target.rx, target.ry - 22);
        g.addFloater(target.rx, target.ry - 36, message.damage, message.kind === "skill");
      }
    }
  };
  net.onPvpReject = (message) => {
    if (message.reason === "rate_limited") return;
    const reasons = { mutual_duel_required: "Both travelers must arm Duel Mode.", out_of_range: "Duel target moved out of range.", invalid_target: "Duel target is no longer in the realm.", invalid_damage: "That attack exceeded the realm's duel limit." };
    ui.toast(reasons[message.reason] || "The realm rejected that duel strike.");
  };
  net.onBossState = (boss) => g.applySharedBoss?.(boss);
  net.onBossHit = (message) => g.applySharedBossHit?.(message);
  net.onBossAttack = (message) => g.applySharedBossAttack?.(message);
  net.onBossDefeated = (message) => g.applySharedBossDefeat?.(message);
  net.onBossReward = (message) => g.applySharedBossReward?.(message);
  net.onBossReject = (message) => {
    if (message.reason === "rate_limited") return;
    const reasons = { out_of_range: "Enter the Infernyx arena before attacking.", inactive: "Infernyx is sealed. The next awakening is being prepared.", stale_boss: "That boss echo has already faded." };
    ui.toast(reasons[message.reason] || "Boss strike rejected by the realm.");
  };

  let wasConnected = false;
  g._presenceTimer = setInterval(() => {
    const connected = !!net.connected;
    ui.setOnlineState(connected, connected ? remoteCount() + 1 : 1);
    if (connected && ui.duelActive !== net.duelActive) ui.updateDuel(net.duelActive);
    if (connected && !wasConnected) {
      ui.receiveSystemChat("Connected to the shared Forest Realm.");
      ui.toast("Realm linked · multiplayer online");
      requestBossState();
    } else if (!connected && wasConnected) {
      if (g.boss?.shared) { g.boss = null; g.ui.syncBoss?.(null); }
      ui.receiveSystemChat("Realm connection lost. Adventure continues in local mode.");
      ui.toast("Realm link lost · continuing locally");
    }
    wasConnected = connected;
  }, 750);
}

function startGame(savedLook, savedName, saveData) {
  // Apply saved look if provided (continue scenario)
  if (savedLook) look = normalizeLook({ ...look, ...savedLook });
  else look = normalizeLook(look);
  if (!savedLook?.cls && CLASSES[saveData?.stats?.cls]) look.cls = saveData.stats.cls;
  if (savedName) { look.name = savedName; }
  creator.classList.add("hidden");
  document.getElementById("game-wrap").classList.remove("hidden");
  audio.init(); audio.resume(); audio.startMusic("explore");
  const canvas = document.getElementById("game");
  computeView(canvas);   // size internal resolution to the device now
  try {
    const ui = new UI(audio);
    game = new Game(canvas, ui, look);
    ui.bind(game);
    // Apply saved game state if continuing
    if (saveData && saveData.stats) {
      const p = game.player;
      p.level = saveData.stats.level || 1;
      p.xp = saveData.stats.xp || 0;
      p.gold = saveData.stats.gold || 0;
      p.hp = saveData.stats.hp || p.maxHp;
      if (saveData.inv) { p.inv = { ...p.inv, ...saveData.inv }; }
      if (saveData.fishing) { game.fishingStats = { ...game.fishingStats, ...saveData.fishing }; }
      if (saveData.quests) game.quests.restore?.(saveData.quests);
      if (saveData.afkFishing) {
        const restoredAfk = normalizeAfkFishingJob(saveData.afkFishing);
        game.afkFishingJob = restoredAfk?.claimedAt ? null : restoredAfk;
      }
      if (Array.isArray(saveData.activeFoodBuffs)) {
        game.activeFoodBuffs = normalizeActiveBuffs(saveData.activeFoodBuffs, Date.now());
      }
      if (saveData.flags) {
        game.flags = { ...game.flags, ...saveData.flags };
        if (game.flags.starterCache) { const cache = game.chests.find((chest) => chest.starter); if (cache) cache.opened = true; }
      }
      if (saveData.equipped) { p.equipped = saveData.equipped; }
      game.ui.toast(`Welcome back, ${look.name}!`);
    }
    if (saveData) {
      const roster = Array.isArray(saveData.pets) ? saveData.pets : [];
      for (const id of roster) game.registerPet(id);
      // Save migration: old starter caches predated Puffalo. Grant the bond
      // once without replaying materials or replacing an existing active pet.
      if (game.flags.starterCache && !game.pets.includes(STARTER_MOUNT_ID)) game.registerPet(STARTER_MOUNT_ID);
      const activePet = saveData.activePetId || (typeof saveData.pet === "string" ? saveData.pet : null);
      if (activePet && !game.pets.includes(activePet)) game.registerPet(activePet);
      const selectedPet = game.pets.includes(activePet) ? activePet : game.pets[0] || null;
      if (selectedPet) game.setActivePet(selectedPet);
      if (saveData.mountId && game.pets.includes(saveData.mountId)) {
        game.mountId = saveData.mountId;
        if (saveData.mounted) game.setMount(saveData.mountId, true);
      }
      game.ui.syncPet?.();
      game.ui.syncFoodBuffs?.(true);
    }
    const persist = () => { if (game?.player) putSave(savePayload(game)); };
    game.onCompanionChange = persist;
    game.onProgressChange = persist;
    const nm = document.getElementById("hud-name"); if (nm) nm.textContent = look.name;
    window.__ANASTA__ = game;
    wireSettings();
    wireMultiplayer(game, ui);
    // recompute internal resolution on rotate/resize so it stays fullscreen
    addEventListener("resize", () => computeView(canvas));
    game.start();
    showArrivalGuide(!!saveData);
    if (afkFishingStatus(game.afkFishingJob).state === "ready") {
      setTimeout(() => ui.toast("AFK Fishing catch ready · open the Dock to claim"), 700);
    }
    // Auto-save every 15s
    setInterval(persist, 15000);
    // Save on page hide / unload
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) persist();
    });
    addEventListener("pagehide", persist);
    // Multiplayer presence (no-op unless enabled in config.js). Fire-and-forget.
    connectMultiplayer(look, look.name, { x: game.player.x, y: game.player.y })
      .then((room) => {
        if (!room) game.ui.setOnlineState(false, 1);
      })
      .catch(() => {});
  } catch (e) { console.error(e); alert("Start failed: " + e.message); }
}

// ── LOGIN SYSTEM ──────────────────────────────────────────────
const loginScreen = document.getElementById("login");
const loginName = document.getElementById("login-name");
const loginExisting = document.getElementById("login-existing");
const loginReturnName = document.getElementById("login-return-name");
const loginReturnStats = document.getElementById("login-return-stats");
const btnContinue = document.getElementById("btn-continue");
const btnNewGame = document.getElementById("btn-newgame");
const SAVE_KEY = "anasta_save";

function getSave() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { return null; } }
function putSave(data) { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); }

function startLoginFx() {
  const c = document.getElementById("login-fx");
  if (!c) return;
  const ctx = c.getContext("2d");
  const resize = () => { c.width = window.innerWidth; c.height = window.innerHeight; };
  resize();
  if (!loginScreen._resizeBound) {
    loginScreen._resizeBound = true;
    addEventListener("resize", () => { if (!loginScreen.classList.contains("hidden")) resize(); });
  }
  const ps = [];
  for (let i = 0; i < 40; i++) ps.push({ x: Math.random() * c.width, y: Math.random() * c.height, vy: -0.3 - Math.random() * 0.5, r: 1 + Math.random() * 2, ph: Math.random() * 7, hue: 250 + Math.random() * 60 });
  let raf;
  (function loop() {
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.globalCompositeOperation = "lighter";
    for (const p of ps) {
      p.y += p.vy; p.ph += 0.02;
      if (p.y < -10) { p.y = c.height + 10; p.x = Math.random() * c.width; }
      const a = 0.3 + 0.7 * Math.sin(p.ph);
      ctx.fillStyle = `hsla(${p.hue},70%,65%,${a * 0.3})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 3, 0, 7); ctx.fill();
      ctx.fillStyle = `hsla(${p.hue},80%,75%,${a})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
    raf = requestAnimationFrame(loop);
    loginScreen._raf = raf;
  })();
}

function showLogin() {
  boot.classList.add("hidden");
  loginScreen.classList.remove("hidden");
  startLoginFx();
  const save = getSave();
  if (save && save.name) {
    loginExisting.classList.remove("hidden");
    loginReturnName.textContent = save.name;
    const stats = save.stats || {};
    loginReturnStats.textContent = `Lv ${stats.level || 1} · ${stats.cls || "warrior"} · ${stats.gold || 0} gold`;
    loginName.value = save.name;
  } else {
    loginExisting.classList.add("hidden");
  }
  if (matchMedia("(pointer:fine)").matches) loginName.focus();
}

function enterGameWithSave(save) {
  if (loginScreen._raf) cancelAnimationFrame(loginScreen._raf);
  loginScreen.classList.add("hidden");
  // Use saved look + skip creator
  startGame(save.look, save.name, save);
}

function enterNewGame(name) {
  if (loginScreen._raf) cancelAnimationFrame(loginScreen._raf);
  loginScreen.classList.add("hidden");
  creator.classList.remove("hidden");
  initCreator();
  if (name) {
    document.getElementById("opt-name").value = name;
    look.name = name;
  }
}

btnContinue.addEventListener("click", () => {
  const save = getSave();
  if (save) enterGameWithSave(save);
});

btnNewGame.addEventListener("click", () => {
  const name = loginName.value.trim() || "Traveler";
  enterNewGame(name);
});

loginName.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const name = loginName.value.trim();
    const save = getSave();
    if (save && save.name === name) enterGameWithSave(save);
    else enterNewGame(name || "Traveler");
  }
});

document.querySelectorAll(".quick-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const name = btn.dataset.name;
    loginName.value = name;
    const save = getSave();
    if (save && save.name === name) enterGameWithSave(save);
    else enterNewGame(name);
  });
});

startBtn.addEventListener("click", () => {
  audio.init(); audio.resume(); audio.startMusic("title");
  if (bootRAF) { cancelAnimationFrame(bootRAF); bootRAF = null; }
  showLogin();
});

preload();
