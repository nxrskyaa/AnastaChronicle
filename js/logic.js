// Game logic: update loop, combat, rendering. Attached to Game.prototype.
import { Game } from "./game.js";
import { img, MONSTERS } from "./assets.js";
import { ITEMS, RECIPES, canCraft, xpFor } from "./crafting.js";

const T = 24, MAP_W = 96, MAP_H = 96, VIEW_W = 420, VIEW_H = 236;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const WEAPONS = {
  fist:   { name: "Fist",   dmg: 8,  range: 30, speed: 0.5, cost: 4 },
  sword:  { name: "Sword",  dmg: 22, range: 40, speed: 0.42, cost: 8 },
  axe:    { name: "Axe",    dmg: 30, range: 36, speed: 0.6, cost: 12 },
  spear:  { name: "Spear",  dmg: 20, range: 58, speed: 0.5, cost: 9 },
  dagger: { name: "Dagger", dmg: 14, range: 28, speed: 0.28, cost: 5 },
  bow:    { name: "Bow",    dmg: 18, range: 90, speed: 0.55, cost: 10 },
};

Game.prototype.update = function (dt) {
  this.t += dt;
  const p = this.player;

  // day/night: 1 min game = ~ dt*speed; full day in ~4 real min
  this.time = (this.time + dt * 6) % 1440;

  p.attackT = Math.max(0, p.attackT - dt);
  p.attackCd = Math.max(0, p.attackCd - dt);
  p.evadeT = Math.max(0, p.evadeT - dt);
  p.evadeCd = Math.max(0, p.evadeCd - dt);
  p.invuln = Math.max(0, p.invuln - dt);
  for (let i = 0; i < 4; i++) p.skillCd[i] = Math.max(0, p.skillCd[i] - dt);

  p.shield = !!(this.keys.ShiftLeft || this.keys.ShiftRight);
  if (p.shield && p.stamina > 0) { p.stamina = Math.max(0, p.stamina - 16 * dt); if (p.stamina <= 0) p.shield = false; }
  else p.stamina = Math.min(p.maxStamina, p.stamina + 20 * dt);

  // dash
  if ((this.keys.Space) && p.evadeCd <= 0 && p.stamina >= 16) {
    p.evadeT = 0.16; p.evadeCd = 0.7; p.stamina -= 16; p.invuln = 0.18;
    const a = Math.atan2(p.vy || (p.dir==="down"?1:p.dir==="up"?-1:0), p.vx || (p.dir==="right"?1:p.dir==="left"?-1:0));
    p.vx = Math.cos(a) * 300; p.vy = Math.sin(a) * 300;
  }

  // input vector
  let ix = 0, iy = 0;
  if (this.moveMode === "tap" && this.moveTarget) {
    const dx = this.moveTarget.x - p.x, dy = this.moveTarget.y - p.y;
    const d = Math.hypot(dx, dy);
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
        this.particles.push({ x: p.x + (Math.random()-0.5)*6, y: p.y + 2, vx:(Math.random()-0.5)*10, vy:-8-Math.random()*8, life:0.3, color:"rgba(150,130,90,0.7)" });
      }
    } else {
      const sp = Math.hypot(p.vx, p.vy);
      if (sp > 1) { const fr = Math.min(sp, p.friction * dt); p.vx -= p.vx/sp*fr; p.vy -= p.vy/sp*fr; }
      else { p.vx = 0; p.vy = 0; }
      p.moving = false;
      if (p.attackT <= 0) { p.anim = "idle"; p.frame = Math.floor(this.t * 1.6) % 2; }
    }
  } else { p.vx *= 0.9; p.vy *= 0.9; }

  // attack (button mode: mouse.down)
  if (this.mouse.down && p.attackCd <= 0) this.doAttack();

  this.moveEntity(p, p.vx * dt, p.vy * dt, 6);
  p.sortY = p.y;

  // camera
  const tx = p.x - VIEW_W/2 + (p.moving ? p.vx*0.06 : 0);
  const ty = p.y - VIEW_H/2 + (p.moving ? p.vy*0.05 : 0);
  const cl = 1 - Math.exp(-8 * dt);
  this.cam.x = clamp(this.cam.x + (tx - this.cam.x) * cl, 0, MAP_W*T - VIEW_W);
  this.cam.y = clamp(this.cam.y + (ty - this.cam.y) * cl, 0, MAP_H*T - VIEW_H);

  this.updateEnemies(dt);
  this.updatePet(dt);
  this.updateInteract();

  // particles
  for (const pa of this.particles) { pa.x += pa.vx*dt; pa.y += pa.vy*dt; pa.vy += 40*dt; pa.life -= dt; }
  this.particles = this.particles.filter(p => p.life > 0);

  if (p.hp <= 0 && !this._dead) { this._dead = true; this.ui.showDeath(); this.paused = true; }
  this.ui.sync();
  this.updateClock();
};

Game.prototype.moveEntity = function (e, dx, dy, r) {
  // axis-separated with water block
  const solidAt = (x, y) => this.tileAt(x, y) === 2;
  let nx = e.x + dx;
  if (!solidAt(nx + Math.sign(dx)*r, e.y)) e.x = clamp(nx, r, MAP_W*T - r); else e.vx = 0;
  let ny = e.y + dy;
  if (!solidAt(e.x, ny + Math.sign(dy)*r)) e.y = clamp(ny, r, MAP_H*T - r); else e.vy = 0;
};

Game.prototype.doAttack = function () {
  const p = this.player;
  const w = WEAPONS[p.equipped] || WEAPONS.fist;
  if (p.stamina < w.cost * 0.4) return;
  p.stamina = Math.max(0, p.stamina - w.cost);
  p.attackT = 0.2; p.attackCd = w.speed; p.anim = "attack";
  const fx = p.dir === "left" ? -1 : p.dir === "right" ? 1 : 0;
  const fy = p.dir === "up" ? -1 : p.dir === "down" ? 1 : 0;
  p.vx += fx * 60; p.vy += fy * 60;
  const dmg = w.dmg + p.level * 2;
  for (const e of this.enemies) {
    if (e.dead) continue;
    const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
    if (d > w.range + 12) continue;
    // in facing arc
    const dot = (dx/d)*fx + (dy/d)*fy;
    if ((fx||fy) && dot < 0.25) continue;
    const crit = Math.random() < 0.2;
    const hit = Math.round(dmg * (crit ? 1.8 : 1));
    e.hp -= hit; e.hurt = 0.2;
    e.x += (dx/d) * 8; e.y += (dy/d) * 8;
    this.spawnHit(e.x, e.y);
    this.addFloater(e.x, e.y - e.h, hit, crit);
    if (e.hp <= 0) this.killEnemy(e);
  }
  // slash fx
  this._slashT = 0.18;
};

Game.prototype.killEnemy = function (e) {
  e.dead = true;
  const p = this.player;
  p.xp += e.xp; p.gold += e.gold;
  // drops
  const drop = e.tier >= 2 ? "ore" : "gel";
  p.inv[drop] = (p.inv[drop]||0) + 1 + (Math.random()<0.5?1:0);
  if (Math.random() < 0.4) p.inv.herb = (p.inv.herb||0)+1;
  this.ui.toast(`+${e.xp} XP · +${e.gold}g`);
  // level up
  while (p.xp >= xpFor(p.level)) {
    p.xp -= xpFor(p.level); p.level++;
    p.maxHp += 12; p.hp = p.maxHp; p.maxStamina += 8; p.stamina = p.maxStamina;
    this.ui.showLevel(p.level);
  }
  // respawn a new one elsewhere after delay
  setTimeout(() => { this.enemies = this.enemies.filter(x => x !== e); this.spawnEnemy(); }, 400);
};

Game.prototype.updateEnemies = function (dt) {
  const p = this.player;
  for (const e of this.enemies) {
    if (e.dead) continue;
    e.hurt = Math.max(0, e.hurt - dt);
    e.atkCd = Math.max(0, e.atkCd - dt);
    e.bob += dt * 4;
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy);
    if (d < 200 && d > 20) {
      const sp = e.speed * dt;
      this.moveEntity(e, (dx/d)*sp, (dy/d)*sp, 8);
    }
    e.sortY = e.y;
    if (d < 22 && e.atkCd <= 0) {
      e.atkCd = 1;
      if (p.invuln <= 0 && !p.shield) {
        p.hp -= e.dmg; p.invuln = 0.5;
        this.addFloater(p.x, p.y - 36, e.dmg, false, true);
      } else if (p.shield) {
        p.stamina = Math.max(0, p.stamina - 6);
      }
    }
  }
};

Game.prototype.updatePet = function (dt) {
  if (!this.pet) return;
  const p = this.player, pt = this.pet;
  const dx = p.x - pt.x, dy = p.y - pt.y, d = Math.hypot(dx, dy);
  pt.bob = (pt.bob || 0) + dt * 5;
  if (d > 34) { const sp = 120 * dt; pt.x += (dx/d)*sp; pt.y += (dy/d)*sp; }
  pt.sortY = pt.y;
};

Game.prototype.updateInteract = function () {
  const p = this.player;
  let near = null;
  for (const c of this.chests) {
    if (c.opened) continue;
    if (Math.hypot(c.x - p.x, c.y - p.y) < 30) { near = c; break; }
  }
  this._nearChest = near;
  this.ui.setInteract(!!near, near ? (near.pet ? "Open (?)" : "Open") : "");
};

Game.prototype.interact = function () {
  const c = this._nearChest;
  if (!c || c.opened) return;
  c.opened = true;
  const p = this.player;
  if (c.pet) {
    this.ui.showPet(c.pet, () => { this.pet = { id: c.pet, x: p.x, y: p.y, bob: 0, sortY: p.y }; 
      const chip = document.getElementById("pet-chip"); if (chip){ chip.classList.remove("hidden"); chip.textContent = "Pet: " + c.pet; } });
  } else {
    const g = 5 + (Math.random()*15|0); p.gold += g;
    const w = ["sword","axe","spear","dagger","bow"][Math.random()*5|0];
    p.inv[w] = (p.inv[w]||0)+1;
    this.ui.toast(`Chest: +${g}g · ${ITEMS[w]?.name||w}!`);
  }
};

Game.prototype.useSkill = function (i) {
  const p = this.player;
  if (p.skillCd[i] > 0) return;
  if (i === 0) { p.skillCd[0]=4; this.mouse.down=true; this.doAttack(); this.mouse.down=false; this.ui.toast("Power Strike!"); }
  else if (i === 1) { if((p.inv.herb||0)>0){p.inv.herb--; p.hp=Math.min(p.maxHp,p.hp+30); p.skillCd[1]=6; this.addFloater(p.x,p.y-36,30,false,false,true); this.ui.toast("Healed +30");} else this.ui.toast("No herbs"); }
  else if (i === 2) { p.skillCd[2]=7; const w=WEAPONS[p.equipped]||WEAPONS.fist; for(const e of this.enemies){if(e.dead)continue; const d=Math.hypot(e.x-p.x,e.y-p.y); if(d<60){const hit=Math.round((w.dmg+p.level*2)*1.3); e.hp-=hit; e.hurt=0.2; this.addFloater(e.x,e.y-e.h,hit,true); this.spawnHit(e.x,e.y); if(e.hp<=0)this.killEnemy(e);}} this._slashT=0.25; this.ui.toast("Whirlwind!"); }
  else if (i === 3) { if(p.stamina>=16){p.evadeT=0.16;p.evadeCd=0.4;p.stamina-=16;p.invuln=0.2;p.skillCd[3]=5;const fx=p.dir==="left"?-1:p.dir==="right"?1:0,fy=p.dir==="up"?-1:p.dir==="down"?1:0;p.vx=fx*340;p.vy=fy*340;} }
};

Game.prototype.equip = function (id) { this.player.equipped = id; this.ui.toast("Equipped " + (ITEMS[id]?.name||id)); this.ui.renderInv(); };

Game.prototype.craft = function (rid) {
  const r = RECIPES.find(x => x.id === rid); if (!r) return;
  const p = this.player;
  if (!canCraft(p.inv, r)) { this.ui.toast("Missing materials"); return; }
  for (const [k,n] of Object.entries(r.need)) p.inv[k] -= n;
  p.inv[r.result] = (p.inv[r.result]||0)+1;
  this.ui.toast("Forged " + (ITEMS[r.result]?.name||r.result));
  this.ui.renderCraft(); this.ui.renderInv();
};

Game.prototype.respawn = function () {
  const p = this.player;
  p.hp = p.maxHp; p.stamina = p.maxStamina;
  p.x = this.camp.x; p.y = this.camp.y + 40;
  this._dead = false; this.paused = false; this.ui.hideDeath();
};

Game.prototype.spawnHit = function (x, y) { this._hits = this._hits || []; this._hits.push({ x, y, t: 0 }); };
Game.prototype.addFloater = function (x, y, val, crit, dmgToPlayer, heal) {
  const sx = (x - this.cam.x) * (this.canvas.clientWidth / VIEW_W);
  const sy = (y - this.cam.y) * (this.canvas.clientHeight / VIEW_H);
  this.ui.dmg(sx, sy, heal ? "+"+val : String(val), crit, heal);
};

Game.prototype.updateClock = function () {
  const el = document.getElementById("clock"); if (!el) return;
  const h = Math.floor(this.time / 60), m = Math.floor(this.time % 60);
  const night = this.time < 5*60 || this.time > 19*60;
  el.textContent = `${night ? "Night" : "Day"} · ${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
};
