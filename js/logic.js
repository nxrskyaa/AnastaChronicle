import { Game } from "./game.js";
import { ITEMS, RECIPES, doCraft, xpFor } from "./crafting.js";
import { view } from "./view.js";

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

function rangedAim(game, kind) {
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
  if (!best) return fallback;

  const d = Math.sqrt(bestD2);
  game.aimAssist = { x: ox + best.dx, y: oy + best.dy, until: game.t + .32 };
  return { dx: best.dx / d, dy: best.dy / d };
}

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
    const kind = w.projectile || "arrow";
    const { dx, dy } = rangedAim(this, kind);
    this.spawnProjectile(p.x, p.y - 14, dx, dy, kind, Math.round(dmg), w.pierce);
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

// Interaction, chest claiming, and fishing live in interactions.js.


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
      p.skillCd[i] = 3; const { dx, dy } = rangedAim(this, "fire");
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
      p.skillCd[i] = 3; const { dx, dy } = rangedAim(this, "arrow");
      this.spawnProjectile(p.x, p.y - 14, dx, dy, "arrow", Math.round((24 + p.level * 3) * (p.dmgMul || 1)), true);
      this.audio.sfx("attack"); this.ui.toast("Power Shot!"); break;
    }
    case "multishot": {
      p.skillCd[i] = 7; const { dx, dy } = rangedAim(this, "arrow");
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
  this.projectiles.push({ x, y, dx, dy, kind, dmg, pierce: !!pierce, life: PROJECTILE_LIFE, hostile: kind === "bossfire", hits: [], hitBoss: false });
};
Game.prototype.updateProjectiles = function (dt) {
  if (!this.projectiles) return;
  const p = this.player;
  for (const pr of this.projectiles) {
    const speed = projectileSpeed(pr.kind);
    pr.x += pr.dx * speed * dt;
    pr.y += pr.dy * speed * dt;
    pr.life -= dt;
    if (pr.kind === "fire" || pr.kind === "bossfire") this.particles.push({ x: pr.x, y: pr.y, vx: 0, vy: 0, life: 0.3, color: pr.kind === "bossfire" ? "rgba(255,120,40,0.8)" : "rgba(255,160,60,0.8)" });
    if (pr.hostile) {
      // hits player
      if (p.invuln <= 0 && Math.hypot(pr.x - p.x, pr.y - (p.y - 14)) < 16) { this.damagePlayer(pr.dmg); pr.life = 0; }
    } else {
      let consumed = false;
      for (const e of this.enemies) { if (e.dead || pr.hits.includes(e)) continue; if (Math.hypot(pr.x - e.x, pr.y - (e.y - e.h * 0.4)) < 18) { this.hurtEnemy(e, pr.dmg, true); pr.hits.push(e); if (!pr.pierce) { pr.life = 0; consumed = true; break; } } }
      // boss hit
      if (!consumed && !pr.hitBoss && this.boss && !this.boss.dead && Math.hypot(pr.x - this.boss.x, pr.y - (this.boss.y - 30)) < 34) { this.hurtBossDirect(pr.dmg); pr.hitBoss = true; if (!pr.pierce) pr.life = 0; }
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
    state: "chase", atkCd: 3, breatheCd: 5, breathWindup: 0, t: 0, rage: false,
  };
  this.ui.toast("WORLD BOSS · Infernyx, the Ashen Oni, has awakened!");
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
  const rageNow = b.hp < b.maxHp * 0.4;
  if (rageNow && !b.rage) {
    this.ui.toast("PHASE II · Infernyx shattered its oni guard!");
    this.fx.push({ kind: "levelring", x: b.x, y: b.y - 18, t: 0, dur: 1 });
    this.shake = Math.max(this.shake, 10); this.audio.sfx("level");
  }
  b.rage = rageNow;

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

  // Fire breath has a visible wind-up so the volley reads as a boss mechanic.
  if (b.breathWindup > 0) {
    b.breathWindup -= dt;
    if (b.breathWindup <= 0) {
      const base = b.breathAngle;
      const spread = b.rage ? [-0.35, -0.12, 0.12, 0.35] : [-0.18, 0, 0.18];
      for (const off of spread) this.spawnProjectile(b.x, b.y - 30, Math.cos(base + off), Math.sin(base + off), "bossfire", b.dmg);
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
  this.ui.toast(`INFERNYX SEALED · +${goldReward}g · +${xpReward}xp · Dragon Scale`);
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
