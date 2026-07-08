import { img } from "./assets.js";
import { ITEMS, RECIPES, canCraft, craft, xpToLevel, applyLevelStats } from "./crafting.js";

const TILE = 16;
const SCALE = 3; // draw scale for pixels
const VIEW_W = 1280;
const VIEW_H = 720;
const WORLD_W = 96; // tiles
const WORLD_H = 96;

// tile ids
const T = { GRASS: 0, DIRT: 1, PATH: 2, WATER: 3 };

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
    this.t = 0;
    this.keys = {};
    this.mouse = { x: 0, y: 0, down: false, worldX: 0, worldY: 0 };
    this.cam = { x: 0, y: 0 };
    this.floating = [];
    this.projectiles = [];
    this.particles = [];
    this.drops = [];
    this.running = false;
    this.paused = false;

    this.rng = mulberry32(0x414e4153); // ANAS
    this.genWorld();
    this.resetPlayer();
    this.spawnSlimes(28);
    this.placeProps();

    this._bindInput();
  }

  resetPlayer() {
    const spawn = this.spawnPoint;
    this.player = {
      x: spawn.x,
      y: spawn.y,
      vx: 0,
      vy: 0,
      dir: "down",
      frame: 0,
      frameT: 0,
      speed: 95,
      level: 1,
      xp: 0,
      hp: 50,
      maxHp: 50,
      stamina: 100,
      maxStamina: 100,
      baseDmg: 2,
      inv: { wood: 3, gel: 1, ore: 1, herb: 1, dagger: 1 },
      gold: 0,
      equipped: "dagger",
      attackT: 0,
      attackCd: 0,
      shield: false,
      evadeT: 0,
      evadeCd: 0,
      invuln: 0,
      dead: false,
      skillCd: [0, 0, 0, 0],
    };
    applyLevelStats(this.player);
    this.player.hp = this.player.maxHp;
    this.player.stamina = this.player.maxStamina;
  }

  genWorld() {
    const w = WORLD_W;
    const h = WORLD_H;
    this.map = new Uint8Array(w * h);
    this.grassVar = new Uint8Array(w * h);
    const rng = this.rng;

    // base noise-ish grass
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        this.map[i] = T.GRASS;
        this.grassVar[i] = (x * 3 + y * 7) & 3;
      }
    }

    // winding path from camp
    let px = 12;
    let py = h >> 1;
    this.spawnPoint = { x: (px + 2) * TILE + 8, y: py * TILE + 8 };
    for (let step = 0; step < 220; step++) {
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const tx = px + ox;
          const ty = py + oy;
          if (tx >= 0 && ty >= 0 && tx < w && ty < h) {
            this.map[ty * w + tx] = Math.abs(ox) + Math.abs(oy) === 0 ? T.PATH : T.DIRT;
          }
        }
      }
      const r = rng();
      if (r < 0.55) px++;
      else if (r < 0.72) py++;
      else if (r < 0.89) py--;
      else px++;
      px = Math.max(2, Math.min(w - 3, px));
      py = Math.max(2, Math.min(h - 3, py));
    }

    // ponds
    for (let n = 0; n < 7; n++) {
      const cx = 10 + Math.floor(rng() * (w - 20));
      const cy = 10 + Math.floor(rng() * (h - 20));
      const rr = 4 + Math.floor(rng() * 5);
      for (let y = cy - rr; y <= cy + rr; y++) {
        for (let x = cx - rr; x <= cx + rr; x++) {
          if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
          const d = (x - cx) ** 2 + (y - cy) ** 2;
          if (d <= rr * rr) {
            if (this.map[y * w + x] !== T.PATH) this.map[y * w + x] = T.WATER;
          }
        }
      }
    }

    // camp clearing
    for (let y = (h >> 1) - 3; y <= (h >> 1) + 3; y++) {
      for (let x = 10; x <= 18; x++) {
        if (this.map[y * w + x] !== T.WATER) this.map[y * w + x] = T.PATH;
      }
    }
  }

  placeProps() {
    this.trees = [];
    this.torches = [];
    this.rocks = [];
    this.chests = [];
    const rng = this.rng;
    const w = WORLD_W;
    const h = WORLD_H;

    for (let y = 2; y < h - 2; y++) {
      for (let x = 2; x < w - 2; x++) {
        const t = this.map[y * w + x];
        if (t === T.WATER || t === T.PATH) continue;
        const r = rng();
        if (r < 0.07) {
          this.trees.push({
            x: x * TILE + 8,
            y: y * TILE + 8,
            v: Math.floor(rng() * 3),
            hp: 3,
          });
        } else if (r < 0.085) {
          this.rocks.push({ x: x * TILE + 8, y: y * TILE + 8, hp: 2 });
        }
      }
    }

    // path torches
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (this.map[y * w + x] === T.PATH && rng() < 0.04) {
          this.torches.push({ x: x * TILE + 8, y: y * TILE + 4 });
        }
      }
    }

    // a few chests off path
    for (let i = 0; i < 6; i++) {
      let placed = false;
      for (let tries = 0; tries < 40 && !placed; tries++) {
        const x = 5 + Math.floor(rng() * (w - 10));
        const y = 5 + Math.floor(rng() * (h - 10));
        if (this.map[y * w + x] === T.GRASS) {
          this.chests.push({
            x: x * TILE + 8,
            y: y * TILE + 8,
            open: false,
          });
          placed = true;
        }
      }
    }
  }

  spawnSlimes(n) {
    this.enemies = [];
    const rng = this.rng;
    for (let i = 0; i < n; i++) {
      let x, y, ok = false;
      for (let t = 0; t < 50 && !ok; t++) {
        x = 20 + rng() * (WORLD_W * TILE - 40);
        y = 20 + rng() * (WORLD_H * TILE - 40);
        if (!this.blocked(x, y, 6) && Math.hypot(x - this.spawnPoint.x, y - this.spawnPoint.y) > 120) {
          ok = true;
        }
      }
      if (!ok) continue;
      const tier = rng() < 0.15 ? 2 : 1;
      this.enemies.push(this._makeSlime(x, y, tier));
    }
  }

  _makeSlime(x, y, tier = 1) {
    return {
      type: "slime",
      name: tier > 1 ? "Alpha Slime" : "Slime",
      x,
      y,
      hp: 18 * tier,
      maxHp: 18 * tier,
      dmg: 4 * tier,
      speed: 28 + tier * 6,
      frame: 0,
      frameT: 0,
      hurtT: 0,
      atkCd: 0,
      aggro: 110 + tier * 20,
      xp: 12 * tier,
      tier,
      dead: false,
      deathT: 0,
    };
  }

  tileAt(px, py) {
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H) return T.WATER;
    return this.map[ty * WORLD_W + tx];
  }

  blocked(x, y, r = 5) {
    if (this.tileAt(x - r, y) === T.WATER) return true;
    if (this.tileAt(x + r, y) === T.WATER) return true;
    if (this.tileAt(x, y - r) === T.WATER) return true;
    if (this.tileAt(x, y + r) === T.WATER) return true;
    // tree trunks
    for (const tr of this.trees) {
      if (tr.hp <= 0) continue;
      if (Math.hypot(x - tr.x, y - (tr.y + 6)) < 7 + r * 0.3) return true;
    }
    for (const rk of this.rocks) {
      if (rk.hp <= 0) continue;
      if (Math.hypot(x - rk.x, y - rk.y) < 6 + r * 0.2) return true;
    }
    return false;
  }

  _bindInput() {
    window.addEventListener("keydown", (e) => {
      this.keys[e.code] = true;
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
      if (!this.running) return;
      if (e.code === "KeyI") this.ui.toggle("inv");
      if (e.code === "KeyC") this.ui.toggle("craft");
      if (e.code === "Escape") this.ui.closeAll();
      if (e.code === "Digit1") this.useSkill(0);
      if (e.code === "Digit2") this.useSkill(1);
      if (e.code === "Digit3") this.useSkill(2);
      if (e.code === "Digit4") this.useSkill(3);
    });
    window.addEventListener("keyup", (e) => {
      this.keys[e.code] = false;
    });

    const c = this.canvas;
    c.addEventListener("mousemove", (e) => this._mouse(e));
    c.addEventListener("mousedown", (e) => {
      this._mouse(e);
      if (e.button === 0) {
        this.mouse.down = true;
        this.tryAttack();
      }
    });
    c.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.mouse.down = false;
    });
    c.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  _mouse(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = this.canvas.width / rect.width;
    const sy = this.canvas.height / rect.height;
    this.mouse.x = (e.clientX - rect.left) * sx;
    this.mouse.y = (e.clientY - rect.top) * sy;
    this.mouse.worldX = this.mouse.x / SCALE + this.cam.x;
    this.mouse.worldY = this.mouse.y / SCALE + this.cam.y;
  }

  start() {
    this.running = true;
    this.last = performance.now();
    const loop = (now) => {
      if (!this.running) return;
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

    // shield
    p.shield = !!this.keys["ShiftLeft"] || !!this.keys["ShiftRight"];
    if (p.shield) {
      p.stamina = Math.max(0, p.stamina - 18 * dt);
      if (p.stamina <= 0) p.shield = false;
    } else {
      p.stamina = Math.min(p.maxStamina, p.stamina + 22 * dt);
    }

    // evade
    if ((this.keys["Space"] || this.keys["KeyE"]) && p.evadeCd <= 0 && p.stamina >= 20) {
      p.evadeT = 0.22;
      p.evadeCd = 0.9;
      p.stamina -= 20;
      p.invuln = 0.22;
      const ang = Math.atan2(
        this.mouse.worldY - p.y,
        this.mouse.worldX - p.x
      );
      p.vx = Math.cos(ang) * 220;
      p.vy = Math.sin(ang) * 220;
    }

    // move
    let mx = 0;
    let my = 0;
    if (this.keys["KeyW"] || this.keys["ArrowUp"]) my -= 1;
    if (this.keys["KeyS"] || this.keys["ArrowDown"]) my += 1;
    if (this.keys["KeyA"] || this.keys["ArrowLeft"]) mx -= 1;
    if (this.keys["KeyD"] || this.keys["ArrowRight"]) mx += 1;
    if (mx || my) {
      const len = Math.hypot(mx, my) || 1;
      mx /= len;
      my /= len;
      if (Math.abs(mx) > Math.abs(my)) p.dir = mx > 0 ? "right" : "left";
      else p.dir = my > 0 ? "down" : "up";
      if (p.evadeT <= 0) {
        const slow = p.shield ? 0.55 : 1;
        p.vx = mx * p.speed * slow;
        p.vy = my * p.speed * slow;
      }
      p.frameT += dt;
      if (p.frameT > 0.12) {
        p.frameT = 0;
        p.frame = (p.frame + 1) % 4;
      }
    } else if (p.evadeT <= 0) {
      p.vx *= 0.8;
      p.vy *= 0.8;
      if (Math.hypot(p.vx, p.vy) < 5) {
        p.vx = 0;
        p.vy = 0;
        p.frame = 0;
      }
    }

    this._moveEntity(p, p.vx * dt, p.vy * dt, 5);

    // hold attack
    if (this.mouse.down && p.attackCd <= 0) this.tryAttack();

    // interact chests / harvest nearby with F or auto when attack hits props
    if (this.keys["KeyF"]) this.tryInteract();

    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateDrops(dt);
    this.updateFloating(dt);

    // camera
    const halfW = VIEW_W / SCALE / 2;
    const halfH = VIEW_H / SCALE / 2;
    this.cam.x = Math.max(0, Math.min(WORLD_W * TILE - VIEW_W / SCALE, p.x - halfW));
    this.cam.y = Math.max(0, Math.min(WORLD_H * TILE - VIEW_H / SCALE, p.y - halfH));

    this.ui.sync(this);
  }

  _moveEntity(ent, dx, dy, r) {
    const nx = ent.x + dx;
    if (!this.blocked(nx, ent.y, r)) ent.x = nx;
    const ny = ent.y + dy;
    if (!this.blocked(ent.x, ny, r)) ent.y = ny;
    ent.x = Math.max(8, Math.min(WORLD_W * TILE - 8, ent.x));
    ent.y = Math.max(8, Math.min(WORLD_H * TILE - 8, ent.y));
  }

  tryAttack() {
    const p = this.player;
    if (p.attackCd > 0 || p.dead) return;
    const w = this.weapon();
    if (p.stamina < w.staminaCost * 0.5) {
      this.ui.toast("Not enough stamina");
      return;
    }
    p.stamina = Math.max(0, p.stamina - w.staminaCost);
    p.attackT = 0.18;
    p.attackCd = w.speed;

    // face mouse
    const ang = Math.atan2(this.mouse.worldY - p.y, this.mouse.worldX - p.x);
    if (Math.abs(Math.cos(ang)) > Math.abs(Math.sin(ang))) p.dir = Math.cos(ang) > 0 ? "right" : "left";
    else p.dir = Math.sin(ang) > 0 ? "down" : "up";

    const dmg = w.dmg + p.baseDmg;

    if (w.ranged) {
      this.projectiles.push({
        x: p.x,
        y: p.y - 4,
        vx: Math.cos(ang) * 220,
        vy: Math.sin(ang) * 220,
        life: 0.9,
        dmg,
        from: "player",
      });
      return;
    }

    // melee arc
    let hit = false;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist > w.range + 8) continue;
      const a = Math.atan2(dy, dx);
      let da = Math.abs(a - ang);
      while (da > Math.PI) da = Math.abs(da - Math.PI * 2);
      if (da < 1.1) {
        this.damageEnemy(e, dmg);
        hit = true;
      }
    }

    // chop trees / rocks in front
    for (const tr of this.trees) {
      if (tr.hp <= 0) continue;
      if (Math.hypot(tr.x - p.x, tr.y + 6 - p.y) < w.range + 6) {
        tr.hp--;
        this.floatText(tr.x, tr.y, "-1", false);
        if (tr.hp <= 0) {
          this.addItem("wood", 2 + Math.floor(Math.random() * 3));
          this.ui.toast("+ Timber");
        }
        hit = true;
      }
    }
    for (const rk of this.rocks) {
      if (rk.hp <= 0) continue;
      if (Math.hypot(rk.x - p.x, rk.y - p.y) < w.range + 4) {
        rk.hp--;
        if (rk.hp <= 0) {
          this.addItem("ore", 1 + Math.floor(Math.random() * 2));
          this.ui.toast("+ Iron Ore");
        }
        hit = true;
      }
    }

    if (!hit) {
      // still swing fx
    }
  }

  tryInteract() {
    const p = this.player;
    for (const c of this.chests) {
      if (c.open) continue;
      if (Math.hypot(c.x - p.x, c.y - p.y) < 20) {
        c.open = true;
        const loot = [
          ["gel", 2],
          ["ore", 2],
          ["wood", 3],
          ["herb", 2],
          ["gold", 15],
        ];
        const L = loot[Math.floor(Math.random() * loot.length)];
        if (L[0] === "gold") {
          p.gold += L[1];
          this.ui.toast(`+${L[1]} gold`);
        } else {
          this.addItem(L[0], L[1]);
          this.ui.toast(`Chest: +${L[1]} ${ITEMS[L[0]].name}`);
        }
        this.floatText(c.x, c.y - 8, "Loot!", true);
        return;
      }
    }
    // herbs on grass near player sometimes
    if (Math.random() < 0.35) {
      this.addItem("herb", 1);
      this.ui.toast("+ Wild Herb");
    }
  }

  useSkill(i) {
    const p = this.player;
    if (p.skillCd[i] > 0 || p.dead) return;
    if (i === 0) {
      // Power Strike
      p.skillCd[0] = 4;
      const w = this.weapon();
      const old = w.dmg;
      // temporary boost via direct damage burst
      const ang = Math.atan2(this.mouse.worldY - p.y, this.mouse.worldX - p.x);
      p.attackT = 0.2;
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - p.x, e.y - p.y) < w.range + 16) {
          this.damageEnemy(e, Math.floor((w.dmg + p.baseDmg) * 1.8), true);
        }
      }
      this.ui.toast("Power Strike!");
    } else if (i === 1) {
      // Heal herbs
      if ((p.inv.herb || 0) < 1) {
        this.ui.toast("Need Wild Herb");
        return;
      }
      p.inv.herb--;
      p.skillCd[1] = 6;
      const heal = 18 + p.level * 2;
      p.hp = Math.min(p.maxHp, p.hp + heal);
      this.floatText(p.x, p.y - 12, `+${heal}`, false, true);
      this.ui.toast("Herbal Remedy");
    } else if (i === 2) {
      // Whirl
      p.skillCd[2] = 7;
      p.stamina = Math.max(0, p.stamina - 15);
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - p.x, e.y - p.y) < 48) {
          this.damageEnemy(e, 8 + p.baseDmg + Math.floor(this.weapon().dmg * 0.5));
        }
      }
      this.ui.toast("Whirlwind!");
    } else if (i === 3) {
      // Sprint burst
      p.skillCd[3] = 5;
      p.stamina = Math.min(p.maxStamina, p.stamina + 30);
      p.invuln = 0.15;
      this.ui.toast("Second Wind");
    }
    this.ui.sync(this);
  }

  damageEnemy(e, dmg, crit = false) {
    if (e.dead) return;
    if (Math.random() < 0.12) {
      dmg = Math.floor(dmg * 1.6);
      crit = true;
    }
    e.hp -= dmg;
    e.hurtT = 0.15;
    this.floatText(e.x, e.y - 6, String(dmg), crit);
    if (e.hp <= 0) {
      e.dead = true;
      e.deathT = 0.4;
      this.grantXp(e.xp);
      this.player.gold += 1 + Math.floor(Math.random() * 3);
      // drops
      this.drop(e.x, e.y, "gel", 1 + Math.floor(Math.random() * 2));
      if (Math.random() < 0.25) this.drop(e.x, e.y, "herb", 1);
      if (Math.random() < 0.15) this.drop(e.x, e.y, "ore", 1);
      // respawn later elsewhere
      setTimeout(() => {
        if (!this.running) return;
        const rng = Math.random;
        let x, y;
        for (let t = 0; t < 30; t++) {
          x = 20 + rng() * (WORLD_W * TILE - 40);
          y = 20 + rng() * (WORLD_H * TILE - 40);
          if (!this.blocked(x, y, 6) && Math.hypot(x - this.player.x, y - this.player.y) > 160) break;
        }
        const idx = this.enemies.indexOf(e);
        if (idx >= 0) this.enemies[idx] = this._makeSlime(x, y, Math.random() < 0.15 ? 2 : 1);
      }, 8000 + Math.random() * 6000);
    }
  }

  grantXp(amount) {
    const p = this.player;
    p.xp += amount;
    let leveled = false;
    while (p.xp >= xpToLevel(p.level)) {
      p.xp -= xpToLevel(p.level);
      p.level++;
      applyLevelStats(p);
      p.hp = p.maxHp;
      p.stamina = p.maxStamina;
      leveled = true;
    }
    if (leveled) {
      this.ui.showLevelUp(p.level);
      this.ui.toast(`Level ${p.level}!`);
    }
  }

  addItem(id, n) {
    const p = this.player;
    p.inv[id] = (p.inv[id] || 0) + n;
  }

  drop(x, y, id, n) {
    this.drops.push({
      x: x + (Math.random() - 0.5) * 10,
      y: y + (Math.random() - 0.5) * 10,
      id,
      n,
      t: 0,
    });
  }

  updateDrops(dt) {
    const p = this.player;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.t += dt;
      if (Math.hypot(d.x - p.x, d.y - p.y) < 14) {
        this.addItem(d.id, d.n);
        this.ui.toast(`+${d.n} ${ITEMS[d.id]?.name || d.id}`);
        this.drops.splice(i, 1);
      } else if (d.t > 30) this.drops.splice(i, 1);
    }
  }

  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.life -= dt;
      if (pr.life <= 0 || this.tileAt(pr.x, pr.y) === T.WATER) {
        this.projectiles.splice(i, 1);
        continue;
      }
      if (pr.from === "player") {
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
  }

  updateEnemies(dt) {
    const p = this.player;
    for (const e of this.enemies) {
      if (e.dead) {
        e.deathT -= dt;
        continue;
      }
      e.frameT = (e.frameT || 0) + dt;
      if (e.frameT > 0.15) {
        e.frameT = 0;
        e.frame = (e.frame + 1) % 4;
      }
      e.hurtT = Math.max(0, e.hurtT - dt);
      e.atkCd = Math.max(0, e.atkCd - dt);

      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const dist = Math.hypot(dx, dy);
      if (dist < e.aggro && dist > 1) {
        const sp = e.speed * dt;
        this._moveEntity(e, (dx / dist) * sp, (dy / dist) * sp, 5);
      }
      if (dist < 14 && e.atkCd <= 0 && p.evadeT <= 0) {
        e.atkCd = 1.1;
        let dmg = e.dmg;
        if (p.shield) {
          dmg = Math.floor(dmg * 0.25);
          p.stamina = Math.max(0, p.stamina - 12);
          this.floatText(p.x, p.y - 10, "block", false);
        }
        if (p.invuln <= 0) {
          p.hp -= dmg;
          p.invuln = 0.35;
          this.floatText(p.x, p.y - 8, String(dmg), false);
          if (p.hp <= 0) {
            p.hp = 0;
            p.dead = true;
            this.ui.showDeath();
          }
        }
      }
    }
  }

  updateFloating(dt) {
    for (let i = this.floating.length - 1; i >= 0; i--) {
      this.floating[i].t -= dt;
      if (this.floating[i].t <= 0) this.floating.splice(i, 1);
    }
  }

  floatText(x, y, text, crit = false, heal = false) {
    // screen-space toast numbers via UI layer
    this.ui.spawnDmg(this, x, y, text, crit, heal);
  }

  doCraft(recipeId) {
    const recipe = RECIPES.find((r) => r.id === recipeId);
    if (!recipe) return;
    if (craft(this.player.inv, recipe)) {
      this.ui.toast(`Crafted ${ITEMS[recipe.result].name}!`);
      // auto equip if weapon and better
      if (ITEMS[recipe.result].weapon) {
        this.player.equipped = recipe.result;
      }
      this.ui.sync(this);
      this.ui.renderCraft(this);
      this.ui.renderInv(this);
    } else {
      this.ui.toast("Missing materials");
    }
  }

  equip(id) {
    if (!ITEMS[id]?.weapon) return;
    if ((this.player.inv[id] || 0) < 1) return;
    this.player.equipped = id;
    this.ui.toast(`Equipped ${ITEMS[id].name}`);
    this.ui.sync(this);
    this.ui.renderInv(this);
  }

  respawn() {
    const p = this.player;
    p.dead = false;
    p.x = this.spawnPoint.x;
    p.y = this.spawnPoint.y;
    p.hp = p.maxHp;
    p.stamina = p.maxStamina;
    p.invuln = 1.5;
    this.ui.hideDeath();
    this.ui.toast("Returned to camp");
  }

  /* ---------- RENDER ---------- */
  render() {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);

    ctx.save();
    ctx.scale(SCALE, SCALE);
    ctx.translate(-Math.floor(this.cam.x), -Math.floor(this.cam.y));

    this.drawTiles();
    this.drawShadowsAndGroundProps();
    this.drawDrops();
    this.drawEntities();
    this.drawProjectiles();
    this.drawTargetCursor();

    ctx.restore();

    this.drawMinimap();
  }

  drawTiles() {
    const ctx = this.ctx;
    const x0 = Math.max(0, Math.floor(this.cam.x / TILE) - 1);
    const y0 = Math.max(0, Math.floor(this.cam.y / TILE) - 1);
    const x1 = Math.min(WORLD_W, Math.ceil((this.cam.x + VIEW_W / SCALE) / TILE) + 1);
    const y1 = Math.min(WORLD_H, Math.ceil((this.cam.y + VIEW_H / SCALE) / TILE) + 1);
    const wf = Math.floor(this.t * 4) % 4;

    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const t = this.map[y * WORLD_W + x];
        let key;
        if (t === T.GRASS) key = `tiles/grass_${this.grassVar[y * WORLD_W + x]}`;
        else if (t === T.DIRT) key = "tiles/dirt";
        else if (t === T.PATH) key = "tiles/path";
        else key = `tiles/water_${wf}`;
        const im = img(key);
        if (im) ctx.drawImage(im, x * TILE, y * TILE);
      }
    }
  }

  drawShadowsAndGroundProps() {
    const ctx = this.ctx;
    const sh = img("tiles/shadow");
    // rocks
    for (const rk of this.rocks) {
      if (rk.hp <= 0) continue;
      if (sh) ctx.drawImage(sh, rk.x - 8, rk.y - 2);
      const im = img("sprites/rock");
      if (im) ctx.drawImage(im, rk.x - 8, rk.y - 10);
    }
    // chests
    for (const c of this.chests) {
      const im = img(c.open ? "sprites/chest_open" : "sprites/chest");
      if (im) ctx.drawImage(im, c.x - 8, c.y - 10);
    }
    // torches
    const tf = Math.floor(this.t * 8) % 4;
    for (const to of this.torches) {
      const im = img(`sprites/torch_${tf}`);
      if (im) ctx.drawImage(im, to.x - 8, to.y - 18);
    }
  }

  drawDrops() {
    const ctx = this.ctx;
    for (const d of this.drops) {
      const bob = Math.sin(this.t * 6 + d.x) * 2;
      const im = img(ITEMS[d.id]?.icon);
      if (im) ctx.drawImage(im, d.x - 8, d.y - 8 + bob);
    }
  }

  drawEntities() {
    // depth sort: trees, enemies, player
    const list = [];
    for (const tr of this.trees) {
      if (tr.hp <= 0) continue;
      list.push({ y: tr.y + 16, draw: () => this.drawTree(tr) });
    }
    for (const e of this.enemies) {
      if (e.dead && e.deathT <= 0) continue;
      list.push({ y: e.y, draw: () => this.drawEnemy(e) });
    }
    list.push({ y: this.player.y, draw: () => this.drawPlayer() });
    list.sort((a, b) => a.y - b.y);
    for (const o of list) o.draw();
  }

  drawTree(tr) {
    const ctx = this.ctx;
    const im = img(`sprites/tree_${tr.v}`);
    if (im) ctx.drawImage(im, tr.x - 16, tr.y - 36);
  }

  drawEnemy(e) {
    const ctx = this.ctx;
    if (e.dead) {
      const f = Math.min(3, Math.floor((0.4 - e.deathT) / 0.1));
      const im = img(`sprites/puff_${f}`);
      if (im) ctx.drawImage(im, e.x - 8, e.y - 10);
      return;
    }
    const key = e.hurtT > 0 ? "sprites/slime_hurt" : `sprites/slime_${e.frame % 4}`;
    const im = img(key);
    if (im) {
      const s = e.tier > 1 ? 1.25 : 1;
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.scale(s, s);
      ctx.drawImage(im, -8, -12);
      ctx.restore();
    }
    // hp bar
    if (e.hp < e.maxHp) {
      const bw = 16;
      ctx.fillStyle = "#1a1010";
      ctx.fillRect(e.x - bw / 2, e.y - 16, bw, 3);
      ctx.fillStyle = "#e05050";
      ctx.fillRect(e.x - bw / 2, e.y - 16, bw * (e.hp / e.maxHp), 3);
    }
  }

  drawPlayer() {
    const p = this.player;
    const ctx = this.ctx;
    const sh = img("tiles/shadow");
    if (sh) ctx.drawImage(sh, p.x - 8, p.y - 2);
    let key;
    if (p.attackT > 0) key = `sprites/player_${p.dir}_atk`;
    else key = `sprites/player_${p.dir}_${p.frame}`;
    const im = img(key);
    if (im) {
      if (p.invuln > 0 && Math.floor(this.t * 20) % 2 === 0) ctx.globalAlpha = 0.5;
      if (p.shield) {
        ctx.strokeStyle = "rgba(120,180,255,0.7)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y - 4, 12, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.drawImage(im, p.x - 8, p.y - 18);
      ctx.globalAlpha = 1;
    }
  }

  drawProjectiles() {
    const ctx = this.ctx;
    for (const pr of this.projectiles) {
      ctx.fillStyle = "#f0d060";
      ctx.fillRect(pr.x - 2, pr.y - 2, 4, 4);
      ctx.fillStyle = "#fff";
      ctx.fillRect(pr.x - 1, pr.y - 1, 2, 2);
    }
  }

  drawTargetCursor() {
    const ctx = this.ctx;
    const x = this.mouse.worldX;
    const y = this.mouse.worldY;
    ctx.strokeStyle = "rgba(90, 220, 160, 0.9)";
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.floor(x) - 4, Math.floor(y) - 4, 8, 8);
    ctx.beginPath();
    ctx.moveTo(x - 6, y);
    ctx.lineTo(x - 2, y);
    ctx.moveTo(x + 2, y);
    ctx.lineTo(x + 6, y);
    ctx.moveTo(x, y - 6);
    ctx.lineTo(x, y - 2);
    ctx.moveTo(x, y + 2);
    ctx.lineTo(x, y + 6);
    ctx.stroke();
  }

  drawMinimap() {
    const mm = document.getElementById("minimap");
    if (!mm) return;
    const m = mm.getContext("2d");
    const W = mm.width;
    const H = mm.height;
    m.imageSmoothingEnabled = false;
    m.fillStyle = "#152018";
    m.fillRect(0, 0, W, H);

    // sample tiles
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const tx = Math.floor((x / W) * WORLD_W);
        const ty = Math.floor((y / H) * WORLD_H);
        const t = this.map[ty * WORLD_W + tx];
        if (t === T.WATER) m.fillStyle = "#3070b0";
        else if (t === T.PATH) m.fillStyle = "#b09060";
        else if (t === T.DIRT) m.fillStyle = "#6a5030";
        else m.fillStyle = "#3a7040";
        m.fillRect(x, y, 1, 1);
      }
    }
    // enemies
    m.fillStyle = "#60f0b0";
    for (const e of this.enemies) {
      if (e.dead) continue;
      const ex = (e.x / (WORLD_W * TILE)) * W;
      const ey = (e.y / (WORLD_H * TILE)) * H;
      m.fillRect(ex - 1, ey - 1, 2, 2);
    }
    // player
    const px = (this.player.x / (WORLD_W * TILE)) * W;
    const py = (this.player.y / (WORLD_H * TILE)) * H;
    m.fillStyle = "#ffffff";
    m.fillRect(px - 2, py - 2, 4, 4);
    m.fillStyle = "#f0c440";
    m.fillRect(px - 1, py - 1, 2, 2);

    // view rect
    m.strokeStyle = "rgba(255,255,255,0.35)";
    const vw = ((VIEW_W / SCALE) / (WORLD_W * TILE)) * W;
    const vh = ((VIEW_H / SCALE) / (WORLD_H * TILE)) * H;
    const vx = (this.cam.x / (WORLD_W * TILE)) * W;
    const vy = (this.cam.y / (WORLD_H * TILE)) * H;
    m.strokeRect(vx, vy, vw, vh);
  }
}

export { ITEMS, RECIPES, canCraft };
