import { Game } from "./game.js";
import { img, MONSTERS } from "./assets.js";
import { ITEMS, RECIPES, canCraft, xpFor } from "./crafting.js";
import { view } from "./view.js";

const T = 24, MAP_W = 110, MAP_H = 110;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const WEAPONS = {
  fist:   { name: "Fist",   dmg: 8,  range: 30, speed: 0.5,  cost: 4 },
  sword:  { name: "Sword",  dmg: 22, range: 42, speed: 0.42, cost: 8 },
  axe:    { name: "Axe",    dmg: 30, range: 38, speed: 0.62, cost: 12 },
  spear:  { name: "Spear",  dmg: 20, range: 62, speed: 0.5,  cost: 9 },
  dagger: { name: "Dagger", dmg: 14, range: 30, speed: 0.28, cost: 5 },
  bow:    { name: "Bow",    dmg: 18, range: 95, speed: 0.55, cost: 10 },
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
    if (roll < 0.5) this.weather = "clear";
    else if (roll < 0.78) this.weather = snowBiome ? "snow" : "rain";
    else this.weather = "snow";
    this.weatherT = 25 + Math.random() * 30;
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
  this.updatePet(dt);
  this.updateInteract();

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
  const dmg = w.dmg + p.level * 2;
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

    if (e.state === "chase") {
      const sp = e.speed * dt;
      this.moveEntity(e, (dx / d) * sp, (dy / d) * sp, 8);
      // attack only when adjacent
      if (d < 20 && e.atkCd <= 0) {
        e.atkCd = 1.4;
        if (p.invuln <= 0 && !p.shield) { p.hp -= e.dmg; p.invuln = 0.6; this.addFloater(p.x, p.y - 36, e.dmg, false, true); this.audio.sfx("hurt"); this.shake = Math.max(this.shake, 4); }
        else if (p.shield) p.stamina = Math.max(0, p.stamina - 5);
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
  this._interactTarget = target; this._interactKind = kind;
  this.ui.setInteract(!!target, label);
  // mobile QoL: auto-open a chest you walk right on top of
  if (kind === "chest" && target && !target.opened && Math.hypot(target.x - p.x, target.y - p.y) < 18) {
    this.interact();
  }
};

Game.prototype.interact = function () {
  const t = this._interactTarget, kind = this._interactKind;
  if (!t) return;
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
  if (i === 0) { p.skillCd[0] = 4; this.mouse.down = true; this.doAttack(); this.mouse.down = false; this.fx.push({ kind: "slashbig", x: p.x, y: p.y, dir: p.dir, t: 0, dur: 0.3 }); this.shake = Math.max(this.shake, 5); this.ui.toast("Power Strike!"); }
  else if (i === 1) { if ((p.inv.herb || 0) > 0) { p.inv.herb--; p.hp = Math.min(p.maxHp, p.hp + 30); p.skillCd[1] = 6; this.addFloater(p.x, p.y - 36, 30, false, false, true); this.audio.sfx("heal"); this.fx.push({ kind: "heal", x: p.x, y: p.y, t: 0, dur: 0.8 }); this.ui.toast("Healed +30"); } else this.ui.toast("No herbs"); }
  else if (i === 2) { p.skillCd[2] = 7; const w = WEAPONS[p.equipped] || WEAPONS.fist; p.attackT = p.attackDur; this.audio.sfx("whirl"); this.fx.push({ kind: "whirl", x: p.x, y: p.y, t: 0, dur: 0.4 }); this.shake = Math.max(this.shake, 7); for (const e of this.enemies) { if (e.dead) continue; const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < 64) { const hit = Math.round((w.dmg + p.level * 2) * 1.3); e.hp -= hit; e.hurt = 0.2; this.addFloater(e.x, e.y - e.h, hit, true); this.spawnHit(e.x, e.y - e.h * 0.4); if (e.hp <= 0) this.killEnemy(e); } } this.ui.toast("Whirlwind!"); }
  else if (i === 3) { if (p.stamina >= 16) { p.evadeT = 0.16; p.evadeCd = 0.4; p.stamina -= 16; p.invuln = 0.2; p.skillCd[3] = 5; this.audio.sfx("dash"); this.fx.push({ kind: "dashline", x: p.x, y: p.y, dir: p.dir, t: 0, dur: 0.25 }); const fx = p.dir === "left" ? -1 : p.dir === "right" ? 1 : 0, fy = p.dir === "up" ? -1 : p.dir === "down" ? 1 : 0; p.vx = fx * 340; p.vy = fy * 340; if (!fx && !fy) p.vy = 340; } }
};

Game.prototype.equip = function (id) { this.player.equipped = id; this.ui.toast("Equipped " + (ITEMS[id]?.name || id)); this.ui.renderInv(); };

Game.prototype.craft = function (rid) {
  const r = RECIPES.find(x => x.id === rid); if (!r) return;
  const p = this.player;
  if (!canCraft(p.inv, r)) { this.ui.toast("Missing materials"); return; }
  for (const [k, n] of Object.entries(r.need)) p.inv[k] -= n;
  p.inv[r.result] = (p.inv[r.result] || 0) + 1;
  this.ui.toast("Forged " + (ITEMS[r.result]?.name || r.result));
  this.ui.renderCraft(); this.ui.renderInv();
};

Game.prototype.respawn = function () {
  const p = this.player;
  p.hp = p.maxHp; p.stamina = p.maxStamina;
  p.x = this.camp.x; p.y = this.camp.y + 46;
  this._dead = false; this.paused = false; this.ui.hideDeath();
};

Game.prototype.spawnHit = function (x, y) { this._hits = this._hits || []; this._hits.push({ x, y, t: 0 }); };
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
