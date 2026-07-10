import { Game } from "./game.js";
import { img } from "./assets.js";
import { view } from "./view.js";
import { tile as gtile, grassFringe, forestFringe, waterFoam } from "./tilegen.js";
import { buildCharacter, DEFAULT_LOOK } from "./chargen.js";
import { net } from "./net.js";
import { bossFrame, BOSS_SIZE } from "./boss.js";
import { activeRod } from "./fishing.js";
import { drawFishSprite } from "./fishart.js";

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
  const typeAt = (x, y) => (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) ? -1 : map[y * MAP_W + x];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = y * MAP_W + x, t = map[i], v = (this.vmap[i] + x * 3 + y * 5) & 7;
      const sx = x * T - camx, sy = y * T - camy;
      let im;
      if (t === 2) im = gtile("water", (wf % 4) * 8 + v);
      else if (t === 1) im = gtile("dirt", v);
      else if (t === 3) im = gtile("sand", v);
      else if (t === 4) im = gtile("snow", v);
      else if (t === 5) im = gtile("forest", v);
      else im = gtile("grass", v);
      if (im) ctx.drawImage(im, sx, sy, T, T);
      else { ctx.fillStyle = "#5aa050"; ctx.fillRect(sx, sy, T, T); }
      // grass fringe spilling onto non-grassy tiles from grassy neighbors
      if (!isGrass(t)) {
        const maskFor = (kind) => {
          let mask = 0;
          if (typeAt(x, y - 1) === kind) mask |= 1;
          if (typeAt(x + 1, y) === kind) mask |= 2;
          if (typeAt(x, y + 1) === kind) mask |= 4;
          if (typeAt(x - 1, y) === kind) mask |= 8;
          return mask;
        };
        const forestMask = maskFor(5), grassMask = maskFor(0);
        if (forestMask) { const edge = forestFringe(forestMask); if (edge) ctx.drawImage(edge, sx, sy, T, T); }
        if (grassMask) { const edge = grassFringe(grassMask); if (edge) ctx.drawImage(edge, sx, sy, T, T); }
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
  if (inv(this.camp.x, this.camp.y)) draw.push({ y: this.camp.y, k: "campfire", o: this.camp });
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
    else if (d.k === "campfire") {
      const frame = img(`fx/campfire_${Math.floor(this.t * 11) % 6}`);
      if (frame) ctx.drawImage(frame, sx - 22, sy - 38);
      for (let i = 0; i < 3; i++) {
        const travel = Math.floor((this.t * (18 + i * 2) + i * 7) % 24);
        const ex = sx + Math.round(Math.sin(this.t * 4 + i * 2) * 4);
        ctx.fillStyle = i === 2 ? `rgba(255,233,132,${1 - travel / 24})` : `rgba(241,112,39,${1 - travel / 24})`;
        ctx.fillRect(ex, sy - 25 - travel, i === 0 ? 2 : 1, i === 0 ? 2 : 1);
      }
    }
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
      if (this.fishing) weap = null;
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
    const aim = this.aimAssist;
    const ax = Math.round(aim.x - camx), ay = Math.round(aim.y - camy);
    const fromX = Math.round((aim.fromX ?? this.player.x) - camx), fromY = Math.round((aim.fromY ?? this.player.y) - camy);
    const pulse = 7 + Math.round(Math.sin(this.t * 18));
    const color = aim.kind === "fire" ? "rgba(203,151,255,.95)" : "rgba(184,255,198,.95)";
    const lineColor = aim.kind === "fire" ? "rgba(188,129,255,.3)" : "rgba(142,235,177,.28)";
    const lineDx = ax - fromX, lineDy = ay - fromY, lineD = Math.hypot(lineDx, lineDy) || 1;
    ctx.fillStyle = lineColor;
    for (let d = 15; d < lineD - 12; d += 10) ctx.fillRect(Math.round(fromX + lineDx / lineD * d), Math.round(fromY + lineDy / lineD * d), 2, 2);
    ctx.strokeStyle = color; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ax - pulse, ay - pulse + 4); ctx.lineTo(ax - pulse, ay - pulse); ctx.lineTo(ax - pulse + 4, ay - pulse);
    ctx.moveTo(ax + pulse - 4, ay - pulse); ctx.lineTo(ax + pulse, ay - pulse); ctx.lineTo(ax + pulse, ay - pulse + 4);
    ctx.moveTo(ax - pulse, ay + pulse - 4); ctx.lineTo(ax - pulse, ay + pulse); ctx.lineTo(ax - pulse + 4, ay + pulse);
    ctx.moveTo(ax + pulse - 4, ay + pulse); ctx.lineTo(ax + pulse, ay + pulse); ctx.lineTo(ax + pulse, ay + pulse - 4);
    ctx.stroke();
    ctx.fillStyle = color; ctx.fillRect(ax - 1, ay - 1, 3, 3);
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
    const ux = dx / distance, uy = dy / distance, nx = -uy, ny = ux;
    const tension = f.tension || 0;
    const rod = activeRod(p.inv);
    const rodPal = rod.id === "spiritrod"
      ? { dark: "#27365d", mid: "#5aa3ab", hi: "#a8fff0", reel: "#bd8cff" }
      : rod.id === "ironrod"
        ? { dark: "#3c3331", mid: "#7d776f", hi: "#d1c79c", reel: "#b8d0d4" }
        : { dark: "#3b251c", mid: "#7b492b", hi: "#c78b4a", reel: "#d9b45d" };
    const baseX = px - ux * 6, baseY = py + 5 - uy * 3;
    const rodLength = rod.id === "spiritrod" ? 31 : rod.id === "ironrod" ? 28 : 25;
    const bend = f.state === "hooked" ? (3 + tension * 7) : 2;
    let rodTipX = baseX, rodTipY = baseY;
    // A segmented integer-pixel shaft stays crisp and visibly bends under load.
    for (let i = 0; i <= 12; i++) {
      const u = i / 12;
      rodTipX = Math.round(baseX + ux * rodLength * u + nx * bend * u * u);
      rodTipY = Math.round(baseY + uy * rodLength * u + ny * bend * u * u - 7 * u);
      ctx.fillStyle = i < 3 ? rodPal.dark : rodPal.mid;
      ctx.fillRect(rodTipX - 1, rodTipY - 1, i < 5 ? 3 : 2, 3);
      if (i % 3 === 0) { ctx.fillStyle = rodPal.hi; ctx.fillRect(rodTipX, rodTipY - 1, 1, 1); }
    }
    ctx.fillStyle = rodPal.dark; ctx.fillRect(Math.round(baseX - 2), Math.round(baseY - 2), 5, 8);
    ctx.fillStyle = rodPal.reel; ctx.fillRect(Math.round(baseX + nx * 3 - 2), Math.round(baseY + ny * 3), 5, 5);
    ctx.fillStyle = "#1a2024"; ctx.fillRect(Math.round(baseX + nx * 3), Math.round(baseY + ny * 3 + 1), 1, 3);
    if (rod.id === "spiritrod") { ctx.fillStyle = `rgba(167,255,238,${.6 + Math.sin(this.t * 7) * .3})`; ctx.fillRect(rodTipX - 1, rodTipY - 2, 3, 3); }
    ctx.strokeStyle = tension > .8 ? "rgba(255,150,120,.95)" : "rgba(235,244,238,.78)"; ctx.lineWidth = 1;
    const sag = f.state === "hooked" ? Math.round((1 - tension) * 10) : 5;
    ctx.beginPath(); ctx.moveTo(rodTipX, rodTipY); ctx.quadraticCurveTo((rodTipX + bx) / 2, (rodTipY + by) / 2 + sag, bx, by); ctx.stroke();
    const bounce = f.state === "bite" ? Math.sin(this.t * 30) * 2 : f.state === "hooked" ? Math.sin(this.t * (f.surge ? 24 : 8)) * (f.surge ? 3 : 1) : Math.sin(this.t * 3);
    if (f.state === "hooked") {
      const dart = Math.round(Math.sin(f.totalT * (3 + f.fish.difficulty * 3) + f.phase) * (6 + f.fish.difficulty * 8));
      drawFishSprite(ctx, f.fish, bx + dart, by + 8, { scale: .5, flip: dart < 0, alpha: .48 });
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
  if (this.catchReveal) {
    const reveal = this.catchReveal;
    const flight = Math.min(1, reveal.elapsed / .72);
    const ease = 1 - Math.pow(1 - flight, 3);
    const startX = reveal.origin.x - camx, startY = reveal.origin.y - camy;
    const endX = this.player.x - camx, endY = this.player.y - camy - 52;
    const fishX = startX + (endX - startX) * ease;
    const fishY = startY + (endY - startY) * ease - Math.sin(flight * Math.PI) * 42;
    const fade = reveal.elapsed > reveal.duration - .35 ? (reveal.duration - reveal.elapsed) / .35 : 1;
    drawFishSprite(ctx, reveal.fish, fishX, fishY, { scale: flight < 1 ? 1.15 + flight * .45 : 1.6, flip: endX < startX, alpha: Math.max(0, fade) });
    if (flight < 1) {
      ctx.fillStyle = `rgba(210,248,255,${1 - flight})`;
      for (let i = 0; i < 4; i++) ctx.fillRect(Math.round(startX - 9 + i * 6), Math.round(startY - 4 - flight * (6 + i * 2)), 2, 2);
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
  this.renderDayNight(ctx, camx, camy);
  this.renderWeather(ctx);
  this.renderPostFX(ctx);
  this.renderMinimap();
};

// Post-processing: vignette + ambient color grade + depth fog + subtle bloom
Game.prototype.renderPostFX = function (ctx) {
  const w = view.w, h = view.h;
  const isNight = this.time >= 19 * 60 || this.time < 5 * 60;
  // 1. Depth fog — subtle warm haze at top (distance), cool at bottom (foreground)
  const fog = ctx.createLinearGradient(0, 0, 0, h);
  fog.addColorStop(0, isNight ? "rgba(84,108,154,0.045)" : "rgba(180,200,160,0.08)");
  fog.addColorStop(0.4, "rgba(0,0,0,0)");
  fog.addColorStop(0.85, "rgba(0,0,0,0)");
  fog.addColorStop(1, isNight ? "rgba(15,20,43,0.035)" : "rgba(40,30,20,0.06)");
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
  } else if (isNight) {
    grade.addColorStop(0, "rgba(88,112,174,0.025)");
    grade.addColorStop(1, "rgba(38,52,104,0.035)");
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
  vig.addColorStop(1, `rgba(0,0,0,${isNight ? .18 : .28})`);
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
};

Game.prototype.renderFX = function (ctx, camx, camy) {
  for (const f of this.fx) {
    const sx = f.x - camx, sy = f.y - camy, pr = f.t / f.dur;
    if (f.kind === "weaponslash") {
      const frame = img(`fx/slash_${clamp(Math.floor(pr * 4), 0, 3)}`);
      const rot = f.dir === "right" ? 0 : f.dir === "down" ? Math.PI / 2 : f.dir === "left" ? Math.PI : -Math.PI / 2;
      const reach = f.weapon === "spear" ? 1.35 : f.weapon === "dagger" ? .72 : f.weapon === "axe" ? 1.2 : 1;
      ctx.save(); ctx.translate(Math.round(sx), Math.round(sy - 17)); ctx.rotate(rot); ctx.scale(reach, reach);
      ctx.globalAlpha = Math.max(0, 1 - pr * .7);
      if (frame) { ctx.drawImage(frame, 2, -20); ctx.globalAlpha *= .3; ctx.drawImage(frame, -2, -20); }
      ctx.restore();
    } else if (f.kind === "bowrelease") {
      ctx.save(); ctx.translate(Math.round(sx), Math.round(sy)); ctx.rotate(f.angle || 0);
      const power = f.variant === "power" || f.variant === "dragon";
      const color = power ? "#ffe38a" : "#bff7cf";
      const count = f.variant === "multi" ? 3 : 1;
      ctx.globalAlpha = 1 - pr;
      for (let i = 0; i < count; i++) {
        const off = (i - (count - 1) / 2) * 5;
        ctx.fillStyle = color; ctx.fillRect(5 + Math.round(pr * 18), off - 1, power ? 18 : 12, 2);
        ctx.fillStyle = "#ffffff"; ctx.fillRect(10 + Math.round(pr * 18), off - 1, power ? 8 : 4, 1);
      }
      ctx.fillStyle = "rgba(151,242,184,.7)"; ctx.fillRect(-2, -9 - Math.round(pr * 5), 2, 19 + Math.round(pr * 10));
      ctx.restore();
    } else if (f.kind === "castburst") {
      ctx.save(); ctx.translate(Math.round(sx), Math.round(sy)); ctx.rotate((f.angle || 0) + Math.PI / 4);
      const dragon = f.variant === "dragon", skill = f.variant === "skill";
      const color = dragon ? "rgba(202,125,255,A)" : skill ? "rgba(255,182,72,A)" : "rgba(129,205,255,A)";
      const radius = 6 + Math.round(pr * 20);
      ctx.strokeStyle = color.replace("A", String(1 - pr)); ctx.lineWidth = 2; ctx.strokeRect(-radius, -radius, radius * 2, radius * 2);
      ctx.fillStyle = color.replace("A", String((1 - pr) * .85));
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.fillRect(Math.round(Math.cos(a) * (radius + 4)) - 1, Math.round(Math.sin(a) * (radius + 4)) - 1, i % 2 ? 2 : 3, i % 2 ? 2 : 3); }
      ctx.restore();
    } else if (f.kind === "warcry") {
      const radius = 10 + pr * 48;
      ctx.globalAlpha = 1 - pr;
      for (let i = 0; i < 16; i++) {
        const a = i / 16 * Math.PI * 2, r = radius + (i % 2 ? 5 : -3);
        ctx.fillStyle = i % 3 === 0 ? "#ffe089" : "#d95b43";
        ctx.fillRect(Math.round(sx + Math.cos(a) * r) - 2, Math.round(sy - 16 + Math.sin(a) * r) - 2, i % 2 ? 3 : 5, i % 2 ? 3 : 5);
      }
      ctx.globalAlpha = 1;
    } else if (f.kind === "blink") {
      ctx.globalAlpha = 1 - pr;
      for (let i = 0; i < 10; i++) {
        const spread = ((i * 13) % 21) - 10, rise = ((i * 7) % 26) + pr * 24;
        ctx.fillStyle = i % 3 === 0 ? "#f0e7ff" : f.arrive ? "#8edcff" : "#b28cff";
        ctx.fillRect(Math.round(sx + spread * (1 - pr)), Math.round(sy - rise), i % 2 ? 2 : 3, 5 + i % 3);
      }
      ctx.globalAlpha = 1;
    } else if (f.kind === "projectileimpact") {
      const fire = f.element === "fire" || f.element === "bossfire";
      const color = f.variant === "dragon" ? "#d699ff" : fire ? "#ffb14c" : "#e8ffd0";
      ctx.globalAlpha = 1 - pr;
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2 + pr, r = 3 + pr * (14 + i % 3 * 3);
        ctx.fillStyle = i % 3 === 0 ? "#ffffff" : color;
        ctx.fillRect(Math.round(sx + Math.cos(a) * r) - 1, Math.round(sy + Math.sin(a) * r) - 1, i % 2 ? 2 : 3, i % 2 ? 2 : 3);
      }
      ctx.globalAlpha = 1;
    } else if (f.kind === "heal") {
      ctx.globalAlpha = 1 - pr;
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * 7 + f.t * 3;
        const rr = 6 + pr * 20;
        ctx.fillStyle = "#88f0a8";
        ctx.fillRect(sx + Math.cos(a) * rr, sy - 8 - pr * 24 + Math.sin(a) * rr * 0.4, 2, 3);
      }
      ctx.globalAlpha = 1;
    } else if (f.kind === "whirl") {
      ctx.globalAlpha = 1 - pr;
      for (let ring = 0; ring < 3; ring++) for (let i = 0; i < 14; i++) {
        if ((i + ring) % 4 === Math.floor(pr * 4)) continue;
        const a = i / 14 * Math.PI * 2 + pr * (8 + ring * 2);
        const rr = 14 + ring * 9 + pr * 24;
        ctx.fillStyle = ring === 0 ? "#fff0a4" : ring === 1 ? "#f59a3d" : "#d94b31";
        const size = ring === 0 ? 2 : 3;
        ctx.fillRect(Math.round(sx + Math.cos(a) * rr) - 1, Math.round(sy - 14 + Math.sin(a) * rr * .65) - 1, size + (i % 3 === 0 ? 2 : 0), size);
      }
      ctx.globalAlpha = 1;
    } else if (f.kind === "slashbig") {
      const ox = f.dir === "left" ? -18 : f.dir === "right" ? 18 : 0;
      const oy = f.dir === "up" ? -20 : f.dir === "down" ? 6 : -8;
      const frame = img(`fx/slash_${clamp(Math.floor(pr * 4), 0, 3)}`);
      ctx.save(); ctx.translate(Math.round(sx + ox), Math.round(sy - 16 + oy));
      ctx.rotate(f.dir === "down" ? Math.PI / 2 : f.dir === "left" ? Math.PI : f.dir === "up" ? -Math.PI / 2 : 0);
      ctx.globalAlpha = 1 - pr * .65; ctx.scale(1.5 + pr * .25, 1.5 + pr * .25);
      if (frame) ctx.drawImage(frame, -8, -20);
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
    } else if (f.kind === "frost") {
      ctx.globalAlpha = 1 - pr;
      for (let i = 0; i < 24; i++) {
        const a = i / 24 * Math.PI * 2, rr = 9 + pr * 59;
        ctx.fillStyle = i % 3 === 0 ? "#efffff" : i % 2 ? "#78cbed" : "#b6efff";
        const h = i % 3 === 0 ? 7 : 4;
        ctx.fillRect(Math.round(sx + Math.cos(a) * rr) - 1, Math.round(sy - 8 + Math.sin(a) * rr) - Math.floor(h / 2), 2 + (i % 4 === 0 ? 1 : 0), h);
      }
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 - pr * 2; const rr = 5 + pr * 36; ctx.fillStyle = "#dffbff"; ctx.fillRect(Math.round(sx + Math.cos(a) * rr) - 1, Math.round(sy - 8 + Math.sin(a) * rr) - 1, 3, 3); }
      ctx.globalAlpha = 1;
    }
  }
  // ---- projectiles ----
  if (this.projectiles) for (const pr of this.projectiles) {
    const sx = pr.x - camx, sy = pr.y - camy;
    if (pr.kind === "fire" || pr.kind === "bossfire") {
      const boss = pr.kind === "bossfire", dragon = pr.variant === "dragon";
      const outer = dragon ? "#8545c7" : boss ? "#b63222" : "#df5b27";
      const middle = dragon ? "#c475f3" : boss ? "#ff7431" : "#ff9a35";
      const core = dragon ? "#f2d6ff" : "#fff1a6";
      const size = boss ? 11 : pr.variant === "skill" || dragon ? 9 : 7;
      for (let i = 3; i >= 1; i--) {
        const tx = Math.round(sx - pr.dx * i * 5), ty = Math.round(sy - pr.dy * i * 5);
        ctx.globalAlpha = .16 + (3 - i) * .12; ctx.fillStyle = outer; ctx.fillRect(tx - 2, ty - 2, 5, 5);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = outer; ctx.fillRect(Math.round(sx - size / 2), Math.round(sy - size / 2), size, size);
      ctx.fillStyle = middle; ctx.fillRect(Math.round(sx - size / 2 + 2), Math.round(sy - size / 2 + 1), size - 3, size - 3);
      ctx.fillStyle = core; ctx.fillRect(Math.round(sx - 1), Math.round(sy - 2), 4, 4);
      for (let i = 0; i < 4; i++) { const a = pr.age * 10 + i * Math.PI / 2; ctx.fillStyle = i % 2 ? middle : core; ctx.fillRect(Math.round(sx + Math.cos(a) * (size / 2 + 3)), Math.round(sy + Math.sin(a) * (size / 2 + 3)), 2, 2); }
    } else if (pr.kind === "arrow") {
      const power = pr.variant === "power", dragon = pr.variant === "dragon", multi = pr.variant === "multi";
      const shaft = dragon ? "#c58aff" : power ? "#ffe07b" : multi ? "#9ce8ad" : "#c79555";
      const head = dragon ? "#f3e0ff" : power ? "#fff8bd" : "#e9eef0";
      const length = power || dragon ? 18 : 13;
      for (let i = 2; i >= 1; i--) {
        ctx.globalAlpha = .18 / i; ctx.fillStyle = shaft;
        const tx = sx - pr.dx * (i * 7), ty = sy - pr.dy * (i * 7);
        ctx.fillRect(Math.round(tx) - 1, Math.round(ty) - 1, 3, 3);
      }
      ctx.globalAlpha = 1;
      for (let d = -length / 2; d <= length / 2; d += 2) {
        ctx.fillStyle = d > length / 2 - 4 ? head : shaft;
        ctx.fillRect(Math.round(sx + pr.dx * d) - 1, Math.round(sy + pr.dy * d) - 1, d > length / 2 - 4 ? 3 : 2, d > length / 2 - 4 ? 3 : 2);
      }
      const nx = -pr.dy, ny = pr.dx, tailX = sx - pr.dx * length / 2, tailY = sy - pr.dy * length / 2;
      ctx.fillStyle = multi ? "#d4ffd8" : dragon ? "#e1bdff" : "#e8d4bb";
      ctx.fillRect(Math.round(tailX + nx * 3) - 1, Math.round(tailY + ny * 3) - 1, 3, 3);
      ctx.fillRect(Math.round(tailX - nx * 3) - 1, Math.round(tailY - ny * 3) - 1, 3, 3);
    }
  }
  ctx.globalAlpha = 1;
};

Game.prototype.renderDayNight = function (ctx, camx = this.cam.x, camy = this.cam.y) {
  const t = this.time; let dark = 0;
  if (t < 5 * 60) dark = 0.72;
  else if (t < 7 * 60) dark = 0.72 * (1 - (t - 5 * 60) / (2 * 60));
  else if (t < 17 * 60) dark = 0;
  else if (t < 19 * 60) dark = 0.72 * ((t - 17 * 60) / (2 * 60));
  else dark = 0.72;
  if (dark <= .01) return;
  const night = t > 19 * 60 || t < 5 * 60;
  if (!this._nightLayer) this._nightLayer = document.createElement("canvas");
  const layer = this._nightLayer;
  if (layer.width !== view.w || layer.height !== view.h) { layer.width = view.w; layer.height = view.h; }
  const lctx = layer.getContext("2d");
  lctx.clearRect(0, 0, view.w, view.h);
  lctx.fillStyle = night ? `rgba(11,17,43,${dark})` : `rgba(53,32,62,${dark * .82})`;
  lctx.fillRect(0, 0, view.w, view.h);
  lctx.globalCompositeOperation = "destination-out";
  const aperture = (x, y, radius, strength = 1) => {
    const gradient = lctx.createRadialGradient(x, y, 2, x, y, radius);
    gradient.addColorStop(0, `rgba(0,0,0,${strength})`);
    gradient.addColorStop(.48, `rgba(0,0,0,${strength * .72})`);
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    lctx.fillStyle = gradient; lctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  };
  const campX = this.camp.x - camx, campY = this.camp.y - camy - 18;
  aperture(campX, campY, 112, .96);
  aperture(this.player.x - camx, this.player.y - camy - 14, 48, .58);
  for (const b of this.buildings) {
    const x = b.x - camx, y = b.y - camy;
    if (x < -90 || x > view.w + 90 || y < -90 || y > view.h + 90) continue;
    if (b.type === "lantern") aperture(x, y - 21, 48, .88);
    else if (b.type === "pagoda") aperture(x, y - 49, 42, .32);
  }
  for (const plant of this.plants) if (plant.hp > 0 && plant.kind === "glow_vine") aperture(plant.x - camx, plant.y - camy - 15, 25, .34);
  if (this.boss && !this.boss.dead && (this.boss.rage || this.boss.breathWindup > 0)) aperture(this.boss.x - camx, this.boss.y - camy - 34, 74, .58);
  for (const projectile of this.projectiles || []) if (projectile.kind === "fire" || projectile.kind === "bossfire") aperture(projectile.x - camx, projectile.y - camy, projectile.kind === "bossfire" ? 35 : 27, .72);
  lctx.globalCompositeOperation = "source-over";
  ctx.drawImage(layer, 0, 0);

  // Source-bound bloom goes on after the darkness mask; there is no fake warm player aura.
  const bloom = (x, y, radius, color, alpha) => {
    const gradient = ctx.createRadialGradient(x, y, 2, x, y, radius);
    gradient.addColorStop(0, color.replace("A", String(alpha)));
    gradient.addColorStop(.45, color.replace("A", String(alpha * .32)));
    gradient.addColorStop(1, color.replace("A", "0"));
    ctx.fillStyle = gradient; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  };
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  const campFlicker = .88 + Math.sin(this.t * 9) * .08 + Math.sin(this.t * 17) * .04;
  bloom(campX, campY, 68, "rgba(255,145,52,A)", dark * .34 * campFlicker);
  for (const b of this.buildings) if (b.type === "lantern") {
    const x = b.x - camx, y = b.y - camy - 21;
    if (x < -60 || x > view.w + 60) continue;
    const flicker = .85 + Math.sin(this.t * 6 + b.x * .03) * .12;
    bloom(x, y, 31, "rgba(255,188,86,A)", dark * .28 * flicker);
  }
  for (const projectile of this.projectiles || []) if (projectile.kind === "fire" || projectile.kind === "bossfire") {
    bloom(projectile.x - camx, projectile.y - camy, projectile.kind === "bossfire" ? 24 : 18, projectile.variant === "dragon" ? "rgba(187,104,255,A)" : "rgba(255,124,45,A)", dark * .34);
  }
  ctx.restore();

  // Pixel emissive pass: lantern flames and fireflies stay bright after grading.
  for (const b of this.buildings) if (b.type === "lantern") {
    const x = Math.round(b.x - camx), y = Math.round(b.y - camy - 23);
    if (x < -20 || x > view.w + 20) continue;
    const flip = Math.floor(this.t * 12 + b.x) % 3;
    ctx.fillStyle = "#d95526"; ctx.fillRect(x - 2, y - 3 - flip, 5, 7 + flip);
    ctx.fillStyle = "#ffad36"; ctx.fillRect(x - 1, y - 4, 3, 6);
    ctx.fillStyle = "#fff2a4"; ctx.fillRect(x, y - 2, 1, 3);
  }
  if (night && this.critters) for (const c of this.critters) {
    const x = Math.round(c.x - camx), y = Math.round(c.y - camy - 12);
    if (x < 0 || x > view.w || y < 0 || y > view.h) continue;
    const alpha = .45 + Math.sin(c.ph) * .35;
    ctx.fillStyle = `rgba(207,255,151,${alpha})`; ctx.fillRect(x, y, 2, 2);
    if (alpha > .62) { ctx.fillStyle = `rgba(225,255,188,${alpha * .55})`; ctx.fillRect(x - 2, y, 1, 1); ctx.fillRect(x + 3, y, 1, 1); }
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
