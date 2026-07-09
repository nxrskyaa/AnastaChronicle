import { loadAll } from "./assets.js";
import { Game } from "./game.js";
import "./logic.js";
import "./render.js";
import { UI } from "./ui.js";
import { buildCharacter, PRESETS, HAIRSTYLES, DEFAULT_LOOK } from "./chargen.js";
import { audio } from "./audio.js";

const boot = document.getElementById("boot");
const bootStatus = document.getElementById("boot-status");
const startBtn = document.getElementById("btn-start");
const creator = document.getElementById("creator");
let look = { ...DEFAULT_LOOK };
let game = null;

async function preload() {
  try {
    await loadAll((d, t) => { bootStatus.textContent = `Loading… ${d}/${t}`; });
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
  document.querySelectorAll(".rot-btn").forEach(b => b.addEventListener("click", () => { audio.sfx("ui"); rotDir = b.dataset.rot; document.querySelectorAll(".rot-btn").forEach(x => x.classList.remove("active")); b.classList.add("active"); }));
  document.getElementById("btn-random").addEventListener("click", () => {
    audio.sfx("ui");
    const pick = a => a[(Math.random() * a.length) | 0];
    look = { name: look.name, skin: pick(PRESETS.skin), hair: pick(PRESETS.hair), eyes: pick(PRESETS.eyes), shirt: pick(PRESETS.shirt), pants: pick(PRESETS.pants), boots: pick(PRESETS.boots), style: pick(HAIRSTYLES) };
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

function startGame() {
  creator.classList.add("hidden");
  document.getElementById("game-wrap").classList.remove("hidden");
  audio.init(); audio.resume(); audio.startMusic("explore");
  try {
    const ui = new UI(audio);
    game = new Game(document.getElementById("game"), ui, look);
    ui.bind(game);
    const nm = document.getElementById("hud-name"); if (nm) nm.textContent = look.name;
    window.__ANASTA__ = game;
    wireSettings();
    game.start();
  } catch (e) { console.error(e); alert("Start failed: " + e.message); }
}

startBtn.addEventListener("click", () => {
  audio.init(); audio.resume(); audio.startMusic("title");
  boot.classList.add("hidden");
  creator.classList.remove("hidden");
  initCreator();
});

preload();
