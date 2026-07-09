import { img } from "./assets.js";
import { ITEMS, RECIPES, canCraft, doCraft, xpFor, applyLevel } from "./crafting.js";

const TILE = 16;
const MAP_W = 64;
const MAP_H = 64;
const SCALE = 3; // internal pixels → CSS via canvas resize

// internal resolution (pixel perfect)
const VIEW_W = 480;
const VIEW_H = 270;

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Game {
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.ui = ui;
    this.paused = false;
    this.t = 0;
    this.keys = {};
    this.mouse = { x: VIEW_W / 2, y: VIEW_H / 2, down: false, wx: 0, wy: 0 };
    this.stick = { x: 0, y: 0, active: false };
    this.cam = { x: 0, y: 0 };
    this.projectiles = [];
    this.drops = [];
    this.slashFx = [];
    this.particles = [];

    this.rng = mulberry32(0x414e4153);
    this._fitCanvas();
    this._genWorld();
    this._initPlayer();
    this._clearSpawn();
    this._spawnSlimes(22);
    this._bind();
    this._bindTouch();
    this.ui.sync();
    window.addEventListener("resize", () => this._fitCanvas());
  }

  _fitCanvas() {
    // keep internal 480x270, scale with nearest neighbor via CSS
    this.canvas.width = VIEW_W;
    this.canvas.height = VIEW_H;
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.style.imageRendering = "pixelated";
    this.canvas.style.objectFit = "contain";
    this.canvas.style.background = "#1a2820";
  }

  _genWorld() {
    const rng = this.rng;
    this.map = new Uint8Array(MAP_W * MAP_H); // 0 grass 1 path 2 dirt edge 3 water
    this.varMap = new Uint8Array(MAP_W * MAP_H);
    for (let i = 0; i < this.map.length; i++) {
      this.map[i] = 0;
      this.varMap[i] = (rng() * 4) | 0;
    }

    // path
    let px = 6,
      py = (MAP_H / 2) | 0;
    this.spawnTX = px + 2;
    this.spawnTY = py;
    for (let s = 0; s < 180; s++) {
      for (let oy = -1; oy <= 1; oy++)
        for (let ox = -1; ox <= 1; ox++) {
          const x = px + ox,
            y = py + oy;
          if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
          this.map[y * MAP_W + x] = ox === 0 && oy === 0 ? 1 : 2;
        }
      const r = rng();
      if (r < 0.55) px++;
      else if (r < 0.72) py++;
      else if (r < 0.89) py--;
      else px++;
      px = Math.max(2, Math.min(MAP_W - 3, px));
      py = Math.max(2, Math.min(MAP_H - 3, py));
    }
    // camp
    for (let y = py - 3; y <= py + 3; y++)
      for (let x = 4; x <= 11; x++) {
        if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) this.map[y * MAP_W + x] = 1;
      }
    this.spawnTX = 7;
    this.spawnTY = py;

    // ponds
    for (let n = 0; n < 6; n++) {
      const cx = 6 + ((rng() * (MAP_W - 12)) | 0);
      const cy = 6 + ((rng() * (MAP_H - 12)) | 0);
      const rr = 2 + ((rng() * 3) | 0);
      for (let y = cy - rr; y <= cy + rr; y++)
        for (let x = cx - rr; x <= cx + rr; x++) {
          if (x < 1 || y < 1 || x >= MAP_W - 1 || y >= MAP_H - 1) continue;
          if ((x - cx) ** 2 + (y - cy) ** 2 <= rr * rr && this.map[y * MAP_W + x] !== 1)
            this.map[y * MAP_W + x] = 3;
        }
    }

    // props
    this.trees = [];
    this.rocks = [];
    this.torches = [];
    this.chests = [];
    for (let y = 2; y < MAP_H - 2; y++) {
      for (let x = 2; x < MAP_W - 2; x++) {
        const t = this.map[y * MAP_W + x];
        if (t === 1 || t === 3) continue;
        const r = rng();
        const wx = x * TILE + 8;
        const wy = y * TILE + 8;
        if (r < 0.07) {
          this.trees.push({
            x: wx,
            y: wy,
            hp: 3,
            v: (rng() * 4) | 0,
            sortY: wy + 20,
          });
        } else if (r < 0.085) {
          this.rocks.push({ x: wx, y: wy, hp: 2, v: (rng() * 3) | 0, sortY: wy + 4 });
        }
      }
    }
    // torches on path
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++) {
        if (this.map[y * MAP_W + x] !== 1 || rng() > 0.04) continue;
        this.torches.push({
          x: x * TILE + 8 + (rng() > 0.5 ? 10 : -10),
          y: y * TILE + 8,
          sortY: y * TILE + 16,
        });
      }
    // chests
    for (let i = 0; i < 6; i++) {
      for (let tries = 0; tries < 40; tries++) {
        const x = 3 + ((rng() * (MAP_W - 6)) | 0);
        const y = 3 + ((rng() * (MAP_H - 6)) | 0);
        if (this.map[y * MAP_W + x] !== 0) continue;
        this.chests.push({
          x: x * TILE + 8,
          y: y * TILE + 8,
          open: false,
          sortY: y * TILE + 12,
        });
        break;
      }
    }
    this.camp = {
      x: this.spawnTX * TILE + 8,
      y: this.spawnTY * TILE + 8,
      sortY: this.spawnTY * TILE + 14,
    };
  }

  _initPlayer() {
    const sx = this.spawnTX * TILE + 8;
    const sy = this.spawnTY * TILE + 8;
    this.player = {
      x: sx,
      y: sy,
      vx: 0,
      vy: 0,
      dir: "down",
      frame: 0,
      frameT: 0,
      speed: 78,
      level: 1,
      xp: 0,
      hp: 50,
      maxHp: 50,
      stamina: 100,
      maxStamina: 100,
      baseDmg: 2,
      inv: { wood: 4, gel: 2, ore: 2, herb: 2, dagger: 1 },
      gold: 5,
      equipped: "dagger",
      attackT: 0,
      attackCd: 0,
      shield: false,
      evadeT: 0,
      evadeCd: 0,
      invuln: 0,
      dead: false,
      skillCd: [0, 0, 0, 0],
      sortY: sy,
    };
    applyLevel(this.player);
    this.player.hp = this.player.maxHp;
    this.player.stamina = this.player.maxStamina;
    this.cam.x = sx - VIEW_W / 2;
    this.cam.y = sy - VIEW_H / 2;
  }

  _clearSpawn() {
    const sx = this.player.x,
      sy = this.player.y;
    this.trees = this.trees.filter((tr) => {
      if (Math.hypot(tr.x - sx, tr.y - sy) < 56) return false;
      // near path
      const tx = (tr.x / TILE) | 0,
        ty = (tr.y / TILE) | 0;
      if (this.map[ty * MAP_W + tx] === 1 || this.map[ty * MAP_W + tx] === 2) return false;
      return true;
    });
    this.rocks = this.rocks.filter((rk) => Math.hypot(rk.x - sx, rk.y - sy) > 48);
  }

  _spawnSlimes(n) {
    this.enemies = [];
    const rng = this.rng;
    for (let i = 0; i < n; i++) {
      let x, y, ok = false;
      for (let t = 0; t < 40 && !ok; t++) {
        x = 24 + rng() * (MAP_W * TILE - 48);
        y = 24 + rng() * (MAP_H * TILE - 48);
        if (!this.blocked(x, y, 6) && Math.hypot(x - this.player.x, y - this.player.y) > 100) ok = true;
      }
      if (!ok) continue;
      const tier = rng() < 0.18 ? 2 : 1;
      this.enemies.push(this._makeSlime(x, y, tier));
    }
  }

  _makeSlime(x, y, tier = 1) {
    return {
      x,
      y,
      hp: 18 * tier,
      maxHp: 18 * tier,
      dmg: 5 * tier,
      speed: 28 + tier * 8,
      tier,
      xp: 12 * tier,
      atkCd: 0,
      hurtT: 0,
      dead: false,
      aggro: 90 + tier * 20,
      frame: 0,
      frameT: 0,
      sortY: y,
    };
  }

  tileAt(px, py) {
    const tx = (px / TILE) | 0;
    const ty = (py / TILE) | 0;
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return 3;
    return this.map[ty * MAP_W + tx];
  }

  blocked(x, y, r = 5) {
    if (this.tileAt(x, y) === 3) return true;
    if (this.tileAt(x + r, y) === 3 || this.tileAt(x - r, y) === 3) return true;
    if (this.tileAt(x, y + r) === 3 || this.tileAt(x, y - r) === 3) return true;
    for (const tr of this.trees) {
      if (tr.hp <= 0) continue;
      if (Math.hypot(x - tr.x, y - (tr.y + 8)) < 8 + r * 0.3) return true;
    }
    for (const rk of this.rocks) {
      if (rk.hp <= 0) continue;
      if (Math.hypot(x - rk.x, y - rk.y) < 7 + r * 0.2) return true;
    }
    return false;
  }

  _bind() {
    window.addEventListener("keydown", (e) => {
      this.keys[e.code] = true;
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
      if (e.code === "KeyI") this.ui.toggle("inv");
      if (e.code === "KeyC") this.ui.toggle("craft");
      if (e.code === "Escape") this.ui.closeAll();
      if (e.code === "Digit1") this.useSkill(0);
      if (e.code === "Digit2") this.useSkill(1);
      if (e.code === "Digit3") this.useSkill(2);
      if (e.code === "Digit4") this.useSkill(3);
      if (e.code === "KeyF") this.interact();
    });
    window.addEventListener("keyup", (e) => {
      this.keys[e.code] = false;
    });

    const c = this.canvas;
    const toWorld = (e) => {
      const rect = c.getBoundingClientRect();
      // letterbox-aware mapping
      const scale = Math.min(rect.width / VIEW_W, rect.height / VIEW_H);
      const ox = rect.left + (rect.width - VIEW_W * scale) / 2;
      const oy = rect.top + (rect.height - VIEW_H * scale) / 2;
      const sx = (e.clientX - ox) / scale;
      const sy = (e.clientY - oy) / scale;
      this.mouse.x = sx;
      this.mouse.y = sy;
      this.mouse.wx = sx + this.cam.x;
      this.mouse.wy = sy + this.cam.y;
    };
    c.addEventListener("mousemove", (e) => toWorld(e));
    c.addEventListener("mousedown", (e) => {
      toWorld(e);
      if (e.button === 0) {
        this.mouse.down = true;
        this.tryAttack();
      }
    });
    c.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.mouse.down = false;
    });
    c.addEventListener("contextmenu", (e) => e.preventDefault());
    c.addEventListener(
      "touchstart",
      (e) => {
        if (!e.touches[0]) return;
        // only if not on stick
        e.preventDefault();
        toWorld(e.touches[0]);
        this.tryAttack();
      },
      { passive: false }
    );
  }

  _bindTouch() {
    const stick = document.getElementById("stick");
    const knob = document.getElementById("stick-knob");
    if (stick && knob) {
      const maxR = 40;
      const setFrom = (cx, cy) => {
        const rect = stick.getBoundingClientRect();
        const ox = rect.left + rect.width / 2;
        const oy = rect.top + rect.height / 2;
        let dx = cx - ox,
          dy = cy - oy;
        const len = Math.hypot(dx, dy) || 1;
        if (len > maxR) {
          dx = (dx / len) * maxR;
          dy = (dy / len) * maxR;
        }
        knob.style.transform = `translate(${dx}px,${dy}px)`;
        this.stick.active = true;
        this.stick.x = dx / maxR;
        this.stick.y = dy / maxR;
      };
      const end = () => {
        this.stick.active = false;
        this.stick.x = this.stick.y = 0;
        knob.style.transform = "translate(0,0)";
      };
      const down = (e) => {
        e.preventDefault();
        const t = e.touches ? e.touches[0] : e;
        setFrom(t.clientX, t.clientY);
      };
      const move = (e) => {
        if (!this.stick.active) return;
        e.preventDefault();
        const t = e.touches ? e.touches[0] : e;
        setFrom(t.clientX, t.clientY);
      };
      stick.addEventListener("pointerdown", down);
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", end);
      stick.addEventListener("touchstart", down, { passive: false });
      stick.addEventListener("touchmove", move, { passive: false });
      stick.addEventListener("touchend", end);
    }
    const hold = (id, on, off) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        on();
      });
      el.addEventListener("pointerup", (e) => {
        e.preventDefault();
        off();
      });
      el.addEventListener("pointerleave", () => off());
    };
    hold(
      "btn-attack",
      () => {
        this.mouse.down = true;
        this.tryAttack();
      },
      () => {
        this.mouse.down = false;
      }
    );
    hold(
      "btn-shield",
      () => {
        this.keys.ShiftLeft = true;
      },
      () => {
        this.keys.ShiftLeft = false;
      }
    );
    hold(
      "btn-evade",
      () => {
        this.keys.Space = true;
        setTimeout(() => (this.keys.Space = false), 100);
      },
      () => {}
    );
    document.getElementById("btn-craft")?.addEventListener("click", () => this.ui.toggle("craft"));
    document.getElementById("btn-inv")?.addEventListener("click", () => this.ui.toggle("inv"));
    document.querySelectorAll("#action-bar .slot").forEach((b) =>
      b.addEventListener("click", () => this.useSkill(Number(b.dataset.i)))
    );
  }

  start() {
    this.last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.033, (now - this.last) / 1000);
      this.last = now;
      if (!this.paused && !this.player.dead) this.update(dt);
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  weapon() {
    return ITEMS[this.player.equipped] || ITEMS.dagger;
  }

  update(dt) {
    this.t += dt;
    const p = this.player;
    p.attackT = Math.max(0, p.attackT - dt);
    p.attackCd = Math.max(0, p.attackCd - dt);
    p.evadeT = Math.max(0, p.evadeT - dt);
    p.evadeCd = Math.max(0, p.evadeCd - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    for (let i = 0; i < 4; i++) p.skillCd[i] = Math.max(0, p.skillCd[i] - dt);

    p.shield = !!(this.keys.ShiftLeft || this.keys.ShiftRight);
    if (p.shield) {
      p.stamina = Math.max(0, p.stamina - 18 * dt);
      if (p.stamina <= 0) p.shield = false;
    } else p.stamina = Math.min(p.maxStamina, p.stamina + 22 * dt);

    // evade toward mouse
    if ((this.keys.Space || this.keys.KeyE) && p.evadeCd <= 0 && p.stamina >= 16) {
      p.evadeT = 0.18;
      p.evadeCd = 0.8;
      p.stamina -= 16;
      p.invuln = 0.18;
      const ang = Math.atan2(this.mouse.wy - p.y, this.mouse.wx - p.x);
      p.vx = Math.cos(ang) * 220;
      p.vy = Math.sin(ang) * 220;
    }

    let mx = 0,
      my = 0;
    if (this.keys.KeyW || this.keys.ArrowUp) my -= 1;
    if (this.keys.KeyS || this.keys.ArrowDown) my += 1;
    if (this.keys.KeyA || this.keys.ArrowLeft) mx -= 1;
    if (this.keys.KeyD || this.keys.ArrowRight) mx += 1;
    if (this.stick.active) {
      mx += this.stick.x;
      my += this.stick.y;
    }
    if (Math.abs(mx) > 0.05 || Math.abs(my) > 0.05) {
      const len = Math.hypot(mx, my) || 1;
      mx /= len;
      my /= len;
      const slow = p.shield ? 0.55 : 1;
      if (p.evadeT <= 0) {
        p.vx = mx * p.speed * slow;
        p.vy = my * p.speed * slow;
      }
      if (Math.abs(mx) > Math.abs(my)) p.dir = mx < 0 ? "left" : "right";
      else p.dir = my < 0 ? "up" : "down";
      p.frameT += dt;
      if (p.frameT > 0.12) {
        p.frameT = 0;
        p.frame = (p.frame + 1) % 4;
      }
    } else if (p.evadeT <= 0) {
      p.vx *= 0.8;
      p.vy *= 0.8;
      if (Math.hypot(p.vx, p.vy) < 4) {
        p.vx = p.vy = 0;
        p.frame = 0;
      }
    }

    // face mouse when attacking
    if (p.attackT > 0 || this.mouse.down) {
      const dx = this.mouse.wx - p.x;
      const dy = this.mouse.wy - p.y;
      if (Math.abs(dx) > Math.abs(dy)) p.dir = dx < 0 ? "left" : "right";
      else p.dir = dy < 0 ? "up" : "down";
    }

    this._move(p, p.vx * dt, p.vy * dt, 5);
    p.sortY = p.y;

    if (this.mouse.down && p.attackCd <= 0) this.tryAttack();

    // interact prompt
    let near = false;
    for (const c of this.chests) {
      if (!c.open && Math.hypot(c.x - p.x, c.y - p.y) < 22) near = true;
    }
    this.ui.setInteract(near);

    this._updateEnemies(dt);
    this._updateProjectiles(dt);
    this._updateDrops(dt);
    this._updateFx(dt);

    // camera
    const tx = p.x - VIEW_W / 2;
    const ty = p.y - VIEW_H / 2 - 12;
    this.cam.x += (tx - this.cam.x) * Math.min(1, 8 * dt);
    this.cam.y += (ty - this.cam.y) * Math.min(1, 8 * dt);
    this.cam.x = Math.max(0, Math.min(MAP_W * TILE - VIEW_W, this.cam.x));
    this.cam.y = Math.max(0, Math.min(MAP_H * TILE - VIEW_H, this.cam.y));

    // mouse world refresh
    this.mouse.wx = this.mouse.x + this.cam.x;
    this.mouse.wy = this.mouse.y + this.cam.y;

    this.ui.sync();
    this._drawMinimap();
  }

  _move(ent, dx, dy, r) {
    const nx = ent.x + dx;
    if (!this.blocked(nx, ent.y, r)) ent.x = nx;
    const ny = ent.y + dy;
    if (!this.blocked(ent.x, ny, r)) ent.y = ny;
    ent.x = Math.max(8, Math.min(MAP_W * TILE - 8, ent.x));
    ent.y = Math.max(8, Math.min(MAP_H * TILE - 8, ent.y));
  }

  tryAttack() {
    const p = this.player;
    if (p.attackCd > 0 || p.dead) return;
    const w = this.weapon();
    if (p.stamina < w.cost * 0.4) {
      this.ui.toast("Not enough stamina");
      return;
    }
    p.stamina = Math.max(0, p.stamina - w.cost);
    p.attackT = 0.16;
    p.attackCd = w.speed;

    const ang = Math.atan2(this.mouse.wy - p.y, this.mouse.wx - p.x);
    this.slashFx.push({
      x: p.x + Math.cos(ang) * 14,
      y: p.y + Math.sin(ang) * 10,
      frame: 0,
      t: 0,
      ang,
    });

    const dmg = w.dmg + p.baseDmg;
    if (w.ranged) {
      this.projectiles.push({
        x: p.x,
        y: p.y - 8,
        vx: Math.cos(ang) * 160,
        vy: Math.sin(ang) * 160,
        life: 1,
        dmg,
      });
      return;
    }

    const range = w.range * TILE * 0.55;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = e.x - p.x,
        dy = e.y - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist > range + 8) continue;
      let da = Math.abs(Math.atan2(dy, dx) - ang);
      while (da > Math.PI) da = Math.abs(da - Math.PI * 2);
      if (da < 1.1) this.damageEnemy(e, dmg);
    }
    // harvest
    for (const tr of this.trees) {
      if (tr.hp <= 0) continue;
      if (Math.hypot(tr.x - p.x, tr.y - p.y) < range + 10) {
        tr.hp--;
        this.floatDmg(tr.x, tr.y - 20, "-1");
        if (tr.hp <= 0) {
          this.addItem("wood", 2 + ((Math.random() * 3) | 0));
          this.ui.toast("+ Timber");
        }
      }
    }
    for (const rk of this.rocks) {
      if (rk.hp <= 0) continue;
      if (Math.hypot(rk.x - p.x, rk.y - p.y) < range + 6) {
        rk.hp--;
        if (rk.hp <= 0) {
          this.addItem("ore", 1 + ((Math.random() * 2) | 0));
          this.ui.toast("+ Iron Ore");
        }
      }
    }
  }

  interact() {
    const p = this.player;
    for (const c of this.chests) {
      if (c.open) continue;
      if (Math.hypot(c.x - p.x, c.y - p.y) < 22) {
        c.open = true;
        const loot = [
          ["gel", 2],
          ["ore", 2],
          ["wood", 4],
          ["herb", 2],
          ["gold", 18],
        ];
        const L = loot[(Math.random() * loot.length) | 0];
        if (L[0] === "gold") {
          p.gold += L[1];
          this.ui.toast(`+${L[1]} gold`);
        } else {
          this.addItem(L[0], L[1]);
          this.ui.toast(`Chest: +${L[1]} ${ITEMS[L[0]].name}`);
        }
        return;
      }
    }
    this.addItem("herb", 1);
    this.ui.toast("+ Wild Herb");
  }

  useSkill(i) {
    const p = this.player;
    if (p.skillCd[i] > 0 || p.dead) return;
    if (i === 0) {
      p.skillCd[0] = 4;
      const w = this.weapon();
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - p.x, e.y - p.y) < w.range * TILE * 0.7 + 16)
          this.damageEnemy(e, Math.floor((w.dmg + p.baseDmg) * 1.85), true);
      }
      this.ui.toast("Power Strike!");
    } else if (i === 1) {
      if ((p.inv.herb || 0) < 1) return this.ui.toast("Need Wild Herb");
      p.inv.herb--;
      p.skillCd[1] = 6;
      const heal = 18 + p.level * 2;
      p.hp = Math.min(p.maxHp, p.hp + heal);
      this.floatDmg(p.x, p.y - 20, `+${heal}`, false, true);
      this.ui.toast("Herbal Remedy");
    } else if (i === 2) {
      p.skillCd[2] = 7;
      p.stamina = Math.max(0, p.stamina - 12);
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - p.x, e.y - p.y) < 42)
          this.damageEnemy(e, 8 + p.baseDmg + Math.floor(this.weapon().dmg * 0.4));
      }
      this.ui.toast("Whirlwind!");
    } else if (i === 3) {
      p.skillCd[3] = 5;
      p.stamina = Math.min(p.maxStamina, p.stamina + 30);
      p.invuln = 0.15;
      this.ui.toast("Second Wind");
    }
    this.ui.sync();
  }

  damageEnemy(e, dmg, forceCrit = false) {
    if (e.dead) return;
    let crit = forceCrit;
    if (!crit && Math.random() < 0.12) {
      dmg = Math.floor(dmg * 1.5);
      crit = true;
    }
    e.hp -= dmg;
    e.hurtT = 0.15;
    this.floatDmg(e.x, e.y - 12, String(dmg), crit);
    // knockback
    const p = this.player;
    const dx = e.x - p.x,
      dy = e.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    e.x += (dx / d) * 8;
    e.y += (dy / d) * 8;
    // particles
    for (let i = 0; i < 4; i++) {
      this.particles.push({
        x: e.x,
        y: e.y - 6,
        vx: (Math.random() - 0.5) * 60,
        vy: -20 - Math.random() * 40,
        life: 0.35,
        color: "#5ef0c0",
      });
    }
    if (e.hp <= 0) {
      e.dead = true;
      this.grantXp(e.xp);
      p.gold += 1 + ((Math.random() * 4) | 0);
      this.drop(e.x, e.y, "gel", 1 + ((Math.random() * 2) | 0));
      if (Math.random() < 0.25) this.drop(e.x, e.y, "herb", 1);
      if (Math.random() < 0.15) this.drop(e.x, e.y, "ore", 1);
      setTimeout(() => {
        const rng = Math.random;
        let x, y;
        for (let t = 0; t < 30; t++) {
          x = 24 + rng() * (MAP_W * TILE - 48);
          y = 24 + rng() * (MAP_H * TILE - 48);
          if (!this.blocked(x, y, 6) && Math.hypot(x - this.player.x, y - this.player.y) > 120) break;
        }
        const idx = this.enemies.indexOf(e);
        if (idx >= 0) this.enemies[idx] = this._makeSlime(x, y, Math.random() < 0.18 ? 2 : 1);
      }, 350);
    }
  }

  grantXp(amount) {
    const p = this.player;
    p.xp += amount;
    let up = false;
    while (p.xp >= xpFor(p.level)) {
      p.xp -= xpFor(p.level);
      p.level++;
      applyLevel(p);
      p.hp = p.maxHp;
      p.stamina = p.maxStamina;
      up = true;
    }
    if (up) {
      this.ui.showLevel(p.level);
      this.ui.toast(`Level ${p.level}!`);
    }
  }

  addItem(id, n) {
    this.player.inv[id] = (this.player.inv[id] || 0) + n;
  }

  drop(x, y, id, n) {
    this.drops.push({ x, y, id, n, t: 0, sortY: y });
  }

  _updateDrops(dt) {
    const p = this.player;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.t += dt;
      d.y += Math.sin(this.t * 6 + d.x) * 0.05;
      if (Math.hypot(d.x - p.x, d.y - p.y) < 14) {
        this.addItem(d.id, d.n);
        this.ui.toast(`+${d.n} ${ITEMS[d.id].name}`);
        this.drops.splice(i, 1);
      } else if (d.t > 35) this.drops.splice(i, 1);
    }
  }

  _updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.life -= dt;
      if (pr.life <= 0 || this.tileAt(pr.x, pr.y) === 3) {
        this.projectiles.splice(i, 1);
        continue;
      }
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - pr.x, e.y - pr.y) < 10) {
          this.damageEnemy(e, pr.dmg);
          this.projectiles.splice(i, 1);
          break;
        }
      }
    }
  }

  _updateFx(dt) {
    for (let i = this.slashFx.length - 1; i >= 0; i--) {
      const s = this.slashFx[i];
      s.t += dt;
      s.frame = Math.min(2, (s.t * 12) | 0);
      if (s.t > 0.22) this.slashFx.splice(i, 1);
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 80 * dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  _updateEnemies(dt) {
    const p = this.player;
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.hurtT = Math.max(0, e.hurtT - dt);
      e.atkCd = Math.max(0, e.atkCd - dt);
      e.frameT = (e.frameT || 0) + dt;
      if (e.frameT > 0.2) {
        e.frameT = 0;
        e.frame = (e.frame + 1) % 4;
      }
      e.sortY = e.y;
      const dx = p.x - e.x,
        dy = p.y - e.y;
      const dist = Math.hypot(dx, dy);
      if (dist < e.aggro && dist > 12) {
        const sp = e.speed * dt;
        this._move(e, (dx / dist) * sp, (dy / dist) * sp, 5);
      }
      if (dist < 14 && e.atkCd <= 0 && p.evadeT <= 0) {
        e.atkCd = 1.0;
        let dmg = e.dmg;
        if (p.shield) {
          dmg = Math.floor(dmg * 0.28);
          p.stamina = Math.max(0, p.stamina - 8);
          this.floatDmg(p.x, p.y - 18, "block");
        }
        if (p.invuln <= 0) {
          p.hp -= dmg;
          p.invuln = 0.35;
          this.floatDmg(p.x, p.y - 16, String(dmg));
          if (p.hp <= 0) {
            p.hp = 0;
            p.dead = true;
            this.ui.showDeath();
          }
        }
      }
    }
  }

  floatDmg(x, y, text, crit = false, heal = false) {
    const sx = x - this.cam.x;
    const sy = y - this.cam.y;
    // scale to screen CSS pixels approximately
    const rect = this.canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / VIEW_W, rect.height / VIEW_H);
    const ox = rect.left + (rect.width - VIEW_W * scale) / 2;
    const oy = rect.top + (rect.height - VIEW_H * scale) / 2;
    this.ui.dmg(ox + sx * scale, oy + sy * scale, text, crit, heal);
  }

  craft(id) {
    const r = RECIPES.find((x) => x.id === id);
    if (!r) return;
    if (doCraft(this.player.inv, r)) {
      this.ui.toast(`Crafted ${ITEMS[r.result].name}`);
      if (ITEMS[r.result].weapon) this.player.equipped = r.result;
      this.ui.renderCraft();
      this.ui.renderInv();
      this.ui.sync();
    } else this.ui.toast("Missing materials");
  }

  equip(id) {
    if (!ITEMS[id]?.weapon || (this.player.inv[id] || 0) < 1) return;
    this.player.equipped = id;
    this.ui.toast(`Equipped ${ITEMS[id].name}`);
    this.ui.renderInv();
    this.ui.sync();
  }

  respawn() {
    const p = this.player;
    p.dead = false;
    p.x = this.spawnTX * TILE + 8;
    p.y = this.spawnTY * TILE + 8;
    p.hp = p.maxHp;
    p.stamina = p.maxStamina;
    p.invuln = 1.2;
    this.ui.hideDeath();
    this.ui.toast("Returned to camp");
  }

  _drawMinimap() {
    const mm = document.getElementById("minimap");
    if (!mm) return;
    const m = mm.getContext("2d");
    const W = mm.width,
      H = mm.height;
    m.imageSmoothingEnabled = false;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const tx = ((x / W) * MAP_W) | 0;
        const ty = ((y / H) * MAP_H) | 0;
        const t = this.map[ty * MAP_W + tx];
        m.fillStyle = t === 3 ? "#3a80c0" : t === 1 ? "#c0a060" : t === 2 ? "#8a6a40" : "#3f8a4a";
        m.fillRect(x, y, 1, 1);
      }
    }
    m.fillStyle = "#1e5030";
    for (const tr of this.trees) {
      if (tr.hp <= 0) continue;
      m.fillRect(((tr.x / (MAP_W * TILE)) * W) | 0, ((tr.y / (MAP_H * TILE)) * H) | 0, 1, 1);
    }
    m.fillStyle = "#60f0b0";
    for (const e of this.enemies) {
      if (e.dead) continue;
      m.fillRect(((e.x / (MAP_W * TILE)) * W) | 0, ((e.y / (MAP_H * TILE)) * H) | 0, 2, 2);
    }
    const px = ((this.player.x / (MAP_W * TILE)) * W) | 0;
    const py = ((this.player.y / (MAP_H * TILE)) * H) | 0;
    m.fillStyle = "#fff";
    m.fillRect(px - 1, py - 1, 3, 3);
    m.fillStyle = "#f0c84a";
    m.fillRect(px, py, 1, 1);
  }

  render() {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);

    // sky/void border color
    ctx.fillStyle = "#1a2820";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    ctx.save();
    ctx.translate(-Math.floor(this.cam.x), -Math.floor(this.cam.y));

    // tiles in view
    const x0 = Math.max(0, (this.cam.x / TILE) | 0);
    const y0 = Math.max(0, (this.cam.y / TILE) | 0);
    const x1 = Math.min(MAP_W - 1, ((this.cam.x + VIEW_W) / TILE) | 0);
    const y1 = Math.min(MAP_H - 1, ((this.cam.y + VIEW_H) / TILE) | 0);
    const wf = (this.t * 4) | 0;

    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const t = this.map[ty * MAP_W + tx];
        const v = this.varMap[ty * MAP_W + tx];
        let key;
        if (t === 3) key = `world/water_${wf % 4}`;
        else if (t === 1) key = `world/path_${v}`;
        else if (t === 2) key = `world/path_${(v + 1) % 4}`;
        else key = `world/grass_${v}`;
        const im = img(key);
        if (im) ctx.drawImage(im, tx * TILE, ty * TILE);
      }
    }

    // depth-sorted draw list for 2.5D
    const list = [];

    for (const tr of this.trees) {
      if (tr.hp <= 0) continue;
      list.push({ sortY: tr.y + 22, draw: () => {
        const im = img(`world/tree_${tr.v}`);
        if (im) ctx.drawImage(im, tr.x - 24, tr.y - 52);
      }});
    }
    for (const rk of this.rocks) {
      if (rk.hp <= 0) continue;
      list.push({ sortY: rk.y + 4, draw: () => {
        const im = img(`world/rock_${rk.v}`);
        if (im) ctx.drawImage(im, rk.x - 12, rk.y - 14);
      }});
    }
    for (const to of this.torches) {
      list.push({ sortY: to.y + 8, draw: () => {
        const im = img(`world/torch_${((this.t * 8) | 0) % 4}`);
        if (im) ctx.drawImage(im, to.x - 8, to.y - 28);
      }});
    }
    for (const c of this.chests) {
      list.push({ sortY: c.y + 6, draw: () => {
        const im = img(c.open ? "world/chest_open" : "world/chest");
        if (im) ctx.drawImage(im, c.x - 12, c.y - 14);
      }});
    }
    // camp
    list.push({ sortY: this.camp.y + 6, draw: () => {
      const im = img(`world/camp_${((this.t * 6) | 0) % 4}`);
      if (im) ctx.drawImage(im, this.camp.x - 16, this.camp.y - 20);
    }});

    // drops
    for (const d of this.drops) {
      list.push({ sortY: d.y, draw: () => {
        const im = img(`items/${d.id}`);
        if (im) {
          const bob = Math.sin(this.t * 5 + d.x) * 2;
          ctx.drawImage(im, d.x - 8, d.y - 8 + bob);
        }
      }});
    }

    // enemies
    for (const e of this.enemies) {
      if (e.dead) continue;
      list.push({ sortY: e.y + 4, draw: () => {
        const im = img(`enemy/slime_t${e.tier}_${e.frame}`);
        if (!im) return;
        if (e.hurtT > 0) {
          ctx.globalAlpha = 0.7;
          ctx.filter = "brightness(2)";
        }
        ctx.drawImage(im, e.x - 14, e.y - 18);
        ctx.filter = "none";
        ctx.globalAlpha = 1;
        // hp bar
        const ratio = Math.max(0, e.hp / e.maxHp);
        ctx.fillStyle = "#1a1010";
        ctx.fillRect(e.x - 10, e.y - 24, 20, 3);
        ctx.fillStyle = ratio > 0.5 ? "#50d070" : ratio > 0.25 ? "#e0a040" : "#e05050";
        ctx.fillRect(e.x - 10, e.y - 24, 20 * ratio, 3);
      }});
    }

    // player
    const p = this.player;
    list.push({ sortY: p.y + 4, draw: () => {
      if (p.invuln > 0 && Math.floor(this.t * 16) % 2 === 0) return;
      const im = img(`player/p_${p.dir}_${p.frame}`);
      if (im) ctx.drawImage(im, p.x - 16, p.y - 32);
      if (p.shield) {
        ctx.strokeStyle = "rgba(120,180,255,0.55)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y - 12, 14, 0, Math.PI * 2);
        ctx.stroke();
      }
    }});

    // slash fx
    for (const s of this.slashFx) {
      list.push({ sortY: s.y + 20, draw: () => {
        const im = img(`fx/slash_${s.frame}`);
        if (!im) return;
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.ang);
        ctx.globalAlpha = 0.9;
        ctx.drawImage(im, -16, -16);
        ctx.restore();
      }});
    }

    list.sort((a, b) => a.sortY - b.sortY);
    for (const o of list) o.draw();

    // projectiles
    ctx.fillStyle = "#ffe080";
    for (const pr of this.projectiles) {
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // particles
    for (const pt of this.particles) {
      ctx.globalAlpha = Math.max(0, pt.life * 2);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x | 0, pt.y | 0, 2, 2);
    }
    ctx.globalAlpha = 1;

    // cursor
    ctx.strokeStyle = "rgba(100,220,160,0.8)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(this.mouse.wx, this.mouse.wy, 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(this.mouse.wx - 7, this.mouse.wy);
    ctx.lineTo(this.mouse.wx + 7, this.mouse.wy);
    ctx.moveTo(this.mouse.wx, this.mouse.wy - 7);
    ctx.lineTo(this.mouse.wx, this.mouse.wy + 7);
    ctx.stroke();

    ctx.restore();

    // vignette
    const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.3, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.75);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}
