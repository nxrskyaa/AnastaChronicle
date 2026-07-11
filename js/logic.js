import { Game } from "./game.js";
import { ITEMS, RECIPES, doCraft, xpFor } from "./crafting.js";
import { view } from "./view.js";
import { updateNpcWorld } from "./npcworld.js";
import { net, sendBossHit, sendPvpHit } from "./net.js";
import { CLASSES } from "./classes.js";

const T = 24, MAP_W = 110, MAP_H = 110;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const WEAPONS = {
  fist:   { name: "Fist",   dmg: 8,  range: 30, speed: 0.5,  cost: 4 },
  sword:  { name: "Sword",  dmg: 22, range: 42, speed: 0.42, cost: 8 },
  axe:    { name: "Axe",    dmg: 30, range: 38, speed: 0.62, cost: 12 },
  spear:  { name: "Spear",  dmg: 20, range: 62, speed: 0.5,  cost: 9 },
  dagger: { name: "Dagger", dmg: 14, range: 30, speed: 0.28, cost: 5 },
  bow:    { name: "Bow",    dmg: 18, range: 95, speed: 0.55, cost: 10, ranged: true, projectile: "arrow", pierce: true },
  staff:  { name: "Staff",  dmg: 16, range: 90, speed: 0.5,  cost: 10, ranged: true, projectile: "fire" },
  dragonblade:  { name: "Dragon Blade", dmg: 42, range: 52, speed: 0.42, cost: 10 },
  dragonbow:    { name: "Dragon Bow",   dmg: 34, range: 110, speed: 0.5, cost: 10, ranged: true, projectile: "arrow", pierce: true },
  dragonstaff:  { name: "Dragon Staff", dmg: 36, range: 100, speed: 0.48, cost: 10, ranged: true, projectile: "fire" },
};
Game.prototype.WEAPONS = WEAPONS;

const PROJECTILE_SPEED = { arrow: 280, bossfire: 150, fire: 200 };
const PROJECTILE_LIFE = 1.4;
const projectileSpeed = (kind) => PROJECTILE_SPEED[kind] || PROJECTILE_SPEED.fire;

function rangedAim(game, kind, preview = false) {
  const p = game.player;
  const ox = p.x, oy = p.y - 14;
  const fx = p.dir === "left" ? -1 : p.dir === "right" ? 1 : 0;
  const fy = p.dir === "up" ? -1 : p.dir === "down" ? 1 : 0;
  const fallback = fx || fy ? { dx: fx, dy: fy } : { dx: 0, dy: 1 };
  const maxD2 = (projectileSpeed(kind) * PROJECTILE_LIFE) ** 2;
  const margin = 24;
  let best = null, bestD2 = Infinity;

  const consider = (x, y) => {
    if (x < game.cam.x - margin || x > game.cam.x + view.w + margin ||
        y < game.cam.y - margin || y > game.cam.y + view.h + margin) return;
    const dx = x - ox, dy = y - oy, d2 = dx * dx + dy * dy;
    if (d2 <= 0.001 || d2 > maxD2 || d2 >= bestD2) return;
    best = { dx, dy }; bestD2 = d2;
  };

  for (const e of game.enemies) if (!e.dead) consider(e.x, e.y - e.h * 0.4);
  if (game.boss && !game.boss.dead) consider(game.boss.x, game.boss.y - 30);
  if (net.connected && net.duelActive) {
    for (const remote of Object.values(net.remote)) if (remote.duel) consider(remote.rx, remote.ry - 18);
  }
  if (!best) return fallback;

  const d = Math.sqrt(bestD2);
  game.aimAssist = { x: ox + best.dx, y: oy + best.dy, fromX: ox, fromY: oy, kind, until: game.t + (preview ? .12 : .55) };
  return { dx: best.dx / d, dy: best.dy / d };
}

function nearestDuelTarget(game, x, y, radius, fx = 0, fy = 0) {
  if (!net.connected || !net.duelActive) return null;
  let best = null, bestDistance = Infinity;
  for (const [id, remote] of Object.entries(net.remote)) {
    if (!remote.duel) continue;
    const dx = remote.rx - x, dy = remote.ry - y, distance = Math.hypot(dx, dy);
    if (distance > radius || distance >= bestDistance) continue;
    const dot = distance > .001 ? dx / distance * fx + dy / distance * fy : 1;
    if ((fx || fy) && dot < .1) continue;
    best = { id, remote, distance }; bestDistance = distance;
  }
  return best;
}

Game.prototype.tryDuelStrike = function (x, y, radius, damage, kind = "basic", fx = 0, fy = 0) {
  const target = nearestDuelTarget(this, x, y, radius, fx, fy);
  if (!target) return false;
  return sendPvpHit(target.id, Math.min(120, Math.max(1, Math.round(damage))), kind);
};

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
  p.hurtT = Math.max(0, (p.hurtT || 0) - dt);
  for (let i = 0; i < 4; i++) p.skillCd[i] = Math.max(0, p.skillCd[i] - dt);

  p.shield = !this.fishing && !!(this.keys.ShiftLeft || this.keys.ShiftRight);
  if (p.shield && p.stamina > 0) { p.stamina = Math.max(0, p.stamina - 16 * dt); if (p.stamina <= 0) p.shield = false; }
  else p.stamina = Math.min(p.maxStamina, p.stamina + 20 * dt);

  if (!this.fishing && this.keys.Space && p.evadeCd <= 0 && p.stamina >= 16) {
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
    if (this.fishing && (this.keys.KeyW || this.keys.KeyS || this.keys.KeyA || this.keys.KeyD || this.keys.ArrowUp || this.keys.ArrowDown || this.keys.ArrowLeft || this.keys.ArrowRight || (this.stick && this.stick.active))) {
      this.failFishing("Fishing cancelled — stay planted while the line is out.");
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

  if (!this.fishing && this.mouse.down && p.attackCd <= 0) this.doAttack();

  this.moveEntity(p, p.vx * dt, p.vy * dt, 6);
  p.sortY = p.y;

  const tx = p.x - view.w / 2 + (p.moving ? p.vx * 0.06 : 0);
  const ty = p.y - view.h / 2 + (p.moving ? p.vy * 0.05 : 0);
  const cl = 1 - Math.exp(-8 * dt);
  this.cam.x = clamp(this.cam.x + (tx - this.cam.x) * cl, 0, MAP_W * T - view.w);
  this.cam.y = clamp(this.cam.y + (ty - this.cam.y) * cl, 0, MAP_H * T - view.h);

  const equipped = WEAPONS[p.equipped] || WEAPONS.fist;
  if (!this.fishing && equipped.ranged) rangedAim(this, equipped.projectile || "arrow", true);

  updateNpcWorld(this, dt);

  this.updateEnemies(dt);
  this.updateBoss(dt);
  this.updateProjectiles(dt);
  this.updatePlants(dt);
  this.updatePet(dt);
  this.updateInteract();
  // buff timer (War Cry etc.)
  if (p.buffT > 0) { p.buffT -= dt; if (p.buffT <= 0) { p.buffT = 0; p.buffMul = 1; } }
  p.wardT = Math.max(0, (p.wardT || 0) - dt);

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

Game.prototype.doAttack = function (damageMul = 1) {
  const p = this.player;
  const w = WEAPONS[p.equipped] || WEAPONS.fist;
  if (p.stamina < w.cost * 0.4) return false;
  p.stamina = Math.max(0, p.stamina - w.cost);
  const durations = { dagger: .18, sword: .28, axe: .42, spear: .34, dragonblade: .36, bow: .34, staff: .38, dragonbow: .4, dragonstaff: .42 };
  const chained = this.t - (p.lastAttackAt ?? -99) < .68;
  p.comboStep = chained ? ((p.comboStep || 0) + 1) % 3 : 0;
  p.lastAttackAt = this.t;
  p.attackDur = durations[p.equipped] || .26;
  p.attackT = p.attackDur; p.attackCd = w.speed;
  p.attackStyle = w.ranged ? (w.projectile === "arrow" ? "bow" : "cast") : "melee";
  this.audio.sfx("attack");
  const fx = p.dir === "left" ? -1 : p.dir === "right" ? 1 : 0;
  const fy = p.dir === "up" ? -1 : p.dir === "down" ? 1 : 0;
  const activeBuff = p.buffT > 0 ? (p.buffMul || 1) : 1;
  const rawDmg = (w.dmg + p.level * 2) * (p.dmgMul || 1) * Math.max(.1, Number(damageMul) || 1);
  // Projectiles flow through hurtEnemy()/hurtBossDirect(), which apply buffs;
  // direct melee paths resolve the active buff here exactly once.
  const dmg = w.ranged ? rawDmg : rawDmg * activeBuff;
  // ranged weapons spawn a projectile instead of melee hitbox
  if (w.ranged) {
    const kind = w.projectile || "arrow";
    const { dx, dy } = rangedAim(this, kind);
    const variant = p.equipped.startsWith("dragon") ? "dragon" : kind === "fire" ? "arcane" : "basic";
    this.spawnProjectile(p.x, p.y - 14, dx, dy, kind, Math.round(dmg), w.pierce, variant);
    p.vx -= dx * 14; p.vy -= dy * 14;
    this.fx.push({ kind: kind === "arrow" ? "bowrelease" : "castburst", x: p.x, y: p.y - 14, angle: Math.atan2(dy, dx), variant, t: 0, dur: .3 });
    return;
  }
  p.vx += fx * 55; p.vy += fy * 55;
  this.fx.push({ kind: "weaponslash", x: p.x, y: p.y, dir: p.dir, weapon: p.equipped, combo: p.comboStep, t: 0, dur: p.attackDur });
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
    if (d > .001) { e.x += (dx / d) * 8; e.y += (dy / d) * 8; }
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
      // hurtBossDirect applies Oni Resolve itself; pass the unbuffed attack value
      // so boss hits match the same single multiplier as ordinary enemies.
      if (!(fx || fy) || dot > 0.1) { this.hurtBossDirect(Math.round(rawDmg * (Math.random() < 0.2 ? 1.8 : 1))); }
    }
  }
  const duelCrit = Math.random() < .16;
  this.tryDuelStrike(p.x, p.y, w.range + 14, dmg * (duelCrit ? 1.55 : 1), this._nextDuelKind || "basic", fx, fy);
  this._nextDuelKind = null;
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
  return true;
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
  const facing = {
    up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
  }[p.dir] || [0, 1];
  const [fx, fy] = facing;
  // Follow from a rear-side position so the companion does not sit inside the hero.
  const targetX = p.x - fx * 30 - fy * 12;
  const targetY = p.y - fy * 26 + fx * 12;
  const dx = targetX - pt.x, dy = targetY - pt.y, d = Math.hypot(dx, dy);

  pt.spawnT = Math.max(0, (pt.spawnT || 0) - dt);
  if (d > 260) {
    pt.x = targetX;
    pt.y = targetY;
    pt.moving = false;
    pt.spawnT = .45;
    this._summonPetFx?.(pt.x, pt.y, false);
  } else if (d > 8) {
    const speed = d > 110 ? 260 : d > 55 ? 185 : 120;
    const step = Math.min(d - 8, speed * dt);
    pt.x += (dx / d) * step;
    pt.y += (dy / d) * step;
    pt.moving = step > .05;
  } else {
    pt.moving = false;
  }

  pt.animT = (pt.animT || 0) + dt * (pt.moving ? 8 : 3.5);
  pt.frame = Math.floor(pt.animT) % 4;
  pt.bob = (pt.bob || 0) + dt * (pt.moving ? 9 : 4.5);
  pt.sortY = pt.y;
};

// Interaction, chest claiming, and fishing live in interactions.js.


Game.prototype.useSkill = function (i) {
  const p = this.player;
  if (this.fishing) return;
  if (p.skillCd[i] > 0) return;
  const cls = p.cls || "warrior";
  const dirVec = () => ({ fx: p.dir === "left" ? -1 : p.dir === "right" ? 1 : 0, fy: p.dir === "up" ? -1 : p.dir === "down" ? 1 : 0 });
  const skill = (CLASSES[cls] || CLASSES.warrior).skills[i];
  if (!skill) return;
  const skillId = skill.id, cooldown = skill.cd;

  switch (skillId) {
    case "powerstrike": {
      this._nextDuelKind = "skill";
      if (!this.doAttack(1.65)) { this._nextDuelKind = null; this.ui.toast("Not enough stamina"); break; }
      p.skillCd[i] = cooldown;
      const { fx, fy } = dirVec();
      this.fx.push({ kind: "crescent", x: p.x + fx * 20, y: p.y + fy * 20, dir: p.dir, t: 0, dur: .42 });
      this.shake = Math.max(this.shake, 2); this.ui.toast("Moon Cleave!"); break;
    }
    case "whirlwind": {
      p.skillCd[i] = cooldown; const w = WEAPONS[p.equipped] || WEAPONS.fist; p.attackDur = .56; p.attackT = p.attackDur; p.attackStyle = "melee";
      this.audio.sfx("whirl"); this.fx.push({ kind: "whirl", x: p.x, y: p.y, variant: "steel", t: 0, dur: .62 }); this.shake = Math.max(this.shake, 3);
      for (const e of this.enemies) { if (e.dead) continue; const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < 70) { const hit = Math.round((w.dmg + p.level * 2) * 1.3 * (p.dmgMul || 1)); this.hurtEnemy(e, hit, true); } }
      this.hurtBoss(p.x, p.y, 70, Math.round(40 * (p.dmgMul || 1)));
      this.tryDuelStrike(p.x, p.y, 82, Math.round((w.dmg + p.level * 2) * 1.3 * (p.dmgMul || 1)), "skill");
      this.ui.toast("Tempest Wheel!"); break;
    }
    case "warcry": {
      p.skillCd[i] = cooldown; p.buffT = 6; p.buffMul = 1.6; p.wardT = Math.max(p.wardT || 0, 1.4);
      this.audio.sfx("level"); this.fx.push({ kind: "warcry", x: p.x, y: p.y, variant: "resolve", t: 0, dur: .9 });
      this.ui.toast("Oni Resolve · damage up"); break;
    }
    case "fireball": {
      p.skillCd[i] = cooldown; const { dx, dy } = rangedAim(this, "fire");
      p.attackDur = .42; p.attackT = p.attackDur; p.attackStyle = "cast";
      this.spawnProjectile(p.x, p.y - 14, dx, dy, "fire", Math.round((26 + p.level * 3) * (p.dmgMul || 1)), false, "comet");
      this.fx.push({ kind: "castburst", x: p.x, y: p.y - 14, angle: Math.atan2(dy, dx), variant: "comet", t: 0, dur: .5 });
      this.audio.sfx("whirl"); this.ui.toast("Ember Comet!"); break;
    }
    case "frostnova": {
      p.skillCd[i] = cooldown; p.attackDur = .48; p.attackT = p.attackDur; p.attackStyle = "cast";
      this.fx.push({ kind: "frost", x: p.x, y: p.y, variant: "lotus", t: 0, dur: .82 }); this.shake = Math.max(this.shake, 2); this.audio.sfx("crit");
      for (const e of this.enemies) { if (e.dead) continue; const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < 80) { this.hurtEnemy(e, Math.round((22 + p.level * 2) * (p.dmgMul || 1)), true); e.frozen = 2.2; } }
      this.hurtBoss(p.x, p.y, 80, Math.round(30 * (p.dmgMul || 1)));
      this.tryDuelStrike(p.x, p.y, 92, Math.round((22 + p.level * 2) * (p.dmgMul || 1)), "skill");
      this.ui.toast("Winter Lotus!"); break;
    }
    case "arrowshot": {
      p.skillCd[i] = cooldown; const { dx, dy } = rangedAim(this, "arrow");
      p.attackDur = .4; p.attackT = p.attackDur; p.attackStyle = "bow";
      this.spawnProjectile(p.x, p.y - 14, dx, dy, "arrow", Math.round((24 + p.level * 3) * (p.dmgMul || 1)), true, "falcon");
      this.fx.push({ kind: "bowrelease", x: p.x, y: p.y - 14, angle: Math.atan2(dy, dx), variant: "falcon", t: 0, dur: .42 });
      this.audio.sfx("attack"); this.ui.toast("Falcon Pierce!"); break;
    }
    case "multishot": {
      p.skillCd[i] = cooldown; const { dx, dy } = rangedAim(this, "arrow");
      const base = Math.atan2(dy, dx);
      p.attackDur = .44; p.attackT = p.attackDur; p.attackStyle = "bow";
      for (const off of [-.34, -.17, 0, .17, .34]) this.spawnProjectile(p.x, p.y - 14, Math.cos(base + off), Math.sin(base + off), "arrow", Math.round((13 + p.level * 1.7) * (p.dmgMul || 1)), false, "sakura");
      this.fx.push({ kind: "bowrelease", x: p.x, y: p.y - 14, angle: base, variant: "sakura", t: 0, dur: .5 });
      this.audio.sfx("attack"); this.ui.toast("Sakura Volley!"); break;
    }
    case "heal": {
      if ((p.inv.herb || 0) > 0) { p.inv.herb--; p.hp = Math.min(p.maxHp, p.hp + 30); p.skillCd[i] = cooldown; p.attackDur = .52; p.attackT = p.attackDur; p.attackStyle = "cast"; this.addFloater(p.x, p.y - 36, 30, false, false, true); this.audio.sfx("heal"); this.fx.push({ kind: "heal", x: p.x, y: p.y, variant: "sutra", t: 0, dur: .9 }); this.ui.toast("Verdant Sutra · +30 HP"); }
      else this.ui.toast("No herbs"); break;
    }
    case "windward": {
      if (p.stamina < 22) { this.ui.toast("Not enough stamina"); break; }
      p.stamina -= 22; p.skillCd[i] = cooldown; p.wardT = 4; p.hp = Math.min(p.maxHp, p.hp + 12);
      p.attackDur = .4; p.attackT = p.attackDur; p.attackStyle = "bow";
      this.addFloater(p.x, p.y - 36, 12, false, false, true); this.audio.sfx("heal");
      this.fx.push({ kind: "windward", x: p.x, y: p.y, t: 0, dur: .9 }); this.ui.toast("Wind Ward · damage reduced"); break;
    }
    case "blink": {
      p.skillCd[i] = cooldown; const { fx, fy } = dirVec(); const dx = fx || 0, dy = fy || 1;
      this.fx.push({ kind: "blink", x: p.x, y: p.y, variant: "rift", t: 0, dur: .5 });
      p.x = clamp(p.x + dx * 90, 8, 110 * 24 - 8); p.y = clamp(p.y + dy * 90, 8, 110 * 24 - 8);
      p.invuln = 0.3; this.fx.push({ kind: "blink", x: p.x, y: p.y, variant: "rift", t: 0, dur: .5, arrive: true }); this.audio.sfx("dash"); this.ui.toast("Rift Step!"); break;
    }
    case "dash":
    case "roll": {
      if (p.stamina >= 16) { p.evadeT = 0.16; p.evadeCd = 0.4; p.stamina -= 16; p.invuln = 0.25; p.skillCd[i] = cooldown; this.audio.sfx("dash"); this.fx.push({ kind: "dashline", x: p.x, y: p.y, dir: p.dir, variant: skillId, t: 0, dur: .32 }); const { fx, fy } = dirVec(); p.vx = fx * 340; p.vy = fy * 340; if (!fx && !fy) p.vy = 340; } break;
    }
  }
};

// ---- Projectiles (fireballs, arrows, boss fire) ----
Game.prototype.spawnProjectile = function (x, y, dx, dy, kind, dmg, pierce, variant = "basic", options = null) {
  const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
  this.projectiles = this.projectiles || [];
  const longRange = ["power", "dragon", "falcon", "comet"].includes(variant);
  const maxLife = longRange ? PROJECTILE_LIFE * 1.15 : PROJECTILE_LIFE;
  this.projectiles.push({ x, y, dx, dy, kind, variant, dmg, pierce: !!pierce, life: maxLife, maxLife, age: 0, trailT: 0, spin: Math.random() * Math.PI * 2, hostile: kind === "bossfire" && !options?.visualOnly, visualOnly: !!options?.visualOnly, targetId: options?.targetId || null, hits: [], hitsRemote: [], hitBoss: false });
};
Game.prototype.updateProjectiles = function (dt) {
  if (!this.projectiles) return;
  const p = this.player;
  for (const pr of this.projectiles) {
    const speed = projectileSpeed(pr.kind);
    pr.x += pr.dx * speed * dt;
    pr.y += pr.dy * speed * dt;
    pr.life -= dt; pr.age += dt; pr.trailT -= dt;
    if ((pr.kind === "fire" || pr.kind === "bossfire") && pr.trailT <= 0) {
      pr.trailT = pr.variant === "dragon" || pr.variant === "boss" ? .025 : .045;
      const color = pr.kind === "bossfire" ? "rgba(255,93,35,.85)" : pr.variant === "dragon" ? "rgba(174,105,255,.86)" : pr.variant === "comet" ? "rgba(255,196,84,.9)" : "rgba(255,165,58,.82)";
      this.particles.push({ x: pr.x - pr.dx * 4, y: pr.y - pr.dy * 4, vx: -pr.dx * 18 + (Math.random() - .5) * 9, vy: -pr.dy * 18 + (Math.random() - .5) * 9, life: .28, color });
    } else if (pr.kind === "arrow" && ["falcon", "sakura", "dragon"].includes(pr.variant) && pr.trailT <= 0) {
      pr.trailT = pr.variant === "sakura" ? .06 : .04;
      const color = pr.variant === "sakura" ? "rgba(255,157,197,.78)" : pr.variant === "dragon" ? "rgba(203,148,255,.82)" : "rgba(178,255,198,.8)";
      this.particles.push({ x: pr.x - pr.dx * 7 + (Math.random() - .5) * 3, y: pr.y - pr.dy * 7 + (Math.random() - .5) * 3, vx: -pr.dx * 8, vy: -pr.dy * 8 - 3, life: .22, color });
    }
    const impact = () => this.fx.push({ kind: "projectileimpact", x: pr.x, y: pr.y, element: pr.kind, variant: pr.variant, t: 0, dur: ["comet", "falcon", "sakura"].includes(pr.variant) ? .42 : .3 });
    if (pr.visualOnly) continue;
    if (pr.hostile) {
      // hits player
      if (p.invuln <= 0 && Math.hypot(pr.x - p.x, pr.y - (p.y - 14)) < 16) { this.damagePlayer(pr.dmg); impact(); pr.life = 0; }
    } else {
      let consumed = false;
      for (const e of this.enemies) { if (e.dead || pr.hits.includes(e)) continue; if (Math.hypot(pr.x - e.x, pr.y - (e.y - e.h * 0.4)) < 18) { this.hurtEnemy(e, pr.dmg, true); impact(); pr.hits.push(e); if (!pr.pierce) { pr.life = 0; consumed = true; break; } } }
      if (!consumed && net.connected && net.duelActive) {
        for (const [id, remote] of Object.entries(net.remote)) {
          if (!remote.duel || pr.hitsRemote.includes(id)) continue;
          if (Math.hypot(pr.x - remote.rx, pr.y - (remote.ry - 18)) >= 17) continue;
          const combatKind = ["skill", "power", "multi", "comet", "falcon", "sakura"].includes(pr.variant) ? "skill" : "projectile";
          if (sendPvpHit(id, Math.min(120, Math.max(1, Math.round(pr.dmg))), combatKind)) {
            impact(); pr.hitsRemote.push(id);
            if (!pr.pierce) { pr.life = 0; consumed = true; }
          }
          break;
        }
      }
      // boss hit
      if (!consumed && !pr.hitBoss && this.boss && !this.boss.dead && Math.hypot(pr.x - this.boss.x, pr.y - (this.boss.y - 30)) < 34) { this.hurtBossDirect(pr.dmg); impact(); pr.hitBoss = true; if (!pr.pierce) pr.life = 0; }
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
  if (!doCraft(p.inv, r)) { this.ui.toast("Missing materials — check the source guide"); return; }
  const item = ITEMS[r.result] || { name: r.result };
  const isRare = !!item.rare;
  this.ui.toast(`${isRare ? "MYTHIC FORGE · " : "Forged · "}${item.name}${item.rod ? " is now your active rod" : ""}`);
  // forge spark particles at player
  for (let i = 0; i < (isRare ? 24 : 12); i++) {
    this.particles.push({ x: p.x, y: p.y - 20, vx: (Math.random() - 0.5) * 100, vy: -40 - Math.random() * 60, life: 0.7, color: isRare ? (Math.random() < 0.5 ? "rgba(255,140,40,0.95)" : "rgba(255,200,80,0.9)") : "rgba(200,220,255,0.85)" });
  }
  this.fx.push({ kind: "levelring", x: p.x, y: p.y - 10, t: 0, dur: 0.5 });
  this.audio.sfx(isRare ? "level" : "pickup");
  this.shake = Math.max(this.shake, isRare ? 6 : 2);
  this.ui.renderCraft(); this.ui.renderInv();
};

Game.prototype.respawn = function () {
  const p = this.player;
  p.hp = p.maxHp; p.stamina = p.maxStamina;
  p.x = this.camp.x; p.y = this.camp.y + 46;
  this._dead = false; this.paused = false; this.ui.hideDeath();
};

// ---- WORLD BOSS: one server-owned HP pool, local AI presentation ----
Game.prototype.applySharedBoss = function (state) {
  if (!state?.active) {
    if (this.boss?.shared) { this.boss.hp = 0; this.boss.dead = true; this.boss.respawnAt = state?.respawnAt || 0; }
    this.ui.syncBoss?.(this.boss);
    return true;
  }
  const isNew = !this.boss?.shared || this.boss.serverId !== state.id;
  if (isNew) {
    this.boss = {
      serverId: state.id, shared: true, x: state.x, y: state.y, sortY: state.y,
      hp: state.hp, maxHp: state.maxHp, dmg: 14 + this.player.level * 2,
      frame: 0, frameT: 0, dead: false, hurt: 0, state: "guard",
      atkCd: 3, breatheCd: 5, breathWindup: 0, t: 0, rage: state.phase === 2,
      strafeDir: 1, strafeT: 2, contribution: Number(state.contribution) || 0,
    };
    this.ui.toast("WORLD BOSS · Infernyx awakened in the Umbral Arena");
    this.ui.receiveSystemChat?.("Infernyx awakened. Contribute damage and remain in the arena; every eligible traveler receives the same reward.");
  } else {
    Object.assign(this.boss, { x: state.x, y: state.y, sortY: state.y, hp: state.hp, maxHp: state.maxHp, dead: false, rage: state.phase === 2 });
    if (Number.isFinite(state.contribution)) this.boss.contribution = state.contribution;
  }
  this.ui.syncBoss?.(this.boss);
};

Game.prototype.applySharedBossHit = function (message) {
  if (!this.boss?.shared || this.boss.serverId !== message.bossId) this.applySharedBoss(net.boss);
  const b = this.boss; if (!b) return;
  const enteredRage = message.phase === 2 && !b.rage;
  b.hp = message.hp; b.maxHp = message.maxHp; b.rage = message.phase === 2; b.hurt = .18;
  if (message.source === net.selfId) b.contribution = (b.contribution || 0) + message.damage;
  if (enteredRage) {
    this.ui.toast("PHASE II · Infernyx shattered its oni guard!");
    this.fx.push({ kind: "levelring", x: b.x, y: b.y - 18, t: 0, dur: 1 });
    this.audio.sfx("level"); this.shake = Math.max(this.shake, 4);
  }
  if (message.source !== net.selfId) {
    this.addFloater(b.x, b.y - 42, message.damage, message.phase === 2);
    this.fx.push({ kind: "projectileimpact", x: b.x, y: b.y - 30, element: "fire", variant: "shared", t: 0, dur: .3 });
  }
  this.ui.syncBoss?.(b);
};

Game.prototype.applySharedBossAttack = function (message) {
  const b = this.boss;
  if (!b?.shared || b.serverId !== message.bossId || b.dead) return;
  const windup = message.kind === "melee" ? .24 : message.phase === 2 ? .48 : .68;
  b.sharedAttack = {
    kind: message.kind, target: message.target, targetName: message.targetName,
    targetX: message.targetX, targetY: message.targetY, angle: message.angle,
    windup, life: windup + .7, fired: false,
  };
  b.state = message.kind === "melee" ? "melee" : "windup";
  if (message.kind === "melee") b.atkCd = b.rage ? 1.4 : 2.2;
  b.breathWindup = message.kind === "breath" ? windup : 0;
  if (message.kind === "breath") {
    this.audio.sfx("whirl");
    this.fx.push({ kind: "bosswarn", x: b.x, y: b.y - 30, angle: message.angle, t: 0, dur: windup });
  }
};

Game.prototype.applySharedBossDefeat = function (message) {
  const b = this.boss; if (!b || (message.boss?.id && b.serverId !== message.boss.id)) return;
  b.hp = 0; b.dead = true; b.respawnAt = message.boss?.respawnAt || 0;
  for (let i = 0; i < 30; i++) this.particles.push({ x: b.x, y: b.y - 30, vx: (Math.random() - .5) * 120, vy: -35 - Math.random() * 80, life: 1, color: Math.random() < .5 ? "rgba(255,190,80,.95)" : "rgba(125,224,180,.9)" });
  this.fx.push({ kind: "levelring", x: b.x, y: b.y - 20, t: 0, dur: 1 });
  this.audio.sfx("level");
  this.ui.toast("INFERNYX SEALED · shared realm victory");
  this.ui.receiveSystemChat?.(`${message.eligibleIds?.length || 0} eligible traveler${message.eligibleIds?.length === 1 ? "" : "s"} sealed Infernyx together.`);
  this.ui.syncBoss?.(b);
};

Game.prototype.applySharedBossReward = function (message) {
  if (!message?.bossId || this._sharedRewardBoss === message.bossId) return;
  this._sharedRewardBoss = message.bossId;
  const reward = message.reward || {}, p = this.player;
  p.gold += Number(reward.gold) || 0;
  p.xp += Number(reward.xp) || 0;
  for (const [item, count] of Object.entries(reward.items || {})) p.inv[item] = (p.inv[item] || 0) + (Number(count) || 0);
  this.ui.toast(`CO-OP REWARD · +${reward.gold || 0}g · +${reward.xp || 0}xp · Dragon Scale`);
  this.ui.receiveSystemChat?.(`Shared boss reward received · ${message.participants || 1} contributor${message.participants === 1 ? "" : "s"}.`);
  while (p.xp >= xpFor(p.level)) { p.xp -= xpFor(p.level); p.level++; p.maxHp += 12; p.hp = p.maxHp; p.maxStamina += 8; p.stamina = p.maxStamina; this.ui.showLevel(p.level); }
  this.ui.sync?.();
};

Game.prototype.spawnBoss = function () {
  if (net.connected && net.protocol >= 2) return;
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
    state: "chase", atkCd: 3, breatheCd: 5, breathWindup: 0, t: 0, rage: false,
    strafeDir: Math.random() < 0.5 ? -1 : 1, strafeT: 1.2 + Math.random() * 1.4,
  };
  this.ui.toast("WORLD BOSS · Infernyx, the Ashen Oni, has awakened!");
  this.audio.sfx("level"); this.shake = Math.max(this.shake, 8);
};
Game.prototype.updateBoss = function (dt) {
  if (net.connected && net.protocol >= 2) {
    if (net.boss?.active && (!this.boss?.shared || this.boss.serverId !== net.boss.id)) this.applySharedBoss(net.boss);
  } else {
    this.bossTimer = (this.bossTimer == null ? 180 : this.bossTimer) - dt;
    if (this.bossTimer <= 0 && (!this.boss || this.boss.dead)) { this.spawnBoss(); this.bossTimer = 180; }
  }

  const b = this.boss; if (!b || b.dead) return;
  const p = this.player;
  b.t += dt; b.hurt = Math.max(0, b.hurt - dt);
  b.frameT += dt; if (b.frameT > 0.18) { b.frameT = 0; b.frame = (b.frame + 1) % 4; }
  const rageNow = b.hp < b.maxHp * 0.4;
  if (rageNow && !b.rage) {
    this.ui.toast("PHASE II · Infernyx shattered its oni guard!");
    this.fx.push({ kind: "levelring", x: b.x, y: b.y - 18, t: 0, dur: 1 });
    this.shake = Math.max(this.shake, 10); this.audio.sfx("level");
  }
  b.rage = rageNow;

  if (b.shared) {
    b.sortY = b.y;
    const attack = b.sharedAttack;
    if (!attack) { b.state = "guard"; b.breathWindup = 0; return; }
    attack.windup -= dt; attack.life -= dt;
    b.atkCd = Math.max(0, (b.atkCd || 0) - dt);
    if (attack.kind === "breath") b.breathWindup = Math.max(0, attack.windup);
    if (!attack.fired && attack.windup <= 0) {
      attack.fired = true;
      const remote = net.remote[attack.target];
      const targetX = attack.target === net.selfId ? p.x : remote?.rx ?? attack.targetX;
      const targetY = attack.target === net.selfId ? p.y : remote?.ry ?? attack.targetY;
      if (attack.kind === "melee") {
        if (attack.target === net.selfId && Math.hypot(p.x - attack.targetX, p.y - attack.targetY) < 52) this.damagePlayer(b.dmg);
        this.fx.push({ kind: "slashbig", x: targetX, y: targetY, dir: "down", t: 0, dur: .32 });
      } else {
        const spread = b.rage ? [-.35, -.12, .12, .35] : [-.18, 0, .18];
        for (const off of spread) this.spawnProjectile(b.x, b.y - 30, Math.cos(attack.angle + off), Math.sin(attack.angle + off), "bossfire", b.dmg, false, "boss", { visualOnly: attack.target !== net.selfId, targetId: attack.target });
        this.fx.push({ kind: "whirl", x: b.x, y: b.y - 30, t: 0, dur: .4 });
      }
    }
    if (attack.life <= 0) { b.sharedAttack = null; b.state = "guard"; b.breathWindup = 0; }
    return;
  }

  const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy) || 1;
  // Close distance when needed, then orbit or hold ground. Infernyx never
  // backpedals radially from a player who commits to close combat.
  const desired = b.rage ? 90 : 130;
  const spd = (b.rage ? 62 : 44) * dt;
  b.strafeT = (b.strafeT ?? 1) - dt;
  b.strafeDir = b.strafeDir || 1;
  if (b.strafeT <= 0) {
    b.strafeT = 1.5 + Math.random() * 1.5;
    if (Math.random() < 0.45) b.strafeDir *= -1;
  }
  if (!b.shared && d > desired + 20) {
    b.x += (dx / d) * spd; b.y += (dy / d) * spd;
  } else if (!b.shared && d >= 62 && b.breathWindup <= 0) {
    // Rotate around the player to preserve distance exactly instead of
    // introducing a tiny outward drift from a Cartesian tangent step.
    const orbit = (spd * (b.rage ? 0.56 : 0.42)) / d * b.strafeDir;
    const angle = Math.atan2(b.y - p.y, b.x - p.x) + orbit;
    const nx = p.x + Math.cos(angle) * d, ny = p.y + Math.sin(angle) * d;
    if (this.tileAt(nx, ny) !== 2) { b.x = nx; b.y = ny; }
    else b.strafeDir *= -1;
  }
  b.sortY = b.y;

  // melee swipe if player hugs the boss
  b.atkCd -= dt;
  if (d < 60 && b.atkCd <= 0) { b.atkCd = b.rage ? 1.4 : 2.2; this.damagePlayer(b.dmg); this.shake = Math.max(this.shake, 6); this.fx.push({ kind: "slashbig", x: p.x, y: p.y, dir: "down", t: 0, dur: 0.3 }); }

  // Fire breath has a visible wind-up so the volley reads as a boss mechanic.
  if (b.breathWindup > 0) {
    b.breathWindup -= dt;
    if (b.breathWindup <= 0) {
      const base = b.breathAngle;
      const spread = b.rage ? [-0.35, -0.12, 0.12, 0.35] : [-0.18, 0, 0.18];
      for (const off of spread) this.spawnProjectile(b.x, b.y - 30, Math.cos(base + off), Math.sin(base + off), "bossfire", b.dmg, false, "boss");
      this.fx.push({ kind: "whirl", x: b.x, y: b.y - 30, t: 0, dur: 0.4 });
    }
  } else {
    b.breatheCd -= dt;
  }
  if (b.breatheCd <= 0 && b.breathWindup <= 0) {
    b.breatheCd = b.rage ? 2.8 : 4.8;
    b.breathWindup = b.rage ? .48 : .68;
    b.breathAngle = Math.atan2(dy, dx);
    this.audio.sfx("whirl"); this.shake = Math.max(this.shake, 5);
    this.fx.push({ kind: "bosswarn", x: b.x, y: b.y - 30, angle: b.breathAngle, t: 0, dur: b.breathWindup });
  }
  b.state = b.breathWindup > 0 ? "windup" : d < 60 ? "melee" : b.shared ? "guard" : d > desired + 20 ? "chase" : "strafe";
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
  if (b.shared) {
    if (!net.connected || !sendBossHit(Math.min(180, Math.max(1, buffed)), b.serverId)) return;
    b.hurt = .16;
    this.addFloater(b.x, b.y - 40, buffed, true);
    this.audio.sfx("hit");
    this.fx.push({ kind: "projectileimpact", x: b.x, y: b.y - 30, element: "fire", variant: "shared", t: 0, dur: .28 });
    return;
  }
  b.hp -= buffed; b.hurt = 0.2;
  this.addFloater(b.x, b.y - 40, buffed, true);
  this.audio.sfx("hit"); this.shake = Math.max(this.shake, 3);
  if (b.hp <= 0) this.killBoss();
};
Game.prototype.killBoss = function () {
  const b = this.boss; if (!b) return;
  if (b.shared) return;
  b.dead = true;
  const p = this.player;
  const goldReward = 200 + p.level * 20, xpReward = 300 + p.level * 40;
  p.gold += goldReward; p.xp += xpReward;
  p.inv.ore = (p.inv.ore || 0) + 8; p.inv.gel = (p.inv.gel || 0) + 6;
  p.inv.dragonscale = (p.inv.dragonscale || 0) + 1;   // rare crafting mat
  for (let i = 0; i < 30; i++) this.particles.push({ x: b.x, y: b.y - 30, vx: (Math.random() - 0.5) * 120, vy: -40 - Math.random() * 80, life: 1.0, color: Math.random() < 0.5 ? "rgba(255,180,60,0.95)" : "rgba(255,120,40,0.9)" });
  this.fx.push({ kind: "levelring", x: b.x, y: b.y - 20, t: 0, dur: 1.0 });
  this.shake = Math.max(this.shake, 12); this.audio.sfx("level");
  this.ui.toast(`INFERNYX SEALED · +${goldReward}g · +${xpReward}xp · Dragon Scale`);
  while (p.xp >= xpFor(p.level)) { p.xp -= xpFor(p.level); p.level++; p.maxHp += 12; p.hp = p.maxHp; p.maxStamina += 8; p.stamina = p.maxStamina; this.ui.showLevel(p.level); }
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
  while (p.xp >= xpFor(p.level)) { p.xp -= xpFor(p.level); p.level++; p.maxHp += 12; p.hp = p.maxHp; p.maxStamina += 8; p.stamina = p.maxStamina; this.ui.showLevel(p.level); }
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
  const ward = p.wardT > 0 ? .62 : 1;
  const dmg = Math.max(1, Math.round(raw * (p.defense || 1) * ward));
  p.hp -= dmg; p.invuln = 0.6;
  this.addFloater(p.x, p.y - 36, dmg, false, true);
  this.audio.sfx("hurt"); this.shake = Math.max(this.shake, 5);
};
Game.prototype.damagePlayerPvp = function (acceptedDamage) {
  const p = this.player;
  const ward = p.wardT > 0 ? .62 : 1;
  const dmg = Math.max(1, Math.round((Number(acceptedDamage) || 0) * ward));
  p.hp -= dmg;
  p.hurtT = Math.max(p.hurtT || 0, .2);
  this.addFloater(p.x, p.y - 36, dmg, false, true);
  this.audio.sfx("hurt");
  this.shake = Math.max(this.shake, 2);
  return dmg;
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
