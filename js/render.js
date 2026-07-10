import { Game } from "./game.js";
import { img } from "./assets.js";
import { view } from "./view.js";
import { tile as gtile, grassFringe, waterFoam } from "./tilegen.js";
import { buildCharacter, DEFAULT_LOOK } from "./chargen.js";
import { net } from "./net.js";
import { bossFrame, BOSS_SIZE } from "./boss.js";

const T = 24, MAP_W = 110, MAP_H = 110;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const isGrass = (t) => t === 0 || t === 5;   // grass & forest count as grassy for fringe

Game.prototype.render = function () {
  const ctx = this.ctx, p = this.player;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, view.w, view.h);
  // screen shake offset
  const shk = this.shake > 0 ? this.shake : 0;
  const shx = shk ? (Math.random() - 0.5) * shk : 0;
  const shy = shk ? (Math.random() - 0.5) * shk : 0;
  const camx = Math.round(this.cam.x + shx), camy = Math.round(this.cam.y + shy);
  const x0 = Math.max(0, (camx / T) | 0), y0 = Math.max(0, (camy / T) | 0);
  const x1 = Math.min(MAP_W, x0 + (view.w / T) + 2), y1 = Math.min(MAP_H, y0 + (view.h / T) + 2);

  const wf = (this.t * 3) | 0;
  const map = this.map;
  const gAt = (x, y) => (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) ? true : isGrass(map[y * MAP_W + x]);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = y * MAP_W + x, t = map[i], v = this.vmap[i];
      const sx = x * T - camx, sy = y * T - camy;
      let im;
      if (t === 2) im = gtile("water", wf % 4);
      else if (t === 1) im = gtile("dirt", v);
      else if (t === 3) im = gtile("sand", v);
      else if (t === 4) im = gtile("snow", v);
      else if (t === 5) im = gtile("forest", v);
      else im = gtile("grass", v);
      if (im) ctx.drawImage(im, sx, sy, T, T);
      else { ctx.fillStyle = "#5aa050"; ctx.fillRect(sx, sy, T, T); }
      // grass fringe spilling onto non-grassy tiles from grassy neighbors
      if (!isGrass(t)) {
        let mask = 0;
        if (gAt(x, y - 1)) mask |= 1;
        if (gAt(x + 1, y)) mask |= 2;
        if (gAt(x, y + 1)) mask |= 4;
        if (gAt(x - 1, y)) mask |= 8;
        if (mask) { const e = grassFringe(mask); if (e) ctx.drawImage(e, sx, sy, T, T); }
      }
      // foam shoreline on water tiles bordering land
      if (t === 2) {
        const land = (xx, yy) => (xx < 0 || yy < 0 || xx >= MAP_W || yy >= MAP_H) ? false : map[yy * MAP_W + xx] !== 2;
        let fm = 0;
        if (land(x, y - 1)) fm |= 1;
        if (land(x + 1, y)) fm |= 2;
        if (land(x, y + 1)) fm |= 4;
        if (land(x - 1, y)) fm |= 8;
        if (fm) { const f = waterFoam(fm); if (f) ctx.drawImage(f, sx, sy, T, T); }
        // Deterministic code-generated pond life keeps water from feeling tiled.
        const seed = (x * 37 + y * 19) % 47;
        if (seed === 0) {
          const bob = Math.round(Math.sin(this.t * 1.8 + x) * 1);
          ctx.fillStyle = "#2c7259"; ctx.fillRect(sx + 7, sy + 10 + bob, 8, 4);
          ctx.fillStyle = "#54a46b"; ctx.fillRect(sx + 8, sy + 9 + bob, 5, 2);
          ctx.fillStyle = "#8dd27d"; ctx.fillRect(sx + 10, sy + 9 + bob, 2, 1);
          if ((x + y) % 2 === 0) { ctx.fillStyle = "#f4d2df"; ctx.fillRect(sx + 12, sy + 7 + bob, 3, 3); ctx.fillStyle = "#fff4c8"; ctx.fillRect(sx + 13, sy + 8 + bob, 1, 1); }
        }
      }
    }
  }

  // camp fire — layered flame + rising embers
  const csx = this.camp.x - camx, csy = this.camp.y - camy;
  if (csx > -40 && csx < view.w + 40) {
    const fl = 6 + Math.sin(this.t * 8) * 2, fl2 = Math.sin(this.t * 13) * 1.5;
    ctx.fillStyle = "rgba(60,40,25,0.5)"; ctx.beginPath(); ctx.ellipse(csx, csy, 18, 8, 0, 0, 7); ctx.fill();
    for (let a = 0; a < 6; a++) { const an = a / 6 * 7; ctx.fillStyle = "#7a5230"; ctx.fillRect(csx + Math.cos(an) * 12 - 2, csy + Math.sin(an) * 5 - 1, 4, 3); }
    // outer flame
    ctx.fillStyle = "#c8481e"; ctx.beginPath(); ctx.ellipse(csx + fl2, csy - 4, fl * 0.7, fl * 1.5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#f08828"; ctx.beginPath(); ctx.ellipse(csx, csy - 5, fl * 0.5, fl * 1.2, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#f8d048"; ctx.beginPath(); ctx.ellipse(csx - fl2 * 0.5, csy - 6, fl * 0.3, fl * 0.7, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#fff0c0"; ctx.beginPath(); ctx.ellipse(csx, csy - 6, fl * 0.15, fl * 0.4, 0, 0, 7); ctx.fill();
    // rising embers
    for (let i = 0; i < 3; i++) { const ey = (this.t * 20 + i * 9) % 24; ctx.fillStyle = `rgba(255,${170 + i * 20},80,${1 - ey / 24})`; ctx.fillRect(csx + Math.sin(this.t * 3 + i) * 5, csy - 6 - ey, 1.5, 1.5); }
  }

  // flowers (flat, under everything)
  const FCOL = [["#f2d0dc", "#e88aa8"], ["#dfe8ff", "#7aa0e0"], ["#fff0c0", "#f0c040"]];
  for (const fl of this.flowers) {
    const sx = fl.x - camx, sy = fl.y - camy;
    if (sx < -8 || sx > view.w + 8) continue;
    const c = FCOL[fl.k];
    ctx.fillStyle = "#4a8040"; ctx.fillRect(sx, sy, 1, 3);
    ctx.fillStyle = c[0]; ctx.fillRect(sx - 1, sy - 2, 3, 3);
    ctx.fillStyle = c[1]; ctx.fillRect(sx, sy - 1, 1, 1);
  }

  // swaying grass tufts (flat detail)
  if (this.tufts) for (const tf of this.tufts) {
    const sx = tf.x - camx, sy = tf.y - camy;
    if (sx < -6 || sx > view.w + 6 || sy < -6 || sy > view.h + 6) continue;
    const sway = Math.sin(this.t * 1.5 + tf.ph) * 1.2;
    ctx.strokeStyle = "#4f9a44"; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx, sy); ctx.lineTo(sx + sway, sy - 4);
    ctx.moveTo(sx - 1, sy); ctx.lineTo(sx - 1 + sway, sy - 3);
    ctx.moveTo(sx + 1, sy); ctx.lineTo(sx + 1 + sway, sy - 3);
    ctx.stroke();
  }

  const draw = [];
  const inv = (wx, wy, margin = 80) => wx - camx > -margin && wx - camx < view.w + margin && wy - camy > -margin && wy - camy < view.h + margin;
  for (const o of this.buildings) if (inv(o.x, o.y, 100)) draw.push({ y: o.sortY, k: "building", o });
  for (const o of this.trees) if (inv(o.x, o.y, 90)) draw.push({ y: o.sortY, k: "tree", o });
  for (const o of this.bushes) if (inv(o.x, o.y)) draw.push({ y: o.sortY, k: "bush", o });
  for (const o of this.rocks) if (inv(o.x, o.y)) draw.push({ y: o.sortY, k: "rock", o });
  for (const o of this.plants) if (o.hp > 0 && inv(o.x, o.y)) draw.push({ y: o.sortY, k: "plant", o });
  for (const o of this.chests) if (inv(o.x, o.y)) draw.push({ y: o.y, k: "chest", o });
  for (const o of this.npcs) if (inv(o.x, o.y)) draw.push({ y: o.sortY, k: "npc", o });
  for (const e of this.enemies) if (!e.dead && inv(e.x, e.y)) draw.push({ y: e.sortY, k: "enemy", o: e });
  if (this.boss && !this.boss.dead && inv(this.boss.x, this.boss.y, 140)) draw.push({ y: this.boss.sortY, k: "boss", o: this.boss });
  if (this.pet) draw.push({ y: this.pet.sortY, k: "pet", o: this.pet });
  draw.push({ y: p.sortY, k: "player", o: p });
  // remote players (multiplayer presence) — interpolate toward server pos
  for (const id in net.remote) {
    const rp = net.remote[id];
    rp.rx += (rp.x - rp.rx) * 0.25;
    rp.ry += (rp.y - rp.ry) * 0.25;
    if (rp.moving) { rp.frameT += 0.016; if (rp.frameT > 0.12) { rp.frameT = 0; rp.frame = (rp.frame + 1) % 4; } }
    else rp.frame = 0;
    if (inv(rp.rx, rp.ry)) draw.push({ y: rp.ry, k: "remote", o: rp });
  }
  draw.sort((a, b) => a.y - b.y);

  for (const d of draw) {
    const o = d.o, sx = Math.round(o.x - camx), sy = Math.round(o.y - camy);
    if (d.k === "building") { const cv = this.village[o.type]; if (cv) ctx.drawImage(cv, sx - cv.width / 2, sy - cv.height + 8); }
    else if (d.k === "tree") { const im = img(`tree_${o.v}`); if (im) ctx.drawImage(im, sx - im.width / 2, sy - im.height + 6); }
    else if (d.k === "bush") { const im = img("bush_0"); if (im) ctx.drawImage(im, sx - im.width / 2, sy - im.height + 4); }
    else if (d.k === "rock") {
      ctx.fillStyle = "rgba(20,18,22,0.25)"; ctx.beginPath(); ctx.ellipse(sx, sy, 9, 3, 0, 0, 7); ctx.fill();
      ctx.fillStyle = o.snow ? "#c8d0d8" : "#8a8f98"; ctx.beginPath(); ctx.ellipse(sx, sy - 3, 8, 6, 0, 0, 7); ctx.fill();
      ctx.fillStyle = o.snow ? "#e8eef4" : "#a6acb6"; ctx.beginPath(); ctx.ellipse(sx - 2, sy - 5, 4, 3, 0, 0, 7); ctx.fill();
      ctx.fillStyle = "#20222a"; ctx.beginPath(); ctx.ellipse(sx, sy - 1, 8, 4, 0, 0, 7); ctx.globalAlpha = 0.3; ctx.fill(); ctx.globalAlpha = 1;
    }
    else if (d.k === "plant") {
      const swayX = Math.sin(o.sway || 0) * 2 + (o.shake > 0 ? (Math.random() - 0.5) * 4 : 0);
      ctx.save(); ctx.translate(sx + swayX, sy);
      // shadow
      ctx.fillStyle = "rgba(20,18,22,0.2)"; ctx.beginPath(); ctx.ellipse(0, 0, 8, 3, 0, 0, 7); ctx.fill();
      if (o.kind === "bamboo_shoot") {
        ctx.fillStyle = "#5a9a48"; ctx.fillRect(-2, -18, 4, 16);
        ctx.fillStyle = "#7abf60"; ctx.fillRect(-2, -18, 1, 16);
        ctx.fillStyle = "#3a7a30"; ctx.fillRect(0, -14, 4, 1); ctx.fillRect(0, -8, 4, 1);
        ctx.fillStyle = "#6ec058"; ctx.beginPath(); ctx.ellipse(-5, -16, 4, 2, -0.4, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.ellipse(5, -16, 4, 2, 0.4, 0, 7); ctx.fill();
      } else if (o.kind === "herb_bush") {
        ctx.fillStyle = "#4a9038"; ctx.beginPath(); ctx.arc(0, -8, 9, 0, 7); ctx.fill();
        ctx.fillStyle = "#6ec058"; ctx.beginPath(); ctx.arc(-3, -10, 6, 0, 7); ctx.fill();
        ctx.fillStyle = "#8ae070"; ctx.fillRect(-4, -12, 2, 2); ctx.fillRect(2, -8, 2, 2);
        ctx.fillStyle = "#f0e8a0"; ctx.fillRect(-1, -6, 2, 2); // flower
      } else if (o.kind === "crystal_ore") {
        ctx.fillStyle = "#5a6e7a"; ctx.beginPath(); ctx.ellipse(0, -4, 9, 7, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "#8ac0e0"; ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(-5, -6); ctx.lineTo(5, -6); ctx.fill();
        ctx.fillStyle = "#c0e8ff"; ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(-2, -6); ctx.lineTo(0, -6); ctx.fill();
        ctx.fillStyle = "#a0d0f0"; ctx.beginPath(); ctx.moveTo(-6, -10); ctx.lineTo(-9, -2); ctx.lineTo(-3, -2); ctx.fill();
        const glint = 0.5 + Math.sin(this.t * 3) * 0.3;
        ctx.fillStyle = `rgba(200,240,255,${glint})`; ctx.fillRect(-1, -13, 2, 2);
      } else if (o.kind === "glow_vine") {
        ctx.strokeStyle = "#4a7038"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-6, -8, -2, -16); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(6, -10, 3, -18); ctx.stroke();
        const glw = 0.6 + Math.sin(this.t * 2 + o.sway) * 0.3;
        ctx.fillStyle = `rgba(120,255,180,${glw})`;
        ctx.beginPath(); ctx.arc(-2, -16, 3, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(3, -18, 2.5, 0, 7); ctx.fill();
        ctx.fillStyle = `rgba(180,255,200,${glw * 0.5})`;
        ctx.beginPath(); ctx.arc(-2, -16, 6, 0, 7); ctx.fill();
      }
      // hp indicator (small bar if damaged)
      if (o.hp < (o.kind === "crystal_ore" ? 3 : 2) && o.hp > 0) {
        ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(-8, -24, 16, 3);
        ctx.fillStyle = "#7ae060"; ctx.fillRect(-8, -24, 16 * (o.hp / (o.kind === "crystal_ore" ? 3 : 2)), 3);
      }
      ctx.restore();
    }
    else if (d.k === "chest") {
      const open = o.opened;
      const im = img(open ? "fx/chest_open" : "fx/chest");
      if (!open && this._interactTarget === o) {
        const pulse = Math.round(Math.sin(this.t * 5) * 2);
        ctx.strokeStyle = o.pet ? "#f1cf63" : "#76e0b2"; ctx.lineWidth = 1;
        ctx.strokeRect(sx - 15 - pulse, sy - 20 - pulse, 30 + pulse * 2, 23 + pulse * 2);
        ctx.fillStyle = o.pet ? "#ffe38a" : "#a2f2cd";
        ctx.fillRect(sx - 2, sy - 27 - pulse, 5, 2); ctx.fillRect(sx - 1, sy - 25 - pulse, 3, 2); ctx.fillRect(sx, sy - 23 - pulse, 1, 2);
      }
      // lid lift animation
      if (open && o.openT < 1) { ctx.save(); ctx.translate(sx, sy); }
      if (im) ctx.drawImage(im, sx - 12, sy - 16 - (open ? Math.round(o.openT * 3) : 0));
      if (open && o.openT < 1) ctx.restore();
      if (!open && o.pet) { ctx.fillStyle = `rgba(255,230,120,${0.5 + 0.5 * Math.sin(this.t * 5)})`; ctx.fillRect(sx + 6, sy - 20, 2, 2); }
    }
    else if (d.k === "npc") {
      const cv = o.cache.walk["down"][o.frame % 4];
      // exclamation marker for available quest
      ctx.drawImage(cv, sx - 16, sy - 36);
      const hasQuest = this.quests.forGiver(o.name, p.inv).some(x => !x.active && !x.done);
      const ready = this.quests.forGiver(o.name, p.inv).some(x => x.ready);
      if (ready) { ctx.fillStyle = "#ffd24a"; ctx.font = "bold 14px sans-serif"; ctx.fillText("?", sx - 3, sy - 40 + Math.sin(this.t * 4) * 2); }
      else if (hasQuest) { ctx.fillStyle = "#ffe070"; ctx.font = "bold 15px sans-serif"; ctx.fillText("!", sx - 2, sy - 40 + Math.sin(this.t * 4) * 2); }
      // name tag
      ctx.font = "7px 'IBM Plex Sans',sans-serif"; ctx.textAlign = "center";
      ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(sx - 18, sy - 46, 36, 9);
      ctx.fillStyle = "#e8ecf2"; ctx.fillText(o.name, sx, sy - 39); ctx.textAlign = "left";
    }
    else if (d.k === "remote") {
      const rsx = Math.round(o.rx - camx), rsy = Math.round(o.ry - camy);
      if (!o.cache) {
        let lk; try { lk = JSON.parse(o.look); } catch { lk = {}; }
        o.cache = buildCharacter({ ...DEFAULT_LOOK, ...lk, name: o.name });
      }
      const dir = ["down", "up", "left", "right"].includes(o.dir) ? o.dir : "down";
      const cv = o.cache.walk[dir][o.frame % 4];
      // soft shadow for remote player
      ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.beginPath(); ctx.ellipse(rsx, rsy + 1, 12, 3.5, 0, 0, 7); ctx.fill();
      ctx.drawImage(cv, rsx - 16, rsy - 36);
      // name tag (blue tint to distinguish other players)
      ctx.font = "7px 'IBM Plex Sans',sans-serif"; ctx.textAlign = "center";
      ctx.fillStyle = "rgba(20,40,80,0.6)"; ctx.fillRect(rsx - 18, rsy - 46, 36, 9);
      ctx.fillStyle = "#9fd0ff"; ctx.fillText(o.name, rsx, rsy - 39); ctx.textAlign = "left";
    }
    else if (d.k === "enemy") {
      const im = this.monCache[o.id] ? this.monCache[o.id][o.frame % 4] : null;
      const bob = Math.sin(o.bob) * 2;
      if (im) {
        // soft shadow
        ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.beginPath(); ctx.ellipse(sx, sy + 1, im.width * 0.35, 3, 0, 0, 7); ctx.fill();
        ctx.drawImage(im, sx - im.width / 2, sy - im.height + bob);
        if (o.state === "chase" && o.angry > 0) { ctx.fillStyle = "#ff5a5a"; ctx.font = "bold 11px sans-serif"; ctx.fillText("!", sx - 2, sy - im.height + bob - 2); }
        if (o.hp < o.maxHp) {
          ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(sx - 12, sy - im.height + bob - 5, 24, 3);
          ctx.fillStyle = "#e05050"; ctx.fillRect(sx - 12, sy - im.height + bob - 5, 24 * (o.hp / o.maxHp), 3);
        }
        if (o.hurt > 0) { ctx.save(); ctx.globalAlpha = o.hurt * 3; ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = "rgba(255,120,120,0.7)"; ctx.fillRect(sx - im.width / 2, sy - im.height + bob, im.width, im.height); ctx.restore(); }
        if (o.frozen) { ctx.save(); ctx.globalAlpha = 0.4; ctx.fillStyle = "rgba(140,220,255,0.8)"; ctx.fillRect(sx - im.width / 2, sy - im.height + bob, im.width, im.height); ctx.restore(); }
      }
    }
    else if (d.k === "boss") {
      const sz = BOSS_SIZE; // native integer scale stays crisp after the canvas scales
      const frame = bossFrame(o.frame, o.rage);
      // large soft shadow for boss
      ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.ellipse(sx, sy + 2, sz * 0.4, 6, 0, 0, 7); ctx.fill();
      if (frame) {
        ctx.save();
        if (o.hurt > 0) ctx.filter = "brightness(1.6)";
        // rage glow aura
        if (o.rage) { ctx.shadowColor = "rgba(255,80,20,0.8)"; ctx.shadowBlur = 20; }
        ctx.drawImage(frame, Math.round(sx - sz / 2), Math.round(sy - sz + 8));
        ctx.restore();
      }
    }
    else if (d.k === "pet") { const im = this.monCache[o.id] ? this.monCache[o.id][(Math.floor(this.t * 4)) % 4] : null; const bob = Math.sin(o.bob) * 2; if (im) ctx.drawImage(im, sx - im.width / 2, sy - im.height * 0.7 + bob, im.width * 0.7, im.height * 0.7); }
    else if (d.k === "player") {
      const dir = p.dir;
      // soft shadow
      ctx.fillStyle = "rgba(0,0,0,0.22)"; ctx.beginPath(); ctx.ellipse(sx, sy + 1, 12, 3.5, 0, 0, 7); ctx.fill();
      let body, weap;
      if (p.attackT > 0) {
        const ph = 1 - p.attackT / p.attackDur;
        const fi = clamp(Math.floor(ph * 5), 0, 4);
        body = this.charCache.atk[dir][fi];
        const wf2 = this.weaponFrames(p.equipped);
        weap = wf2.atk[dir][fi];
      } else {
        body = this.charCache.walk[dir][p.frame % 4];
        const wf2 = this.weaponFrames(p.equipped);
        weap = wf2.walk[dir];
      }
      if (p.invuln > 0 && Math.floor(this.t * 20) % 2) ctx.globalAlpha = 0.5;
      // weapon behind body when facing up/left
      const behind = dir === "up" || dir === "left";
      if (behind && weap) ctx.drawImage(weap, sx - 16, sy - 36);
      if (body) ctx.drawImage(body, sx - 16, sy - 36);
      if (!behind && weap) ctx.drawImage(weap, sx - 16, sy - 36);
      ctx.globalAlpha = 1;
    }
  }

  if (this._hits) {
    for (const h of this._hits) { h.t += 1 / 60; const f = Math.min(3, (h.t / 0.05) | 0); const im = img(`fx/hit_${f}`); if (im) ctx.drawImage(im, Math.round(h.x - camx) - 8, Math.round(h.y - camy) - 8); }
    this._hits = this._hits.filter(h => h.t < 0.2);
  }
  if (this.aimAssist && this.aimAssist.until > this.t) {
    const ax = Math.round(this.aimAssist.x - camx), ay = Math.round(this.aimAssist.y - camy);
    const pulse = 7 + Math.round(Math.sin(this.t * 18));
    ctx.strokeStyle = "rgba(225,255,190,.9)"; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ax - pulse, ay - pulse + 4); ctx.lineTo(ax - pulse, ay - pulse); ctx.lineTo(ax - pulse + 4, ay - pulse);
    ctx.moveTo(ax + pulse - 4, ay - pulse); ctx.lineTo(ax + pulse, ay - pulse); ctx.lineTo(ax + pulse, ay - pulse + 4);
    ctx.moveTo(ax - pulse, ay + pulse - 4); ctx.lineTo(ax - pulse, ay + pulse); ctx.lineTo(ax - pulse + 4, ay + pulse);
    ctx.moveTo(ax + pulse - 4, ay + pulse); ctx.lineTo(ax + pulse, ay + pulse); ctx.lineTo(ax + pulse, ay + pulse - 4);
    ctx.stroke();
  }
  for (const pa of this.particles) { ctx.fillStyle = pa.color; ctx.globalAlpha = Math.max(0, pa.life * 2); ctx.fillRect(Math.round(pa.x - camx), Math.round(pa.y - camy), 2, 2); }
  ctx.globalAlpha = 1;

  this.renderFX(ctx, camx, camy);
  // fishing line + bobber
  if (this.fishing) {
    const f = this.fishing, p = this.player;
    const px = Math.round(p.x - camx), py = Math.round(p.y - camy - 20);
    const bx = Math.round(f.bobX - camx), by = Math.round(f.bobY - camy);
    const dx = bx - px, dy = by - py, distance = Math.hypot(dx, dy) || 1;
    const rodTipX = Math.round(px + dx / distance * 12), rodTipY = Math.round(py + dy / distance * 12 - 6);
    const tension = f.tension || 0;
    // Bent rod and curved line communicate tension before the HUD is read.
    ctx.strokeStyle = "#5a351e"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px - dx / distance * 5, py + 4); ctx.lineTo(rodTipX, rodTipY); ctx.stroke();
    ctx.strokeStyle = tension > .8 ? "rgba(255,150,120,.95)" : "rgba(235,244,238,.78)"; ctx.lineWidth = 1;
    const sag = f.state === "hooked" ? Math.round((1 - tension) * 10) : 5;
    ctx.beginPath(); ctx.moveTo(rodTipX, rodTipY); ctx.quadraticCurveTo((rodTipX + bx) / 2, (rodTipY + by) / 2 + sag, bx, by); ctx.stroke();
    const bounce = f.state === "bite" ? Math.sin(this.t * 30) * 2 : f.state === "hooked" ? Math.sin(this.t * (f.surge ? 24 : 8)) * (f.surge ? 3 : 1) : Math.sin(this.t * 3);
    if (f.state === "hooked") {
      const dart = Math.round(Math.sin(f.totalT * (3 + f.fish.difficulty * 3) + f.phase) * (6 + f.fish.difficulty * 8));
      ctx.fillStyle = "rgba(14,55,70,.48)";
      ctx.fillRect(bx + dart - 7, by + 6, 12, 4); ctx.fillRect(bx + dart - 4, by + 4, 7, 8);
      ctx.fillRect(bx + dart + 5, by + 5, 3, 2); ctx.fillRect(bx + dart + 5, by + 9, 3, 2);
      if (f.surge) {
        ctx.strokeStyle = "rgba(205,245,250,.8)";
        for (let i = 0; i < 2; i++) { const radius = 5 + ((this.t * 18 + i * 6) % 13); ctx.strokeRect(bx - radius, by - Math.round(radius / 3), radius * 2, Math.round(radius / 1.5)); }
      }
    }
    // bobber
    ctx.fillStyle = "#c83f3f"; ctx.fillRect(bx - 2, Math.round(by + bounce - 2), 5, 4);
    ctx.fillStyle = "#fff1d2"; ctx.fillRect(bx - 1, Math.round(by + bounce - 2), 3, 1);
    if (f.state === "bite") {
      // ripple + "!" alert
      ctx.strokeStyle = `rgba(255,255,255,${0.5 + 0.5 * Math.sin(this.t * 20)})`;
      const ripple = 5 + Math.round(Math.sin(this.t * 12) * 2); ctx.strokeRect(bx - ripple, by - Math.round(ripple / 2), ripple * 2, ripple);
      ctx.fillStyle = "#ffd24a"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center";
      ctx.fillText("!", bx, by - 8); ctx.textAlign = "left";
    }
  }
  // ambient critters: butterflies by day, glowing fireflies at night
  const night = this.time > 19 * 60 || this.time < 5 * 60;
  if (this.critters) for (const c of this.critters) {
    const sx = Math.round(c.x - camx), sy = Math.round(c.y - camy - 12);
    if (sx < -8 || sx > view.w + 8 || sy < -8 || sy > view.h + 8) continue;
    if (night) {
      const glow = 0.4 + 0.6 * Math.sin(c.ph);
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = `rgba(160,255,120,${glow * 0.35})`; ctx.beginPath(); ctx.arc(sx, sy, 6, 0, 7); ctx.fill();
      ctx.fillStyle = `rgba(200,255,160,${glow * 0.2})`; ctx.beginPath(); ctx.arc(sx, sy, 10, 0, 7); ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = `rgba(240,255,200,${glow})`; ctx.fillRect(sx, sy, 2, 2);
      ctx.fillStyle = `rgba(255,255,220,${glow * 0.8})`; ctx.fillRect(sx, sy, 1, 1);
    } else {
      const flap = Math.sin(c.ph) > 0;
      if (c.kind === "bird") {
        // little "m" shaped bird
        ctx.strokeStyle = "#48566e"; ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(sx - 3, sy); ctx.quadraticCurveTo(sx - 1, sy - (flap ? 3 : 1), sx, sy);
        ctx.quadraticCurveTo(sx + 1, sy - (flap ? 3 : 1), sx + 3, sy); ctx.stroke();
      } else {
        // butterfly: body + 2 wings that flap
        const wy = flap ? 2 : 3, wx = flap ? 3 : 2;
        const col = ["#f0a0d0", "#f0c860", "#a0c0f0", "#f08080"][(c.ph | 0) % 4] || "#f0a0d0";
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.ellipse(sx - 2, sy, wx, wy, 0.5, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.ellipse(sx + 2, sy, wx, wy, -0.5, 0, 7); ctx.fill();
        ctx.fillStyle = "#3a2a3a"; ctx.fillRect(sx, sy - 2, 1, 4);
      }
    }
  }
  this.renderDayNight(ctx);
  this.renderWeather(ctx);
  this.renderPostFX(ctx);
  this.renderMinimap();
};

// Post-processing: vignette + ambient color grade + depth fog + subtle bloom
Game.prototype.renderPostFX = function (ctx) {
  const w = view.w, h = view.h;
  // 1. Depth fog — subtle warm haze at top (distance), cool at bottom (foreground)
  const fog = ctx.createLinearGradient(0, 0, 0, h);
  fog.addColorStop(0, "rgba(180,200,160,0.08)");
  fog.addColorStop(0.4, "rgba(0,0,0,0)");
  fog.addColorStop(0.85, "rgba(0,0,0,0)");
  fog.addColorStop(1, "rgba(40,30,20,0.06)");
  ctx.fillStyle = fog;
  ctx.fillRect(0, 0, w, h);

  // 2. Color grading — warm/magical tint overlay (very subtle)
  const grade = ctx.createLinearGradient(0, 0, w, h);
  const t = this.time;
  const morning = t > 5*60 && t < 9*60;
  const golden = t > 16*60 && t < 19*60;
  if (morning) {
    grade.addColorStop(0, "rgba(255,220,160,0.06)");
    grade.addColorStop(1, "rgba(200,230,255,0.04)");
  } else if (golden) {
    grade.addColorStop(0, "rgba(255,180,100,0.08)");
    grade.addColorStop(1, "rgba(255,120,60,0.05)");
  } else {
    grade.addColorStop(0, "rgba(255,250,240,0.02)");
    grade.addColorStop(1, "rgba(240,250,255,0.02)");
  }
  ctx.fillStyle = grade;
  ctx.fillRect(0, 0, w, h);

  // 3. Vignette — darken edges for focal depth
  const cx = w / 2, cy = h / 2;
  const vig = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.3, cx, cy, Math.max(w, h) * 0.7);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.28)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
};

Game.prototype.renderFX = function (ctx, camx, camy) {
  for (const f of this.fx) {
    const sx = f.x - camx, sy = f.y - camy, pr = f.t / f.dur;
    if (f.kind === "heal") {
      ctx.globalAlpha = 1 - pr;
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * 7 + f.t * 3;
        const rr = 6 + pr * 20;
        ctx.fillStyle = "#88f0a8";
        ctx.fillRect(sx + Math.cos(a) * rr, sy - 8 - pr * 24 + Math.sin(a) * rr * 0.4, 2, 3);
      }
      ctx.globalAlpha = 1;
    } else if (f.kind === "whirl") {
      // layered fiery whirlwind
      ctx.save(); ctx.translate(sx, sy - 14); ctx.rotate(pr * 14);
      const cols = ["rgba(255,220,120,A)", "rgba(255,150,60,A)", "rgba(255,90,40,A)"];
      for (let ring = 0; ring < 3; ring++) {
        ctx.strokeStyle = cols[ring].replace("A", String((1 - pr) * (0.9 - ring * 0.2)));
        ctx.lineWidth = 4 - ring;
        ctx.beginPath(); ctx.arc(0, 0, 14 + ring * 8 + pr * 26, ring, ring + 5); ctx.stroke();
      }
      ctx.restore();
      // embers flung out
      for (let i = 0; i < 6; i++) { const a = i / 6 * 7 + pr * 8; const rr = 20 + pr * 34; ctx.fillStyle = `rgba(255,${150 + i * 12},60,${1 - pr})`; ctx.fillRect(sx + Math.cos(a) * rr, sy - 14 + Math.sin(a) * rr, 2.5, 2.5); }
    } else if (f.kind === "slashbig") {
      const ox = f.dir === "left" ? -18 : f.dir === "right" ? 18 : 0;
      const oy = f.dir === "up" ? -20 : f.dir === "down" ? 6 : -8;
      ctx.save(); ctx.translate(sx + ox, sy - 16 + oy);
      // fiery double-arc
      ctx.strokeStyle = `rgba(255,240,180,${1 - pr})`; ctx.lineWidth = 5 - pr * 4;
      ctx.beginPath(); ctx.arc(0, 0, 16 + pr * 18, -1, 1.9); ctx.stroke();
      ctx.strokeStyle = `rgba(255,140,60,${(1 - pr) * 0.8})`; ctx.lineWidth = 3 - pr * 2;
      ctx.beginPath(); ctx.arc(0, 0, 12 + pr * 16, -0.8, 1.7); ctx.stroke();
      ctx.restore();
    } else if (f.kind === "levelring") {
      ctx.strokeStyle = `rgba(240,216,120,${1 - pr})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(sx, sy - 16, 8 + pr * 40, 0, 7); ctx.stroke();
      for (let i = 0; i < 6; i++) { const a = i / 6 * 7; ctx.fillStyle = `rgba(255,230,140,${1 - pr})`; ctx.fillRect(sx + Math.cos(a) * (10 + pr * 40), sy - 16 + Math.sin(a) * (10 + pr * 40), 3, 3); }
    } else if (f.kind === "dashline") {
      const ox = f.dir === "left" ? 1 : f.dir === "right" ? -1 : 0;
      const oy = f.dir === "up" ? 1 : f.dir === "down" ? -1 : 0;
      ctx.strokeStyle = `rgba(200,230,255,${(1 - pr) * 0.7})`; ctx.lineWidth = 2;
      for (let i = 1; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(sx + ox * i * 6, sy - 16 + oy * i * 6 - 4); ctx.lineTo(sx + ox * i * 6, sy - 16 + oy * i * 6 + 4); ctx.stroke(); }
    } else if (f.kind === "pop") {
      ctx.strokeStyle = `rgba(255,255,255,${1 - pr})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx, sy, 4 + pr * 16, 0, 7); ctx.stroke();
    } else if (f.kind === "hit") {
      ctx.save(); ctx.globalAlpha = 1 - pr;
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
      for (let a = 0; a < 4; a++) {
        const ang = a * 1.57;
        ctx.beginPath(); ctx.moveTo(sx + Math.cos(ang) * 3, sy + Math.sin(ang) * 3);
        ctx.lineTo(sx + Math.cos(ang) * (7 + pr * 4), sy + Math.sin(ang) * (7 + pr * 4)); ctx.stroke();
      }
      ctx.fillStyle = `rgba(255,255,200,${0.5 - pr * 0.5})`;
      ctx.beginPath(); ctx.arc(sx, sy, 3, 0, 7); ctx.fill();
      ctx.restore();
    } else if (f.kind === "bosswarn") {
      ctx.save(); ctx.translate(sx, sy);
      const length = 78 + pr * 28, half = .22 + pr * .08;
      ctx.fillStyle = `rgba(255,70,35,${.08 + pr * .14})`;
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(f.angle - half) * length, Math.sin(f.angle - half) * length);
      ctx.lineTo(Math.cos(f.angle + half) * length, Math.sin(f.angle + half) * length);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = `rgba(255,190,80,${.35 + pr * .55})`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(f.angle) * length, Math.sin(f.angle) * length); ctx.stroke();
      const pulse = 9 + Math.round(pr * 14); ctx.strokeStyle = `rgba(255,120,45,${1 - pr * .35})`;
      ctx.strokeRect(-pulse, -pulse, pulse * 2, pulse * 2); ctx.restore();
    } else if (f.kind === "frost") {      // expanding icy ring + shards
      ctx.strokeStyle = `rgba(150,230,255,${1 - pr})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(sx, sy - 8, 8 + pr * 60, 0, 7); ctx.stroke();
      ctx.strokeStyle = `rgba(200,245,255,${(1 - pr) * 0.7})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx, sy - 8, 4 + pr * 40, 0, 7); ctx.stroke();
      for (let i = 0; i < 8; i++) { const a = i / 8 * 7 + pr * 2; const rr = 10 + pr * 50; ctx.fillStyle = `rgba(220,245,255,${1 - pr})`; ctx.fillRect(sx + Math.cos(a) * rr, sy - 8 + Math.sin(a) * rr, 2, 4); }
    }
  }
  // ---- projectiles ----
  if (this.projectiles) for (const pr of this.projectiles) {
    const sx = pr.x - camx, sy = pr.y - camy;
    if (pr.kind === "fire" || pr.kind === "bossfire") {
      const r = pr.kind === "bossfire" ? 7 : 5;
      ctx.fillStyle = `rgba(255,220,120,0.95)`; ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.fill();
      ctx.fillStyle = `rgba(255,130,40,0.85)`; ctx.beginPath(); ctx.arc(sx, sy, r * 0.6, 0, 7); ctx.fill();
    } else if (pr.kind === "arrow") {
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(Math.atan2(pr.dy, pr.dx));
      ctx.strokeStyle = "#caa060"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(5, 0); ctx.stroke();
      ctx.fillStyle = "#e8e0d0"; ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(1, -2.5); ctx.lineTo(1, 2.5); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
};

Game.prototype.renderDayNight = function (ctx) {
  const t = this.time; let dark = 0;
  if (t < 5 * 60) dark = 0.72;
  else if (t < 7 * 60) dark = 0.72 * (1 - (t - 5 * 60) / (2 * 60));
  else if (t < 17 * 60) dark = 0;
  else if (t < 19 * 60) dark = 0.72 * ((t - 17 * 60) / (2 * 60));
  else dark = 0.72;
  if (dark > 0.01) {
    const night = t > 19 * 60 || t < 5 * 60;
    ctx.fillStyle = night ? `rgba(18,24,58,${dark})` : `rgba(60,40,70,${dark * 0.8})`;
    ctx.fillRect(0, 0, view.w, view.h);
    const glow = (wx, wy, r, col) => { const g = ctx.createRadialGradient(wx, wy, 4, wx, wy, r); g.addColorStop(0, col); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(wx, wy, r, 0, 7); ctx.fill(); };
    ctx.globalCompositeOperation = "lighter";
    glow(this.camp.x - this.cam.x, this.camp.y - this.cam.y, 95, `rgba(255,180,80,${dark * 0.5})`);
    glow(this.player.x - this.cam.x, this.player.y - this.cam.y, 72, `rgba(255,210,140,${dark * 0.4})`);
    // lantern glows near village
    for (const b of this.buildings) {
      if (b.type !== "lantern") continue;
      const lx = b.x - this.cam.x, ly = b.y - this.cam.y;
      if (lx < -60 || lx > view.w + 60) continue;
      const flicker = 0.85 + Math.sin(this.t * 5 + b.x * 0.01) * 0.15;
      glow(lx, ly - 20, 38, `rgba(255,200,100,${dark * 0.55 * flicker})`);
    }
    // torii gate aura
    for (const b of this.buildings) {
      if (b.type !== "torii") continue;
      const tx = b.x - this.cam.x, ty = b.y - this.cam.y;
      if (tx < -60 || tx > view.w + 60) continue;
      glow(tx, ty - 20, 55, `rgba(255,140,80,${dark * 0.3})`);
    }
    // pagoda spiritual glow
    for (const b of this.buildings) {
      if (b.type !== "pagoda") continue;
      const px2 = b.x - this.cam.x, py2 = b.y - this.cam.y;
      if (px2 < -60 || px2 > view.w + 60) continue;
      glow(px2, py2 - 50, 50, `rgba(180,220,255,${dark * 0.25})`);
    }
    ctx.globalCompositeOperation = "source-over";
    // torch fire animation at camp entrance (obor api)
    if (night) {
      for (const b of this.buildings) {
        if (b.type !== "lantern") continue;
        const lx = b.x - this.cam.x, ly = b.y - this.cam.y;
        if (lx < -30 || lx > view.w + 30) continue;
        const fy = ly - 22 + Math.sin(this.t * 8 + b.x) * 1.5;
        const fs = 3 + Math.sin(this.t * 10 + b.y) * 1;
        ctx.fillStyle = `rgba(255,140,50,${0.7 + Math.sin(this.t * 12) * 0.2})`;
        ctx.beginPath(); ctx.ellipse(lx, fy, fs, fs + 2, 0, 0, 7); ctx.fill();
        ctx.fillStyle = `rgba(255,220,120,0.6)`;
        ctx.beginPath(); ctx.ellipse(lx, fy - 1, fs * 0.5, fs * 0.6, 0, 0, 7); ctx.fill();
      }
    }
  }
};

Game.prototype.renderWeather = function (ctx) {
  if (this.weather === "clear" && !this.weatherP.length) return;
  if (this.weather === "rain") {
    ctx.strokeStyle = "rgba(170,200,230,0.5)"; ctx.lineWidth = 1;
    ctx.beginPath();
    for (const d of this.weatherP) { ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 3, d.y + 8); }
    ctx.stroke();
    ctx.fillStyle = "rgba(40,55,80,0.12)"; ctx.fillRect(0, 0, view.w, view.h);
  } else if (this.weather === "snow") {
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    for (const d of this.weatherP) ctx.fillRect(d.x, d.y, 2, 2);
    ctx.fillStyle = "rgba(220,230,245,0.1)"; ctx.fillRect(0, 0, view.w, view.h);
  }
};

Game.prototype.renderMinimap = function () {
  const m = this.mctx, S = 120, sc = S / MAP_W;
  m.clearRect(0, 0, S, S);
  m.fillStyle = "#2a3a28"; m.fillRect(0, 0, S, S);
  for (let y = 0; y < MAP_H; y += 2) {
    for (let x = 0; x < MAP_W; x += 2) {
      const t = this.map[y * MAP_W + x]; let c = null;
      if (t === 2) c = "#3a6a90"; else if (t === 1) c = "#7a5a3a"; else if (t === 3) c = "#c8b088"; else if (t === 4) c = "#c8d4e0"; else if (t === 5) c = "#254a2a";
      if (c) { m.fillStyle = c; m.fillRect(x * sc, y * sc, 2 * sc, 2 * sc); }
    }
  }
  m.fillStyle = "#f5b040"; m.fillRect(this.camp.x / T * sc - 2, this.camp.y / T * sc - 2, 4, 4);
  m.fillStyle = "#ffe070"; for (const c of this.chests) if (!c.opened && c.pet) m.fillRect(c.x / T * sc - 1, c.y / T * sc - 1, 2, 2);
  m.fillStyle = "#6fbaf0"; for (const n of this.npcs) m.fillRect(n.x / T * sc - 1, n.y / T * sc - 1, 2, 2);
  m.fillStyle = "#e05050"; for (const e of this.enemies) if (!e.dead) m.fillRect(e.x / T * sc - 1, e.y / T * sc - 1, 2, 2);
  m.fillStyle = "#6ed9a8"; m.fillRect(this.player.x / T * sc - 2, this.player.y / T * sc - 2, 4, 4);
  m.strokeStyle = "rgba(255,255,255,0.4)"; m.strokeRect(this.cam.x / T * sc, this.cam.y / T * sc, view.w / T * sc, view.h / T * sc);
};
