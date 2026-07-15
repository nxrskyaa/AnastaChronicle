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
import { SERVER_OPTIONS, getSelectedServerId, setSelectedServerId } from "./config.js";
import {
  connectRitualWallet, walletShortAddress, walletState,
  getWalletSave, putWalletSave, clearWalletSave, contractConfigured,
  readOnchainProfile, registerOnchainProfile, deleteOnchainProfile,
  recordOnchainLevel, hashSave, walletErrorMessage,
  readV3Save, saveProgressOnchain, v3Configured,
  readOwnedWeapons, readLastPull, pullGachaFree, pullGachaGold, pullGachaRitual,
} from "./wallet.js";
import { COSMETIC_BY_ID, cosmeticForRelic, drawGuestGacha, GACHA_BY_ITEM_ID, isGachaCosmetic } from "./gacha.js";

const boot = document.getElementById("boot");
const bootStatus = document.getElementById("boot-status");
const loadingBar = document.getElementById("loading-bar-fill");
const startBtn = document.getElementById("btn-start");
const creator = document.getElementById("creator");
let look = { ...DEFAULT_LOOK };
let game = null;
let walletContractProfile = null;
let walletProfileReadError = false;
let walletChainSave = null;
let walletOwnedWeapons = [];
let onchainPolicy = (() => { try { return localStorage.getItem("anasta_level_policy") === "every" ? "every" : "milestone"; } catch { return "milestone"; } })();

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
let creatorMode = "new";
let wardrobeOriginalLook = null;

function invalidatePreview() { previewLookKey = ""; }

function updateCreatorSummary() {
  const cls = CLASSES[look.cls] || CLASSES.warrior;
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  document.querySelectorAll("#pick-class [data-cls]").forEach((button) => {
    const meta = CLASSES[button.dataset.cls];
    if (!meta) return;
    const crest = button.querySelector("i"), name = button.querySelector("b"), path = button.querySelector("small");
    if (crest) crest.textContent = meta.crest;
    if (name) name.textContent = meta.name;
    if (path) path.textContent = meta.path;
    button.style.setProperty("--class-accent", meta.color);
  });
  set("preview-class-kicker", `${cls.path || cls.name.toUpperCase()} PATH`);
  set("preview-class-name", cls.name);
  set("preview-class-desc", cls.blurb);
  const traits = document.getElementById("preview-traits");
  if (traits) traits.innerHTML = (cls.traits || []).map(v => `<span>${v}</span>`).join("");
  const kit = document.getElementById("creator-class-kit");
  if (kit) {
    kit.style.setProperty("--selected-class", cls.color);
    kit.innerHTML = cls.skills.map((skill, index) => `<article><i>${index + 1}</i><div><b>${skill.name}</b><span>${skill.desc}</span></div></article>`).join("");
  }
  document.querySelector(".preview-summary")?.style.setProperty("--preview-accent", look.accent || cls.color);
  document.getElementById("pick-class")?.style.setProperty("--selected-class", cls.color);
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
  const allValues = part === "style" ? HAIRSTYLES : part === "mark" ? FACE_MARKS : part === "accessory" ? ACCESSORIES : part === "outfit" ? OUTFITS : part === "aura" ? AURAS : PRESETS[part];
  const vals = creatorMode === "new" ? allValues.filter((value) => !isGachaCosmetic(value)) : allValues;
  const textPart = ["style", "mark", "accessory", "outfit", "aura"].includes(part);
  for (const v of vals) {
    const relic = COSMETIC_BY_ID[v];
    const locked = creatorMode === "wardrobe" && !!relic && !game?.cosmeticsOwned?.includes(v);
    const b = document.createElement("button");
    b.className = "swatch" + (look[part] === v ? " sel" : "") + (locked ? " locked" : "") + (relic ? ` relic-swatch ${relic.rarity}` : "");
    b.type = "button";
    b.title = locked ? `${relic.name} · locked in Relic Constellation` : `${part}: ${relic?.name || v}`;
    b.setAttribute("aria-label", locked ? `${relic.name}, locked` : `${part} ${relic?.name || v}`);
    b.setAttribute("aria-pressed", look[part] === v ? "true" : "false");
    b.disabled = locked;
    if (textPart) { b.textContent = locked ? `LOCKED · ${relic.name}` : relic?.name || v; b.classList.add("txt"); }
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
  const wardrobe = creatorMode === "wardrobe";
  document.getElementById("creator-step-label").textContent = wardrobe ? "TRAVELER WARDROBE / LIVE" : "CHRONICLE GENESIS / 02";
  document.getElementById("creator-title").textContent = wardrobe ? "RESTYLE YOUR TRAVELER" : "CREATE YOUR TRAVELER";
  document.getElementById("creator-subtitle").textContent = wardrobe ? "Equip unlocked hair, outfits, accessories, and aura without leaving the realm." : "Choose a path, shape your look, then begin the chronicle.";
  document.getElementById("btn-enter").innerHTML = wardrobe ? "SAVE APPEARANCE <b>&rsaquo;</b>" : "BEGIN CHRONICLE <b>&rsaquo;</b>";
  document.getElementById("btn-creator-close")?.classList.toggle("hidden", !wardrobe);
  document.querySelector('[data-creator-tab="identity"]')?.classList.toggle("hidden", wardrobe);
  if (wardrobe) {
    document.querySelectorAll("[data-creator-tab]").forEach((tab) => tab.classList.toggle("active", tab.dataset.creatorTab === "appearance"));
    document.querySelectorAll("[data-creator-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.creatorPanel === "appearance"));
  }
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
  document.getElementById("btn-enter").addEventListener("click", () => {
    if (creatorMode !== "wardrobe") return startGame();
    look = normalizeLook(look);
    game.rebuildCharacter(look);
    game.player.cls = look.cls;
    game.onProgressChange?.();
    creator.classList.add("hidden");
    creatorMode = "new";
    wardrobeOriginalLook = null;
    game.paused = false; game.inputLocked = false; game.suspendInput(220);
    game.ui.toast("Appearance saved · your new look is active");
  });
  drawPreview();
  startPreviewLoop();
}

function closeWardrobe() {
  if (creatorMode !== "wardrobe") return;
  look = normalizeLook(wardrobeOriginalLook || game?.look || look);
  creator.classList.add("hidden");
  creatorMode = "new";
  wardrobeOriginalLook = null;
  if (game) { game.paused = false; game.inputLocked = false; game.suspendInput(220); }
}

function openWardrobe() {
  if (!game?.player) return;
  game.ui.closeAll();
  game.paused = true; game.inputLocked = true; game.resetInputState();
  wardrobeOriginalLook = normalizeLook(game.look);
  look = normalizeLook(game.look);
  creatorMode = "wardrobe";
  invalidatePreview();
  creator.classList.remove("hidden");
  initCreator();
  const progress = document.getElementById("menu-style-progress");
  if (progress) progress.textContent = `${game.cosmeticsOwned.length} Style Echo${game.cosmeticsOwned.length === 1 ? "" : "es"} unlocked`;
}

document.getElementById("btn-open-wardrobe")?.addEventListener("click", openWardrobe);
document.getElementById("btn-creator-close")?.addEventListener("click", closeWardrobe);

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
    const on = (e) => { e.preventDefault(); if (!game || performance.now() < (game.inputSuspendUntil || 0)) return; const map = { up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD" }; game.keys[map[dir]] = true; };
    const off = (e) => { e.preventDefault(); if (!game) return; const map = { up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD" }; game.keys[map[dir]] = false; };
    b.addEventListener("touchstart", on, { passive: false }); b.addEventListener("touchend", off, { passive: false }); b.addEventListener("touchcancel", off, { passive: false });
    b.addEventListener("mousedown", on); b.addEventListener("mouseup", off); b.addEventListener("mouseleave", off);
  });
  const passportButton = document.getElementById("realm-connect-button");
  const syncPassport = () => {
    const address = document.getElementById("realm-wallet-address");
    const network = document.getElementById("realm-network-name");
    const state = document.getElementById("realm-sync-state");
    if (address) address.textContent = walletState.address ? walletShortAddress(walletState.address) : "Not linked";
    if (network) network.textContent = walletState.connected ? "Ritual Testnet" : "Not linked";
    if (state) state.innerHTML = `<i aria-hidden="true"></i> ${walletState.connected ? (walletContractProfile?.active ? "Ritual profile active" : "Profile not registered") : "Local only"}`;
    if (passportButton) { passportButton.disabled = false; passportButton.removeAttribute("aria-disabled"); passportButton.textContent = walletState.connected ? "Ritual wallet linked" : "Connect Ritual wallet"; }
  };
  syncPassport();
  passportButton?.addEventListener("click", async () => {
    try { await connectRitualWallet(); await syncWalletContractProfile(); syncPassport(); game?.ui?.toast("Ritual wallet linked · profile contract active"); }
    catch (error) { game?.ui?.toast(error?.message || "Wallet connection cancelled."); }
  });
}

function showArrivalGuide(isReturning) {
  const banner = document.getElementById("arrival-banner");
  if (!banner) return;
  const title = document.getElementById("arrival-title");
  const kicker = document.getElementById("arrival-kicker");
  const guide = document.getElementById("arrival-guide-text");
  if (title) title.textContent = isReturning ? `WELCOME BACK, ${look.name}` : `WELCOME, ${look.name}`;
  if (kicker) kicker.textContent = isReturning ? "CHRONICLE RESUMED" : "NEW TRAVELER";
  if (guide) guide.textContent = isReturning && game?.flags?.starterCache
    ? "Open Sanctuary to switch bonds, then press M to ride your active mount."
    : "Find the golden cache south of camp. Press F to open it and bond Puffalo.";
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
    version: 3,
    name: look.name,
    look: normalizeLook(look),
    stats: { level: p.level, xp: p.xp, gold: p.gold, hp: p.hp, cls: p.cls },
    position: { x: Number(p.x) || 0, y: Number(p.y) || 0, dir: p.dir || "down" },
    onchainPolicy,
    inv: p.inv,
    fishing: g.fishingStats,
    quests: g.quests?.serialize?.(),
    afkFishing: g.afkFishingJob || null,
    flags: g.flags,
    cosmeticsOwned: Array.isArray(g.cosmeticsOwned) ? [...g.cosmeticsOwned] : [],
    equipped: p.equipped,
    pets: Array.isArray(g.pets) ? [...g.pets] : [],
    activePetId: g.activePetId || g.pet?.id || null,
    mountId: g.mountId || null,
    mounted: !!g.mounted,
    activeFoodBuffs: Array.isArray(g.activeFoodBuffs) ? g.activeFoodBuffs : [],
    ts: Date.now(),
  };
}

function safeRestorePosition(g, x, y) {
  const fallback = { x: g.player.x, y: g.player.y };
  const valid = (px, py) => {
    if (!Number.isFinite(px) || !Number.isFinite(py)) return false;
    if (px < 12 || py < 12 || px > 110 * 24 - 12 || py > 110 * 24 - 12) return false;
    if (g.isSolidAt?.(px, py, 7) ?? g.tileAt?.(px, py) === 2) return false;
    if (g.bossArena && Math.hypot(px - g.bossArena.x, py - g.bossArena.y) < g.bossArena.radius + 20) return false;
    return true;
  };
  if (valid(x, y)) return { x, y };
  for (const radius of [24, 48, 72, 96, 128]) {
    for (let i = 0; i < 16; i++) {
      const angle = i / 16 * Math.PI * 2;
      const candidate = { x: x + Math.cos(angle) * radius, y: y + Math.sin(angle) * radius };
      if (valid(candidate.x, candidate.y)) return candidate;
    }
  }
  return fallback;
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
  if (!CLASSES[look.cls]) look.cls = "warrior";
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
    // Panels live outside the canvas and survive login/continue transitions.
    // Always enter a fresh world with chat (and other transient panels) closed.
    ui.closeAll();
    // Apply saved game state if continuing
    if (saveData && saveData.stats) {
      const p = game.player;
      p.level = Math.max(1, Math.floor(Number(saveData.stats.level) || 1));
      p.xp = saveData.stats.xp || 0;
      p.gold = saveData.stats.gold || 0;
      const classStats = (CLASSES[p.cls] || CLASSES.warrior).stats;
      p.maxHp = classStats.maxHp + (p.level - 1) * 12;
      p.maxStamina = classStats.maxStamina + (p.level - 1) * 8;
      p.hp = Math.max(1, Math.min(p.maxHp, Number(saveData.stats.hp) || p.maxHp));
      p.stamina = p.maxStamina;
      if (saveData.onchainPolicy) onchainPolicy = saveData.onchainPolicy === "every" ? "every" : "milestone";
      const savedPosition = saveData.position;
      if (savedPosition) {
        const restored = safeRestorePosition(game, Number(savedPosition.x), Number(savedPosition.y));
        p.x = restored.x; p.y = restored.y; p.dir = savedPosition.dir || p.dir;
        p.vx = 0; p.vy = 0; p.moving = false; game.resetInputState();
      }
      if (saveData.inv) { p.inv = { ...p.inv, ...saveData.inv }; }
      if (saveData.fishing) { game.fishingStats = { ...game.fishingStats, ...saveData.fishing }; }
      if (saveData.quests) game.quests.restore?.(saveData.quests);
      if (Array.isArray(saveData.activeFoodBuffs)) {
        game.activeFoodBuffs = normalizeActiveBuffs(saveData.activeFoodBuffs, Date.now());
      }
      if (saveData.flags) {
        game.flags = { ...game.flags, ...saveData.flags };
        if (game.flags.starterCache) { const cache = game.chests.find((chest) => chest.starter); if (cache) cache.opened = true; }
      }
      if (Array.isArray(saveData.cosmeticsOwned)) game.cosmeticsOwned = [...new Set(saveData.cosmeticsOwned.filter((id) => COSMETIC_BY_ID[id]))];
      for (const slot of [look.style, look.outfit, look.accessory]) if (COSMETIC_BY_ID[slot] && !game.cosmeticsOwned.includes(slot)) game.cosmeticsOwned.push(slot);
      if (saveData.equipped) { p.equipped = saveData.equipped; }
      game.ui.toast(`Welcome back, ${look.name}!`);
    }
    if (saveData?.recovery) {
      game.ui.toast("Wallet level recovered · local inventory starts fresh");
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
    const persist = () => {
      if (!game?.player) return;
      const payload = savePayload(game);
      if (saveMode === "wallet" && walletState.address) putWalletSave(payload, walletState.address);
      else putSave(payload);
      ui.markSaved?.(payload.ts);
      return payload.ts;
    };
    const grantGachaRewards = (weapons) => {
      const rewards = [];
      for (const weapon of weapons) {
        game.player.inv[weapon.id] = (game.player.inv[weapon.id] || 0) + 1;
        rewards.push(weapon);
        const sequence = Math.max(0, Number(game.flags.gachaSequence) || 0);
        const cosmetic = cosmeticForRelic(weapon.itemId, sequence);
        game.flags.gachaSequence = sequence + 1;
        if (cosmetic) {
          const duplicate = game.cosmeticsOwned.includes(cosmetic.id);
          if (!duplicate) game.cosmeticsOwned.push(cosmetic.id);
          rewards.push({ ...cosmetic, duplicate });
        }
      }
      return rewards;
    };
    game.requestSave = async () => {
      const savedAt = persist();
      if (saveMode !== "wallet") return { local: true, savedAt };
      if (!walletState.connected) throw new Error("Reconnect the Ritual wallet before creating an onchain checkpoint.");
      if (!v3Configured) throw new Error("Deploy and configure Anasta V3 before using recoverable wallet saves.");
      if (!(await ensureOnchainProfile(game, ui))) throw new Error("Ritual profile is not ready.");
      const payload = savePayload(game);
      const transaction = await saveProgressOnchain(payload);
      walletChainSave = payload;
      walletContractProfile = { ...(walletContractProfile || {}), active: true, level: payload.stats.level, lastSaveHash: hashSave(payload) };
      return { local: true, onchain: true, savedAt, hash: transaction.hash };
    };
    game.requestGacha = async (kind, count) => {
      const pulls = count === 10 ? 10 : 1;
      if (!walletState.connected) {
        if (kind === "ritual") throw new Error("Connect a Ritual wallet to use RITUAL offerings.");
        if (kind === "free") {
          const remaining = Math.max(0, Number(game.flags.guestGachaFreePulls) || 0);
          if (remaining < pulls) throw new Error(`Only ${remaining} guest free pull${remaining === 1 ? " remains" : "s remain"}.`);
          game.flags.guestGachaFreePulls = remaining - pulls;
        } else {
          const price = pulls * 500;
          if (game.player.gold < price) throw new Error(`Need ${price.toLocaleString()} gold for this summon.`);
          game.player.gold -= price;
        }
        const weapons = drawGuestGacha(pulls).filter(Boolean);
        const rewards = grantGachaRewards(weapons);
        persist();
        game.ui.sync?.();
        return rewards;
      }
      if (!v3Configured) throw new Error("Anasta V3 contract is not configured.");
      if (!(await ensureOnchainProfile(game, ui))) throw new Error("Ritual profile is not ready.");
      if (kind === "gold") {
        const price = pulls * 500;
        if (game.player.gold < price) throw new Error(`Need ${price.toLocaleString()} gold for this summon.`);
        await pullGachaGold(pulls, savePayload(game));
        game.player.gold -= price;
      } else if (kind === "ritual") await pullGachaRitual(pulls);
      else await pullGachaFree(pulls);
      const itemIds = await readLastPull(walletState.address);
      const weapons = itemIds.map((itemId) => GACHA_BY_ITEM_ID[itemId]).filter(Boolean);
      if (weapons.length !== pulls) throw new Error("Ritual confirmed the pull but the relic result could not be decoded. Sync again.");
      const rewards = grantGachaRewards(weapons);
      persist();
      game.ui.sync?.();
      return rewards;
    };
    game.requestWalletConnect = async () => {
      await connectRitualWallet();
      await syncWalletContractProfile();
      return walletState.address;
    };
    ui.markSaved?.(saveData?.ts || Date.now());
    game.onCompanionChange = persist;
    game.onProgressChange = persist;
    game.onLevelUp = (level) => queueLevelProof(game, ui, level);
    const nm = document.getElementById("hud-name"); if (nm) nm.textContent = look.name;
    window.__ANASTA__ = game;
    wireSettings();
    wireMultiplayer(game, ui);
    // recompute internal resolution on rotate/resize so it stays fullscreen
    addEventListener("resize", () => computeView(canvas));
    game.start();
    if (saveMode === "wallet" && walletState.connected && contractConfigured) {
      setTimeout(() => ensureOnchainProfile(game, ui), 450);
    }
    showArrivalGuide(!!saveData);
    if (!saveData && !game.flags.starterGuideSeen) {
      setTimeout(() => {
        if (window.__ANASTA__ === game && !game.flags.starterGuideSeen) ui.openStarterGuide?.(0);
      }, 520);
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
    return true;
  } catch (e) {
    console.error("Chronicle start failed", e);
    // A partially-created Game used to keep its RAF alive after a failed
    // resume. That left the menu hidden while an orphan loop kept touching
    // the old canvas. Stop it and clear the global reference before showing
    // the recovery state.
    game?.stop?.();
    game = null;
    window.__ANASTA__ = null;
    creator.classList.add("hidden");
    document.getElementById("game-wrap")?.classList.add("hidden");
    if (!saveData) showLogin();
    return false;
  }
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
const SAVE_BACKUP_KEY = "anasta_save_backup";
let saveMode = "guest";

function normalizeSaveData(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const safe = { ...raw };
  safe.version = Math.max(3, Number(raw.version) || 1);
  safe.name = String(raw.name || raw.look?.name || "Traveler").slice(0, 14) || "Traveler";
  safe.look = normalizeLook({ ...(raw.look && typeof raw.look === "object" ? raw.look : {}), name: safe.name });
  const stats = raw.stats && typeof raw.stats === "object" ? raw.stats : {};
  safe.stats = {
    level: Math.max(1, Math.min(999, Math.floor(Number(stats.level) || 1))),
    xp: Math.max(0, Number(stats.xp) || 0), gold: Math.max(0, Number(stats.gold) || 0),
    hp: Math.max(1, Number(stats.hp) || 999), cls: CLASSES[stats.cls] ? stats.cls : safe.look.cls,
  };
  const position = raw.position && typeof raw.position === "object" ? raw.position : {};
  safe.position = { x: Number(position.x), y: Number(position.y), dir: ["up", "down", "left", "right"].includes(position.dir) ? position.dir : "down" };
  safe.inv = raw.inv && typeof raw.inv === "object" && !Array.isArray(raw.inv)
    ? Object.fromEntries(Object.entries(raw.inv).slice(0, 256).map(([id, count]) => [id, Math.max(0, Math.floor(Number(count) || 0))])) : {};
  safe.pets = Array.isArray(raw.pets) ? [...new Set(raw.pets.filter((id) => typeof id === "string").slice(0, 64))] : [];
  safe.cosmeticsOwned = Array.isArray(raw.cosmeticsOwned) ? [...new Set(raw.cosmeticsOwned.filter((id) => COSMETIC_BY_ID[id]))] : [];
  const flags = raw.flags && typeof raw.flags === "object" ? raw.flags : {};
  safe.flags = {
    starterCache: !!flags.starterCache,
    starterGuideSeen: !!flags.starterGuideSeen,
    guestGachaFreePulls: Object.prototype.hasOwnProperty.call(flags, "guestGachaFreePulls") ? Math.max(0, Math.min(5, Math.floor(Number(flags.guestGachaFreePulls) || 0))) : 5,
    gachaSequence: Math.max(0, Math.floor(Number(flags.gachaSequence) || 0)),
  };
  safe.activeFoodBuffs = Array.isArray(raw.activeFoodBuffs) ? raw.activeFoodBuffs.slice(0, 24) : [];
  return safe;
}

function parseStoredSave(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? normalizeSaveData(JSON.parse(raw)) : null;
  } catch { return null; }
}

function getSave() {
  // Prefer the newest checkpoint, then recover from the last known-good copy.
  // This keeps a malformed write (or an interrupted mobile storage write)
  // from turning Continue into a dead button.
  return parseStoredSave(SAVE_KEY) || parseStoredSave(SAVE_BACKUP_KEY);
}

function putSave(data) {
  const safe = normalizeSaveData(data);
  if (!safe) return false;
  try {
    const next = JSON.stringify(safe);
    const previous = parseStoredSave(SAVE_KEY);
    if (previous) {
      const previousJson = JSON.stringify(previous);
      if (previousJson !== next) localStorage.setItem(SAVE_BACKUP_KEY, previousJson);
    }
    localStorage.setItem(SAVE_KEY, next);
    return true;
  } catch (error) {
    console.warn("Guest checkpoint could not be written", error);
    return false;
  }
}

const mainMenuChoices = document.getElementById("main-menu-choices");
const guestAccess = document.getElementById("guest-access");
const walletAccess = document.getElementById("wallet-access");
const aboutPanel = document.getElementById("about-panel");
const serverPicker = document.querySelector(".server-picker");
const walletActions = document.getElementById("wallet-profile-actions");
const walletStatusTitle = document.getElementById("wallet-status-title");
const walletStatusText = document.getElementById("wallet-status-text");
const walletConnectNow = document.getElementById("btn-wallet-connect-now");
const walletContinue = document.getElementById("btn-wallet-continue");
const walletDelete = document.getElementById("btn-wallet-delete");
const walletSync = document.getElementById("btn-wallet-sync");

function syncLevelPolicyButtons() {
  document.querySelectorAll("[data-level-policy]").forEach((button) => {
    const active = button.dataset.levelPolicy === onchainPolicy;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  const note = document.getElementById("onchain-policy-note");
  if (note) note.textContent = onchainPolicy === "every"
    ? "A proof is prepared for each level-up (paid tx after contract setup)."
    : "Only selected milestone levels will submit a paid proof (recommended).";
}

function setOnchainPolicy(policy) {
  onchainPolicy = policy === "every" ? "every" : "milestone";
  try { localStorage.setItem("anasta_level_policy", onchainPolicy); } catch {}
  syncLevelPolicyButtons();
}

async function syncWalletContractProfile() {
  if (!contractConfigured || !walletState.connected) { walletContractProfile = null; return null; }
  walletProfileReadError = false;
  try {
    walletContractProfile = await readOnchainProfile(walletState.address);
    walletChainSave = v3Configured && walletContractProfile?.active ? await readV3Save(walletState.address) : null;
    walletOwnedWeapons = v3Configured && walletContractProfile?.active ? await readOwnedWeapons(walletState.address) : [];
    if (walletChainSave) {
      walletChainSave.inv ||= {};
      walletOwnedWeapons.forEach((count, index) => { const weapon = GACHA_BY_ITEM_ID[index + 1]; if (weapon && count > 0) walletChainSave.inv[weapon.id] = count; });
    }
    if (walletChainSave) putWalletSave(walletChainSave, walletState.address);
  }
  catch { walletContractProfile = null; walletProfileReadError = true; }
  return walletContractProfile;
}

async function ensureOnchainProfile(g, ui) {
  if (!contractConfigured || !walletState.connected) return false;
  if (g._onchainProfilePromise) return g._onchainProfilePromise;
  g._onchainProfilePromise = (async () => {
    const profile = walletContractProfile || await syncWalletContractProfile();
    if (walletProfileReadError) { ui.toast("Ritual profile read failed · check RPC and retry wallet sync"); return false; }
    if (profile?.active) { g._onchainProfileRegistered = true; return true; }
    ui.toast("Ritual profile transaction requested… confirm it in your wallet.");
    await registerOnchainProfile(look.name, look);
    walletContractProfile = await syncWalletContractProfile();
    g._onchainProfileRegistered = true;
    ui.toast("Ritual profile registered · level proofs enabled");
    return true;
  })().catch((error) => {
    ui.toast(walletErrorMessage(error, "Profile transaction could not be completed."));
    return false;
  }).finally(() => {
    if (!g._onchainProfileRegistered) g._onchainProfilePromise = null;
  });
  return g._onchainProfilePromise;
}

async function submitLevelProof(g, ui, level) {
  if (!contractConfigured || !walletState.connected || !Number.isFinite(level)) return;
  if (onchainPolicy === "milestone" && level % 5 !== 0) return;
  if (!(await ensureOnchainProfile(g, ui))) return;
  const current = walletContractProfile?.level || 1;
  if (current >= level) return;
  const payload = savePayload(g);
  ui.toast(`Level ${level} proof ready · confirm ${"0.00067 RITUAL"} tx`);
  try {
    if (v3Configured) await saveProgressOnchain(payload);
    else await recordOnchainLevel(level, payload);
    walletContractProfile = { ...(walletContractProfile || {}), level, active: true, lastSaveHash: hashSave(payload) };
    ui.toast(`Level ${level} recorded on Ritual`);
  } catch (error) {
    ui.toast(`Level proof skipped · ${walletErrorMessage(error, "transaction cancelled")}`);
  }
}

function queueLevelProof(g, ui, level) {
  g._levelProofQueue = (g._levelProofQueue || Promise.resolve()).then(() => submitLevelProof(g, ui, level));
}

function setLoginMode(mode) {
  document.querySelector("#login .login-card")?.setAttribute("data-login-mode", mode);
  mainMenuChoices?.classList.toggle("hidden", mode !== "menu");
  serverPicker?.classList.toggle("hidden", mode !== "menu");
  guestAccess?.classList.toggle("hidden", mode !== "guest");
  walletAccess?.classList.toggle("hidden", mode !== "wallet");
  aboutPanel?.classList.toggle("hidden", mode !== "about");
  if (mode === "guest" && matchMedia("(pointer:fine)").matches) setTimeout(() => loginName?.focus(), 30);
}

function renderServerPicker() {
  const wrap = document.getElementById("server-picker-list");
  if (!wrap) return;
  const selected = getSelectedServerId();
  wrap.innerHTML = "";
  for (const server of SERVER_OPTIONS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `server-option${server.id === selected ? " selected" : ""}`;
    button.dataset.serverId = server.id;
    button.setAttribute("aria-pressed", String(server.id === selected));
    button.innerHTML = `<span class="server-dot"></span><strong>${server.code}</strong><span class="server-option-copy"><b>${server.name}</b><small>RITUAL SHARD · ${server.capacity} CAP</small></span><em>${server.id === selected ? "SELECTED" : "JOIN"}</em>`;
    button.addEventListener("click", () => {
      setSelectedServerId(server.id);
      renderServerPicker();
    });
    wrap.appendChild(button);
  }
}

function refreshWalletPanel() {
  const save = walletState.address ? (walletChainSave || getWalletSave(walletState.address)) : null;
  const actionNote = document.getElementById("wallet-action-note");
  if (!walletState.connected) {
    if (walletStatusTitle) walletStatusTitle.textContent = "WALLET PASSPORT";
    if (walletStatusText) walletStatusText.textContent = "Connect an EVM wallet to reserve your Ritual identity.";
    walletActions?.classList.add("hidden");
    walletSync?.classList.add("hidden");
    if (walletConnectNow) { walletConnectNow.classList.remove("hidden"); walletConnectNow.disabled = false; walletConnectNow.innerHTML = "CONNECT RITUAL WALLET <span>›</span>"; }
    return;
  }
  if (walletStatusTitle) walletStatusTitle.textContent = walletShortAddress(walletState.address);
  if (walletStatusText) walletStatusText.textContent = walletProfileReadError
    ? "Ritual profile read failed · check RPC and retry wallet sync."
    : walletContractProfile?.active
    ? (save ? `Ritual checkpoint ready · Level ${walletContractProfile.level || save.stats?.level || 1}.` : `Legacy profile found · Level ${walletContractProfile.level || 1}; full recovery needs V3.`)
    : (save ? `Local chronicle found · Level ${save.stats?.level || 1}.` : "Ritual network linked · no profile yet.");
  walletActions?.classList.toggle("hidden", false);
  walletSync?.classList.remove("hidden");
  walletContinue?.classList.toggle("hidden", !save && !walletContractProfile?.active);
  if (walletContinue) walletContinue.innerHTML = save ? "CONTINUE CHECKPOINT <span>›</span>" : "RECOVER LEVEL <span>›</span>";
  walletDelete?.classList.toggle("hidden", !save && !walletContractProfile?.active);
  if (actionNote) actionNote.textContent = walletContractProfile?.active
    ? "Deleting this Ritual profile needs one wallet confirmation."
    : save ? "This clears the local save for the connected wallet." : "No profile is ready to delete.";
  const walletNew = document.getElementById("btn-wallet-new");
  walletNew?.classList.toggle("hidden", walletProfileReadError || !!walletContractProfile?.active);
  if (walletConnectNow) walletConnectNow.classList.add("hidden");
}

async function openWalletPanel() {
  setLoginMode("wallet");
  try {
    await connectRitualWallet();
    saveMode = "wallet";
    await syncWalletContractProfile();
    refreshWalletPanel();
  } catch (error) {
    if (walletStatusTitle) walletStatusTitle.textContent = "WALLET NOT CONNECTED";
    if (walletStatusText) walletStatusText.textContent = walletErrorMessage(error, "Wallet connection cancelled.");
    walletConnectNow?.classList.remove("hidden");
  }
}

function buildWalletRecoverySave() {
  const profile = walletContractProfile;
  if (!profile?.active || !walletState.address) return null;
  const level = Math.max(1, Math.floor(Number(profile.level) || 1));
  const name = String(profile.displayName || "Traveler").slice(0, 14) || "Traveler";
  const recoveryLook = normalizeLook({ ...DEFAULT_LOOK, name });
  return {
    version: 2,
    recovery: true,
    name,
    look: recoveryLook,
    stats: { level, xp: 0, gold: 0, hp: 999, cls: recoveryLook.cls },
    position: { x: 55 * 24, y: 55 * 24 + 46, dir: "down" },
    onchainPolicy,
    inv: Object.fromEntries(walletOwnedWeapons.map((count, index) => [GACHA_BY_ITEM_ID[index + 1]?.id, count]).filter(([id, count]) => id && count > 0)),
    fishing: { total: 0, best: 0, records: {} },
    quests: null,
    afkFishing: null,
    flags: { starterCache: false, starterGuideSeen: false, guestGachaFreePulls: 5, gachaSequence: 0 },
    cosmeticsOwned: [],
    equipped: "fist",
    pets: [], activePetId: null, mountId: null, mounted: false,
    activeFoodBuffs: [], ts: Date.now(), wallet: walletState.address,
  };
}

function startLoginFx() {
  const c = document.getElementById("login-fx");
  if (!c) return;
  // showLogin() can be reached repeatedly from the access panels. Never let
  // an old particle RAF survive into the next visit.
  if (loginScreen._raf) cancelAnimationFrame(loginScreen._raf);
  loginScreen._raf = null;
  const ctx = c.getContext("2d");
  const resize = () => { c.width = window.innerWidth; c.height = window.innerHeight; };
  resize();
  if (!loginScreen._resizeBound) {
    loginScreen._resizeBound = true;
    addEventListener("resize", () => { if (!loginScreen.classList.contains("hidden")) resize(); });
  }
  const ps = [];
  for (let i = 0; i < 40; i++) ps.push({ x: Math.random() * c.width, y: Math.random() * c.height, vy: -0.3 - Math.random() * 0.5, r: 1 + Math.random() * 2, ph: Math.random() * 7, hue: Math.random() < .6 ? 42 + Math.random() * 28 : 112 + Math.random() * 38 });
  let raf;
  (function loop() {
    if (loginScreen.classList.contains("hidden")) {
      loginScreen._raf = null;
      return;
    }
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
  saveMode = "guest";
  setLoginMode("menu");
  renderServerPicker();
  syncLevelPolicyButtons();
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
  document.getElementById("login-recovery-error")?.classList.add("hidden");
}

let resumeInFlight = false;
async function enterGameWithSave(rawSave) {
  if (resumeInFlight || game) return;
  const save = normalizeSaveData(rawSave);
  if (!save) return;
  resumeInFlight = true;
  // Rewrite migrated saves before booting the world. This also repairs saves
  // loaded from the backup slot so the next Continue is deterministic.
  putSave(save);
  if (loginScreen._raf) cancelAnimationFrame(loginScreen._raf);
  loginScreen._raf = null;
  loginScreen.classList.add("hidden");
  const resume = document.getElementById("resume-loading");
  const resumeText = document.getElementById("resume-loading-text");
  resume?.classList.remove("hidden");
  if (resumeText) resumeText.textContent = `Preparing ${save.name} · Level ${save.stats.level}`;
  // Give the browser one paint so the user sees a real loading state instead
  // of a frozen menu while procedural tiles/entities are constructed.
  await new Promise((resolve) => {
    let finished = false;
    const finish = () => { if (finished) return; finished = true; resolve(); };
    requestAnimationFrame(() => requestAnimationFrame(finish));
    // Background tabs may pause RAF entirely. Keep the loader finite there.
    setTimeout(finish, 180);
  });
  const started = startGame(save.look, save.name, save);
  resume?.classList.add("hidden");
  resumeInFlight = false;
  if (!started) {
    game = null;
    loginScreen.classList.remove("hidden");
    setLoginMode("guest");
    const message = "Save recovery failed · your checkpoint is safe; try again or create a new traveler";
    if (resumeText) resumeText.textContent = message;
    const recoveryError = document.getElementById("login-recovery-error");
    if (recoveryError) {
      recoveryError.textContent = message;
      recoveryError.classList.remove("hidden");
    }
  }
}

function enterNewGame(name) {
  if (loginScreen._raf) cancelAnimationFrame(loginScreen._raf);
  loginScreen._raf = null;
  loginScreen.classList.add("hidden");
  creator.classList.remove("hidden");
  initCreator();
  if (name) {
    document.getElementById("opt-name").value = name;
    look.name = name;
  }
}

btnContinue.addEventListener("click", () => {
  if (resumeInFlight) return;
  saveMode = "guest";
  const save = getSave();
  if (save) enterGameWithSave(save);
  else {
    const recoveryError = document.getElementById("login-recovery-error");
    if (recoveryError) {
      recoveryError.textContent = "No readable checkpoint found on this device. Create a new traveler or reconnect the wallet.";
      recoveryError.classList.remove("hidden");
    }
  }
});

btnNewGame.addEventListener("click", () => {
  saveMode = "guest";
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
    saveMode = "guest";
    const name = btn.dataset.name;
    loginName.value = name;
    const save = getSave();
    if (save && save.name === name) enterGameWithSave(save);
    else enterNewGame(name);
  });
});

document.getElementById("btn-guest-play")?.addEventListener("click", () => setLoginMode("guest"));
document.getElementById("btn-connect-wallet")?.addEventListener("click", openWalletPanel);
document.getElementById("btn-about")?.addEventListener("click", () => setLoginMode("about"));
loginScreen?.addEventListener("click", (event) => {
  const back = event.target.closest("[data-main-menu]");
  if (!back) return;
  event.preventDefault();
  setLoginMode("menu");
  renderServerPicker();
});
loginScreen?.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  const panelOpen = [guestAccess, walletAccess, aboutPanel].some((panel) => panel && !panel.classList.contains("hidden"));
  if (!panelOpen) return;
  event.preventDefault();
  setLoginMode("menu");
  renderServerPicker();
});
document.querySelectorAll("[data-level-policy]").forEach((button) => button.addEventListener("click", () => setOnchainPolicy(button.dataset.levelPolicy)));
walletConnectNow?.addEventListener("click", openWalletPanel);
walletSync?.addEventListener("click", async () => {
  if (!walletState.connected) return;
  walletSync.disabled = true;
  if (walletStatusText) walletStatusText.textContent = "Reading your Ritual profile…";
  await syncWalletContractProfile();
  refreshWalletPanel();
  walletSync.disabled = false;
});
document.getElementById("btn-wallet-continue")?.addEventListener("click", () => {
  const save = walletChainSave || getWalletSave(walletState.address);
  const recovered = save || buildWalletRecoverySave();
  if (!recovered) return refreshWalletPanel();
  saveMode = "wallet";
  enterGameWithSave(recovered);
});
document.getElementById("btn-wallet-new")?.addEventListener("click", () => {
  saveMode = "wallet";
  enterNewGame("Traveler");
});
document.getElementById("btn-wallet-delete")?.addEventListener("click", async () => {
  if (walletDelete) walletDelete.disabled = true;
  try {
    if (!walletState.connected || !walletState.address) throw new Error("Connect the Ritual wallet first.");
    // The panel can be open for minutes. Re-read immediately before sending so
    // an already-deleted profile never produces a confusing reverted tx.
    await syncWalletContractProfile();
    if (walletProfileReadError) {
      if (walletStatusText) walletStatusText.textContent = "Could not verify this profile on Ritual. Retry wallet sync first.";
      return;
    }
    if (walletContractProfile?.active) {
      walletStatusText && (walletStatusText.textContent = "Confirm profile deletion in your wallet…");
      await deleteOnchainProfile();
      walletContractProfile = null;
    }
    clearWalletSave(walletState.address);
    walletProfileReadError = false;
    refreshWalletPanel();
    if (walletStatusText) walletStatusText.textContent = "Profile cleared. Create a new traveler when ready.";
  } catch (error) {
    if (walletStatusText) walletStatusText.textContent = walletErrorMessage(error, "Profile deletion failed. Retry after syncing the wallet.");
  } finally { if (walletDelete) walletDelete.disabled = false; }
});

startBtn.addEventListener("click", () => {
  audio.init(); audio.resume(); audio.startMusic("title");
  if (bootRAF) { cancelAnimationFrame(bootRAF); bootRAF = null; }
  showLogin();
});

preload();
