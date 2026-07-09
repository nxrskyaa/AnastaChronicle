import { loadAll } from "./assets.js";
import { Game } from "./game.js";
import "./logic.js";
import "./render.js";
import { UI } from "./ui.js";
import { buildCharacter, PRESETS, HAIRSTYLES, DEFAULT_LOOK } from "./chargen.js";

const boot = document.getElementById("boot");
const bootStatus = document.getElementById("boot-status");
const startBtn = document.getElementById("btn-start");
const creator = document.getElementById("creator");

let look = { ...DEFAULT_LOOK };

async function preload() {
  try {
    await loadAll((d, t) => { bootStatus.textContent = `Loading… ${d}/${t}`; });
    bootStatus.textContent = "Ready";
    startBtn.disabled = false;
  } catch (e) { bootStatus.textContent = "Load error: " + e.message; console.error(e); }
}

// ---- character creator ----
let rotDir = "down";
function drawPreview() {
  const cv = document.getElementById("char-preview");
  const ctx = cv.getContext("2d"); ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, cv.width, cv.height);
  const cache = buildCharacter(look);
  const f = Math.floor(Date.now() / 200) % 4;
  const src = cache.walk[rotDir][f];
  ctx.drawImage(src, 0, 0, 32, 40, 16, 12, 96, 120);
}

function swatch(part) {
  const wrap = document.getElementById("sw-" + part);
  if (!wrap) return;
  wrap.innerHTML = "";
  const vals = part === "style" ? HAIRSTYLES : PRESETS[part];
  for (const v of vals) {
    const b = document.createElement("button");
    b.className = "swatch" + (look[part] === v ? " sel" : "");
    if (part === "style") { b.textContent = v[0].toUpperCase(); b.title = v; }
    else b.style.background = v;
    b.addEventListener("click", () => {
      look[part] = v;
      wrap.querySelectorAll(".swatch").forEach(s => s.classList.remove("sel"));
      b.classList.add("sel");
      drawPreview();
    });
    wrap.appendChild(b);
  }
}

function initCreator() {
  ["style", "hair", "skin", "shirt", "pants", "boots"].forEach(swatch);
  document.getElementById("opt-name").addEventListener("input", (e) => { look.name = e.target.value || "Anasta"; });
  document.querySelectorAll(".rot-btn").forEach(b => b.addEventListener("click", () => {
    rotDir = b.dataset.rot;
    document.querySelectorAll(".rot-btn").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
  }));
  document.getElementById("btn-random").addEventListener("click", () => {
    const pick = a => a[(Math.random() * a.length) | 0];
    look = { name: look.name, skin: pick(PRESETS.skin), hair: pick(PRESETS.hair), shirt: pick(PRESETS.shirt), pants: pick(PRESETS.pants), boots: pick(PRESETS.boots), style: pick(HAIRSTYLES) };
    ["style", "hair", "skin", "shirt", "pants", "boots"].forEach(swatch);
    drawPreview();
  });
  document.getElementById("btn-enter").addEventListener("click", startGame);
  setInterval(() => { if (!creator.classList.contains("hidden")) drawPreview(); }, 200);
  drawPreview();
}

function startGame() {
  creator.classList.add("hidden");
  document.getElementById("game-wrap").classList.remove("hidden");
  fitCanvas();
  try {
    const ui = new UI();
    const game = new Game(document.getElementById("game"), ui, look);
    ui.bind(game);
    const nm = document.getElementById("hud-name"); if (nm) nm.textContent = look.name;
    window.__ANASTA__ = game;
    game.start();
  } catch (e) { console.error(e); alert("Start failed: " + e.message); }
}

startBtn.addEventListener("click", () => {
  boot.classList.add("hidden");
  creator.classList.remove("hidden");
  initCreator();
});

// responsive canvas — fixes mobile cutoff
function fitCanvas() {
  const cv = document.getElementById("game");
  if (!cv) return;
  // canvas uses CSS object-fit: contain; nothing else needed, but ensure wrap sized
}
addEventListener("resize", fitCanvas);

preload();
