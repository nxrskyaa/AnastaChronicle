import { img, MONSTERS, PET_IDS } from "./assets.js";
import { ITEMS, RECIPES, canCraft, xpFor } from "./crafting.js";
import { buildCharacter, buildWeapon, DEFAULT_LOOK } from "./chargen.js";
import { QuestLog, NPC_DEFS } from "./quests.js";

const T = 24;
const MAP_W = 110, MAP_H = 110;
const VIEW_W = 420, VIEW_H = 236;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Game {
  constructor(canvas, ui, look) {
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
    this.moveMode = "button";
    this.moveTarget = null;
    this.particles = [];
    this.weatherP = [];
    this.enemies = [];
    this.chests = [];
    this.trees = [];
    this.bushes = [];
    this.rocks = [];
    this.flowers = [];
    this.npcs = [];
    this.pet = null;
    this.time = 6 * 60;
    this.weather = "clear";     // clear | rain | snow
    this.weatherT = 30;
    this.quests = new QuestLog();

    this.look = look || { ...DEFAULT_LOOK };
    this.charCache = buildCharacter(this.look);
    this.weaponCache = {};

    this.buildWorld();
    this.bindInput();
  }

  rebuildCharacter(look) {
    this.look = look;
    this.charCache = buildCharacter(look);
  }
  weaponFrames(w) {
    if (!this.weaponCache[w]) this.weaponCache[w] = buildWeapon(w);
    return this.weaponCache[w];
  }

  buildWorld() {
    const m = new Uint8Array(MAP_W * MAP_H);
    const v = new Uint8Array(MAP_W * MAP_H);
    // biomes: 0 grass, 1 path, 2 water, 3 sand, 4 snow-ground, 5 dark-grass(forest)
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const i = y * MAP_W + x;
        const lake = Math.hypot(x - 80, y - 28) < 13;
        const beach = Math.hypot(x - 80, y - 28) < 16;
        const snow = y < 18 && x < 46;                 // north-west snow biome
        const deepForest = x > 74 && y > 70;           // SE dark forest
        if (lake) m[i] = 2;
        else if (beach) m[i] = 3;
        else if (snow) m[i] = 4;
        else if (deepForest) m[i] = 5;
        else m[i] = 0;
        v[i] = (Math.random() * 4) | 0;
      }
    }
    // winding main paths + a diagonal branch + a loop
    for (let x = 8; x < MAP_W - 8; x++) {
      const yy = 55 + Math.round(Math.sin(x * 0.11) * 6);
      m[yy * MAP_W + x] = 1; m[(yy + 1) * MAP_W + x] = 1;
    }
    for (let y = 8; y < MAP_H - 8; y++) {
      const xx = 55 + Math.round(Math.cos(y * 0.09) * 6);
      m[y * MAP_W + xx] = 1; m[y * MAP_W + xx + 1] = 1;
    }
    // diagonal trail to snow biome
    for (let t2 = 0; t2 < 40; t2++) {
      const x = 55 - t2, y = 55 - t2;
      if (x > 1 && y > 1) { m[y * MAP_W + x] = 1; m[y * MAP_W + x + 1] = 1; }
    }
    this.map = m; this.vmap = v;
    this.camp = { x: 55 * T, y: 55 * T };

    // decorations: trees, bushes, rocks, flowers by biome
    for (let y = 3; y < MAP_H - 3; y++) {
      for (let x = 3; x < MAP_W - 3; x++) {
        const i = y * MAP_W + x, t = m[i];
        if (t === 1 || t === 2) continue;
        const nearCamp = Math.hypot(x - 55, y - 55) < 8;
        if (nearCamp) continue;
        const edge = Math.min(x, y, MAP_W - x, MAP_H - y);
        const wx = x * T + T / 2, wy = y * T + T / 2;
        let treeDens = 0.05 + (edge < 12 ? 0.13 : 0) + (t === 5 ? 0.1 : 0);
        const r = Math.random();
        if (r < treeDens) {
          this.trees.push({ x: wx, y: wy, v: (Math.random() * 4) | 0, sortY: wy });
        } else if (r < treeDens + 0.02) {
          this.bushes.push({ x: wx, y: wy, sortY: wy });
        } else if (r < treeDens + 0.032 && (t === 0 || t === 4)) {
          this.rocks.push({ x: wx, y: wy, sortY: wy, snow: t === 4 });
        } else if (r < treeDens + 0.075 && t === 0) {
          this.flowers.push({ x: wx, y: wy, k: (Math.random() * 3) | 0 });
        }
      }
    }

    this.player = {
      x: this.camp.x, y: this.camp.y + 46,
      vx: 0, vy: 0, dir: "down", frame: 0, frameT: 0,
      anim: "idle", moving: false, dustT: 0,
      speed: 120, accel: 900, friction: 1150,
      hp: 50, maxHp: 50, stamina: 100, maxStamina: 100,
      level: 1, xp: 0, gold: 0,
      attackT: 0, attackDur: 0.24, attackCd: 0, evadeT: 0, evadeCd: 0, invuln: 0,
      shield: false, skillCd: [0, 0, 0, 0],
      inv: { wood: 2, ore: 0, gel: 0, herb: 1 },
      equipped: "sword", dmg: 8, sortY: 0,
      name: this.look.name || "Anasta",
    };
    this.player.inv.sword = 1;

    // NPCs around camp
    for (const def of NPC_DEFS) {
      this.npcs.push({
        name: def.name, look: def.look,
        x: this.camp.x + def.dx, y: this.camp.y + def.dy,
        dir: "down", frame: 0, frameT: Math.random() * 4, sortY: 0,
        cache: buildCharacter({ ...DEFAULT_LOOK, ...def.look, name: def.name }),
      });
    }

    for (let k = 0; k < 46; k++) this.spawnEnemy();
    for (let k = 0; k < 16; k++) this.spawnChest();
  }

  spawnEnemy() {
    let x, y, tries = 0;
    do {
      x = rand(4 * T, (MAP_W - 4) * T); y = rand(4 * T, (MAP_H - 4) * T); tries++;
    } while ((this.tileAt(x, y) === 2 || Math.hypot(x - this.camp.x, y - this.camp.y) < 9 * T) && tries < 30);
    const tier = Math.random() < 0.65 ? 1 : Math.random() < 0.7 ? 2 : 3;
    const id = MONSTERS[(Math.random() * MONSTERS.length) | 0];
    const im = img(`mon/${id}`);
    this.enemies.push({
      id, x, y, sortY: y, tier,
      hp: 14 + tier * 12, maxHp: 14 + tier * 12,
      dmg: 4 + tier * 3, speed: 24 + tier * 10,
      xp: 6 + tier * 8, gold: tier * 2,
      bob: Math.random() * 6, atkCd: 0, hurt: 0, dead: false, h: im ? im.height : 40,
    });
  }

  spawnChest() {
    let x, y, tries = 0;
    do { x = rand(5 * T, (MAP_W - 5) * T); y = rand(5 * T, (MAP_H - 5) * T); tries++; }
    while (this.tileAt(x, y) === 2 && tries < 30);
    const pet = Math.random() < 0.3 ? PET_IDS[(Math.random() * PET_IDS.length) | 0] : null;
    this.chests.push({ x, y, sortY: y, opened: false, openT: 0, pet });
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
      if (e.code === "KeyQ") this.ui.toggle("quest");
      if (e.code === "KeyM") this.toggleMoveMode();
      if (e.code === "KeyF") this.interact();
      if (["Digit1", "Digit2", "Digit3", "Digit4"].includes(e.code)) this.useSkill(Number(e.code.slice(5)) - 1);
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
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
      } else this.mouse.down = true;
    });
    addEventListener("mouseup", () => { this.mouse.down = false; });
    document.getElementById("btn-move-mode")?.addEventListener("click", () => this.toggleMoveMode());
    document.querySelectorAll("#skillbar .sk[data-i]").forEach((b) =>
      b.addEventListener("click", () => this.useSkill(Number(b.dataset.i))));
    this.bindTouch();
  }

  toggleMoveMode() {
    this.moveMode = this.moveMode === "button" ? "tap" : "button";
    this.moveTarget = null;
    const el = document.querySelector("#btn-move-mode .sk-name");
    if (el) el.textContent = this.moveMode === "tap" ? "Btn" : "Tap";
    this.ui.toast(this.moveMode === "tap" ? "Tap-to-move ON" : "Button/keyboard ON");
  }

  bindTouch() {
    const stick = document.getElementById("stick");
    const knob = document.getElementById("stick-knob");
    if (stick) {
      const set = (cx, cy) => {
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
      const el = document.getElementById(id); if (!el) return;
      el.addEventListener("touchstart", (e) => { e.preventDefault(); on(); }, { passive: false });
      el.addEventListener("touchend", (e) => { e.preventDefault(); off && off(); }, { passive: false });
    };
    hold("btn-attack", () => this.mouse.down = true, () => this.mouse.down = false);
    hold("btn-shield", () => this.keys.ShiftLeft = true, () => this.keys.ShiftLeft = false);
    hold("btn-evade", () => this.keys.Space = true, () => this.keys.Space = false);
    hold("btn-interact", () => this.interact(), null);
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
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!this.paused) this.update(dt);
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}
