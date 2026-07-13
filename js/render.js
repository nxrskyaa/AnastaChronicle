import { Game } from "./game.js";
import { img } from "./assets.js";
import { view } from "./view.js";
import { tile as gtile, grassFringe, forestFringe, waterFoam } from "./tilegen.js";
import { buildCharacter, DEFAULT_LOOK } from "./chargen.js";
import { net } from "./net.js";
import { bossFrame, BOSS_SIZE } from "./boss.js";
import { activeRod } from "./fishing.js";
import { drawFishSprite } from "./fishart.js";
import { MON_ELEMENT, MON_META } from "./monsters.js";
import { CLASSES } from "./classes.js";

const T = 24, MAP_W = 110, MAP_H = 110;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const isGrass = (t) => t === 0 || t === 5;   // grass & forest count as grassy for fringe

const PET_AURA = {
  fire: ["#ffb14c", "#ff6338"], water: ["#9eeaff", "#4daee8"], grass: ["#c8f69a", "#66c76f"],
  rock: ["#ead7a5", "#a88b67"], electric: ["#fff39a", "#efc83d"], bug: ["#efc5ff", "#bd83df"],
  ice: ["#e8ffff", "#7cd8ef"], dark: ["#d4b4ff", "#7655a8"],
  wind: ["#dff8e4", "#67bda1"], light: ["#fff1a8", "#d9a249"],
};

function poseFrame(cache, pose, dir, frame, fallback = "walk") {
  const bank = cache?.[pose]?.[dir] ?? cache?.[fallback]?.[dir] ?? cache?.walk?.down;
  if (!bank) return null;
  if (!Array.isArray(bank)) return bank;
  return bank[((frame % bank.length) + bank.length) % bank.length] || null;
}

function objectPhase(o, salt = 0) {
  const x = Math.round(o.x || 0), y = Math.round(o.y || 0);
  return ((x * 13 + y * 7 + salt * 31) % 97) / 97 * Math.PI * 2;
}

function drawNpcActivity(ctx, npc, x, y, t, dir) {
  const side = dir === "left" ? -1 : 1;
  const activity = npc.activity || npc.routine;
  if (activity === "fish") {
    const handX = x + side * 5, handY = y - 19;
    const vertical = dir === "up" || dir === "down";
    const tipX = vertical ? x + side * 8 : x + side * 19;
    const tipY = vertical ? handY + (dir === "down" ? 12 : -14) : y - 32;
    const floatX = vertical ? tipX : x + side * 27;
    const floatY = (vertical ? tipY + (dir === "down" ? 17 : -13) : y - 5) + Math.round(Math.sin(t * 3 + objectPhase(npc)));
    ctx.strokeStyle = "#4a301f"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(handX, handY); ctx.lineTo(tipX, tipY); ctx.stroke();
    ctx.strokeStyle = "rgba(205,232,238,.78)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.lineTo(floatX, floatY); ctx.stroke();
    ctx.fillStyle = "#f4ede0"; ctx.fillRect(floatX - 1, floatY, 3, 2);
    ctx.fillStyle = "#e15b45"; ctx.fillRect(floatX, floatY - 2, 1, 2);
  } else if (activity === "gather") {
    const bx = x + side * 8, by = y - 10;
    ctx.fillStyle = "#4d301d"; ctx.fillRect(bx - 4, by - 5, 8, 7);
    ctx.fillStyle = "#a8753d"; ctx.fillRect(bx - 3, by - 4, 6, 5);
    ctx.strokeStyle = "#c89a5b"; ctx.lineWidth = 1;
    ctx.strokeRect(bx - 2, by - 7, 4, 4);
    ctx.fillStyle = "#75b95a"; ctx.fillRect(bx - 2, by - 6, 2, 2); ctx.fillRect(bx + 1, by - 7, 2, 3);
  } else if (activity === "work") {
    const lift = npc.emoteT > 0 ? Math.sin((1 - npc.emoteT) * Math.PI * 4) * 5 : Math.sin(t * 1.4 + objectPhase(npc)) * 1.5;
    const hx = x + side * 7, hy = y - 18 - Math.round(lift);
    ctx.strokeStyle = "#704725"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + side * 5, hy - 9); ctx.stroke();
    ctx.fillStyle = "#65717a"; ctx.fillRect(hx + side * 4 - (side < 0 ? 5 : 0), hy - 11, 6, 4);
    ctx.fillStyle = "#aeb9bd"; ctx.fillRect(hx + side * 4 - (side < 0 ? 4 : -1), hy - 11, 4, 1);
  } else if (activity === "patrol") {
    const px = x + side * 8;
    ctx.fillStyle = "#382a20"; ctx.fillRect(px, y - 34, 2, 34);
    ctx.fillStyle = npc.look?.accent || "#d9b95f"; ctx.fillRect(px + (side < 0 ? -5 : 2), y - 34, 5, 4);
    ctx.fillStyle = "#e7edf0"; ctx.fillRect(px - 1, y - 38, 4, 5); ctx.fillRect(px, y - 41, 2, 3);
  }

  if (npc.carriesLantern) {
    const lx = x - side * 8, ly = y - 12;
    const flicker = Math.floor(t * 10 + objectPhase(npc)) % 2;
    ctx.fillStyle = "#3a2b24"; ctx.fillRect(lx - 3, ly - 8, 7, 9);
    ctx.fillStyle = "#b85b2d"; ctx.fillRect(lx - 2, ly - 7, 5, 6);
    ctx.fillStyle = "#ffd36b"; ctx.fillRect(lx - 1, ly - 7 - flicker, 3, 5 + flicker);
    ctx.fillStyle = "#fff0a0"; ctx.fillRect(lx, ly - 5, 1, 2);
  }
}

function drawNpcEmote(ctx, npc, x, y, t) {
  if (!(npc.emoteT > 0)) return;
  const rise = Math.round((1.25 - Math.min(1.25, npc.emoteT)) * 2);
  const bx = x + 9, by = y - 49 - rise;
  ctx.fillStyle = "rgba(28,35,39,.86)"; ctx.fillRect(bx - 5, by - 5, 11, 9);
  ctx.fillStyle = "rgba(241,239,220,.95)"; ctx.fillRect(bx - 4, by - 4, 9, 7); ctx.fillRect(bx - 2, by + 3, 2, 2);
  ctx.fillStyle = npc.emote === "gather" ? "#5da957" : npc.emote === "work" ? "#87959c" : npc.emote === "rest" ? "#7588b5" : "#d69c45";
  if (npc.emote === "rest") {
    ctx.font = "bold 7px sans-serif"; ctx.textAlign = "center"; ctx.fillText("Z", bx, by + 2); ctx.textAlign = "left";
  } else if (npc.emote === "gather") {
    ctx.fillRect(bx - 2, by - 2, 5, 3); ctx.fillStyle = "#397944"; ctx.fillRect(bx, by + 1, 1, 2);
  } else if (npc.emote === "work") {
    ctx.fillRect(bx - 2, by - 2, 5, 2); ctx.fillRect(bx, by, 1, 3);
  } else if (npc.emote === "fish") {
    ctx.fillRect(bx - 3, by - 1, 6, 3); ctx.fillRect(bx + 3, by - 2, 2, 2); ctx.fillStyle = "#f2eee2"; ctx.fillRect(bx - 1, by - 1, 1, 1);
  } else {
    const wave = Math.floor(t * 7) % 2;
    ctx.fillRect(bx - 2, by - 2 - wave, 2, 4); ctx.fillRect(bx + 1, by - 3 + wave, 2, 5);
  }
}

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

  // Infernyx arena is a permanent code-drawn landmark, kept clear of random props.
  if (this.bossArena) {
    const ax = this.bossArena.x - camx, ay = this.bossArena.y - camy;
    if (ax > -150 && ax < view.w + 150 && ay > -100 && ay < view.h + 100) {
      const awake = !!this.boss && !this.boss.dead;
      const pulse = .45 + Math.sin(this.t * 2.3) * .12;
      ctx.save(); ctx.translate(Math.round(ax), Math.round(ay));
      ctx.fillStyle = "rgba(19,14,22,.2)"; ctx.beginPath(); ctx.ellipse(0, 7, 116, 57, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = awake ? `rgba(215,91,54,${pulse})` : "rgba(121,96,89,.38)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 7, 110, 52, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = awake ? `rgba(239,174,80,${pulse * .62})` : "rgba(91,116,99,.3)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(0, 7, 80, 36, 0, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 12; i++) {
        const angle = i / 12 * Math.PI * 2, x = Math.round(Math.cos(angle) * 108), y = Math.round(7 + Math.sin(angle) * 51);
        ctx.fillStyle = "#342e31"; ctx.fillRect(x - 4, y - 3, 8, 6);
        ctx.fillStyle = awake ? (i % 3 === 0 ? "#f0b85e" : "#a64d39") : "#657469"; ctx.fillRect(x - 2, y - 4, 4, 2); ctx.fillRect(x - 1, y - 2, 2, 4);
      }
      ctx.fillStyle = awake ? `rgba(232,104,55,${pulse * .48})` : "rgba(91,113,101,.26)";
      for (let i = 0; i < 8; i++) { const angle = i / 8 * Math.PI * 2 + Math.PI / 8; const x = Math.round(Math.cos(angle) * 48), y = Math.round(7 + Math.sin(angle) * 21); ctx.fillRect(x - 2, y - 2, 4, 4); ctx.fillRect(x - 5, y, 10, 1); }
      ctx.restore();
    }
  }

  // flowers (flat, under everything)
  const FCOL = [["#f2d0dc", "#e88aa8"], ["#dfe8ff", "#7aa0e0"], ["#fff0c0", "#f0c040"]];
  for (const fl of this.flowers) {
    const sway = Math.round(Math.sin(this.t * 1.35 + objectPhase(fl, fl.k)));
    const sx = fl.x - camx + sway, sy = fl.y - camy;
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
  for (const e of this.enemies) if (inv(e.x, e.y)) {
    if (e.dead && e._deathSeen == null) e._deathSeen = this.t;
    if (!e.dead || this.t - e._deathSeen < .4) draw.push({ y: e.sortY, k: "enemy", o: e });
  }
  if (this.boss && !this.boss.dead && inv(this.boss.x, this.boss.y, 140)) draw.push({ y: this.boss.sortY, k: "boss", o: this.boss });
  if (this.pet && !(this.mounted && this.pet.id === this.mountId)) draw.push({ y: this.pet.sortY, k: "pet", o: this.pet });
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
    if (d.k === "building") {
      const cv = this.village[o.type];
      if (cv) {
        const bx = sx - cv.width / 2, by = sy - cv.height + 8;
        ctx.drawImage(cv, bx, by);
        const phase = objectPhase(o);
        if (o.type === "lantern") {
          const pulse = .55 + Math.sin(this.t * 7 + phase) * .25;
          ctx.save(); ctx.globalCompositeOperation = "lighter";
          ctx.fillStyle = `rgba(255,193,92,${pulse * .16})`; ctx.fillRect(sx - 8, sy - 19, 16, 16);
          ctx.fillStyle = `rgba(255,231,157,${pulse})`; ctx.fillRect(sx - 2, sy - 13, 4, 5);
          ctx.fillStyle = `rgba(255,255,220,${pulse})`; ctx.fillRect(sx - 1, sy - 13, 2, 2);
          ctx.restore();
        } else if (o.type === "sakura") {
          for (let i = 0; i < 3; i++) {
            const fall = (this.t * (8 + i * 1.5) + phase * 11 + i * 13) % 48;
            const drift = Math.round(Math.sin(this.t * 1.7 + phase + i) * 5);
            ctx.fillStyle = i === 1 ? "rgba(255,224,238,.8)" : "rgba(255,164,204,.72)";
            ctx.fillRect(Math.round(sx - 17 + i * 16 + drift), Math.round(by + 17 + fall), i === 1 ? 2 : 3, 2);
          }
        } else if (o.type.startsWith("house") || o.type === "shop" || o.type === "pagoda") {
          for (let i = 0; i < 2; i++) {
            const rise = (this.t * (5 + i) + phase * 4 + i * 8) % 22;
            const drift = Math.round(Math.sin(this.t * .8 + phase + i) * 3);
            ctx.fillStyle = `rgba(193,205,211,${Math.max(0, .25 - rise / 100)})`;
            ctx.fillRect(Math.round(bx + cv.width * .72 + drift), Math.round(by + 8 - rise), 3 + i * 2, 2 + i);
          }
        } else if (o.type === "waystone") {
          const pulse = .34 + Math.sin(this.t * 3.1 + phase) * .2;
          ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = `rgba(113,231,164,${pulse})`;
          ctx.fillRect(sx - 1, sy - 24, 3, 8); ctx.fillRect(sx - 4, sy - 21, 9, 2); ctx.restore();
        } else if (o.type === "field_shrine") {
          const rise = (this.t * 7 + phase * 6) % 24, drift = Math.round(Math.sin(this.t * 1.5 + phase) * 3);
          ctx.fillStyle = `rgba(206,218,211,${.3 * (1 - rise / 24)})`; ctx.fillRect(sx + 4 + drift, sy - 30 - rise, 2 + Math.round(rise / 8), 3);
          ctx.fillStyle = `rgba(255,205,102,${.55 + Math.sin(this.t * 8 + phase) * .18})`; ctx.fillRect(sx - 1, sy - 18, 3, 3);
        } else if (o.type === "signpost") {
          const sway = Math.round(Math.sin(this.t * 3 + phase) * 2);
          ctx.fillStyle = "rgba(188,80,64,.78)"; ctx.fillRect(sx + 7 + sway, sy - 26, 4, 2); ctx.fillRect(sx + 9 + sway, sy - 24, 2, 5);
        } else if (o.type === "plank_bridge") {
          const ripple = Math.round((this.t * 11 + phase * 5) % 18);
          ctx.fillStyle = `rgba(190,236,245,${.34 * (1 - ripple / 18)})`;
          ctx.fillRect(sx - 18 - ripple / 2, sy + 1, 8 + ripple, 1); ctx.fillRect(sx + 8 - ripple / 3, sy + 4, 5 + ripple / 2, 1);
        } else if (o.type === "ritual_hall") {
          // Hand-pixel the Indonesian flag so the landmark feels alive rather
          // than like a flat pasted decal. Red sits above white, with a subtle
          // cloth wave driven by the same world clock as grass and lanterns.
          const flagX = bx + cv.width - 17, flagY = by + 4;
          const wave = this.t * 3.2 + phase;
          ctx.fillStyle = "#ead58a"; ctx.fillRect(flagX, flagY - 1, 1, 31);
          for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 14; col++) {
              const flutter = Math.round(Math.sin(wave + col * .55 + row * .18) * (col / 7));
              ctx.fillStyle = row < 5 ? "#e4483f" : "#f3eee0";
              ctx.fillRect(flagX + 2 + col, flagY + row + flutter, 2, 1);
            }
          }
          ctx.save(); ctx.globalCompositeOperation = "lighter";
          ctx.fillStyle = `rgba(106,225,171,${.12 + Math.sin(this.t * 3 + phase) * .04})`;
          ctx.fillRect(sx - 16, by + 13, 32, 2);
          ctx.restore();
        }
      }
    }
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
    else if (d.k === "tree") {
      const im = img(`tree_${o.v}`);
      if (im) {
        ctx.drawImage(im, sx - im.width / 2, sy - im.height + 6);
        const phase = objectPhase(o, o.v);
        if (Math.sin(this.t * .7 + phase) > .94) {
          const drift = Math.round(Math.sin(this.t * 2 + phase) * 5);
          ctx.fillStyle = o.v === 2 ? "rgba(225,123,112,.75)" : "rgba(126,190,93,.68)";
          ctx.fillRect(sx + drift + ((o.v * 5) % 13) - 6, sy - 34 + Math.round((this.t * 9 + phase * 3) % 18), 2, 2);
        }
      }
    }
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
      const resource = img(`resource/${o.kind}`);
      if (resource) {
        ctx.drawImage(resource, -Math.floor(resource.width / 2), -resource.height + 2);
        if (o.kind === "crystal_ore") {
          const glint = .28 + Math.sin(this.t * 3.2 + o.sway) * .22;
          ctx.fillStyle = `rgba(214,247,255,${glint})`; ctx.fillRect(-2, -29, 2, 2); ctx.fillRect(7, -18, 1, 1);
        } else if (o.kind === "glow_vine") {
          const glow = .16 + Math.sin(this.t * 2.4 + o.sway) * .08;
          ctx.fillStyle = `rgba(100,255,176,${glow})`; ctx.beginPath(); ctx.arc(0, -16, 13, 0, Math.PI * 2); ctx.fill();
          ctx.drawImage(resource, -Math.floor(resource.width / 2), -resource.height + 2);
        }
      } else if (o.kind === "bamboo_shoot") {
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
      const im = img(open ? (o.pet ? "fx/chest_pet_open" : "fx/chest_open") : (o.pet ? "fx/chest_pet" : "fx/chest"));
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
      const pdx = p.x - o.x, pdy = p.y - o.y, playerNear = Math.hypot(pdx, pdy) < 58;
      let dir = ["down", "up", "left", "right"].includes(o.dir) ? o.dir : "down";
      if (o.activity === "fish" && o.preferredDir) dir = o.preferredDir;
      else if (playerNear && !o.moving) dir = Math.abs(pdx) > Math.abs(pdy) ? (pdx < 0 ? "left" : "right") : (pdy < 0 ? "up" : "down");
      const pose = o.moving ? "walk" : "idle";
      const frame = o.moving ? o.frame : Math.floor(this.t * 1.8 + objectPhase(o)) % 4;
      const cv = poseFrame(o.cache, pose, dir, frame, "walk");
      const breathe = o.moving ? (o.frame % 2 ? -1 : 0) : Math.round(Math.sin(this.t * 1.7 + objectPhase(o, 2)) * .6);
      ctx.fillStyle = "rgba(18,25,24,.22)";
      ctx.beginPath(); ctx.ellipse(sx, sy + 1, o.moving ? 10 : 9, o.moving ? 3 : 2.5, 0, 0, Math.PI * 2); ctx.fill();
      // exclamation marker for available quest
      if (cv) ctx.drawImage(cv, sx - 16, sy - 36 + breathe);
      drawNpcActivity(ctx, o, sx, sy + breathe, this.t, dir);
      const hasQuest = this.quests.forGiver(o.name, p.inv).some(x => !x.active && !x.done);
      const ready = this.quests.forGiver(o.name, p.inv).some(x => x.ready);
      if (ready) { ctx.fillStyle = "#ffd24a"; ctx.font = "bold 14px sans-serif"; ctx.fillText("?", sx - 3, sy - 40 + Math.sin(this.t * 4) * 2 + breathe); }
      else if (hasQuest) { ctx.fillStyle = "#ffe070"; ctx.font = "bold 15px sans-serif"; ctx.fillText("!", sx - 2, sy - 40 + Math.sin(this.t * 4) * 2 + breathe); }
      if (playerNear && this._interactTarget === o) {
        const side = dir === "left" ? 1 : -1;
        ctx.fillStyle = "rgba(143,224,195,.7)";
        ctx.fillRect(sx + side * 8, sy - 27 + breathe, 2, 2);
        ctx.fillRect(sx + side * 11, sy - 30 + breathe, 1, 1);
      }
      if (o.ambient || (!hasQuest && !ready)) drawNpcEmote(ctx, o, sx, sy, this.t);
      // Ambient residents reveal their tag only up close, keeping busy regions readable.
      if (!o.ambient || playerNear || this._interactTarget === o) {
        const tagW = o.ambient ? 42 : 36;
        ctx.font = "7px 'IBM Plex Sans',sans-serif"; ctx.textAlign = "center";
        ctx.fillStyle = o.ambient ? "rgba(20,35,31,.72)" : "rgba(0,0,0,0.5)"; ctx.fillRect(sx - tagW / 2, sy - 46, tagW, 9);
        if (o.ambient) { ctx.fillStyle = o.look?.accent || "#79c9a4"; ctx.fillRect(sx - tagW / 2, sy - 46, 2, 9); }
        ctx.fillStyle = "#e8ecf2"; ctx.fillText(o.name, sx, sy - 39); ctx.textAlign = "left";
      }
    }
    else if (d.k === "remote") {
      const rsx = Math.round(o.rx - camx), rsy = Math.round(o.ry - camy);
      if (!o.cache) {
        let lk; try { lk = JSON.parse(o.look); } catch { lk = {}; }
        const resolvedLook = { ...DEFAULT_LOOK, ...lk, name: o.name };
        o.cache = buildCharacter(resolvedLook);
        o.weaponCache = this.weaponFrames((CLASSES[resolvedLook.cls] || CLASSES.warrior).weapon);
      }
      const dir = ["down", "up", "left", "right"].includes(o.dir) ? o.dir : "down";
      const cv = o.cache.walk[dir][o.frame % 4];
      const remoteWeapon = o.weaponCache?.walk?.[dir] || null;
      const remoteMountMeta = o.mounted ? MON_META[o.mountId] : null;
      const remoteMountFrames = remoteMountMeta?.mountable ? this.monCache[o.mountId] : null;
      const remoteMountFrame = o.moving ? o.frame : Math.floor(this.t * 2.4 + objectPhase(o));
      const remoteMountSprite = remoteMountFrames?.[remoteMountFrame % remoteMountFrames.length] || null;
      const remoteRiding = !!remoteMountSprite;
      const remoteMountScale = remoteRiding ? remoteMountMeta.mountScale || 1.25 : 1;
      const remoteLift = remoteRiding ? Math.round(17 + (remoteMountScale - 1) * 12) : 0;
      const remoteBob = remoteRiding
        ? (o.moving ? -Math.round(Math.abs(Math.sin(this.t * 13 + objectPhase(o))) * 2) : Math.round(Math.sin(this.t * 2.4 + objectPhase(o)) * .22))
        : 0;
      // soft shadow for remote player
      ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.beginPath(); ctx.ellipse(rsx, rsy + (remoteRiding ? 3 : 1), remoteRiding ? 18 * remoteMountScale : 12, remoteRiding ? 4.5 : 3.5, 0, 0, 7); ctx.fill();
      if (remoteRiding) {
        ctx.save(); ctx.translate(rsx, rsy + 2 + remoteBob); ctx.scale(remoteMountScale, remoteMountScale);
        ctx.drawImage(remoteMountSprite, -remoteMountSprite.width / 2, -remoteMountSprite.height); ctx.restore();
        ctx.fillStyle = "#2a2424"; ctx.fillRect(rsx - 9, rsy - 22 + remoteBob, 18, 4);
        ctx.fillStyle = "#9a623c"; ctx.fillRect(rsx - 8, rsy - 23 + remoteBob, 16, 3);
        ctx.fillStyle = "#d5a95c"; ctx.fillRect(rsx - 2, rsy - 24 + remoteBob, 4, 2);
      }
      if (o.duel) {
        const pulse = .52 + Math.sin(this.t * 5 + objectPhase(o)) * .18;
        ctx.strokeStyle = `rgba(239,92,73,${pulse})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(rsx, rsy, 15, 5, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.save(); ctx.translate(rsx, rsy - 51 - remoteLift + remoteBob); ctx.rotate(.6); ctx.fillStyle = "#e9d9c6"; ctx.fillRect(-1, -6, 2, 12); ctx.fillStyle = "#c65d4c"; ctx.fillRect(-4, 3, 8, 2); ctx.rotate(-1.2); ctx.fillStyle = "#e9d9c6"; ctx.fillRect(-1, -6, 2, 12); ctx.fillStyle = "#c65d4c"; ctx.fillRect(-4, 3, 8, 2); ctx.restore();
      }
      ctx.save(); ctx.translate(rsx, rsy - remoteLift + remoteBob);
      const weaponBehind = dir === "up" || dir === "left";
      if (weaponBehind && remoteWeapon) ctx.drawImage(remoteWeapon, -16, -36);
      ctx.drawImage(cv, -16, -36);
      if (!weaponBehind && remoteWeapon) ctx.drawImage(remoteWeapon, -16, -36);
      ctx.restore();
      // name tag (blue tint to distinguish other players)
      ctx.font = "7px 'IBM Plex Sans',sans-serif"; ctx.textAlign = "center";
      ctx.fillStyle = o.duel ? "rgba(76,25,29,.78)" : "rgba(20,40,80,0.6)"; ctx.fillRect(rsx - 20, rsy - 46 - remoteLift + remoteBob, 40, 9);
      if (o.duel) { ctx.fillStyle = "#d95348"; ctx.fillRect(rsx - 20, rsy - 46 - remoteLift + remoteBob, 2, 9); }
      ctx.fillStyle = o.duel ? "#ffc0ab" : "#9fd0ff"; ctx.fillText(o.name, rsx, rsy - 39 - remoteLift + remoteBob); ctx.textAlign = "left";
    }
    else if (d.k === "enemy") {
      const im = this.monCache[o.id] ? this.monCache[o.id][o.frame % 4] : null;
      const bob = Math.sin(o.bob) * 2;
      if (im) {
        const toPlayerX = p.x - o.x, toPlayerY = p.y - o.y, toPlayerD = Math.hypot(toPlayerX, toPlayerY) || 1;
        const chase = o.state === "chase" && !o.frozen;
        const attackAge = 1.4 - (o.atkCd || 0);
        const attackPr = attackAge >= 0 && attackAge < .28 ? attackAge / .28 : -1;
        const lunge = attackPr >= 0 ? Math.sin(attackPr * Math.PI) * 6 : 0;
        const hurt = clamp((o.hurt || 0) / .2, 0, 1);
        if (o.dead && o._deathSeen == null) o._deathSeen = this.t;
        const death = o.dead ? clamp((this.t - o._deathSeen) / .4, 0, 1) : 0;
        const leanX = chase ? clamp(toPlayerX / toPlayerD, -1, 1) * 2 : 0;
        const leanY = chase ? clamp(toPlayerY / toPlayerD, -1, 1) : 0;
        const drawX = sx + leanX + toPlayerX / toPlayerD * lunge;
        const drawY = sy + leanY + toPlayerY / toPlayerD * lunge;
        const squash = hurt ? .9 + (1 - hurt) * .1 : 1;
        // soft shadow
        ctx.globalAlpha = 1 - death;
        ctx.fillStyle = `rgba(0,0,0,${.2 * (1 - death)})`; ctx.beginPath(); ctx.ellipse(drawX, sy + 1, im.width * .35 * (1 - death * .5), 3, 0, 0, 7); ctx.fill();
        ctx.save();
        ctx.translate(Math.round(drawX), Math.round(drawY));
        ctx.scale((1 - death * .7) * (hurt ? 1.08 : 1), (1 - death * .35) * squash);
        if (death) ctx.rotate(death * .2 * (objectPhase(o) > Math.PI ? -1 : 1));
        if (hurt) ctx.filter = `brightness(${1.25 + hurt * .75}) saturate(${1 + hurt * .5})`;
        ctx.drawImage(im, -im.width / 2, -im.height + bob);
        ctx.restore();
        ctx.globalAlpha = 1;
        if (!o.dead && o.state === "chase" && o.angry > 0) { ctx.fillStyle = "#ff5a5a"; ctx.font = "bold 11px sans-serif"; ctx.fillText("!", sx - 2, sy - im.height + bob - 2); }
        if (!o.dead && o.hp < o.maxHp) {
          ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(sx - 12, sy - im.height + bob - 5, 24, 3);
          ctx.fillStyle = "#e05050"; ctx.fillRect(sx - 12, sy - im.height + bob - 5, 24 * (o.hp / o.maxHp), 3);
        }
        if (!o.dead && o.frozen) {
          const frostPulse = .55 + Math.sin(this.t * 8 + objectPhase(o)) * .2;
          ctx.fillStyle = `rgba(178,239,255,${frostPulse})`;
          for (let i = 0; i < 6; i++) {
            const a = i / 6 * Math.PI * 2, rr = 12 + (i % 2) * 4;
            const ix = Math.round(sx + Math.cos(a) * rr), iy = Math.round(sy - 18 + Math.sin(a) * rr * .7);
            ctx.fillRect(ix - 1, iy - 3, 2, 6); ctx.fillRect(ix - 2, iy - 1, 4, 2);
          }
        }
      }
    }
    else if (d.k === "boss") {
      const sz = BOSS_SIZE; // native integer scale stays crisp after the canvas scales
      const frame = bossFrame(o.frame, o.rage);
      const toPlayerX = p.x - o.x, toPlayerY = p.y - o.y, toPlayerD = Math.hypot(toPlayerX, toPlayerY) || 1;
      const nx = toPlayerX / toPlayerD, ny = toPlayerY / toPlayerD;
      const windupMax = o.rage ? .48 : .68;
      const windupPr = o.breathWindup > 0 ? clamp(1 - o.breathWindup / windupMax, 0, 1) : 0;
      const meleeMax = o.rage ? 1.4 : 2.2;
      const meleeAge = meleeMax - (o.atkCd || 0);
      const meleePr = o.state === "melee" && meleeAge >= 0 && meleeAge < .34 ? meleeAge / .34 : -1;
      const meleeLunge = meleePr >= 0 ? Math.sin(meleePr * Math.PI) * 10 : 0;
      const breathRecoilAge = o.breathWindup <= 0 ? (o.rage ? 2.8 : 4.8) - (o.breatheCd || 0) : 1;
      const breathRecoil = breathRecoilAge >= 0 && breathRecoilAge < .28 ? (1 - breathRecoilAge / .28) * 5 : 0;
      const hurtKick = clamp((o.hurt || 0) / .2, 0, 1) * 4;
      const visualX = sx + nx * meleeLunge - Math.cos(o.breathAngle || 0) * breathRecoil - nx * hurtKick;
      const visualY = sy + ny * meleeLunge - Math.sin(o.breathAngle || 0) * breathRecoil - ny * hurtKick;
      const charge = windupPr ? Math.sin(windupPr * Math.PI) : 0;
      // large soft shadow for boss
      ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.ellipse(visualX, sy + 2, sz * (.4 + charge * .04), 6 - charge, 0, 0, 7); ctx.fill();
      if (frame) {
        ctx.save();
        ctx.translate(Math.round(visualX), Math.round(visualY));
        ctx.scale(1 + charge * .09, 1 - charge * .07);
        if (o.hurt > 0) ctx.filter = "brightness(1.6)";
        // rage glow aura
        if (o.rage) { ctx.shadowColor = "rgba(255,80,20,0.8)"; ctx.shadowBlur = 20; }
        if (o.rage && (o.state === "windup" || meleePr >= 0)) {
          ctx.save(); ctx.globalAlpha = .16 + charge * .12; ctx.filter = "saturate(1.8) brightness(1.25)";
          ctx.drawImage(frame, -sz / 2 - 5, -sz + 8); ctx.drawImage(frame, -sz / 2 + 5, -sz + 8); ctx.restore();
        }
        ctx.drawImage(frame, -sz / 2, -sz + 8);
        ctx.restore();
        if (windupPr) {
          ctx.fillStyle = o.rage ? "rgba(255,105,55,.9)" : "rgba(255,190,92,.82)";
          for (let i = 0; i < 8; i++) {
            const a = i / 8 * Math.PI * 2 + this.t * (o.rage ? 5 : 3), rr = 36 - windupPr * 22 + (i % 2) * 5;
            ctx.fillRect(Math.round(visualX + Math.cos(a) * rr) - 1, Math.round(visualY - 38 + Math.sin(a) * rr * .55) - 1, i % 2 ? 2 : 3, i % 2 ? 2 : 3);
          }
        }
      }
    }
    else if (d.k === "pet") {
      const moving = o.moving ?? Math.hypot(p.x - o.x, p.y - o.y) > 34;
      const frameIndex = Number.isFinite(o.frame) ? o.frame : Math.floor(this.t * (moving ? 7 : 3));
      const im = this.monCache[o.id] ? this.monCache[o.id][frameIndex % 4] : null;
      if (im) {
        if (this._renderPetRef !== o) { this._renderPetRef = o; o._renderBirth = this.t; }
        const summonAge = this.t - (o._renderBirth ?? this.t);
        const summon = Math.max(clamp(1 - summonAge / .55, 0, 1), clamp((o.spawnT || 0) / .45, 0, 1));
        const element = MON_ELEMENT[o.id] || "grass", pal = PET_AURA[element] || PET_AURA.grass;
        const phase = objectPhase(o, o.id?.length || 0);
        const stride = moving ? Math.sin(this.t * 14 + phase) : Math.sin(o.bob || this.t * 4);
        const bob = moving ? Math.round(Math.abs(stride) * -3) : Math.round(stride * 1.3);
        const dx = p.x - o.x, dy = p.y - o.y, dist = Math.hypot(dx, dy) || 1;
        const leanX = moving ? clamp(dx / dist, -1, 1) * 2 : 0;
        const petScale = MON_META[o.id]?.petScale || .82;
        const scaleX = petScale + (moving ? Math.abs(stride) * .025 : Math.sin(this.t * 2 + phase) * .012);
        const scaleY = petScale - (moving ? Math.abs(stride) * .025 : Math.sin(this.t * 2 + phase) * .012);
        if (summon > 0) {
          const radius = Math.round(10 + (1 - summon) * 15);
          ctx.globalAlpha = summon;
          ctx.strokeStyle = pal[0]; ctx.lineWidth = 2; ctx.strokeRect(sx - radius, sy - Math.round(radius * .35), radius * 2, Math.round(radius * .7));
          ctx.fillStyle = pal[1];
          for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + this.t * 4; ctx.fillRect(Math.round(sx + Math.cos(a) * radius) - 1, Math.round(sy - 10 + Math.sin(a) * radius * .65) - 1, 2, 2); }
          ctx.globalAlpha = 1;
        }
        ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.beginPath(); ctx.ellipse(sx, sy + 1, im.width * .25 * scaleX / petScale, 2.5, 0, 0, 7); ctx.fill();
        ctx.save();
        ctx.translate(Math.round(sx + leanX), Math.round(sy + bob));
        ctx.scale(scaleX, scaleY);
        ctx.drawImage(im, -im.width / 2, -im.height);
        ctx.restore();
        const mood = Math.sin(this.t * .85 + phase);
        if (!moving && mood > .9) {
          ctx.fillStyle = pal[0];
          ctx.fillRect(sx + 9, sy - 27, 2, 2); ctx.fillRect(sx + 12, sy - 31, 1, 1);
        }
      }
    }
    else if (d.k === "player") {
      const mountMeta = this.mounted ? MON_META[this.mountId] : null;
      const mountFrames = this.mounted ? this.monCache[this.mountId] : null;
      const mountFrame = p.moving ? p.frame || 0 : Math.floor(this.t * 2.4);
      const mountSprite = mountFrames?.[mountFrame % mountFrames.length] || null;
      const riding = !!(mountMeta?.mountable && mountSprite);
      const mountScale = riding ? mountMeta.mountScale || 1.25 : 1;
      const riderLift = riding ? this.riderVisualLift() : 0;
      let mountBob = 0;
      if (riding) {
        const stride = p.moving ? Math.sin(this.t * 13) : Math.sin(this.t * 2.4) * .22;
        mountBob = p.moving ? -Math.round(Math.abs(stride) * 2) : Math.round(stride);
        const scaleX = mountScale + (p.moving ? Math.abs(stride) * .025 : 0);
        const scaleY = mountScale - (p.moving ? Math.abs(stride) * .025 : 0);
        const palette = PET_AURA[mountMeta.element] || PET_AURA.grass;
        ctx.fillStyle = "rgba(7,12,13,.29)"; ctx.beginPath(); ctx.ellipse(sx, sy + 3, 19 * mountScale, 5, 0, 0, Math.PI * 2); ctx.fill();
        if (p.moving) {
          ctx.fillStyle = `${palette[0]}88`;
          const wake = (Math.floor(this.t * 18) % 3) * 5;
          ctx.fillRect(sx - 18 - wake, sy - 2, Math.max(2, 8 - wake / 2), 2);
          ctx.fillRect(sx + 10 + wake / 2, sy + 1, Math.max(2, 6 - wake / 3), 1);
        }
        ctx.save();
        ctx.translate(sx, sy + mountBob + 2); ctx.scale(scaleX, scaleY);
        ctx.drawImage(mountSprite, -mountSprite.width / 2, -mountSprite.height);
        ctx.restore();
        // Code-drawn saddle and harness make the relationship read as riding,
        // rather than a companion sprite accidentally overlapping the hero.
        ctx.fillStyle = "#2a2424"; ctx.fillRect(sx - 9, sy - 22 + mountBob, 18, 4);
        ctx.fillStyle = "#9a623c"; ctx.fillRect(sx - 8, sy - 23 + mountBob, 16, 3);
        ctx.fillStyle = "#d5a95c"; ctx.fillRect(sx - 2, sy - 24 + mountBob, 4, 2);
      }
      ctx.save();
      if (riderLift) ctx.translate(0, mountBob - riderLift);
      const dir = ["down", "up", "left", "right"].includes(p.dir) ? p.dir : "down";
      const hurtT = p.hurtT || p.damageT || 0;
      const attackPhase = p.attackT > 0 ? clamp(1 - p.attackT / (p.attackDur || .25), 0, 1) : 0;
      let pose = p.moving ? "walk" : "idle", poseIndex = p.frame || 0;
      if (this.fishing) { pose = "fishing"; poseIndex = Math.floor(this.t * 2) % 4; }
      else if (hurtT > 0) { pose = "hurt"; poseIndex = Math.floor(this.t * 16) % 4; }
      else if (p.evadeT > 0) { pose = "dash"; poseIndex = clamp(Math.floor((1 - p.evadeT / .16) * 4), 0, 3); }
      else if (p.shield) { pose = "guard"; poseIndex = Math.floor(this.t * 2) % 4; }
      else if (p.attackT > 0) {
        pose = p.attackStyle === "cast" ? "cast" : p.attackStyle === "bow" ? "bow" : "atk";
        poseIndex = Math.floor(attackPhase * 6);
      } else if (!p.moving) poseIndex = Math.floor(this.t * 2.2) % 4;
      if (!this.charCache?.[pose] && ["idle", "guard", "hurt", "fishing"].includes(pose)) poseIndex = 0;

      const activePoseBank = this.charCache?.[pose]?.[dir];
      if (p.attackT > 0 && Array.isArray(activePoseBank)) poseIndex = clamp(Math.floor(attackPhase * activePoseBank.length), 0, activePoseBank.length - 1);

      const body = poseFrame(this.charCache, pose, dir, poseIndex, p.attackT > 0 ? "atk" : "walk");
      const wf2 = this.weaponFrames(p.equipped);
      let weap = null;
      if (!this.fishing) {
        const weaponBank = wf2?.[pose]?.[dir]
          ?? (p.attackT > 0 ? wf2?.atk?.[dir] : wf2?.walk?.[dir]);
        if (Array.isArray(weaponBank)) {
          const weaponIndex = p.attackT > 0
            ? clamp(Math.floor(attackPhase * weaponBank.length), 0, weaponBank.length - 1)
            : poseIndex % weaponBank.length;
          weap = weaponBank[weaponIndex];
        } else weap = weaponBank;
      }

      const dvec = dir === "left" ? [-1, 0] : dir === "right" ? [1, 0] : dir === "up" ? [0, -1] : [0, 1];
      let ox = 0, oy = 0, scaleX = 1, scaleY = 1, rotation = 0;
      if (pose === "idle") { oy = Math.round(Math.sin(this.t * 2.2) * .55); scaleY += Math.sin(this.t * 2.2) * .012; }
      if (pose === "guard") { ox = -dvec[0]; oy = 1 - dvec[1]; scaleX = 1.04; scaleY = .96; }
      if (pose === "dash") { ox = dvec[0] * 3; oy = dvec[1] * 3; scaleX = dvec[0] ? 1.08 : .94; scaleY = dvec[1] ? 1.08 : .94; }
      if (pose === "hurt") { ox = Math.round(Math.sin(this.t * 45) * 2); scaleX = 1.08; scaleY = .92; }
      if (pose === "cast") { oy = -Math.round(Math.sin(attackPhase * Math.PI) * 2); }
      if (pose === "bow") { ox = -dvec[0] * Math.round(Math.sin(attackPhase * Math.PI) * 2); oy = -dvec[1] * Math.round(Math.sin(attackPhase * Math.PI) * 2); }
      if (pose === "atk") {
        const strike = Math.sin(attackPhase * Math.PI), anticipation = clamp(attackPhase / .24, 0, 1);
        const travel = attackPhase < .24 ? -2 * anticipation : 1 + strike * (3 + (p.comboStep || 0));
        ox = Math.round(dvec[0] * travel); oy = Math.round(dvec[1] * travel);
        scaleX = dvec[0] ? 1 + strike * .07 : 1 - strike * .035;
        scaleY = dvec[1] ? 1 + strike * .06 : 1 - strike * .025;
        rotation = (dvec[0] || 1) * ((p.comboStep || 0) === 1 ? -.055 : .035) * strike;
      }

      // The mount owns the ground shadow while riding.
      if (!riding) { ctx.fillStyle = "rgba(0,0,0,0.22)"; ctx.beginPath(); ctx.ellipse(sx, sy + 1, 12 * scaleX, 3.5 * scaleY, 0, 0, 7); ctx.fill(); }
      if (pose === "cast" && p.attackT > 0) {
        ctx.save(); ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < 6; i++) {
          const a = i / 6 * Math.PI * 2 - attackPhase * 5, rr = 9 + attackPhase * 7;
          ctx.fillStyle = i % 2 ? "rgba(139,219,255,.82)" : "rgba(210,159,255,.9)";
          ctx.fillRect(Math.round(sx + Math.cos(a) * rr) - 1, Math.round(sy - 17 + Math.sin(a) * rr * .55) - 1, 2, 2);
        }
        ctx.restore();
      }
      if (p.buffT > 0) {
        const pulse = .4 + Math.sin(this.t * 7) * .16;
        ctx.strokeStyle = `rgba(244,183,78,${pulse})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(sx, sy - 2, 15 + Math.sin(this.t * 5), 5, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "rgba(255,220,125,.8)";
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + this.t * 1.4; ctx.fillRect(Math.round(sx + Math.cos(a) * 13), Math.round(sy - 18 + Math.sin(a) * 8), 2, 2); }
      }
      if (p.wardT > 0) {
        const pulse = .44 + Math.sin(this.t * 9) * .14;
        ctx.strokeStyle = `rgba(113,224,166,${pulse})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(sx, sy - 16, 16, 21, 0, -.55, 2.25); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(sx, sy - 16, 16, 21, 0, 2.58, 5.36); ctx.stroke();
        for (let i = 0; i < 5; i++) { const a = this.t * 2.2 + i * Math.PI * .4; ctx.fillStyle = i % 2 ? "#bdf4b0" : "#65c998"; ctx.fillRect(Math.round(sx + Math.cos(a) * 17), Math.round(sy - 16 + Math.sin(a) * 11), 3, 2); }
      }
      // weapon behind body when facing up/left
      const behind = dir === "up" || dir === "left";
      const drawPlayerLayers = (x, y, alpha = 1) => {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(rotation); ctx.scale(scaleX, scaleY);
        if (behind && weap) ctx.drawImage(weap, -16, -36);
        if (body) ctx.drawImage(body, -16, -36);
        if (!behind && weap) ctx.drawImage(weap, -16, -36);
        ctx.restore();
      };
      if (pose === "dash" && body) {
        for (let i = 3; i >= 1; i--) drawPlayerLayers(sx + ox - dvec[0] * i * 5, sy + oy - dvec[1] * i * 5, .08 + i * .035);
      }
      const invulnAlpha = p.invuln > 0 && Math.floor(this.t * 20) % 2 ? .5 : 1;
      drawPlayerLayers(sx + ox, sy + oy, invulnAlpha);
      if (pose === "guard") {
        const gx = sx + dvec[0] * 13, gy = sy - 18 + dvec[1] * 9;
        ctx.fillStyle = "rgba(126,205,231,.16)"; ctx.fillRect(gx - 6, gy - 8, 12, 16);
        ctx.strokeStyle = "rgba(189,239,249,.85)"; ctx.lineWidth = 1; ctx.strokeRect(gx - 6, gy - 8, 12, 16);
        ctx.fillStyle = "rgba(231,253,255,.9)"; ctx.fillRect(gx - 1, gy - 5, 2, 10); ctx.fillRect(gx - 4, gy - 1, 8, 2);
      }
      ctx.restore();
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
  this.renderWorldChat(ctx, camx, camy);
  this.renderMinimap();
};

// World speech is a DOM overlay. Canvas text was rendered at the low internal
// game resolution and then enlarged, which made the letters look broken.
Game.prototype.renderWorldChat = function (_ctx, camx, camy) {
  const layer = document.getElementById("world-chat-layer");
  if (!layer) return;
  const rectKey = `${innerWidth}x${innerHeight}:${view.w}x${view.h}`;
  if (this._worldChatRectKey !== rectKey) {
    this._worldChatRectKey = rectKey;
    this._worldChatRect = this.canvas.getBoundingClientRect();
  }
  const rect = this._worldChatRect;
  const scaleX = rect.width / view.w;
  const scaleY = rect.height / view.h;
  const active = [];
  const p = this.player;
  if (p?.chatText && p.chatUntil > this.t) {
    active.push({
      key: "self", name: p.name || "Traveler", text: p.chatText,
      x: p.x - camx, y: p.y - camy - (this.mounted ? 60 : 43),
      accent: "#e1bd61", born: p.chatBorn, until: p.chatUntil, self: true,
    });
  }
  for (const [id, remote] of Object.entries(net.remote)) {
    if (!remote.chatText || remote.chatUntil <= this.t) continue;
    const x = remote.rx - camx, y = remote.ry - camy;
    if (x < -90 || x > view.w + 90 || y < -90 || y > view.h + 70) continue;
    active.push({
      key: `remote-${id}`, name: remote.name || "Traveler", text: remote.chatText,
      x, y: y - (remote.mounted ? 60 : 51), accent: remote.duel ? "#df6655" : "#63c69e",
      born: remote.chatBorn, until: remote.chatUntil, duel: !!remote.duel,
    });
  }

  const keep = new Set();
  this._worldChatEls ||= new Map();
  for (const bubble of active) {
    keep.add(bubble.key);
    let el = this._worldChatEls.get(bubble.key);
    if (!el) {
      el = document.createElement("div");
      el.className = "world-chat-bubble";
      el.append(document.createElement("span"), document.createElement("p"));
      layer.appendChild(el);
      this._worldChatEls.set(bubble.key, el);
    }
    const [label, message] = el.children;
    const displayName = bubble.self ? `${bubble.name} · YOU` : bubble.name;
    if (label.textContent !== displayName) label.textContent = displayName;
    if (message.textContent !== bubble.text) {
      message.textContent = bubble.text;
      el.classList.remove("arrive");
      void el.offsetWidth;
      el.classList.add("arrive");
      // Measure only when the copy changes. This keeps the whole bubble on
      // screen without forcing layout reads on every animation frame.
      el._bubbleHalf = Math.ceil(el.offsetWidth / 2) + 8;
    }
    el.classList.toggle("self", !!bubble.self);
    el.classList.toggle("duel", !!bubble.duel);
    el.style.setProperty("--chat-accent", bubble.accent);
    const rawPx = rect.left + bubble.x * scaleX;
    const fallbackHalf = innerWidth <= 600 ? 98 : 118;
    const bubbleMargin = Math.min(rect.width / 2, el._bubbleHalf || fallbackHalf);
    const px = clamp(rawPx, rect.left + bubbleMargin, rect.right - bubbleMargin);
    const py = clamp(rect.top + bubble.y * scaleY, rect.top + 58, rect.bottom - 28);
    const intro = clamp((this.t - (bubble.born ?? this.t)) / .16, 0, 1);
    const outro = clamp((bubble.until - this.t) / .42, 0, 1);
    el.style.left = `${Math.round(px)}px`;
    el.style.top = `${Math.round(py)}px`;
    const tailLimit = Math.max(0, bubbleMargin - 23);
    el.style.setProperty("--chat-tail-shift", `${Math.round(clamp(rawPx - px, -tailLimit, tailLimit))}px`);
    el.style.opacity = String(Math.min(intro, outro));
  }
  for (const [key, el] of this._worldChatEls) {
    if (keep.has(key)) continue;
    el.remove();
    this._worldChatEls.delete(key);
  }
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
    if (sx < -180 || sx > view.w + 180 || sy < -180 || sy > view.h + 180) continue;
    if (f.kind === "weaponslash") {
      const frame = img(`fx/slash_${clamp(Math.floor(pr * 4), 0, 3)}`);
      const rot = f.dir === "right" ? 0 : f.dir === "down" ? Math.PI / 2 : f.dir === "left" ? Math.PI : -Math.PI / 2;
      const reach = f.weapon === "spear" ? 1.35 : f.weapon === "dagger" ? .72 : f.weapon === "axe" ? 1.2 : f.weapon === "greatblade" ? 1.34 : 1;
      const dragon = String(f.weapon).startsWith("dragon");
      const trail = dragon ? "#d99cff" : f.weapon === "greatblade" ? "#e05063" : f.weapon === "axe" ? "#f1a45d" : f.weapon === "spear" ? "#8fe1c0" : f.weapon === "dagger" ? "#9bd4f0" : "#f5df91";
      const combo = Number(f.combo) || 0, mirror = combo === 1 ? -1 : 1;
      ctx.save(); ctx.translate(Math.round(sx), Math.round(sy - 17)); ctx.rotate(rot + (combo === 2 ? .12 : 0)); ctx.scale(reach, reach * mirror);
      ctx.globalAlpha = Math.max(0, 1 - pr * .7);
      if (frame) { ctx.drawImage(frame, 2 + combo, -20); ctx.globalAlpha *= .3; ctx.drawImage(frame, -3 - combo, -20); }
      ctx.globalAlpha = Math.max(0, (1 - pr) * .9); ctx.fillStyle = trail;
      for (let i = 0; i < 8; i++) {
        const angle = -.98 + i * .2 + pr * (.24 + combo * .05), radius = 17 + i * 1.7 + combo * 1.5;
        const size = i % 3 === 0 ? 3 : 2;
        ctx.fillRect(Math.round(Math.cos(angle) * radius), Math.round(Math.sin(angle) * radius) - 1, size, size);
      }
      ctx.strokeStyle = trail; ctx.lineWidth = combo === 2 ? 2 : 1; ctx.globalAlpha *= .7;
      ctx.beginPath(); ctx.arc(0, 0, 21 + combo * 3, -.98 + pr * .14, .48 + pr * .2); ctx.stroke();
      if (dragon) { ctx.fillStyle = "#fff0ff"; ctx.fillRect(20 + Math.round(pr * 6), -2, 5, 2); ctx.fillRect(15, -8, 2, 2); }
      ctx.restore();
    } else if (f.kind === "bowrelease") {
      ctx.save(); ctx.translate(Math.round(sx), Math.round(sy)); ctx.rotate(f.angle || 0);
      const power = ["power", "dragon", "falcon", "predator"].includes(f.variant), sakura = f.variant === "sakura", spirit = f.variant === "spirit";
      const hunter = ["hunter", "predator", "vault"].includes(f.variant);
      const color = spirit ? "#a9f4dc" : hunter ? "#d8e68b" : f.variant === "falcon" ? "#c8ffd5" : sakura ? "#ffb0cf" : power ? "#ffe38a" : "#bff7cf";
      const count = sakura ? 5 : f.variant === "multi" || spirit ? 3 : 1;
      ctx.globalAlpha = 1 - pr;
      for (let i = 0; i < count; i++) {
        const off = (i - (count - 1) / 2) * (sakura ? 3.5 : 5);
        ctx.fillStyle = color; ctx.fillRect(5 + Math.round(pr * 18), off - 1, power ? 18 : 12, 2);
        ctx.fillStyle = "#ffffff"; ctx.fillRect(10 + Math.round(pr * 18), off - 1, power ? 8 : 4, 1);
      }
      ctx.fillStyle = sakura ? "rgba(255,151,193,.7)" : spirit ? "rgba(126,238,213,.72)" : hunter ? "rgba(205,226,119,.7)" : "rgba(151,242,184,.7)"; ctx.fillRect(-2, -9 - Math.round(pr * 5), 2, 19 + Math.round(pr * 10));
      ctx.strokeStyle = power ? `rgba(255,222,122,${1 - pr})` : spirit ? `rgba(132,241,213,${(1 - pr) * .85})` : hunter ? `rgba(203,225,112,${(1 - pr) * .82})` : `rgba(137,229,178,${(1 - pr) * .8})`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(0, 0, 5 + pr * 16, 12 + pr * 9, 0, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? color : "#fff"; ctx.fillRect(-5 - Math.round(pr * 12), -8 + i * 5, 2 + i % 2, 2); }
      if (f.variant === "falcon" || f.variant === "predator") {
        ctx.strokeStyle = `rgba(188,255,209,${1 - pr})`; ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(-8 - pr * 14, -10 - pr * 5); ctx.lineTo(-3, -2); ctx.lineTo(-8 - pr * 14, 10 + pr * 5); ctx.stroke();
      } else if (sakura || spirit) {
        for (let i = 0; i < 7; i++) { const a = i * 2.2 + pr * 4, r = 8 + i * 2 + pr * 12; ctx.fillStyle = spirit ? (i % 2 ? "#ddfff3" : "#75d9bd") : (i % 2 ? "#ffd8e8" : "#ef86b3"); ctx.fillRect(Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r * .55), 3, 2); }
      }
      ctx.restore();
    } else if (f.kind === "castburst") {
      ctx.save(); ctx.translate(Math.round(sx), Math.round(sy)); ctx.rotate((f.angle || 0) + Math.PI / 4);
      const dragon = f.variant === "dragon", comet = f.variant === "comet", skill = f.variant === "skill", holy = ["holy", "radiant"].includes(f.variant);
      const color = holy ? "rgba(255,222,113,A)" : dragon ? "rgba(202,125,255,A)" : comet ? "rgba(255,174,64,A)" : skill ? "rgba(255,182,72,A)" : "rgba(129,205,255,A)";
      const radius = 6 + Math.round(pr * 20);
      ctx.strokeStyle = color.replace("A", String(1 - pr)); ctx.lineWidth = 2; ctx.strokeRect(-radius, -radius, radius * 2, radius * 2);
      ctx.save(); ctx.rotate(-pr * 2.1); ctx.strokeStyle = color.replace("A", String((1 - pr) * .58)); ctx.lineWidth = 1; ctx.strokeRect(-radius * .68, -radius * .68, radius * 1.36, radius * 1.36); ctx.restore();
      ctx.fillStyle = color.replace("A", String((1 - pr) * .85));
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.fillRect(Math.round(Math.cos(a) * (radius + 4)) - 1, Math.round(Math.sin(a) * (radius + 4)) - 1, i % 2 ? 2 : 3, i % 2 ? 2 : 3); }
      ctx.fillStyle = holy ? "#fffbd6" : dragon ? "#f7e5ff" : comet ? "#fff4af" : skill ? "#fff2ba" : "#dff5ff";
      ctx.fillRect(-1, -radius - 8, 3, 5); ctx.fillRect(-1, radius + 3, 3, 5); ctx.fillRect(-radius - 8, -1, 5, 3); ctx.fillRect(radius + 3, -1, 5, 3);
      if (comet) {
        ctx.rotate(-Math.PI / 4); ctx.fillStyle = `rgba(255,220,115,${1 - pr})`;
        for (let i = 0; i < 4; i++) ctx.fillRect(-14 - i * 6 - Math.round(pr * 8), -3 + i * 2, 8 - i, 2);
      }
      ctx.restore();
    } else if (f.kind === "crescent") {
      const rot = f.dir === "right" ? 0 : f.dir === "down" ? Math.PI / 2 : f.dir === "left" ? Math.PI : -Math.PI / 2;
      ctx.save(); ctx.translate(Math.round(sx), Math.round(sy - 13)); ctx.rotate(rot); ctx.globalAlpha = 1 - pr;
      const blood = f.variant === "blood";
      for (let band = 0; band < 3; band++) {
        const radius = 18 + band * 5 + pr * 18;
        ctx.strokeStyle = blood ? (band === 0 ? "#ffd1d6" : band === 1 ? "#dc5063" : "#651f34") : band === 0 ? "#fff3bd" : band === 1 ? "#e6c56a" : "#8fd1b0";
        ctx.lineWidth = band === 0 ? 3 : 1;
        ctx.beginPath(); ctx.arc(0, 0, radius, -.72, .72); ctx.stroke();
      }
      ctx.fillStyle = blood ? "#f26a78" : "#f8e7a0";
      for (let i = 0; i < 7; i++) { const a = -.7 + i * .23, r = 24 + pr * 24 + (i % 2) * 4; ctx.fillRect(Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r), i % 2 ? 2 : 4, 2); }
      ctx.restore();
    } else if (f.kind === "warcry") {
      const radius = 10 + pr * 48, holy = f.variant === "holy", blood = f.variant === "blood";
      ctx.globalAlpha = 1 - pr;
      for (let i = 0; i < 16; i++) {
        const a = i / 16 * Math.PI * 2, r = radius + (i % 2 ? 5 : -3);
        ctx.fillStyle = holy ? (i % 3 === 0 ? "#fffbd0" : "#e6bd57") : blood ? (i % 3 === 0 ? "#ffd2d7" : "#c73550") : i % 3 === 0 ? "#ffe089" : "#d95b43";
        ctx.fillRect(Math.round(sx + Math.cos(a) * r) - 2, Math.round(sy - 16 + Math.sin(a) * r) - 2, i % 2 ? 3 : 5, i % 2 ? 3 : 5);
      }
      ctx.strokeStyle = holy ? `rgba(255,236,149,${(1 - pr) * .78})` : blood ? `rgba(231,70,96,${(1 - pr) * .78})` : `rgba(255,208,101,${(1 - pr) * .7})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(sx, sy - 4, radius * 1.05, radius * .38, 0, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 4; i++) { const side = i < 2 ? -1 : 1, y = sy - 42 + (i % 2) * 13 + pr * 18; ctx.fillStyle = i % 2 ? "#f3c66c" : "#c84e3e"; ctx.fillRect(Math.round(sx + side * (18 + i * 2)), Math.round(y), 4, 12); }
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
      const color = ["holy", "radiant"].includes(f.variant) ? "#ffe88a" : ["hunter", "predator", "vault"].includes(f.variant) ? "#cfe47b" : f.variant === "spirit" ? "#9ff1da" : f.variant === "dragon" ? "#d699ff" : f.variant === "comet" ? "#ffd36a" : f.variant === "falcon" ? "#aef7c4" : f.variant === "sakura" ? "#ff9bc4" : fire ? "#ffb14c" : "#e8ffd0";
      ctx.globalAlpha = 1 - pr;
      const impactCount = ["comet", "falcon", "sakura"].includes(f.variant) ? 18 : 12;
      for (let i = 0; i < impactCount; i++) {
        const a = i / impactCount * Math.PI * 2 + pr, r = 3 + pr * (14 + i % 3 * 3);
        ctx.fillStyle = i % 3 === 0 ? "#ffffff" : color;
        const wide = f.variant === "sakura" && i % 2 === 0;
        ctx.fillRect(Math.round(sx + Math.cos(a) * r) - 1, Math.round(sy + Math.sin(a) * r) - 1, wide ? 4 : i % 2 ? 2 : 3, wide ? 2 : i % 2 ? 2 : 3);
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
      const healSize = 5 + Math.round(Math.sin(Math.min(1, pr) * Math.PI) * 6);
      ctx.fillStyle = "#dfffe6"; ctx.fillRect(Math.round(sx - 2), Math.round(sy - 23 - healSize), 5, healSize * 2); ctx.fillRect(Math.round(sx - healSize), Math.round(sy - 20), healSize * 2, 5);
      ctx.strokeStyle = `rgba(113,231,157,${1 - pr})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(sx, sy - 4, 9 + pr * 28, 4 + pr * 10, 0, 0, Math.PI * 2); ctx.stroke();
      if (f.variant === "sutra") {
        ctx.save(); ctx.translate(Math.round(sx), Math.round(sy - 18)); ctx.rotate(pr * Math.PI * .5); ctx.globalAlpha = 1 - pr;
        const seal = 10 + pr * 16; ctx.strokeStyle = "#caffb1"; ctx.strokeRect(-seal, -seal, seal * 2, seal * 2);
        ctx.strokeStyle = "#71d8a0"; ctx.strokeRect(-seal * .55, -seal * .55, seal * 1.1, seal * 1.1);
        ctx.fillStyle = "#f0ffe4"; ctx.fillRect(-1, -seal + 3, 3, seal * 2 - 6); ctx.fillRect(-seal + 3, -1, seal * 2 - 6, 3); ctx.restore();
      } else if (f.variant === "sanctuary") {
        ctx.save(); ctx.translate(Math.round(sx),Math.round(sy - 8)); ctx.rotate(pr * .7); ctx.strokeStyle=`rgba(255,224,126,${1-pr})`; const seal=13+pr*24; ctx.strokeRect(-seal,-seal,seal*2,seal*2); ctx.rotate(Math.PI/4); ctx.strokeRect(-seal*.65,-seal*.65,seal*1.3,seal*1.3); ctx.restore();
      }
      ctx.globalAlpha = 1;
    } else if (f.kind === "windward") {
      ctx.save(); ctx.translate(Math.round(sx), Math.round(sy - 15)); ctx.globalAlpha = 1 - pr;
      for (let ring = 0; ring < 2; ring++) {
        const rr = 10 + ring * 10 + pr * (20 + ring * 7);
        ctx.strokeStyle = ring ? "#74c999" : "#d9ffc4"; ctx.lineWidth = ring ? 1 : 2;
        ctx.beginPath(); ctx.arc(0, 0, rr, -.7 + pr, 3.9 + pr); ctx.stroke();
      }
      for (let i = 0; i < 12; i++) { const a = i * .84 + pr * 5, rr = 8 + (i % 3) * 6 + pr * 24; ctx.fillStyle = i % 3 === 0 ? "#e7ffd1" : i % 2 ? "#6cc997" : "#9ce596"; ctx.fillRect(Math.round(Math.cos(a) * rr), Math.round(Math.sin(a) * rr * .68), 3 + i % 2, 2); }
      ctx.restore();
    } else if (f.kind === "whirl") {
      ctx.globalAlpha = 1 - pr;
      const steel = f.variant === "steel", blood = f.variant === "blood";
      for (let ring = 0; ring < 3; ring++) for (let i = 0; i < 14; i++) {
        if ((i + ring) % 4 === Math.floor(pr * 4)) continue;
        const a = i / 14 * Math.PI * 2 + pr * (8 + ring * 2);
        const rr = 14 + ring * 9 + pr * 24;
        ctx.fillStyle = blood ? (ring === 0 ? "#ffd4da" : ring === 1 ? "#dd4d64" : "#6e2338") : steel ? (ring === 0 ? "#fff3b0" : ring === 1 ? "#a7d9c4" : "#5e9b88") : ring === 0 ? "#fff0a4" : ring === 1 ? "#f59a3d" : "#d94b31";
        const size = ring === 0 ? 2 : 3;
        ctx.fillRect(Math.round(sx + Math.cos(a) * rr) - 1, Math.round(sy - 14 + Math.sin(a) * rr * .65) - 1, size + (i % 3 === 0 ? 2 : 0), size);
      }
      ctx.strokeStyle = blood ? `rgba(238,79,104,${(1 - pr) * .85})` : steel ? `rgba(205,247,225,${(1 - pr) * .82})` : `rgba(255,235,157,${(1 - pr) * .78})`; ctx.lineWidth = 2;
      for (let ring = 0; ring < 2; ring++) { ctx.beginPath(); ctx.ellipse(sx, sy - 13, 23 + ring * 13 + pr * 18, 8 + ring * 5 + pr * 5, pr * (ring ? -2 : 2), .25, Math.PI * 1.55); ctx.stroke(); }
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
      const roll = f.variant === "roll", hunter = f.variant === "hunter";
      ctx.strokeStyle = hunter ? `rgba(205,226,116,${(1 - pr) * .82})` : roll ? `rgba(126,222,165,${(1 - pr) * .75})` : `rgba(218,230,235,${(1 - pr) * .72})`; ctx.lineWidth = 2;
      for (let i = 1; i <= 5; i++) { ctx.beginPath(); ctx.moveTo(sx + ox * i * 6, sy - 16 + oy * i * 6 - 4); ctx.lineTo(sx + ox * i * 6, sy - 16 + oy * i * 6 + 4); ctx.stroke(); }
      if (roll) for (let i = 0; i < 7; i++) { const a = i * 1.7 + pr * 4, r = 8 + i * 3 + pr * 10; ctx.fillStyle = i % 2 ? "#a9e99e" : "#63bd88"; ctx.fillRect(Math.round(sx + ox * r + Math.cos(a) * 5), Math.round(sy - 16 + oy * r + Math.sin(a) * 5), 3, 2); }
    } else if (f.kind === "pop") {
      ctx.strokeStyle = `rgba(255,255,255,${1 - pr})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx, sy, 4 + pr * 16, 0, 7); ctx.stroke();
    } else if (f.kind === "chestburst") {
      const alpha = Math.max(0, 1 - pr), radius = 6 + pr * (f.pet ? 38 : 27);
      ctx.save(); ctx.translate(Math.round(sx), Math.round(sy));
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = f.pet ? "#d6a6ff" : "#f2d377"; ctx.lineWidth = 2;
      ctx.rotate(pr * (f.pet ? 1.2 : .55)); ctx.strokeRect(-radius, -radius * .45, radius * 2, radius * .9);
      ctx.rotate(Math.PI / 4); ctx.strokeStyle = f.pet ? "#ffe287" : "#72d9ad"; ctx.lineWidth = 1;
      ctx.strokeRect(-radius * .72, -radius * .72, radius * 1.44, radius * 1.44);
      ctx.rotate(-Math.PI / 4 - pr * (f.pet ? 1.2 : .55));
      for (let i = 0; i < (f.pet ? 12 : 8); i++) {
        const angle = i / (f.pet ? 12 : 8) * Math.PI * 2, inner = 5 + pr * 5, outer = radius + (i % 2 ? 8 : 14);
        ctx.strokeStyle = i % 3 === 0 ? "#ffffff" : f.pet ? "#b67ce9" : "#eac765";
        ctx.beginPath(); ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner); ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer); ctx.stroke();
      }
      if (pr < .58) {
        const beam = (1 - pr / .58) * (f.pet ? 30 : 20);
        ctx.fillStyle = f.pet ? "rgba(205,154,255,.16)" : "rgba(255,225,130,.14)";
        ctx.beginPath(); ctx.moveTo(-7, 3); ctx.lineTo(-beam, -55); ctx.lineTo(beam, -55); ctx.lineTo(7, 3); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
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
      const lotus = f.variant === "lotus", holy = f.variant === "holy", briar = f.variant === "briar";
      for (let i = 0; i < 24; i++) {
        const a = i / 24 * Math.PI * 2, rr = 9 + pr * 59;
        ctx.fillStyle = holy ? (i % 3 === 0 ? "#fffbd7" : i % 2 ? "#edc85e" : "#fff0a2") : briar ? (i % 3 === 0 ? "#edffd0" : i % 2 ? "#7ead50" : "#b8d96f") : i % 3 === 0 ? "#efffff" : i % 2 ? "#78cbed" : "#b6efff";
        const h = i % 3 === 0 ? 7 : 4;
        ctx.fillRect(Math.round(sx + Math.cos(a) * rr) - 1, Math.round(sy - 8 + Math.sin(a) * rr) - Math.floor(h / 2), 2 + (i % 4 === 0 ? 1 : 0), h);
      }
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 - pr * 2; const rr = 5 + pr * 36; ctx.fillStyle = "#dffbff"; ctx.fillRect(Math.round(sx + Math.cos(a) * rr) - 1, Math.round(sy - 8 + Math.sin(a) * rr) - 1, 3, 3); }
      ctx.strokeStyle = holy ? `rgba(255,227,121,${(1-pr)*.82})` : briar ? `rgba(136,188,82,${(1-pr)*.82})` : `rgba(177,239,255,${(1 - pr) * .78})`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(sx, sy - 2, 12 + pr * 55, 5 + pr * 22, 0, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const inner = 8 + pr * 20, outer = 15 + pr * 48; ctx.beginPath(); ctx.moveTo(sx + Math.cos(a) * inner, sy - 2 + Math.sin(a) * inner * .42); ctx.lineTo(sx + Math.cos(a) * outer, sy - 2 + Math.sin(a) * outer * .42); ctx.stroke(); }
      if (lotus) {
        for (let i = 0; i < 8; i++) {
          const a = i / 8 * Math.PI * 2 + pr * .65, rr = 12 + pr * 31;
          ctx.save(); ctx.translate(Math.round(sx + Math.cos(a) * rr), Math.round(sy - 7 + Math.sin(a) * rr * .45)); ctx.rotate(a);
          ctx.fillStyle = i % 2 ? "rgba(225,251,255,.75)" : "rgba(126,209,239,.72)";
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(8 + pr * 7, -3); ctx.lineTo(12 + pr * 8, 0); ctx.lineTo(8 + pr * 7, 3); ctx.closePath(); ctx.fill(); ctx.restore();
        }
      }
      ctx.globalAlpha = 1;
    }
  }
  // ---- projectiles ----
  if (this.projectiles) for (const pr of this.projectiles) {
    const sx = pr.x - camx, sy = pr.y - camy;
    if (pr.kind === "fire" || pr.kind === "bossfire") {
      const boss = pr.kind === "bossfire", dragon = pr.variant === "dragon", comet = pr.variant === "comet", holy = ["holy", "radiant"].includes(pr.variant);
      const outer = holy ? "#9c7928" : dragon ? "#8545c7" : comet ? "#8d3b2b" : boss ? "#b63222" : "#df5b27";
      const middle = holy ? "#f0c958" : dragon ? "#c475f3" : comet ? "#ff9e38" : boss ? "#ff7431" : "#ff9a35";
      const core = holy ? "#fffbd1" : dragon ? "#f2d6ff" : comet ? "#fff4a8" : "#fff1a6";
      const size = boss ? 11 : comet ? 10 : pr.variant === "skill" || dragon ? 9 : 7;
      for (let i = 3; i >= 1; i--) {
        const tx = Math.round(sx - pr.dx * i * 5), ty = Math.round(sy - pr.dy * i * 5);
        ctx.globalAlpha = .16 + (3 - i) * .12; ctx.fillStyle = outer; ctx.fillRect(tx - 2, ty - 2, 5, 5);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = outer; ctx.fillRect(Math.round(sx - size / 2), Math.round(sy - size / 2), size, size);
      ctx.fillStyle = middle; ctx.fillRect(Math.round(sx - size / 2 + 2), Math.round(sy - size / 2 + 1), size - 3, size - 3);
      ctx.fillStyle = core; ctx.fillRect(Math.round(sx - 1), Math.round(sy - 2), 4, 4);
      for (let i = 0; i < 4; i++) { const a = pr.age * 10 + i * Math.PI / 2; ctx.fillStyle = i % 2 ? middle : core; ctx.fillRect(Math.round(sx + Math.cos(a) * (size / 2 + 3)), Math.round(sy + Math.sin(a) * (size / 2 + 3)), 2, 2); }
      if (comet) {
        const nx = -pr.dy, ny = pr.dx;
        for (let i = 1; i <= 4; i++) { ctx.globalAlpha = .62 / i; ctx.fillStyle = i % 2 ? "#ffc05b" : "#fff2a4"; ctx.fillRect(Math.round(sx - pr.dx * (7 + i * 5) + nx * (i % 2 ? 2 : -2)), Math.round(sy - pr.dy * (7 + i * 5) + ny * (i % 2 ? 2 : -2)), 6 - i, 3); }
        ctx.globalAlpha = 1;
      }
    } else if (pr.kind === "arrow") {
      const hunter = ["hunter", "predator", "vault"].includes(pr.variant), spirit = pr.variant === "spirit";
      const power = pr.variant === "power" || pr.variant === "falcon" || pr.variant === "predator", dragon = pr.variant === "dragon", multi = pr.variant === "multi", sakura = pr.variant === "sakura";
      const shaft = spirit ? "#7bd4bd" : hunter ? "#a9bf55" : dragon ? "#c58aff" : pr.variant === "falcon" ? "#9df0b8" : sakura ? "#e98aae" : power ? "#ffe07b" : multi ? "#9ce8ad" : "#c79555";
      const head = spirit ? "#e1fff6" : hunter ? "#f0f6b4" : dragon ? "#f3e0ff" : pr.variant === "falcon" ? "#edfff0" : sakura ? "#ffe1eb" : power ? "#fff8bd" : "#e9eef0";
      const length = power || dragon ? 19 : sakura ? 15 : 13;
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
      ctx.fillStyle = spirit ? "#bff4e4" : hunter ? "#d7e68a" : sakura ? "#ffc3d9" : pr.variant === "falcon" ? "#c8ffd3" : multi ? "#d4ffd8" : dragon ? "#e1bdff" : "#e8d4bb";
      ctx.fillRect(Math.round(tailX + nx * 3) - 1, Math.round(tailY + ny * 3) - 1, 3, 3);
      ctx.fillRect(Math.round(tailX - nx * 3) - 1, Math.round(tailY - ny * 3) - 1, 3, 3);
      if (pr.variant === "falcon" || pr.variant === "predator") {
        ctx.strokeStyle = "rgba(173,255,198,.62)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(tailX, tailY); ctx.lineTo(tailX - pr.dx * 8 + nx * 6, tailY - pr.dy * 8 + ny * 6); ctx.moveTo(tailX, tailY); ctx.lineTo(tailX - pr.dx * 8 - nx * 6, tailY - pr.dy * 8 - ny * 6); ctx.stroke();
      } else if (sakura) {
        const a = (pr.spin || 0) + pr.age * 8; ctx.fillStyle = "rgba(255,165,202,.82)";
        ctx.fillRect(Math.round(sx - pr.dx * 8 + Math.cos(a) * 5), Math.round(sy - pr.dy * 8 + Math.sin(a) * 5), 3, 2);
      }
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
    else if (b.type === "field_shrine") aperture(x, y - 24, 34, .4);
    else if (b.type === "waystone") aperture(x, y - 19, 24, .22);
    else if (b.type === "ritual_hall") aperture(x, y - 38, 44, .2);
  }
  for (const npc of this.npcs) if (npc.carriesLantern) {
    const x = npc.x - camx, y = npc.y - camy - 20;
    if (x > -50 && x < view.w + 50 && y > -50 && y < view.h + 50) aperture(x, y, 35, .64);
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
  for (const b of this.buildings) if (b.type === "field_shrine" || b.type === "waystone") {
    const x = b.x - camx, y = b.y - camy - (b.type === "field_shrine" ? 24 : 19);
    if (x < -50 || x > view.w + 50 || y < -50 || y > view.h + 50) continue;
    const flicker = .84 + Math.sin(this.t * (b.type === "field_shrine" ? 7 : 3) + objectPhase(b)) * .1;
    bloom(x, y, b.type === "field_shrine" ? 25 : 18, b.type === "field_shrine" ? "rgba(255,173,76,A)" : "rgba(96,232,169,A)", dark * (b.type === "field_shrine" ? .2 : .13) * flicker);
  }
  for (const b of this.buildings) if (b.type === "ritual_hall") {
    const x = b.x - camx, y = b.y - camy - 38;
    if (x > -60 && x < view.w + 60 && y > -60 && y < view.h + 60) bloom(x, y, 38, "rgba(97,218,170,A)", dark * .1);
  }
  for (const npc of this.npcs) if (npc.carriesLantern) {
    const x = npc.x - camx, y = npc.y - camy - 20;
    if (x < -45 || x > view.w + 45 || y < -45 || y > view.h + 45) continue;
    const flicker = .86 + Math.sin(this.t * 8 + objectPhase(npc)) * .1;
    bloom(x, y, 24, "rgba(255,178,72,A)", dark * .24 * flicker);
  }
  for (const projectile of this.projectiles || []) if (projectile.kind === "fire" || projectile.kind === "bossfire") {
    const projectileBloom = ["holy", "radiant"].includes(projectile.variant) ? "rgba(255,221,112,A)" : projectile.variant === "dragon" ? "rgba(187,104,255,A)" : "rgba(255,124,45,A)";
    bloom(projectile.x - camx, projectile.y - camy, projectile.kind === "bossfire" ? 24 : 18, projectileBloom, dark * .34);
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
  for (const npc of this.npcs) if (npc.carriesLantern) {
    const side = npc.dir === "left" ? -1 : 1;
    const x = Math.round(npc.x - camx - side * 8), y = Math.round(npc.y - camy - 19);
    if (x < -20 || x > view.w + 20 || y < -20 || y > view.h + 20) continue;
    ctx.fillStyle = "#ffb23d"; ctx.fillRect(x - 1, y - 1, 3, 4);
    ctx.fillStyle = "#fff3a6"; ctx.fillRect(x, y, 1, 2);
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
