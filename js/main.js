import { loadAll } from "./assets.js";
import { Game } from "./game.js";
import "./logic.js";
import "./interactions.js";
import "./render.js";
import { UI } from "./ui.js";
import { buildCharacter, PRESETS, HAIRSTYLES, DEFAULT_LOOK } from "./chargen.js";
import { audio } from "./audio.js";
import { computeView } from "./view.js";
import { connectMultiplayer, net } from "./net.js";

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
    // Simulated load steps for visual feedback (loading bar animation)
    const steps = ["Init engine", "Generating terrain", "Spawning creatures", "Tuning audio", "Ready"];
    for (let i = 0; i < steps.length; i++) {
      bootStatus.textContent = `Loading… ${steps[i]}`;
      if (loadingBar) loadingBar.style.width = `${((i + 1) / steps.length) * 100}%`;
      await loadAll((d, t) => { bootStatus.textContent = `Loading… ${d}/${t}`; });
      await new Promise(r => setTimeout(r, 200));
    }
    if (loadingBar) loadingBar.style.width = "100%";
    bootStatus.textContent = "Ready";
    startBtn.disabled = false;
  } catch (e) { bootStatus.textContent = "Load error: " + e.message; console.error(e); }
}

let rotDir = "down";
function drawPreview() {
  const cv = document.getElementById("char-preview");
  const ctx = cv.getContext("2d"); ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, cv.width, cv.height);
  const cache = buildCharacter(look);
  const f = Math.floor(Date.now() / 200) % 4;
  ctx.drawImage(cache.walk[rotDir][f], 0, 0, 32, 40, 16, 12, 96, 120);
}
function swatch(part) {
  const wrap = document.getElementById("sw-" + part); if (!wrap) return;
  wrap.innerHTML = "";
  const vals = part === "style" ? HAIRSTYLES : PRESETS[part];
  for (const v of vals) {
    const b = document.createElement("button");
    b.className = "swatch" + (look[part] === v ? " sel" : "");
    if (part === "style") { b.textContent = v.slice(0, 3); b.title = v; b.classList.add("txt"); }
    else b.style.background = v;
    b.addEventListener("click", () => { audio.sfx("ui"); look[part] = v; wrap.querySelectorAll(".swatch").forEach(s => s.classList.remove("sel")); b.classList.add("sel"); drawPreview(); });
    wrap.appendChild(b);
  }
}
function initCreator() {
  ["style", "hair", "eyes", "skin", "shirt", "pants", "boots"].forEach(swatch);
  document.getElementById("opt-name").addEventListener("input", (e) => { look.name = e.target.value || "Anasta"; });
  // gender picker
  document.querySelectorAll("#pick-gender .cls-btn").forEach(b => b.addEventListener("click", () => {
    audio.sfx("ui"); look.gender = b.dataset.gender;
    document.querySelectorAll("#pick-gender .cls-btn").forEach(x => x.classList.remove("sel")); b.classList.add("sel");
    drawPreview();
  }));
  // class picker
  document.querySelectorAll("#pick-class .cls-btn").forEach(b => b.addEventListener("click", () => {
    audio.sfx("ui"); look.cls = b.dataset.cls;
    document.querySelectorAll("#pick-class .cls-btn").forEach(x => x.classList.remove("sel")); b.classList.add("sel");
    drawPreview();
  }));
  document.querySelectorAll(".rot-btn").forEach(b => b.addEventListener("click", () => { audio.sfx("ui"); rotDir = b.dataset.rot; document.querySelectorAll(".rot-btn").forEach(x => x.classList.remove("active")); b.classList.add("active"); }));
  document.getElementById("btn-random").addEventListener("click", () => {
    audio.sfx("ui");
    const pick = a => a[(Math.random() * a.length) | 0];
    look = { name: look.name, gender: look.gender, cls: look.cls, skin: pick(PRESETS.skin), hair: pick(PRESETS.hair), eyes: pick(PRESETS.eyes), shirt: pick(PRESETS.shirt), pants: pick(PRESETS.pants), boots: pick(PRESETS.boots), style: pick(HAIRSTYLES) };
    ["style", "hair", "eyes", "skin", "shirt", "pants", "boots"].forEach(swatch); drawPreview();
  });
  document.getElementById("btn-enter").addEventListener("click", startGame);
  setInterval(() => { if (!creator.classList.contains("hidden")) drawPreview(); }, 200);
  drawPreview();
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
  document.getElementById("btn-settings")?.addEventListener("click", () => { audio.sfx("ui"); game?.ui.toggle("settings"); });
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

function startGame(savedLook, savedName, saveData) {
  // Apply saved look if provided (continue scenario)
  if (savedLook) { Object.assign(look, savedLook); }
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
      if (saveData.stats.cls) { p.cls = saveData.stats.cls; }
      if (saveData.inv) { p.inv = { ...p.inv, ...saveData.inv }; }
      if (saveData.fishing) { game.fishingStats = { ...game.fishingStats, ...saveData.fishing }; }
      if (saveData.flags) {
        game.flags = { ...game.flags, ...saveData.flags };
        if (game.flags.starterCache) { const cache = game.chests.find((chest) => chest.starter); if (cache) cache.opened = true; }
      }
      if (saveData.equipped) { p.equipped = saveData.equipped; }
      game.ui.toast(`Welcome back, ${look.name}!`);
    }
    const nm = document.getElementById("hud-name"); if (nm) nm.textContent = look.name;
    window.__ANASTA__ = game;
    wireSettings();
    // recompute internal resolution on rotate/resize so it stays fullscreen
    addEventListener("resize", () => computeView(canvas));
    game.start();
    // Auto-save every 15s
    setInterval(() => {
      if (!game || !game.player) return;
      const p = game.player;
      putSave({
        name: look.name,
        look: look,
        stats: { level: p.level, xp: p.xp, gold: p.gold, hp: p.hp, cls: p.cls },
        inv: p.inv,
        fishing: game.fishingStats,
        flags: game.flags,
        equipped: p.equipped,
        ts: Date.now(),
      });
    }, 15000);
    // Save on page hide / unload
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && game && game.player) {
        const p = game.player;
        putSave({
          name: look.name, look,
          stats: { level: p.level, xp: p.xp, gold: p.gold, hp: p.hp, cls: p.cls },
          inv: p.inv, fishing: game.fishingStats, flags: game.flags, equipped: p.equipped, ts: Date.now(),
        });
      }
    });
    // Multiplayer presence (no-op unless enabled in config.js). Fire-and-forget.
    connectMultiplayer(look, look.name, { x: game.player.x, y: game.player.y })
      .then((room) => {
        if (room) {
          net.onChat = (m) => game.ui.toast(`${m.name}: ${m.text}`);
          game.ui.toast("Connected — you're online!");
        }
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
  c.width = window.innerWidth; c.height = window.innerHeight;
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
  loginName.focus();
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
