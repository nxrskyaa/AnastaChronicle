import { img, MONSTERS, PET_IDS } from "./assets.js";
import { ITEMS, RECIPES, canCraft, xpFor } from "./crafting.js";

const T = 24;              // render tile size (px, world units)
const MAP_W = 96, MAP_H = 96;
const VIEW_W = 420, VIEW_H = 236;

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Game {
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;
    this.ui = ui;
    this.mini = document.getElementById("minimap");
    this.mctx = this.mini.getContext("2d");
    this.keys = {};
    this.mouse = { x: 0, y: 0, wx: 0, wy: 0, down: false };
    this.stick = { active: false, x: 0, y: 0 };
    this.cam = { x: 0, y: 0 };
    this.t = 0;
    this.paused = false;
    this.moveMode = "button";   // or "tap"
    this.moveTarget = null;
    this.particles = [];
    this.floaters = [];
    this.enemies = [];
    this.chests = [];
    this.trees = [];
    this.bushes = [];
    this.pet = null;
    this.time = 6 * 60;          // minutes, start 06:00
    this.buildWorld();
    this.bindInput();
  }

  buildWorld() {
    // biome map: 0 grass, 1 path, 2 water, 3 sand
    const m = new Uint8Array(MAP_W * MAP_H);
    const v = new Uint8Array(MAP_W * MAP_H);
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const i = y * MAP_W + x;
        // large lake in NE, sand beach around it, winding path
        const lake = Math.hypot(x - 70, y - 26) < 12;
        const beach = Math.hypot(x - 70, y - 26) < 15;
        if (lake) m[i] = 2;
        else if (beach) m[i] = 3;
        else m[i] = 0;
        v[i] = (Math.random() * 4) | 0;
      }
    }
    // paths: cross through center camp
    for (let x = 8; x < MAP_W - 8; x++) {
      const yy = 48 + Math.round(Math.sin(x * 0.12) * 4);
      m[yy * MAP_W + x] = 1; m[(yy + 1) * MAP_W + x] = 1;
    }
    for (let y = 8; y < MAP_H - 8; y++) {
      const xx = 48 + Math.round(Math.cos(y * 0.1) * 4);
      m[y * MAP_W + xx] = 1; m[y * MAP_W + xx + 1] = 1;
    }
    this.map = m; this.vmap = v;

    // camp center
    this.camp = { x: 48 * T, y: 48 * T };

    // trees: scattered, denser at edges (forest border), clear near camp
    for (let y = 3; y < MAP_H - 3; y++) {
      for (let x = 3; x < MAP_W - 3; x++) {
        const i = y * MAP_W + x;
        if (m[i] !== 0) continue;
        const edge = Math.min(x, y, MAP_W - x, MAP_H - y);
        const nearCamp = Math.hypot(x - 48, y - 48) < 7;
        const nearPath = m[i] === 1;
        if (nearCamp || nearPath) continue;
        let dens = 0.05 + (edge < 10 ? 0.14 : 0);
        if (Math.random() < dens) {
          if (Math.random() < 0.72)
            this.trees.push({ x: x * T + T / 2, y: y * T + T / 2, v: (Math.random() * 4) | 0, sortY: y * T + T / 2 });
          else
            this.bushes.push({ x: x * T + T / 2, y: y * T + T / 2, sortY: y * T + T / 2 });
        }
      }
    }

    // player
    this.player = {
      x: this.camp.x, y: this.camp.y + 40,
      vx: 0, vy: 0, dir: "down", frame: 0, frameT: 0,
      anim: "idle", moving: false, dustT: 0,
      speed: 118, accel: 900, friction: 1100,
      hp: 50, maxHp: 50, stamina: 100, maxStamina: 100,
      level: 1, xp: 0, gold: 0,
      attackT: 0, attackCd: 0, evadeT: 0, evadeCd: 0, invuln: 0,
      shield: false, skillCd: [0, 0, 0, 0],
      inv: { wood: 0, ore: 0, gel: 0, herb: 0 },
      equipped: "fist", dmg: 8, sortY: 0,
    };

    // spawn enemies + chests
    for (let k = 0; k < 40; k++) this.spawnEnemy();
    for (let k = 0; k < 14; k++) this.spawnChest();
  }

  spawnEnemy() {
    let x, y, tries = 0;
    do {
      x = rand(4 * T, (MAP_W - 4) * T);
      y = rand(4 * T, (MAP_H - 4) * T);
      tries++;
    } while ((this.tileAt(x, y) === 2 || Math.hypot(x - this.camp.x, y - this.camp.y) < 8 * T) && tries < 30);
    const tier = Math.random() < 0.7 ? 1 : Math.random() < 0.7 ? 2 : 3;
    const id = MONSTERS[(Math.random() * MONSTERS.length) | 0];
    const im = img(`mon/${id}`);
    const h = im ? im.height : 40;
    this.enemies.push({
      id, x, y, sortY: y, tier,
      hp: 14 + tier * 12, maxHp: 14 + tier * 12,
      dmg: 4 + tier * 3, speed: 26 + tier * 10,
      xp: 6 + tier * 8, gold: tier * 2,
      bob: Math.random() * 6, atkCd: 0, hurt: 0, dead: false, h,
    });
  }

  spawnChest() {
    let x, y, tries = 0;
    do {
      x = rand(5 * T, (MAP_W - 5) * T);
      y = rand(5 * T, (MAP_H - 5) * T);
      tries++;
    } while (this.tileAt(x, y) === 2 && tries < 30);
    // ~30% of chests contain a pet
    const pet = Math.random() < 0.3 ? PET_IDS[(Math.random() * PET_IDS.length) | 0] : null;
    this.chests.push({ x, y, sortY: y, opened: false, pet });
  }

  tileAt(px, py) {
    const tx = clamp((px / T) | 0, 0, MAP_W - 1);
    const ty = clamp((py / T) | 0, 0, MAP_H - 1);
    return this.map[ty * MAP_W + tx];
  }

  bindInput() {
    addEventListener("keydown", (e) => {
      this.keys[e.code] = true;
      if (e.code === "KeyI") this.ui.toggle("inv");
      if (e.code === "KeyC") this.ui.toggle("craft");
      if (e.code === "KeyM") this.toggleMoveMode();
      if (e.code === "KeyF") this.interact();
      if (["Digit1","Digit2","Digit3","Digit4"].includes(e.code))
        this.useSkill(Number(e.code.slice(5)) - 1);
      if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].includes(e.code)) e.preventDefault();
    });
    addEventListener("keyup", (e) => { this.keys[e.code] = false; });

    const rect = () => this.canvas.getBoundingClientRect();
    this.canvas.addEventListener("mousemove", (e) => {
      const r = rect();
      this.mouse.x = (e.clientX - r.left) * (VIEW_W / r.width);
      this.mouse.y = (e.clientY - r.top) * (VIEW_H / r.height);
    });
    this.canvas.addEventListener("mousedown", (e) => {
      if (this.moveMode === "tap") {
        const r = rect();
        const mx = (e.clientX - r.left) * (VIEW_W / r.width);
        const my = (e.clientY - r.top) * (VIEW_H / r.height);
        this.moveTarget = { x: mx + this.cam.x, y: my + this.cam.y };
      } else {
        this.mouse.down = true;
      }
    });
    addEventListener("mouseup", () => { this.mouse.down = false; });

    document.getElementById("btn-move-mode")?.addEventListener("click", () => this.toggleMoveMode());
    document.querySelectorAll("#skillbar .sk[data-i]").forEach((b) =>
      b.addEventListener("click", () => this.useSkill(Number(b.dataset.i))));

    // touch controls
    this.bindTouch();
  }

  toggleMoveMode() {
    this.moveMode = this.moveMode === "button" ? "tap" : "button";
    this.moveTarget = null;
    const el = document.querySelector("#btn-move-mode .sk-name");
    if (el) el.textContent = this.moveMode === "tap" ? "Btn" : "Tap";
    this.ui.toast(this.moveMode === "tap" ? "Tap-to-move ON — click ground to walk" : "Button/keyboard control ON");
  }

  bindTouch() {
    const stick = document.getElementById("stick");
    const knob = document.getElementById("stick-knob");
    if (stick) {
      const set = (cx, cy, t) => {
        const r = stick.getBoundingClientRect();
        let dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2);
        const d = Math.hypot(dx, dy), max = r.width / 2;
        if (d > max) { dx = dx / d * max; dy = dy / d * max; }
        this.stick.active = true; this.stick.x = dx / max; this.stick.y = dy / max;
        knob.style.transform = `translate(${dx}px,${dy}px)`;
      };
      const end = () => { this.stick.active = false; this.stick.x = 0; this.stick.y = 0; knob.style.transform = "translate(0,0)"; };
      stick.addEventListener("touchstart", (e) => { e.preventDefault(); set(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
      stick.addEventListener("touchmove", (e) => { e.preventDefault(); set(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
      stick.addEventListener("touchend", end);
    }
    const hold = (id, on, off) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("touchstart", (e) => { e.preventDefault(); on(); }, { passive: false });
      el.addEventListener("touchend", (e) => { e.preventDefault(); off && off(); }, { passive: false });
    };
    hold("btn-attack", () => this.mouse.down = true, () => this.mouse.down = false);
    hold("btn-shield", () => this.keys.ShiftLeft = true, () => this.keys.ShiftLeft = false);
    hold("btn-evade", () => this.keys.Space = true, () => this.keys.Space = false);
    // tap on canvas for tap-move (touch)
    this.canvas.addEventListener("touchstart", (e) => {
      if (this.moveMode !== "tap") return;
      const r = this.canvas.getBoundingClientRect();
      const mx = (e.touches[0].clientX - r.left) * (VIEW_W / r.width);
      const my = (e.touches[0].clientY - r.top) * (VIEW_H / r.height);
      this.moveTarget = { x: mx + this.cam.x, y: my + this.cam.y };
    }, { passive: true });
  }

  start() {
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!this.paused) this.update(dt);
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}
