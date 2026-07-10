import { Game } from "./game.js";
import { img, MONSTERS } from "./assets.js";
import { ITEMS, RECIPES, canCraft, xpFor } from "./crafting.js";
import { view } from "./view.js";
import { CLASSES } from "./classes.js";

const T = 24, MAP_W = 110, MAP_H = 110;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const WEAPONS = {
  fist:   { name: "Fist",   dmg: 8,  range: 30, speed: 0.5,  cost: 4 },
  sword:  { name: "Sword",  dmg: 22, range: 42, speed: 0.42, cost: 8 },
  axe:    { name: "Axe",    dmg: 30, range: 38, speed: 0.62, cost: 12 },
  spear:  { name: "Spear",  dmg: 20, range: 62, speed: 0.5,  cost: 9 },
  dagger: { name: "Dagger", dmg: 14, range: 30, speed: 0.28, cost: 5 },
  bow:    { name: "Bow",    dmg: 18, range: 95, speed: 0.55, cost: 10, ranged: true },
  staff:  { name: "Staff",  dmg: 16, range: 90, speed: 0.5,  cost: 10, ranged: true },
  dragonblade:  { name: "Dragon Blade", dmg: 42, range: 52, speed: 0.42, cost: 10 },
  dragonbow:    { name: "Dragon Bow",   dmg: 34, range: 110, speed: 0.5, cost: 10, ranged: true },
  dragonstaff:  { name: "Dragon Staff", dmg: 36, range: 100, speed: 0.48, cost: 10, ranged: true },
};
Game.prototype.WEAPONS = WEAPONS;

Game.prototype.update = function (dt) {
  // hit-stop: freeze action briefly on big hits
  if (this.hitStop > 0) { this.hitStop -= dt; this.shake = Math.max(this.shake, 0); return; }
  this.t += dt;
  if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 60);
  // advance skill/impact fx
  for (const f of this.fx) f.t += dt;
  this.fx = this.fx.filter(f => f.t < f.dur);
  const p = this.player;
  this.time = (this.time + dt * 6) % 1440;

  // weather scheduler
  this.weatherT -= dt;
  if (this.weatherT <= 0) {
    const roll = Math.random();
    const snowBiome = this.tileAt(p.x, p.y) === 4;
    if (roll < 0.68) this.weather = "clear";
    else if (roll < 0.86) this.weather = snowBiome ? "snow" : "rain";
    else this.weather = "snow";
    this.weatherT = 35 + Math.random() * 40;
    if (this.weather !== "clear") this.ui.toast(this.weather === "rain" ? "It starts to rain…" : "Snow begins to fall…");
  }

  p.attackT = Math.max(0, p.attackT - dt);
  p.attackCd = Math.max(0, p.attackCd - dt);
  p.evadeT = Math.max(0, p.evadeT - dt);
  p.evadeCd = Math.max(0, p.evadeCd - dt);
  p.invuln = Math.max(0, p.invuln - dt);
  for (let i = 0; i < 4; i++) p.skillCd[i] = Math.max(0, p.skillCd[i] - dt);

  p.shield = !!(this.keys.ShiftLeft || this.keys.ShiftRight);
  if (p.shield && p.stamina > 0) { p.stamina = Math.max(0, p.stamina - 16 * dt); if (p.stamina <= 0) p.shield = false; }
  else p.stamina = Math.min(p.maxStamina, p.stamina + 20 * dt);

  if (this.keys.Space && p.evadeCd <= 0 && p.stamina >= 16) {
    p.evadeT = 0.16; p.evadeCd = 0.7; p.stamina -= 16; p.invuln = 0.18;
    const fx = p.dir === "left" ? -1 : p.dir === "right" ? 1 : 0;
    const fy = p.dir === "up" ? -1 : p.dir === "down" ? 1 : 0;
    p.vx = (fx || (p.vx > 0 ? 1 : -1)) * 300; p.vy = fy * 300;
    if (!fx && !fy) { p.vx = 0; p.vy = 300; }
  }

  // fishing freezes movement/combat; F reels (handled via interact)
  if (this.fishing) {
    this.updateFishing(dt);
    p.vx = 0; p.vy = 0; p.moving = false;
    // any movement input cancels the cast
    if (this.keys.KeyW || this.keys.KeyS || this.keys.KeyA || this.keys.KeyD || (this.stick && this.stick.active)) {
      this.fishing = null;
    }
  }

  let ix = 0, iy = 0;
  if (this.moveMode === "tap" && this.moveTarget) {
    const dx = this.moveTarget.x - p.x, dy = this.moveTarget.y - p.y, d = Math.hypot(dx, dy);
    if (d < 6) this.moveTarget = null; else { ix = dx / d; iy = dy / d; }
  } else {
    if (this.keys.KeyW || this.keys.ArrowUp) iy -= 1;
    if (this.keys.KeyS || this.keys.ArrowDown) iy += 1;
    if (this.keys.KeyA || this.keys.ArrowLeft) ix -= 1;
    if (this.keys.KeyD || this.keys.ArrowRight) ix += 1;
    if (this.stick.active) { ix += this.stick.x; iy += this.stick.y; }
    const l = Math.hypot(ix, iy); if (l > 1) { ix /= l; iy /= l; }
  }

  const maxSp = p.speed * (p.shield ? 0.5 : 1) * (p.attackT > 0 ? 0.4 : 1);
  if (p.evadeT <= 0) {
    if (Math.hypot(ix, iy) > 0.05) {
      p.vx += ix * p.accel * dt; p.vy += iy * p.accel * dt;
      const sp = Math.hypot(p.vx, p.vy);
      if (sp > maxSp) { p.vx = p.vx / sp * maxSp; p.vy = p.vy / sp * maxSp; }
      p.moving = true;
      if (Math.abs(ix) > Math.abs(iy)) p.dir = ix < 0 ? "left" : "right";
      else p.dir = iy < 0 ? "up" : "down";
      p.frameT += dt * (0.6 + sp / maxSp);
      if (p.frameT > 0.12) { p.frameT = 0; p.frame = (p.frame + 1) % 4; }
      p.dustT -= dt;
      if (p.dustT <= 0 && sp > 40) {
        p.dustT = 0.16;
        this.particles.push({ x: p.x + (Math.random() - 0.5) * 6, y: p.y + 2, vx: (Math.random() - 0.5) * 10, vy: -8 - Math.random() * 8, life: 0.3, color: "rgba(150,130,90,0.7)" });
        this.audio.sfx("step");
      }
    } else {
      const sp = Math.hypot(p.vx, p.vy);
      if (sp > 1) { const fr = Math.min(sp, p.friction * dt); p.vx -= p.vx / sp * fr; p.vy -= p.vy / sp * fr; }
      else { p.vx = 0; p.vy = 0; }
      p.moving = false;
      if (p.attackT <= 0) p.frame = Math.floor(this.t * 1.6) % 2;
    }
  } else { p.vx *= 0.9; p.vy *= 0.9; }

  if (this.mouse.down && p.attackCd <= 0) this.doAttack();

  this.moveEntity(p, p.vx * dt, p.vy * dt, 6);
  p.sortY = p.y;

  const tx = p.x - view.w / 2 + (p.moving ? p.vx * 0.06 : 0);
  const ty = p.y - view.h / 2 + (p.moving ? p.vy * 0.05 : 0);
  const cl = 1 - Math.exp(-8 * dt);
  this.cam.x = clamp(this.cam.x + (tx - this.cam.x) * cl, 0, MAP_W * T - view.w);
  this.cam.y = clamp(this.cam.y + (ty - this.cam.y) * cl, 0, MAP_H * T - view.h);

  // npc idle anim
  for (const n of this.npcs) {
    n.frameT += dt;
    if (n.frameT > 0.5) { n.frameT = 0; n.frame = (n.frame + 1) % 2; }
    n.sortY = n.y;
  }

  this.updateEnemies(dt);
  this.updateBoss(dt);
  this.updateProjectiles(dt);
  this.updatePlants(dt);
  this.updatePet(dt);
  this.updateInteract();
  // buff timer (War Cry etc.)
  if (p.buffT > 0) { p.buffT -= dt; if (p.buffT <= 0) { p.buffT = 0; p.buffMul = 1; } }

  for (const pa of this.particles) { pa.x += pa.vx * dt; pa.y += pa.vy * dt; pa.vy += 40 * dt; pa.life -= dt; }
  this.particles = this.particles.filter(pa => pa.life > 0);
  // ambient critters drift gently around home anchor
  if (this.critters) for (const c of this.critters) {
    c.a += (Math.random() - 0.5) * dt * 2;
    c.x += Math.cos(c.a) * c.spd; c.y += Math.sin(c.a) * c.spd;
    const dx = c.hx - c.x, dy = c.hy - c.y;
    if (Math.hypot(dx, dy) > 70) { c.a = Math.atan2(dy, dx); }
    c.ph += dt * 8;
  }
  this.updateWeather(dt);

  // chest open animation timer
  for (const c of this.chests) if (c.opened && c.openT < 1) c.openT = Math.min(1, c.openT + dt * 3);

  if (p.hp <= 0 && !this._dead) { this._dead = true; this.ui.showDeath(); this.paused = true; }
  this.ui.sync();
  this.updateClock();
};

Game.prototype.updateWeather = function (dt) {
  if (this.weather === "clear") { if (this.weatherP.length) this.weatherP.length = Math.max(0, this.weatherP.length - 4); return; }
  const target = this.weather === "rain" ? 160 : 110;
  while (this.weatherP.length < target) {
    this.weatherP.push({
      x: Math.random() * (view.w + 40) - 20, y: Math.random() * view.h,
      vy: this.weather === "rain" ? 340 + Math.random() * 120 : 40 + Math.random() * 30,
      vx: this.weather === "rain" ? -60 : Math.sin(Math.random() * 6) * 20,
      sway: Math.random() * 6,
    });
  }
  for (const d of this.weatherP) {
    d.y += d.vy * dt; d.x += d.vx * dt;
    if (this.weather === "snow") { d.sway += dt * 3; d.x += Math.sin(d.sway) * 0.4; }
    if (d.y > view.h) { d.y = -6; d.x = Math.random() * (view.w + 40) - 20; }
  }
};

Game.prototype.moveEntity = function (e, dx, dy, r) {
  const solid = (x, y) => this.tileAt(x, y) === 2;
  let nx = e.x + dx;
  if (!solid(nx + Math.sign(dx) * r, e.y)) e.x = clamp(nx, r, MAP_W * T - r); else e.vx = 0;
  let ny = e.y + dy;
  if (!solid(e.x, ny + Math.sign(dy) * r)) e.y = clamp(ny, r, MAP_H * T - r); else e.vy = 0;
};

Game.prototype.doAttack = function () {
  const p = this.player;
  const w = WEAPONS[p.equipped] || WEAPONS.fist;
  if (p.stamina < w.cost * 0.4) return;
  p.stamina = Math.max(0, p.stamina - w.cost);
  p.attackT = p.attackDur; p.attackCd = w.speed;
  this.audio.sfx("attack");
  const fx = p.dir === "left" ? -1 : p.dir === "right" ? 1 : 0;
  const fy = p.dir === "up" ? -1 : p.dir === "down" ? 1 : 0;
  p.vx += fx * 55; p.vy += fy * 55;
  const dmg = (w.dmg + p.level * 2) * (p.dmgMul || 1);
  // ranged weapons spawn a projectile instead of melee hitbox
  if (w.ranged) {
    const dvx = fx || 0, dvy = fy || 1;
    this.spawnProjectile(p.x, p.y - 14, dvx, dvy, p.equipped === "staff" ? "fire" : "arrow", Math.round(dmg), p.equipped === "bow");
    this.audio.sfx("attack"); return;
  }
  let anyHit = false;
  for (const e of this.enemies) {
    if (e.dead) continue;
    const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
    if (d > w.range + 12) continue;
    const dot = d > 0 ? (dx / d) * fx + (dy / d) * fy : 1;
    if ((fx || fy) && dot < 0.2) continue;
    const crit = Math.random() < 0.2;
    const hit = Math.round(dmg * (crit ? 1.8 : 1));
    e.hp -= hit; e.hurt = 0.2; e.angry = 6; e.state = "chase";
    e.x += (dx / d) * 8; e.y += (dy / d) * 8;
    this.spawnHit(e.x, e.y - e.h * 0.4);
    this.addFloater(e.x, e.y - e.h, hit, crit);
    this.audio.sfx(crit ? "crit" : "hit");
    this.shake = Math.max(this.shake, crit ? 6 : 3);
    if (crit) this.hitStop = 0.05;
    anyHit = true;
    if (e.hp <= 0) this.killEnemy(e);
  }
  // melee also hits the boss if in range & in facing direction
  if (this.boss && !this.boss.dead) {
    const b = this.boss;
    const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy);
    if (d < w.range + 34) {
      const dot = d > 0 ? (dx / d) * fx + (dy / d) * fy : 1;
      if (!(fx || fy) || dot > 0.1) { this.hurtBossDirect(Math.round(dmg * (Math.random() < 0.2 ? 1.8 : 1))); }
    }
  }
  // melee also hits harvestable plants in range
  for (const pl of this.plants) {
    if (pl.hp <= 0) continue;
    const dx = pl.x - p.x, dy = pl.y - p.y, d = Math.hypot(dx, dy);
    if (d > w.range + 14) continue;
    const dot = d > 0 ? (dx / d) * fx + (dy / d) * fy : 1;
    if ((fx || fy) && dot < 0.1) continue;
    pl.hp -= Math.max(1, Math.round(dmg));
    pl.shake = 0.2;
    this.spawnHit(pl.x, pl.y - 12);
    this.audio.sfx("hit");
    if (pl.hp <= 0) this.harvestPlant(pl);
  }
};

Game.prototype.killEnemy = function (e) {
  e.dead = true;
  const p = this.player;
  p.xp += e.xp; p.gold += e.gold;
  this.quests.killCount++;
  const drop = e.tier >= 2 ? "ore" : "gel";
  p.inv[drop] = (p.inv[drop] || 0) + 1 + (Math.random() < 0.5 ? 1 : 0);
  if (Math.random() < 0.4) p.inv.herb = (p.inv.herb || 0) + 1;
  for (let i = 0; i < 6; i++) this.particles.push({ x: e.x, y: e.y - e.h / 2, vx: (Math.random() - 0.5) * 40, vy: -20 - Math.random() * 30, life: 0.4, color: "rgba(120,220,150,0.8)" });
  this.fx.push({ kind: "pop", x: e.x, y: e.y - e.h / 2, t: 0, dur: 0.35 });
  this.shake = Math.max(this.shake, 4);
  this.audio.sfx("coin");
  while (p.xp >= xpFor(p.level)) { p.xp -= xpFor(p.level); p.level++; p.maxHp += 12; p.hp = p.maxHp; p.maxStamina += 8; p.stamina = p.maxStamina; this.ui.showLevel(p.level); this.audio.sfx("level"); this.fx.push({ kind: "levelring", x: p.x, y: p.y, t: 0, dur: 0.7 }); }
  setTimeout(() => { this.enemies = this.enemies.filter(x => x !== e); this.spawnEnemy(); }, 400);
};

Game.prototype.updateEnemies = function (dt) {
  const p = this.player;
  for (const e of this.enemies) {
    if (e.dead) continue;
    e.hurt = Math.max(0, e.hurt - dt);
    e.atkCd = Math.max(0, e.atkCd - dt);
    e.bob += dt * 4;
    e.angry = Math.max(0, e.angry - dt);
    if (e.frozen) { e.frozen -= dt; if (e.frozen < 0) e.frozen = 0; }
    // idle bounce frame
    e.frameT += dt; if (e.frameT > 0.28) { e.frameT = 0; e.frame = (e.frame + 1) % 4; }

    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy);
    const AGGRO = 78;          // small aggro radius — must get close
    const LEASH = 260;         // give up if player runs

    // state machine: passive wander unless provoked or player very close
    if (e.angry > 0 && d < LEASH) {
      e.state = "chase";
    } else if (d < AGGRO && e.angry <= 0 && Math.random() < 0.02) {
      // only *some* monsters notice you nearby, occasionally
      e.state = "chase"; e.angry = 3;
    } else if (e.state === "chase" && (d > LEASH || e.angry <= 0)) {
      e.state = "wander";
    }

    if (e.state === "chase" && !e.frozen) {
      const sp = e.speed * dt;
      this.moveEntity(e, (dx / d) * sp, (dy / d) * sp, 8);
      // attack only when adjacent
      if (d < 20 && e.atkCd <= 0) {
        e.atkCd = 1.4;
        this.damagePlayer(e.dmg);
      }
    } else {
      // gentle wander around home anchor
      e.wanderT -= dt;
      if (e.wanderT <= 0) {
        e.wanderT = 1.5 + Math.random() * 2.5;
        if (Math.random() < 0.5) { e.wdx = 0; e.wdy = 0; }        // pause
        else { const a = Math.random() * 7; e.wdx = Math.cos(a); e.wdy = Math.sin(a); }
      }
      // stay near home
      const hdx = e.hx - e.x, hdy = e.hy - e.y, hd = Math.hypot(hdx, hdy);
      if (hd > 90) { e.wdx = hdx / hd; e.wdy = hdy / hd; }
      if (e.wdx || e.wdy) { const sp = e.speed * 0.45 * dt; this.moveEntity(e, e.wdx * sp, e.wdy * sp, 8); }
    }
    e.sortY = e.y;
  }
};

Game.prototype.updatePet = function (dt) {
  if (!this.pet) return;
  const p = this.player, pt = this.pet;
  const dx = p.x - pt.x, dy = p.y - pt.y, d = Math.hypot(dx, dy);
  pt.bob = (pt.bob || 0) + dt * 5;
  if (d > 34) { const sp = 125 * dt; pt.x += (dx / d) * sp; pt.y += (dy / d) * sp; }
  pt.sortY = pt.y;
};

Game.prototype.updateInteract = function () {
  const p = this.player;
  let target = null, kind = null, label = "";
  for (const n of this.npcs) {
    if (Math.hypot(n.x - p.x, n.y - p.y) < 34) { target = n; kind = "npc"; label = `Talk to ${n.name}`; break; }
  }
  if (!target) {
    for (const c of this.chests) {
      if (c.opened) continue;
      if (Math.hypot(c.x - p.x, c.y - p.y) < 30) { target = c; kind = "chest"; label = c.pet ? "Open (?)" : "Open Chest"; break; }
    }
  }
  // water's edge -> fishing prompt (a water tile within reach in front/around)
  if (!target && !this.fishing) {
    const T = 24, MW = 110;
    const near = [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, 1], [1, -1], [-1, 1]];
    const ptx = (p.x / T) | 0, pty = (p.y / T) | 0;
    for (const [dx, dy] of near) {
      const tx = ptx + dx, ty = pty + dy;
      if (tx < 0 || ty < 0 || tx >= MW || ty >= 110) continue;
      if (this.map[ty * MW + tx] === 2) { target = { x: (tx + 0.5) * T, y: (ty + 0.5) * T }; kind = "fish"; label = "Cast Line"; break; }
    }
  }
  this._interactTarget = target; this._interactKind = kind;
  this.ui.setInteract(!!target || !!this.fishing, this.fishing ? (this.fishing.state === "bite" ? "REEL! (F)" : "Fishing…") : label);
  // mobile QoL: auto-open a chest you walk right on top of
  if (kind === "chest" && target && !target.opened && Math.hypot(target.x - p.x, target.y - p.y) < 18) {
    this.interact();
  }
};

// Fishing mini-game: cast -> wait (random) -> bite window -> reel (F) to catch.
Game.prototype.startFishing = function (spot) {
  const p = this.player;
  p.dir = spot.y < p.y ? "up" : spot.y > p.y ? "down" : (spot.x < p.x ? "left" : "right");
  this.fishing = { state: "cast", t: 0, wait: 1.2 + Math.random() * 2.8, spot, bobX: spot.x, bobY: spot.y };
  this.audio.sfx("ui");
  this.ui.toast("Line cast! Wait for a bite…");
};
Game.prototype.updateFishing = function (dt) {
  const f = this.fishing; if (!f) return;
  f.t += dt;
  if (f.state === "cast") {
    if (f.t >= f.wait) { f.state = "bite"; f.t = 0; f.window = 1.1; this.audio.sfx("quest"); this.ui.toast("A bite! Press F to reel!"); this.shake = Math.max(this.shake, 3); }
  } else if (f.state === "bite") {
    if (f.t >= f.window) { // missed
      this.fishing = null; this.ui.toast("The fish got away…"); this.audio.sfx("hurt");
    }
  }
};
Game.prototype.reelFish = function () {
  const f = this.fishing; if (!f) return;
  if (f.state === "bite") {
    // caught!
    this.fishing = null;
    this.quests.fishCount++;
    const p = this.player;
    // weighted fish table: common → uncommon → rare → legendary
    const FISH = [
      { name: "Minnow",      gold: 5,  weight: 30, rarity: "common" },
      { name: "Bass",        gold: 9,  weight: 24, rarity: "common" },
      { name: "Trout",       gold: 12, weight: 18, rarity: "common" },
      { name: "Carp",        gold: 10, weight: 16, rarity: "common" },
      { name: "Pike",        gold: 20, weight: 10, rarity: "uncommon" },
      { name: "Salmon",      gold: 26, weight: 8,  rarity: "uncommon" },
      { name: "Koi",         gold: 38, weight: 5,  rarity: "rare" },
      { name: "Catfish",     gold: 32, weight: 5,  rarity: "rare" },
      { name: "Crystal Eel", gold: 60, weight: 2,  rarity: "rare" },
      { name: "Golden Fish", gold: 80, weight: 1.2,rarity: "legendary" },
      { name: "River Spirit",gold: 120,weight: 0.4,rarity: "legendary" },
    ];
    let total = 0; for (const fi of FISH) total += fi.weight;
    let roll = Math.random() * total, fish = FISH[0];
    for (const fi of FISH) { roll -= fi.weight; if (roll <= 0) { fish = fi; break; } }
    const gold = fish.gold + ((Math.random() * 6) | 0);
    const rare = fish.rarity === "rare" || fish.rarity === "legendary";
    const legendary = fish.rarity === "legendary";
    p.gold += gold;
    p.inv.fish = (p.inv.fish || 0) + 1;
    if (legendary) p.inv.dragonscale = (p.inv.dragonscale || 0); // no scale, but flag rarity
    this.audio.sfx("level");
    const col = legendary ? "rgba(255,220,120,0.95)" : rare ? "rgba(240,200,140,0.9)" : "rgba(150,220,255,0.9)";
    for (let i = 0; i < (legendary ? 24 : 12); i++) this.particles.push({ x: f.bobX, y: f.bobY, vx: (Math.random() - 0.5) * 60, vy: -40 - Math.random() * 40, life: 0.7, color: col });
    this.ui.toast(`${legendary ? "✨ LEGENDARY! " : rare ? "⭐ " : ""}Caught a ${fish.name}! +${gold}g`);
    this.ui.sync && this.ui.sync();
  } else if (f.state === "cast") {
    this.fishing = null; this.ui.toast("Reeled in early.");
  }
};

Game.prototype.interact = function () {
  // fishing takes priority: reel if a line is out
  if (this.fishing) { this.reelFish(); return; }
  const t = this._interactTarget, kind = this._interactKind;
  if (!t) return;
  if (kind === "fish") { this.startFishing(t); return; }
  if (kind === "npc") { this.ui.showDialog(t, this); return; }
  if (kind === "chest" && !t.opened) {
    t.opened = true; t.openT = 0;
    this.quests.chestCount++;
    this.audio.sfx("chest");
    const p = this.player;
    for (let i = 0; i < 10; i++) this.particles.push({ x: t.x, y: t.y - 8, vx: (Math.random() - 0.5) * 50, vy: -30 - Math.random() * 40, life: 0.6, color: "rgba(255,220,120,0.9)" });
    if (t.pet) {
      this.ui.showPet(t.pet, () => {
        this.pet = { id: t.pet, x: p.x, y: p.y, bob: 0, sortY: p.y };
        const chip = document.getElementById("pet-chip"); if (chip) { chip.classList.remove("hidden"); chip.textContent = "Pet: " + t.pet; }
      });
    } else {
      const g = 5 + (Math.random() * 15 | 0); p.gold += g;
      const w = ["sword", "axe", "spear", "dagger", "bow"][Math.random() * 5 | 0];
      p.inv[w] = (p.inv[w] || 0) + 1;
      this.ui.toast(`Chest: +${g}g · ${ITEMS[w]?.name || w}!`);
    }
  }
};

Game.prototype.useSkill = function (i) {
  const p = this.player;
  if (p.skillCd[i] > 0) return;
  const cls = p.cls || "warrior";
  const dirVec = () => ({ fx: p.dir === "left" ? -1 : p.dir === "right" ? 1 : 0, fy: p.dir === "up" ? -1 : p.dir === "down" ? 1 : 0 });

  // resolve skill id from class loadout
  const CLS_SKILLS = {
    warrior: ["powerstrike", "whirlwind", "warcry", "dash"],
    mage:    ["fireball", "frostnova", "heal", "blink"],
    archer:  ["arrowshot", "multishot", "heal", "roll"],
  };
  const skillId = (CLS_SKILLS[cls] || CLS_SKILLS.warrior)[i];

  switch (skillId) {
    case "powerstrike": {
      p.skillCd[i] = 4; this.mouse.down = true; this.doAttack(); this.mouse.down = false;
      this.fx.push({ kind: "slashbig", x: p.x, y: p.y, dir: p.dir, t: 0, dur: 0.3 });
      this.shake = Math.max(this.shake, 5); this.ui.toast("Power Strike!"); break;
    }
    case "whirlwind": {
      p.skillCd[i] = 7; const w = WEAPONS[p.equipped] || WEAPONS.fist; p.attackT = p.attackDur;
      this.audio.sfx("whirl"); this.fx.push({ kind: "whirl", x: p.x, y: p.y, t: 0, dur: 0.4 }); this.shake = Math.max(this.shake, 7);
      for (const e of this.enemies) { if (e.dead) continue; const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < 70) { const hit = Math.round((w.dmg + p.level * 2) * 1.3 * (p.dmgMul || 1)); this.hurtEnemy(e, hit, true); } }
      this.hurtBoss(p.x, p.y, 70, Math.round(40 * (p.dmgMul || 1)));
      this.ui.toast("Whirlwind!"); break;
    }
    case "warcry": {
      p.skillCd[i] = 12; p.buffT = 6; p.buffMul = 1.6;
      this.audio.sfx("level"); this.fx.push({ kind: "levelring", x: p.x, y: p.y, t: 0, dur: 0.7 });
      this.ui.toast("War Cry! +60% dmg"); break;
    }
    case "fireball": {
      p.skillCd[i] = 3; const { fx, fy } = dirVec(); const dx = fx || 0, dy = fy || 1;
      this.spawnProjectile(p.x, p.y - 14, dx, dy, "fire", Math.round((26 + p.level * 3) * (p.dmgMul || 1)));
      this.audio.sfx("whirl"); this.ui.toast("Fireball!"); break;
    }
    case "frostnova": {
      p.skillCd[i] = 8; this.fx.push({ kind: "frost", x: p.x, y: p.y, t: 0, dur: 0.6 }); this.shake = Math.max(this.shake, 5); this.audio.sfx("crit");
      for (const e of this.enemies) { if (e.dead) continue; const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < 80) { this.hurtEnemy(e, Math.round((22 + p.level * 2) * (p.dmgMul || 1)), true); e.frozen = 2.2; } }
      this.hurtBoss(p.x, p.y, 80, Math.round(30 * (p.dmgMul || 1)));
      this.ui.toast("Frost Nova!"); break;
    }
    case "arrowshot": {
      p.skillCd[i] = 3; const { fx, fy } = dirVec(); const dx = fx || 0, dy = fy || 1;
      this.spawnProjectile(p.x, p.y - 14, dx, dy, "arrow", Math.round((24 + p.level * 3) * (p.dmgMul || 1)), true);
      this.audio.sfx("attack"); this.ui.toast("Power Shot!"); break;
    }
    case "multishot": {
      p.skillCd[i] = 7; const { fx, fy } = dirVec(); let dx = fx || 0, dy = fy || 1;
      const base = Math.atan2(dy, dx);
      for (const off of [-0.28, 0, 0.28]) { this.spawnProjectile(p.x, p.y - 14, Math.cos(base + off), Math.sin(base + off), "arrow", Math.round((16 + p.level * 2) * (p.dmgMul || 1))); }
      this.audio.sfx("attack"); this.ui.toast("Multishot!"); break;
    }
    case "heal": {
      if ((p.inv.herb || 0) > 0) { p.inv.herb--; p.hp = Math.min(p.maxHp, p.hp + 30); p.skillCd[i] = 6; this.addFloater(p.x, p.y - 36, 30, false, false, true); this.audio.sfx("heal"); this.fx.push({ kind: "heal", x: p.x, y: p.y, t: 0, dur: 0.8 }); this.ui.toast("Healed +30"); }
      else this.ui.toast("No herbs"); break;
    }
    case "blink": {
      p.skillCd[i] = 6; const { fx, fy } = dirVec(); const dx = fx || 0, dy = fy || 1;
      p.x = clamp(p.x + dx * 90, 8, 110 * 24 - 8); p.y = clamp(p.y + dy * 90, 8, 110 * 24 - 8);
      p.invuln = 0.3; this.fx.push({ kind: "frost", x: p.x, y: p.y, t: 0, dur: 0.4 }); this.audio.sfx("dash"); this.ui.toast("Blink!"); break;
    }
    case "dash":
    case "roll": {
      if (p.stamina >= 16) { p.evadeT = 0.16; p.evadeCd = 0.4; p.stamina -= 16; p.invuln = 0.25; p.skillCd[i] = skillId === "roll" ? 4 : 5; this.audio.sfx("dash"); this.fx.push({ kind: "dashline", x: p.x, y: p.y, dir: p.dir, t: 0, dur: 0.25 }); const { fx, fy } = dirVec(); p.vx = fx * 340; p.vy = fy * 340; if (!fx && !fy) p.vy = 340; } break;
    }
  }
};

// ---- Projectiles (fireballs, arrows, boss fire) ----
Game.prototype.spawnProjectile = function (x, y, dx, dy, kind, dmg, pierce) {
  const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
  this.projectiles = this.projectiles || [];
  const speed = kind === "arrow" ? 280 : kind === "bossfire" ? 150 : 200;
  this.projectiles.push({ x, y, dx, dy, kind, dmg, pierce: !!pierce, life: 1.4, hostile: kind === "bossfire", hits: [] });
};
Game.prototype.updateProjectiles = function (dt) {
  if (!this.projectiles) return;
  const p = this.player;
  for (const pr of this.projectiles) {
    pr.x += pr.dx * (pr.kind === "arrow" ? 280 : pr.kind === "bossfire" ? 150 : 200) * dt;
    pr.y += pr.dy * (pr.kind === "arrow" ? 280 : pr.kind === "bossfire" ? 150 : 200) * dt;
    pr.life -= dt;
    if (pr.kind === "fire" || pr.kind === "bossfire") this.particles.push({ x: pr.x, y: pr.y, vx: 0, vy: 0, life: 0.3, color: pr.kind === "bossfire" ? "rgba(255,120,40,0.8)" : "rgba(255,160,60,0.8)" });
    if (pr.hostile) {
      // hits player
      if (p.invuln <= 0 && Math.hypot(pr.x - p.x, pr.y - (p.y - 14)) < 16) { this.damagePlayer(pr.dmg); pr.life = 0; }
    } else {
      for (const e of this.enemies) { if (e.dead || pr.hits.includes(e)) continue; if (Math.hypot(pr.x - e.x, pr.y - (e.y - e.h * 0.4)) < 18) { this.hurtEnemy(e, pr.dmg, true); pr.hits.push(e); if (!pr.pierce) { pr.life = 0; break; } } }
      // boss hit
      if (this.boss && !this.boss.dead && Math.hypot(pr.x - this.boss.x, pr.y - (this.boss.y - 30)) < 34) { this.hurtBossDirect(pr.dmg); if (!pr.pierce) pr.life = 0; }
    }
  }
  this.projectiles = this.projectiles.filter(pr => pr.life > 0 && pr.x > 0 && pr.y > 0 && pr.x < 110 * 24 && pr.y < 110 * 24);
};

// shared enemy damage (used by melee, skills, projectiles)
Game.prototype.hurtEnemy = function (e, hit, crit) {
  if (e.dead) return;
  const p = this.player;
  const buffed = Math.round(hit * (p.buffT > 0 ? (p.buffMul || 1) : 1));
  e.hp -= buffed; e.hurt = 0.2; e.angry = 6; e.state = "chase";
  this.addFloater(e.x, e.y - e.h, buffed, crit);
  this.spawnHit(e.x, e.y - e.h * 0.4);
  this.audio.sfx(crit ? "crit" : "hit");
  this.shake = Math.max(this.shake, crit ? 5 : 3);
  if (e.hp <= 0) this.killEnemy(e);
};

Game.prototype.equip = function (id) { this.player.equipped = id; this.ui.toast("Equipped " + (ITEMS[id]?.name || id)); this.ui.renderInv(); };

Game.prototype.craft = function (rid) {
  const r = RECIPES.find(x => x.id === rid); if (!r) return;
  const p = this.player;
  if (!canCraft(p.inv, r)) { this.ui.toast("Missing materials"); return; }
  for (const [k, n] of Object.entries(r.need)) p.inv[k] -= n;
  p.inv[r.result] = (p.inv[r.result] || 0) + 1;
  const isDragon = r.result.startsWith("dragon");
  this.ui.toast(isDragon ? "🔥 Forged " + (ITEMS[r.result]?.name || r.result) + "!" : "Forged " + (ITEMS[r.result]?.name || r.result));
  // forge spark particles at player
  for (let i = 0; i < (isDragon ? 24 : 12); i++) {
    this.particles.push({ x: p.x, y: p.y - 20, vx: (Math.random() - 0.5) * 100, vy: -40 - Math.random() * 60, life: 0.7, color: isDragon ? (Math.random() < 0.5 ? "rgba(255,140,40,0.95)" : "rgba(255,200,80,0.9)") : "rgba(200,220,255,0.85)" });
  }
  this.fx.push({ kind: "levelring", x: p.x, y: p.y - 10, t: 0, dur: 0.5 });
  this.audio.sfx(isDragon ? "level" : "pickup");
  this.shake = Math.max(this.shake, isDragon ? 6 : 2);
  this.ui.renderCraft(); this.ui.renderInv();
};

Game.prototype.respawn = function () {
  const p = this.player;
  p.hp = p.maxHp; p.stamina = p.maxStamina;
  p.x = this.camp.x; p.y = this.camp.y + 46;
  this._dead = false; this.paused = false; this.ui.hideDeath();
};

// ---- WORLD BOSS: glowing dragon, spawns every 3 minutes ----
Game.prototype.spawnBoss = function () {
  if (this.boss && !this.boss.dead) return;
  const p = this.player;
  // spawn a bit away from the player, on land
  let x, y, tries = 0;
  do {
    const a = Math.random() * 7, r = 200 + Math.random() * 120;
    x = clamp(p.x + Math.cos(a) * r, 6 * 24, 104 * 24);
    y = clamp(p.y + Math.sin(a) * r, 6 * 24, 104 * 24);
    tries++;
  } while (this.tileAt(x, y) === 2 && tries < 20);
  const hp = 900 + p.level * 120;
  this.boss = {
    x, y, sortY: y, hp, maxHp: hp, dmg: 14 + p.level * 2,
    frame: 0, frameT: 0, dead: false, hurt: 0,
    state: "chase", atkCd: 3, breatheCd: 5, t: 0, rage: false,
  };
  this.ui.toast("⚠ A WORLD BOSS has appeared: Infernyx the Dragon!");
  this.audio.sfx("level"); this.shake = Math.max(this.shake, 8);
};
Game.prototype.updateBoss = function (dt) {
  // 3-minute spawn timer
  this.bossTimer = (this.bossTimer == null ? 180 : this.bossTimer) - dt;
  if (this.bossTimer <= 0 && (!this.boss || this.boss.dead)) { this.spawnBoss(); this.bossTimer = 180; }

  const b = this.boss; if (!b || b.dead) return;
  const p = this.player;
  b.t += dt; b.hurt = Math.max(0, b.hurt - dt);
  b.frameT += dt; if (b.frameT > 0.18) { b.frameT = 0; b.frame = (b.frame + 1) % 4; }
  b.rage = b.hp < b.maxHp * 0.4;

  const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy) || 1;
  // move toward player but keep some distance (ranged aggressor)
  const desired = b.rage ? 90 : 130;
  const spd = (b.rage ? 62 : 44) * dt;
  if (d > desired + 20) { b.x += (dx / d) * spd; b.y += (dy / d) * spd; }
  else if (d < desired - 20) { b.x -= (dx / d) * spd; b.y -= (dy / d) * spd; }
  b.sortY = b.y;

  // melee swipe if player hugs the boss
  b.atkCd -= dt;
  if (d < 60 && b.atkCd <= 0) { b.atkCd = b.rage ? 1.4 : 2.2; this.damagePlayer(b.dmg); this.shake = Math.max(this.shake, 6); this.fx.push({ kind: "slashbig", x: p.x, y: p.y, dir: "down", t: 0, dur: 0.3 }); }

  // fire breath: volley of fireballs toward the player
  b.breatheCd -= dt;
  if (b.breatheCd <= 0) {
    b.breatheCd = b.rage ? 2.6 : 4.5;
    this.audio.sfx("whirl"); this.shake = Math.max(this.shake, 5);
    const base = Math.atan2(dy, dx);
    const spread = b.rage ? [-0.35, -0.12, 0.12, 0.35] : [-0.18, 0, 0.18];
    for (const off of spread) this.spawnProjectile(b.x, b.y - 30, Math.cos(base + off), Math.sin(base + off), "bossfire", b.dmg);
    this.fx.push({ kind: "whirl", x: b.x, y: b.y - 30, t: 0, dur: 0.4 });
  }
};
// AoE damage helper for player skills hitting the boss
Game.prototype.hurtBoss = function (x, y, radius, dmg) {
  const b = this.boss; if (!b || b.dead) return;
  if (Math.hypot(b.x - x, b.y - y) < radius + 30) this.hurtBossDirect(dmg);
};
Game.prototype.hurtBossDirect = function (dmg) {
  const b = this.boss; if (!b || b.dead) return;
  const p = this.player;
  const buffed = Math.round(dmg * (p.buffT > 0 ? (p.buffMul || 1) : 1));
  b.hp -= buffed; b.hurt = 0.2;
  this.addFloater(b.x, b.y - 40, buffed, true);
  this.audio.sfx("hit"); this.shake = Math.max(this.shake, 3);
  if (b.hp <= 0) this.killBoss();
};
Game.prototype.killBoss = function () {
  const b = this.boss; if (!b) return;
  b.dead = true;
  const p = this.player;
  const goldReward = 200 + p.level * 20, xpReward = 300 + p.level * 40;
  p.gold += goldReward; p.xp += xpReward;
  p.inv.ore = (p.inv.ore || 0) + 8; p.inv.gel = (p.inv.gel || 0) + 6;
  p.inv.dragonscale = (p.inv.dragonscale || 0) + 1;   // rare crafting mat
  for (let i = 0; i < 30; i++) this.particles.push({ x: b.x, y: b.y - 30, vx: (Math.random() - 0.5) * 120, vy: -40 - Math.random() * 80, life: 1.0, color: Math.random() < 0.5 ? "rgba(255,180,60,0.95)" : "rgba(255,120,40,0.9)" });
  this.fx.push({ kind: "levelring", x: b.x, y: b.y - 20, t: 0, dur: 1.0 });
  this.shake = Math.max(this.shake, 12); this.audio.sfx("level");
  this.ui.toast(`💀 Infernyx defeated! +${goldReward}g +${xpReward}xp +Dragon Scale!`);
  while (p.xp >= xpFor(p.level)) { p.xp -= xpFor(p.level); p.level++; p.maxHp += 12; p.hp = p.maxHp; this.ui.showLevel(p.level); }
  this.ui.sync && this.ui.sync();
  setTimeout(() => { this.boss = null; }, 600);
};

Game.prototype.spawnHit = function (x, y) {
  this.fx.push({ kind: "hit", x, y, t: 0, dur: 0.15 });
  for (let i = 0; i < 4; i++) this.particles.push({ x, y, vx: (Math.random() - 0.5) * 80, vy: -20 - Math.random() * 40, life: 0.3, color: "rgba(255,255,200,0.8)" });
};

Game.prototype.harvestPlant = function (pl) {
  const drops = {
    bamboo_shoot: { item: "wood", count: 2, xp: 4, gold: 2 },
    herb_bush: { item: "herb", count: 2, xp: 3, gold: 1 },
    crystal_ore: { item: "ore", count: 3, xp: 8, gold: 5 },
    glow_vine: { item: "gel", count: 2, xp: 6, gold: 3 },
  };
  const d = drops[pl.kind] || drops.herb_bush;
  const p = this.player;
  p.inv[d.item] = (p.inv[d.item] || 0) + d.count;
  p.xp += d.xp; p.gold += d.gold;
  this.ui.toast(`🌿 Harvested ${pl.kind.replace("_", " ")}! +${d.count} ${d.item} +${d.xp}xp`);
  this.audio.sfx("pickup");
  this.addFloater(pl.x, pl.y - 16, `+${d.count} ${d.item}`, false, false, true);
  // particle burst
  for (let i = 0; i < 8; i++) this.particles.push({ x: pl.x, y: pl.y - 10, vx: (Math.random() - 0.5) * 60, vy: -30 - Math.random() * 40, life: 0.6, color: pl.kind === "crystal_ore" ? "rgba(180,220,255,0.9)" : "rgba(120,200,100,0.9)" });
  pl.respawn = 30; // respawn in 30 sec
  while (p.xp >= xpFor(p.level)) { p.xp -= xpFor(p.level); p.level++; p.maxHp += 12; p.hp = p.maxHp; this.ui.showLevel(p.level); }
  this.ui.sync && this.ui.sync();
};

Game.prototype.updatePlants = function (dt) {
  for (const pl of this.plants) {
    pl.sway = (pl.sway || 0) + dt * 2;
    if (pl.shake > 0) pl.shake -= dt;
    if (pl.hp <= 0 && pl.respawn > 0) {
      pl.respawn -= dt;
      if (pl.respawn <= 0) { pl.hp = pl.kind === "crystal_ore" ? 3 : 2; }
    }
  }
};

Game.prototype.damagePlayer = function (raw) {
  const p = this.player;
  if (p.invuln > 0) return;
  if (p.shield) { p.stamina = Math.max(0, p.stamina - 6); if (p.stamina > 0) { p.invuln = 0.2; return; } }
  const dmg = Math.max(1, Math.round(raw * (p.defense || 1)));
  p.hp -= dmg; p.invuln = 0.6;
  this.addFloater(p.x, p.y - 36, dmg, false, true);
  this.audio.sfx("hurt"); this.shake = Math.max(this.shake, 5);
};
Game.prototype.addFloater = function (x, y, val, crit, dmgToPlayer, heal) {
  const sx = (x - this.cam.x) * (this.canvas.clientWidth / view.w);
  const sy = (y - this.cam.y) * (this.canvas.clientHeight / view.h);
  this.ui.dmg(sx, sy, heal ? "+" + val : String(val), crit, heal);
};
Game.prototype.updateClock = function () {
  const el = document.getElementById("clock"); if (!el) return;
  const h = Math.floor(this.time / 60), m = Math.floor(this.time % 60);
  const night = this.time < 5 * 60 || this.time > 19 * 60;
  const wIcon = this.weather === "rain" ? " · 🌧" : this.weather === "snow" ? " · ❄" : "";
  el.textContent = `${night ? "Night" : "Day"} ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}${wIcon}`;
};
