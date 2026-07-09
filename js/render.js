// Rendering: world tiles, entities (depth-sorted), FX, day/night overlay, minimap.
import { Game } from "./game.js";
import { img } from "./assets.js";

const T = 24, MAP_W = 96, MAP_H = 96, VIEW_W = 420, VIEW_H = 236;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

Game.prototype.render = function () {
  const ctx = this.ctx, p = this.player;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);

  const camx = Math.round(this.cam.x), camy = Math.round(this.cam.y);
  const x0 = Math.max(0, (camx / T) | 0), y0 = Math.max(0, (camy / T) | 0);
  const x1 = Math.min(MAP_W, x0 + (VIEW_W / T) + 2), y1 = Math.min(MAP_H, y0 + (VIEW_H / T) + 2);

  // ground tiles
  const wf = (this.t * 3) | 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = y * MAP_W + x, t = this.map[i], v = this.vmap[i];
      let key;
      if (t === 2) key = `tiles/water_${wf % 4}`;
      else if (t === 1) key = `tiles/path_${v % 4}`;
      else if (t === 3) key = `tiles/sand_${v % 4}`;
      else key = `tiles/grass_${v % 4}`;
      const im = img(key);
      const sx = x * T - camx, sy = y * T - camy;
      if (im) ctx.drawImage(im, sx, sy, T, T);
      else { ctx.fillStyle = t===2?"#4a8fb0":t===1?"#a8825a":t===3?"#e8dcc0":"#5aa050"; ctx.fillRect(sx, sy, T, T); }
    }
  }

  // camp fire ring at center
  const csx = this.camp.x - camx, csy = this.camp.y - camy;
  if (csx > -40 && csx < VIEW_W + 40) {
    const flick = 6 + Math.sin(this.t * 8) * 2;
    ctx.fillStyle = "rgba(60,40,25,0.6)"; ctx.beginPath(); ctx.ellipse(csx, csy, 16, 8, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#e8963c"; ctx.beginPath(); ctx.ellipse(csx, csy - 2, flick*0.5, flick, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#f5d060"; ctx.beginPath(); ctx.ellipse(csx, csy - 3, flick*0.3, flick*0.6, 0, 0, 7); ctx.fill();
  }

  // depth-sorted sprites: trees, bushes, enemies, player, pet, chests
  const drawList = [];
  for (const tr of this.trees) if (this.inView(tr.x, camx)) drawList.push({ y: tr.sortY, kind: "tree", o: tr });
  for (const b of this.bushes) if (this.inView(b.x, camx)) drawList.push({ y: b.sortY, kind: "bush", o: b });
  for (const c of this.chests) if (this.inView(c.x, camx)) drawList.push({ y: c.y, kind: "chest", o: c });
  for (const e of this.enemies) if (!e.dead && this.inView(e.x, camx)) drawList.push({ y: e.sortY, kind: "enemy", o: e });
  if (this.pet) drawList.push({ y: this.pet.sortY, kind: "pet", o: this.pet });
  drawList.push({ y: p.sortY, kind: "player", o: p });
  drawList.sort((a, b) => a.y - b.y);

  for (const d of drawList) {
    const o = d.o, sx = Math.round(o.x - camx), sy = Math.round(o.y - camy);
    if (d.kind === "tree") {
      const im = img(`tree_${o.v}`);
      if (im) ctx.drawImage(im, sx - im.width/2, sy - im.height + 6);
    } else if (d.kind === "bush") {
      const im = img("bush_0");
      if (im) ctx.drawImage(im, sx - im.width/2, sy - im.height + 4);
    } else if (d.kind === "chest") {
      const im = img(o.opened ? "fx/chest_open" : "fx/chest");
      if (im) ctx.drawImage(im, sx - 12, sy - 16);
      if (!o.opened && o.pet) { // sparkle hint
        ctx.fillStyle = `rgba(255,230,120,${0.5+0.5*Math.sin(this.t*5)})`;
        ctx.fillRect(sx + 6, sy - 20, 2, 2);
      }
    } else if (d.kind === "enemy") {
      const im = img(`mon/${o.id}`);
      const bob = Math.sin(o.bob) * 2;
      if (im) {
        if (o.hurt > 0) { ctx.save(); ctx.globalAlpha = 0.8; }
        ctx.drawImage(im, sx - im.width/2, sy - im.height + bob);
        if (o.hurt > 0) { ctx.globalCompositeOperation = "source-atop"; ctx.fillStyle = "rgba(255,80,80,0.6)"; ctx.fillRect(sx - im.width/2, sy - im.height + bob, im.width, im.height); ctx.globalCompositeOperation = "source-over"; ctx.restore(); }
        // hp bar
        if (o.hp < o.maxHp) {
          ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(sx - 12, sy - im.height + bob - 5, 24, 3);
          ctx.fillStyle = "#e05050"; ctx.fillRect(sx - 12, sy - im.height + bob - 5, 24 * (o.hp/o.maxHp), 3);
        }
      }
    } else if (d.kind === "pet") {
      const im = img(`pet/${o.id}`);
      const bob = Math.sin(o.bob) * 2;
      if (im) ctx.drawImage(im, sx - im.width/2, sy - im.height + bob);
    } else if (d.kind === "player") {
      const key = p.attackT > 0 ? `player/p_${p.dir}_atk` : `player/p_${p.dir}_${p.frame % 4}`;
      const im = img(key) || img(`player/p_${p.dir}_0`);
      if (p.invuln > 0 && Math.floor(this.t*20)%2) ctx.globalAlpha = 0.5;
      if (im) ctx.drawImage(im, sx - 16, sy - 36);
      ctx.globalAlpha = 1;
      // slash arc
      if (this._slashT > 0) {
        const sf = 3 - Math.ceil(this._slashT / 0.06);
        const sl = img(`fx/slash_${clamp(sf,0,3)}`);
        const ox = p.dir==="left"?-20:p.dir==="right"?20:0, oy = p.dir==="up"?-24:p.dir==="down"?-4:-14;
        if (sl) ctx.drawImage(sl, sx - 20 + ox, sy - 34 + oy);
        this._slashT -= 1/60;
      }
    }
  }

  // hit sparks
  if (this._hits) {
    for (const h of this._hits) {
      h.t += 1/60;
      const f = Math.min(3, (h.t / 0.05) | 0);
      const im = img(`fx/hit_${f}`);
      if (im) ctx.drawImage(im, Math.round(h.x - camx) - 8, Math.round(h.y - camy) - 8);
    }
    this._hits = this._hits.filter(h => h.t < 0.2);
  }

  // particles
  for (const pa of this.particles) {
    ctx.fillStyle = pa.color; ctx.globalAlpha = Math.max(0, pa.life * 2);
    ctx.fillRect(Math.round(pa.x - camx), Math.round(pa.y - camy), 2, 2);
  }
  ctx.globalAlpha = 1;

  // ===== DAY / NIGHT overlay =====
  this.renderDayNight(ctx);

  this.renderMinimap();
};

Game.prototype.inView = function (wx, camx) {
  const sx = wx - camx; return sx > -60 && sx < VIEW_W + 60;
};

Game.prototype.renderDayNight = function (ctx) {
  const t = this.time; // minutes
  // brightness: 0 midday .. 1 deep night
  let dark = 0;
  if (t < 5*60) dark = 0.7;
  else if (t < 7*60) dark = 0.7 * (1 - (t - 5*60)/(2*60)); // dawn
  else if (t < 17*60) dark = 0;
  else if (t < 19*60) dark = 0.7 * ((t - 17*60)/(2*60)); // dusk
  else dark = 0.7;
  if (dark > 0.01) {
    // color: dusk warm, night blue
    const night = t > 19*60 || t < 5*60;
    ctx.fillStyle = night ? `rgba(20,26,60,${dark})` : `rgba(60,40,70,${dark*0.8})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // campfire glow cutout at night
    const cx = this.camp.x - this.cam.x, cy = this.camp.y - this.cam.y;
    const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, 90);
    g.addColorStop(0, `rgba(255,180,80,${dark*0.5})`);
    g.addColorStop(1, "rgba(255,180,80,0)");
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 90, 0, 7); ctx.fill();
    // player torch glow
    const px = this.player.x - this.cam.x, py = this.player.y - this.cam.y;
    const g2 = ctx.createRadialGradient(px, py, 4, px, py, 70);
    g2.addColorStop(0, `rgba(255,210,140,${dark*0.4})`);
    g2.addColorStop(1, "rgba(255,210,140,0)");
    ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(px, py, 70, 0, 7); ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }
};

Game.prototype.renderMinimap = function () {
  const m = this.mctx, S = 120, sc = S / MAP_W;
  m.clearRect(0, 0, S, S);
  m.fillStyle = "#2a3a28"; m.fillRect(0, 0, S, S);
  // biomes (coarse)
  for (let y = 0; y < MAP_H; y += 2) {
    for (let x = 0; x < MAP_W; x += 2) {
      const t = this.map[y*MAP_W+x];
      if (t === 2) m.fillStyle = "#3a6a90";
      else if (t === 1) m.fillStyle = "#7a5a3a";
      else if (t === 3) m.fillStyle = "#c8b088";
      else continue;
      m.fillRect(x*sc, y*sc, 2*sc, 2*sc);
    }
  }
  // camp
  m.fillStyle = "#f5b040"; m.fillRect(this.camp.x/T*sc-2, this.camp.y/T*sc-2, 4, 4);
  // chests with pets
  for (const c of this.chests) if (!c.opened && c.pet) { m.fillStyle = "#ffe070"; m.fillRect(c.x/T*sc-1, c.y/T*sc-1, 2, 2); }
  // enemies
  m.fillStyle = "#e05050";
  for (const e of this.enemies) if (!e.dead) m.fillRect(e.x/T*sc-1, e.y/T*sc-1, 2, 2);
  // player
  m.fillStyle = "#6ed9a8"; m.fillRect(this.player.x/T*sc-2, this.player.y/T*sc-2, 4, 4);
  // viewport box
  m.strokeStyle = "rgba(255,255,255,0.4)";
  m.strokeRect(this.cam.x/T*sc, this.cam.y/T*sc, VIEW_W/T*sc, VIEW_H/T*sc);
};
