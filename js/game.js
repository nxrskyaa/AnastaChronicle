import { buildCharacter, buildWeapon, DEFAULT_LOOK } from "./chargen.js";
import { QuestLog, NPC_DEFS } from "./quests.js";
import { buildVillage } from "./buildings.js";
import { audio } from "./audio.js";
import { buildMonsters, MON_IDS, MON_META, STARTER_MOUNT_ID, monHeight } from "./monsters.js";
import { view } from "./view.js";
import { buildTiles } from "./tilegen.js";
import { buildBoss } from "./boss.js";
import { applyClass } from "./classes.js";
import { net, sendMove } from "./net.js";
import { createAmbientNpcDefs, createNpcRoutine } from "./npcworld.js";

const T = 24;
const MAP_W = 110, MAP_H = 110;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const PET_IDS = new Set(MON_IDS);

export class Game {
  constructor(canvas, ui, look) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;
    this.ui = ui;
    this.mini = document.getElementById("minimap");
    this.mctx = this.mini.getContext("2d");
    this.keys = {};
    this.mouse = { x: 0, y: 0, wx: 0, wy: 0, down: false };
    this.stick = { active: false, x: 0, y: 0 };
    this.cam = { x: 0, y: 0 };
    this.t = 0;
    this.paused = false;
    this.moveMode = "button";
    this.moveTarget = null;
    this.particles = [];
    this.weatherP = [];
    this.enemies = [];
    this.chests = [];
    this.trees = [];
    this.bushes = [];
    this.rocks = [];
    this.flowers = [];
    this.plants = [];   // harvestable plants
    this.npcs = [];
    this.pet = null;
    this.pets = [];
    this.activePetId = null;
    this.mountId = null;
    this.mounted = false;
    this.activeFoodBuffs = [];
    this.foodBuffTotals = { speed: 0, damage: 0, defense: 0, fishingLuck: 0 };
    this.flags = { starterCache: false, guestGachaFreePulls: 5, gachaSequence: 0 };
    this.cosmeticsOwned = [];
    this.fishingStats = { total: 0, best: 0, records: {} };
    this.afkFishingJob = null;
    this.lastAfkFishingClaim = null;
    this.autoBattle = false;
    this.autoBattleTarget = null;
    this.autoBattleState = "OFF";
    this.autoBattleScanT = 0;
    this.autoBattleSkillT = 0;
    this.inputSuspendUntil = 0;
    this.catchReveal = null;
    this.time = 6 * 60;
    this.weather = "clear";     // clear | rain | snow
    this.weatherT = 30;
    this.quests = new QuestLog();
    this.shake = 0;
    this.hitStop = 0;
    this.fx = [];               // skill/impact visual effects
    this.audio = audio;
    this.village = buildVillage();
    this.buildings = [];
    this.monCache = buildMonsters();
    buildTiles();
    buildBoss();

    this.look = look || { ...DEFAULT_LOOK };
    this.charCache = buildCharacter(this.look);
    this.weaponCache = {};

    this.buildWorld();
    this.bindInput();
  }

  rebuildCharacter(look) {
    this.look = look;
    this.charCache = buildCharacter(look);
  }
  weaponFrames(w) {
    if (!this.weaponCache[w]) this.weaponCache[w] = buildWeapon(w);
    return this.weaponCache[w];
  }

  registerPet(id) {
    if (!PET_IDS.has(id)) return false;
    if (!Array.isArray(this.pets)) this.pets = [];
    if (this.pets.includes(id)) return false;
    this.pets.push(id);
    this.onCompanionChange?.();
    return true;
  }

  setActivePet(id) {
    if (!PET_IDS.has(id) || !Array.isArray(this.pets) || !this.pets.includes(id)) return false;
    if (this.pet?.id === id) {
      this.activePetId = id;
      this.ui?.syncPet?.();
      this.onCompanionChange?.();
      return true;
    }

    const player = this.player;
    if (!player) return false;
    if (this.mounted && this.mountId !== id) this.mounted = false;
    const oldPet = this.pet;
    if (oldPet) this._summonPetFx(oldPet.x, oldPet.y, false);

    this.activePetId = id;
    this.pet = {
      id,
      x: player.x - 18,
      y: player.y + 18,
      bob: 0,
      animT: 0,
      moving: false,
      spawnT: .45,
      sortY: player.y + 18,
    };
    this._summonPetFx(this.pet.x, this.pet.y, true);

    if (typeof this.ui?.syncPet === "function") {
      this.ui.syncPet();
    } else {
      // Preserve the original chip behavior when the richer companion UI is absent.
      const chip = document.getElementById("pet-chip");
      if (chip) { chip.classList.remove("hidden"); chip.textContent = "Pet: " + id; }
    }
    this.onCompanionChange?.();
    return true;
  }

  cyclePet(direction = 1) {
    if (!Array.isArray(this.pets) || !this.pets.length) return null;
    const valid = this.pets.filter((id, index, list) => PET_IDS.has(id) && list.indexOf(id) === index);
    if (!valid.length) return null;
    this.pets = valid;
    const current = valid.indexOf(this.activePetId || this.pet?.id);
    const step = direction < 0 ? -1 : 1;
    const next = current < 0 ? 0 : (current + step + valid.length) % valid.length;
    return this.setActivePet(valid[next]) ? valid[next] : null;
  }

  mountablePets() {
    return (this.pets || []).filter((id, index, list) => MON_META[id]?.mountable && list.indexOf(id) === index);
  }

  setMount(id, ride = true) {
    if (!MON_META[id]?.mountable || !this.pets?.includes(id)) return false;
    if (ride && this.fishing) this.failFishing?.("Line reeled in before mounting.");
    const switchedCompanion = this.activePetId !== id;
    if (switchedCompanion && !this.setActivePet(id)) return false;
    this.mountId = id;
    this.mounted = !!ride;
    this.moveTarget = null;
    this.resetInputState?.();
    if (!switchedCompanion) this._summonPetFx(this.player.x, this.player.y, true);
    this.ui?.syncMount?.();
    this.ui?.syncPet?.(true);
    this.onCompanionChange?.();
    return true;
  }

  toggleMount(id = this.activePetId || this.mountId) {
    if (this.mounted) {
      this.mounted = false;
      this._summonPetFx(this.player.x, this.player.y, false);
      this.ui?.syncMount?.();
      this.ui?.syncPet?.(true);
      this.onCompanionChange?.();
      return this.mountId;
    }
    return this.setMount(id, true) ? id : null;
  }

  mountSpeedMultiplier() {
    return this.mounted ? Math.max(1, Number(MON_META[this.mountId]?.mountSpeed) || 1) : 1;
  }

  riderVisualLift() {
    const meta = this.mounted ? MON_META[this.mountId] : null;
    if (!meta?.mountable) return 0;
    return Math.round(17 + ((Number(meta.mountScale) || 1.25) - 1) * 12);
  }

  _summonPetFx(x, y, withSound) {
    this.fx.push({ kind: "levelring", x, y: y - 6, t: 0, dur: .48 });
    for (let i = 0; i < 10; i++) {
      const angle = (Math.PI * 2 * i) / 10 + Math.random() * .25;
      const speed = 24 + Math.random() * 34;
      this.particles.push({
        x, y: y - 10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 18,
        life: .45 + Math.random() * .25,
        color: i % 2 ? "rgba(126,232,188,.92)" : "rgba(255,221,128,.9)",
      });
    }
    if (withSound) this.audio?.sfx("pet");
  }

  buildWorld() {
    const m = new Uint8Array(MAP_W * MAP_H);
    const v = new Uint8Array(MAP_W * MAP_H);
    // biomes: 0 grass, 1 path, 2 water, 3 sand, 4 snow-ground, 5 dark-grass(forest)
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const i = y * MAP_W + x;
        const lake = Math.hypot(x - 80, y - 28) < 13;
        const beach = Math.hypot(x - 80, y - 28) < 16;
        const pond = Math.hypot(x - 64, y - 50) < 4.2;        // small pond near camp for fishing
        const pondEdge = Math.hypot(x - 64, y - 50) < 5.4;
        const snow = y < 18 && x < 46;                 // north-west snow biome
        const deepForest = x > 74 && y > 70;           // SE dark forest
        if (lake || pond) m[i] = 2;
        else if (beach || pondEdge) m[i] = 3;
        else if (snow) m[i] = 4;
        else if (deepForest) m[i] = 5;
        else m[i] = 0;
        v[i] = (Math.random() * 8) | 0;
      }
    }
    // winding main paths + a diagonal branch + a loop
    for (let x = 8; x < MAP_W - 8; x++) {
      const yy = 55 + Math.round(Math.sin(x * 0.11) * 6);
      m[yy * MAP_W + x] = 1; m[(yy + 1) * MAP_W + x] = 1;
    }
    for (let y = 8; y < MAP_H - 8; y++) {
      const xx = 55 + Math.round(Math.cos(y * 0.09) * 6);
      m[y * MAP_W + xx] = 1; m[y * MAP_W + xx + 1] = 1;
    }
    // diagonal trail to snow biome
    for (let t2 = 0; t2 < 40; t2++) {
      const x = 55 - t2, y = 55 - t2;
      if (x > 1 && y > 1) { m[y * MAP_W + x] = 1; m[y * MAP_W + x + 1] = 1; }
    }
    // Authored secondary trails connect real destinations instead of leaving a
    // decorative cross surrounded by trees. Water can only be crossed by the
    // explicitly marked pond bridge.
    const carveTrail = (x0, y0, x1, y1, width = 1, bend = 0, crossWater = false) => {
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2;
      for (let step = 0; step <= steps; step++) {
        const u = step / steps, sway = Math.sin(u * Math.PI) * bend;
        const x = Math.round(x0 + (x1 - x0) * u + sway);
        const y = Math.round(y0 + (y1 - y0) * u - sway * .42);
        for (let oy = -width; oy <= width; oy++) for (let ox = -width; ox <= width; ox++) {
          if (Math.abs(ox) + Math.abs(oy) > width + .5) continue;
          const tx = x + ox, ty = y + oy;
          if (tx < 1 || tx >= MAP_W - 1 || ty < 1 || ty >= MAP_H - 1) continue;
          const index = ty * MAP_W + tx;
          if (crossWater || m[index] !== 2) m[index] = 1;
        }
      }
    };
    carveTrail(55, 57, 85, 80, 1, 2.2);       // Umbral Arena pilgrimage road
    carveTrail(54, 52, 62, 50, 1, -.7, true); // camp fishing bridge
    carveTrail(58, 51, 70, 36, 1, 1.4);       // lakeside route
    carveTrail(50, 58, 29, 86, 1, -2);        // southern bamboo trail
    for (let step = 0; step < 96; step++) {
      const a = step / 96 * Math.PI * 2, x = Math.round(55 + Math.cos(a) * 13), y = Math.round(55 + Math.sin(a) * 9);
      if (x > 1 && y > 1 && m[y * MAP_W + x] !== 2) m[y * MAP_W + x] = 1;
    }
    this.map = m; this.vmap = v;
    this.camp = { x: 55 * T, y: 55 * T };
    this.bossArena = { x: 87 * T, y: 82 * T, radius: 5.5 * T };

    // ---- VILLAGE layout around camp ----
    const cx = 55, cy = 55;
    const place = (type, tx, ty, w, h) => {
      this.buildings.push({ type, x: tx * T, y: ty * T, sortY: ty * T });
      // clear decorations + set ground to path under footprint
      for (let yy = ty - 1; yy <= ty + 1; yy++) for (let xx = tx - 2; xx <= tx + 2; xx++) {
        const ii = yy * MAP_W + xx; if (ii >= 0 && ii < m.length && m[ii] !== 2) m[ii] = (Math.random() < 0.5 ? 1 : 0);
      }
    };
    place("house_red", cx - 6, cy - 5);
    place("house_blue", cx + 6, cy - 4);
    place("house_thatch", cx - 7, cy + 4);
    place("shop", cx + 6, cy + 5);
    place("well", cx, cy - 6);
    place("stall", cx + 3, cy + 2);
    // Keep the Ritual Hall in the player's first sightline. It is a real
    // village building (not a distant decorative prop), with a clear apron
    // around the footprint so its foundation cannot read as floating.
    // Put the hall on a dry, level approach east of the pond.  The old
    // anchor sat on the pond's beach radius, which made the foundation read
    // as floating and hid the Ritual mark behind water FX on small screens.
    const ritualSite = [72, 56];
    this.buildings.push({ type: "ritual_hall", x: ritualSite[0] * T, y: ritualSite[1] * T, sortY: ritualSite[1] * T + 8 });
    for (let yy = ritualSite[1] - 2; yy <= ritualSite[1] + 2; yy++) for (let xx = ritualSite[0] - 4; xx <= ritualSite[0] + 4; xx++) {
      const ii = yy * MAP_W + xx;
      if (ii >= 0 && ii < m.length && m[ii] !== 2) m[ii] = 1;
    }
    // fence line along south edge of camp
    for (let i = -5; i <= 5; i++) if (i !== 0) this.buildings.push({ type: "fenceH", x: (cx + i) * T, y: (cy + 7) * T, sortY: (cy + 7) * T });

    // Japanese decor near village entrance
    place("torii", cx, cy - 10);
    place("pagoda", cx - 10, cy - 8);
    place("sakura", cx + 8, cy - 8);
    place("sakura", cx - 9, cy + 6);
    // stone lanterns along paths
    this.buildings.push({ type: "lantern", x: (cx - 2) * T, y: (cy - 8) * T, sortY: (cy - 8) * T });
    this.buildings.push({ type: "lantern", x: (cx + 2) * T, y: (cy - 8) * T, sortY: (cy - 8) * T });
    this.buildings.push({ type: "lantern", x: (cx - 4) * T, y: (cy + 3) * T, sortY: (cy + 3) * T });
    this.buildings.push({ type: "lantern", x: (cx + 5) * T, y: (cy + 6) * T, sortY: (cy + 6) * T });
    // bamboo groves near forest edges
    for (let i = 0; i < 8; i++) {
      const bx = 20 + Math.floor(Math.random() * 15);
      const by = 80 + Math.floor(Math.random() * 20);
      if (m[by * MAP_W + bx] !== 1 && m[by * MAP_W + bx] !== 2)
        this.buildings.push({ type: "bamboo", x: bx * T, y: by * T, sortY: by * T });
    }
    for (let i = 0; i < 6; i++) {
      const bx = 80 + Math.floor(Math.random() * 20);
      const by = 60 + Math.floor(Math.random() * 20);
      if (m[by * MAP_W + bx] !== 1 && m[by * MAP_W + bx] !== 2)
        this.buildings.push({ type: "bamboo", x: bx * T, y: by * T, sortY: by * T });
    }

    // Trail furniture creates navigation rhythm and visual stories outside the
    // basecamp: crossroads, rest points, shrines, bridge, and arena markers.
    const trailLandmarks = [
      ["signpost", 48, 55], ["signpost", 61, 49], ["signpost", 67, 65],
      ["waystone", 38, 59], ["waystone", 73, 69], ["waystone", 82, 78],
      ["field_shrine", 32, 79], ["field_shrine", 68, 38], ["field_shrine", 78, 73],
      ["trail_bench", 42, 61], ["trail_bench", 72, 68],
      ["plank_bridge", 62, 50],
      ["lantern", 45, 58], ["lantern", 64, 62], ["lantern", 74, 70], ["lantern", 80, 76],
    ];
    for (const [type, tx, ty] of trailLandmarks) this.buildings.push({ type, x: tx * T, y: ty * T, sortY: ty * T });

    // decorations: trees, bushes, rocks, flowers by biome
    for (let y = 3; y < MAP_H - 3; y++) {
      for (let x = 3; x < MAP_W - 3; x++) {
        const i = y * MAP_W + x, t = m[i];
        if (t === 1 || t === 2) continue;
        const nearCamp = Math.hypot(x - 55, y - 55) < 10;
        const nearBossArena = Math.hypot(x - 87, y - 82) < 6;
        const nearLandmark = trailLandmarks.some(([, tx, ty]) => Math.hypot(x - tx, y - ty) < 2.3)
          || Math.hypot(x - ritualSite[0], y - ritualSite[1]) < 3.6;
        if (nearCamp || nearBossArena || nearLandmark) continue;
        const edge = Math.min(x, y, MAP_W - x, MAP_H - y);
        const wx = x * T + T / 2, wy = y * T + T / 2;
        let treeDens = 0.05 + (edge < 12 ? 0.13 : 0) + (t === 5 ? 0.1 : 0);
        const r = Math.random();
        if (r < treeDens) {
          this.trees.push({ x: wx, y: wy, v: (Math.random() * 4) | 0, sortY: wy });
        } else if (r < treeDens + 0.02) {
          this.bushes.push({ x: wx, y: wy, sortY: wy });
        } else if (r < treeDens + 0.032 && (t === 0 || t === 4)) {
          this.rocks.push({ x: wx, y: wy, sortY: wy, snow: t === 4 });
        } else if (r < treeDens + 0.075 && t === 0) {
          this.flowers.push({ x: wx, y: wy, k: (Math.random() * 3) | 0 });
        } else if (r < treeDens + 0.11 && (t === 0 || t === 5)) {
          // harvestable plants: bamboo shoot, herb bush, crystal ore, vine
          const kinds = ["bamboo_shoot", "herb_bush", "crystal_ore", "glow_vine"];
          const kind = kinds[(Math.random() * kinds.length) | 0];
          this.plants.push({ x: wx, y: wy, kind, hp: kind === "crystal_ore" ? 3 : 2, sortY: wy, respawn: 0, sway: Math.random() * 6.28 });
        }
      }
    }

    this.player = {
      x: this.camp.x, y: this.camp.y + 46,
      vx: 0, vy: 0, dir: "down", frame: 0, frameT: 0,
      anim: "idle", moving: false, dustT: 0,
      speed: 120, accel: 900, friction: 1150,
      hp: 50, maxHp: 50, stamina: 100, maxStamina: 100,
      level: 1, xp: 0, gold: 0,
      attackT: 0, attackDur: 0.24, attackCd: 0, evadeT: 0, evadeCd: 0, invuln: 0,
      shield: false, skillCd: [0, 0, 0, 0],
      buffT: 0, buffMul: 1, wardT: 0, dmgMul: 1, defense: 1,
      comboStep: 0, lastAttackAt: -99, hurtT: 0,
      inv: { wood: 2, ore: 0, gel: 0, herb: 1, basicrod: 1 },
      equipped: "sword", dmg: 8, sortY: 0,
      name: this.look.name || "Anasta",
      cls: this.look.cls || "warrior",
    };
    // apply class stats + starting weapon
    applyClass(this.player, this.player.cls);
    this.player.inv[this.player.equipped] = 1;

    const addNpc = (def, x, y, index, ambient = false) => {
      const npcClass = def.look.cls || ({ Guard: "warrior", Forge: "warrior", Champion: "warrior", Potions: "mage", Scout: "archer" }[def.role] || "villager");
      this.npcs.push({
        id: def.id || `quest-${def.name.toLowerCase()}`,
        name: def.name, look: def.look, role: def.role, line: def.line,
        dayLine: def.dayLine || def.line, nightLine: def.nightLine || def.line,
        x, y, dir: def.face || "down", frame: 0, frameT: (index * .17) % .5, sortY: y,
        ...createNpcRoutine(def, x, y, index, ambient),
        cache: buildCharacter({ ...DEFAULT_LOOK, ...def.look, name: def.name, cls: npcClass }),
      });
    };

    // Quest givers retain their camp positions, but now run small role-based routines.
    for (let i = 0; i < NPC_DEFS.length; i++) {
      const def = NPC_DEFS[i];
      addNpc(def, this.camp.x + def.dx, this.camp.y + def.dy, i);
    }

    // Twenty residents make the roads, pond, shrine, coast, forest and snowfield
    // feel inhabited. Their looks and dialogue are generated deterministically.
    const ambientDefs = createAmbientNpcDefs();
    for (let i = 0; i < ambientDefs.length; i++) {
      const def = ambientDefs[i];
      addNpc(def, def.tx * T, def.ty * T, NPC_DEFS.length + i, true);
    }

    for (let k = 0; k < 46; k++) this.spawnEnemy();
    // The nearby golden cache teaches interaction and guarantees that every
    // traveler can discover mounts without depending on random world rolls.
    this.chests.push({ x: this.camp.x + 28, y: this.camp.y + 64, sortY: this.camp.y + 64, opened: false, openT: 0, pet: STARTER_MOUNT_ID, starter: true });
    for (let k = 0; k < 15; k++) this.spawnChest();

    // ambient wildlife — butterflies (day) / fireflies (night), passive & harmless
    this.critters = [];
    for (let k = 0; k < 44; k++) {
      const x = rand(6 * T, (MAP_W - 6) * T), y = rand(6 * T, (MAP_H - 6) * T);
      this.critters.push({ x, y, hx: x, hy: y, a: Math.random() * 7, spd: 0.5 + Math.random(), r: 10 + Math.random() * 30, kind: Math.random() < 0.5 ? "fly" : "bird", ph: Math.random() * 7 });
    }
    // decorative grass tufts that sway
    this.tufts = [];
    for (let k = 0; k < 240; k++) {
      const tx = (rand(2, MAP_W - 2) | 0), ty = (rand(2, MAP_H - 2) | 0);
      if (this.map[ty * MAP_W + tx] === 0 && Math.hypot(tx - 87, ty - 82) >= 6) this.tufts.push({ x: tx * T + rand(0, T), y: ty * T + rand(0, T), ph: Math.random() * 7 });
    }
  }

  spawnEnemy() {
    let x, y, tries = 0;
    do {
      x = rand(4 * T, (MAP_W - 4) * T); y = rand(4 * T, (MAP_H - 4) * T); tries++;
    } while ((this.tileAt(x, y) === 2 || Math.hypot(x - this.camp.x, y - this.camp.y) < 12 * T || Math.hypot(x - this.bossArena.x, y - this.bossArena.y) < this.bossArena.radius) && tries < 30);
    const tier = Math.random() < 0.6 ? 1 : Math.random() < 0.8 ? 2 : 3;
    const habitat = this.creatureHabitatAt(x, y);
    const candidates = MON_IDS.filter((candidate) => habitat.includes(MON_META[candidate]?.habitat));
    const rarityWeight = { common: 5, uncommon: 3, rare: 2, epic: 1 };
    const pool = (candidates.length ? candidates : MON_IDS).flatMap((candidate) =>
      Array(rarityWeight[MON_META[candidate]?.rarity] || 2).fill(candidate)
    );
    const id = pool[(Math.random() * pool.length) | 0];
    // heavier HP/dmg scaling so combat feels meaningful; tier 3 hits harder
    const baseHp = 18 + tier * 16, baseDmg = 4 + tier * 3;
    this.enemies.push({
      id, x, y, sortY: y, tier, habitat: MON_META[id]?.habitat || habitat[0], hx: x, hy: y,       // hx/hy = home anchor for wander
      hp: baseHp, maxHp: baseHp,
      dmg: baseDmg, speed: 18 + tier * 6,
      xp: 6 + tier * 8, gold: tier * 2,
      bob: Math.random() * 6, frame: 0, frameT: Math.random(),
      atkCd: 0, hurt: 0, dead: false, h: monHeight(),
      state: "wander", angry: 0, wanderT: Math.random() * 2, wdx: 0, wdy: 0,
    });
  }

  creatureHabitatAt(x, y) {
    const tile = this.tileAt(x, y);
    const tx = x / T, ty = y / T;
    const nearLake = Math.hypot(tx - 80, ty - 28) < 18;
    const nearPond = Math.hypot(tx - 64, ty - 50) < 8;
    const nearRuins = Math.hypot(x - this.bossArena.x, y - this.bossArena.y) < this.bossArena.radius + 190;
    const night = this.time >= 19 * 60 || this.time < 5 * 60;
    if (tile === 4 || (ty < 23 && tx < 46)) return ["snow", "highland"];
    if (tile === 3 || nearLake) return ["coast", "meadow"];
    if (nearPond) return ["marsh", "coast", "meadow"];
    if (nearRuins) return night ? ["ruins", "night", "forest"] : ["ruins", "forest"];
    if (tile === 5 || (tx > 73 && ty > 64)) return night ? ["forest", "night"] : ["forest"];
    return ["meadow", "forest", "highland"];
  }

  spawnChest() {
    let x, y, tries = 0;
    do { x = rand(5 * T, (MAP_W - 5) * T); y = rand(5 * T, (MAP_H - 5) * T); tries++; }
    while ((this.tileAt(x, y) === 2 || Math.hypot(x - this.bossArena.x, y - this.bossArena.y) < this.bossArena.radius) && tries < 30);
    const pet = Math.random() < 0.35 ? MON_IDS[(Math.random() * MON_IDS.length) | 0] : null;
    this.chests.push({ x, y, sortY: y, opened: false, openT: 0, pet });
  }

  tileAt(px, py) {
    const tx = clamp((px / T) | 0, 0, MAP_W - 1);
    const ty = clamp((py / T) | 0, 0, MAP_H - 1);
    return this.map[ty * MAP_W + tx];
  }

  resetInputState() {
    this.keys = {};
    this.mouse.down = false;
    this.stick.active = false;
    this.stick.x = 0;
    this.stick.y = 0;
    this.moveTarget = null;
    this._pendingInteraction = null;
    const knob = document.getElementById("stick-knob");
    if (knob) knob.style.transform = "translate(0,0)";
    if (this.player) {
      this.player.vx = 0;
      this.player.vy = 0;
      this.player.moving = false;
      this.player.shield = false;
      this.player.evadeT = 0;
    }
  }

  suspendInput(milliseconds = 180) {
    this.resetInputState();
    this.inputSuspendUntil = Math.max(this.inputSuspendUntil || 0, performance.now() + milliseconds);
  }

  bindInput() {
    addEventListener("keydown", (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (this.inputLocked) return;
      if (performance.now() < (this.inputSuspendUntil || 0)) return;
      this.keys[e.code] = true;
      if (e.repeat && ["KeyI", "KeyC", "KeyQ", "KeyF", "Digit1", "Digit2", "Digit3", "Digit4"].includes(e.code)) return;
      if (e.code === "KeyI") this.ui.toggle("inv");
      if (e.code === "KeyC") this.ui.toggle("craft");
      if (e.code === "KeyQ") this.ui.toggle("quest");
      if (e.code === "KeyF" && !e.repeat && !this.paused) this.interact();
      if (["Digit1", "Digit2", "Digit3", "Digit4"].includes(e.code) && !e.repeat && !this.paused) this.useSkill(Number(e.code.slice(5)) - 1);
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
    });
    addEventListener("keyup", (e) => { this.keys[e.code] = false; });
    const rect = () => this.canvas.getBoundingClientRect();
    this.canvas.addEventListener("mousemove", (e) => {
      const r = rect();
      this.mouse.x = (e.clientX - r.left) * (view.w / r.width);
      this.mouse.y = (e.clientY - r.top) * (view.h / r.height);
    });
    this.canvas.addEventListener("mousedown", (e) => {
      if (this.inputLocked) return;
      if (performance.now() < (this.inputSuspendUntil || 0)) return;
      if (this.moveMode === "tap") {
        const r = rect();
        const mx = (e.clientX - r.left) * (view.w / r.width);
        const my = (e.clientY - r.top) * (view.h / r.height);
        this.moveTarget = { x: mx + this.cam.x, y: my + this.cam.y };
      } else this.mouse.down = true;
    });
    addEventListener("mouseup", () => { this.mouse.down = false; });
    document.getElementById("btn-move-mode")?.addEventListener("click", () => this.toggleMoveMode());
    document.querySelectorAll("#skillbar .sk[data-i]").forEach((b) =>
      b.addEventListener("click", () => { if (!this.inputLocked) this.useSkill(Number(b.dataset.i)); }));
    this.bindTouch();
  }

  toggleMoveMode() {
    this.moveMode = this.moveMode === "button" ? "tap" : "button";
    this.moveTarget = null;
    const el = document.querySelector("#btn-move-mode .sk-name");
    if (el) el.textContent = this.moveMode === "tap" ? "Btn" : "Tap";
    this.ui.toast(this.moveMode === "tap" ? "Tap-to-move ON" : "Button/keyboard ON");
  }

  bindTouch() {
    const stick = document.getElementById("stick");
    const knob = document.getElementById("stick-knob");
    if (stick) {
      const set = (cx, cy) => {
        if (this.inputLocked) return;
        if (performance.now() < (this.inputSuspendUntil || 0)) return;
        const r = stick.getBoundingClientRect();
        let dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2);
        const d = Math.hypot(dx, dy), max = r.width / 2;
        if (d > max) { dx = dx / d * max; dy = dy / d * max; }
        this.stick.active = true; this.stick.x = dx / max; this.stick.y = dy / max;
        knob.style.transform = `translate(${dx}px,${dy}px)`;
      };
      const end = () => { this.stick.active = false; this.stick.x = 0; this.stick.y = 0; knob.style.transform = "translate(0,0)"; };
      stick.addEventListener("touchstart", (e) => { e.preventDefault(); set(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
      stick.addEventListener("touchmove", (e) => { e.preventDefault(); set(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
      stick.addEventListener("touchend", end);
      stick.addEventListener("touchcancel", end);
    }
    const activeReleases = new Set();
    const bindAction = (id, on, off) => {
      const el = document.getElementById(id); if (!el) return;
      let active = false, lastPointerAt = -Infinity, fallbackTimer = 0;
      el.style.touchAction = "none";
      el.style.webkitTapHighlightColor = "transparent";

      const end = (e) => {
        e?.preventDefault?.();
        if (!active) return;
        active = false;
        activeReleases.delete(end);
        off?.();
      };
      const begin = (e) => {
        e?.preventDefault?.();
        if (this.inputLocked) return;
        if (performance.now() < (this.inputSuspendUntil || 0)) return;
        if (active) return;
        active = true;
        activeReleases.add(end);
        if (e?.pointerId != null) {
          lastPointerAt = performance.now();
          try { el.setPointerCapture?.(e.pointerId); } catch { /* capture can fail after cancellation */ }
        }
        on?.();
      };

      el.addEventListener("pointerdown", begin, { passive: false });
      el.addEventListener("pointerup", end, { passive: false });
      el.addEventListener("pointercancel", end, { passive: false });
      el.addEventListener("lostpointercapture", end);
      if (typeof PointerEvent === "undefined") {
        el.addEventListener("touchstart", (e) => { lastPointerAt = performance.now(); begin(e); }, { passive: false });
        el.addEventListener("touchend", end, { passive: false });
        el.addEventListener("touchcancel", end, { passive: false });
      }
      // Keyboard activation and older touch WebViews still produce click even
      // when they do not deliver a usable pointer stream.
      el.addEventListener("click", (e) => {
        e.preventDefault();
        if (performance.now() - lastPointerAt < 650) return;
        begin();
        clearTimeout(fallbackTimer);
        fallbackTimer = setTimeout(() => end(), 90);
      });
    };
    const releaseActions = () => {
      for (const release of [...activeReleases]) release();
    };
    const resetAllInput = () => {
      releaseActions();
      this.suspendInput();
    };
    addEventListener("blur", resetAllInput);
    addEventListener("focus", resetAllInput);
    addEventListener("pointercancel", resetAllInput);
    addEventListener("pagehide", resetAllInput);
    addEventListener("pageshow", resetAllInput);
    document.addEventListener("freeze", resetAllInput);
    document.addEventListener("visibilitychange", resetAllInput);

    bindAction("btn-attack", () => this.mouse.down = true, () => this.mouse.down = false);
    bindAction("btn-shield", () => this.keys.ShiftLeft = true, () => this.keys.ShiftLeft = false);
    bindAction("btn-evade", () => this.keys.Space = true, () => this.keys.Space = false);
    bindAction("btn-interact", () => {
      this.keys.KeyF = true;
      if (this.paused || this.fishing?.state === "hooked") return;
      this.interact();
    }, () => this.keys.KeyF = false);
    this.canvas.addEventListener("touchstart", (e) => {
      e.preventDefault();
      if (this.paused || this.inputLocked || this.fishing) return;
      if (performance.now() < (this.inputSuspendUntil || 0)) return;
      const r = this.canvas.getBoundingClientRect();
      const mx = (e.touches[0].clientX - r.left) * (view.w / r.width);
      const my = (e.touches[0].clientY - r.top) * (view.h / r.height);
      const wx = mx + this.cam.x, wy = my + this.cam.y;
      const resolved = this.resolveInteract?.({ x: wx, y: wy });
      if (resolved?.target) {
        if (resolved.reachable) {
          this.interact(resolved);
        } else if (this.moveMode === "tap") {
          this._pendingInteraction = resolved;
          this.moveTarget = { x: resolved.target.x, y: resolved.target.y };
          this.ui.toast("Approaching…");
        } else {
          this.ui.toast("Move closer to interact.");
        }
        return;
      }
      this._pendingInteraction = null;
      if (this.moveMode === "tap") this.moveTarget = { x: wx, y: wy };
    }, { passive: false });
  }

  start() {
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (document.hidden) {
        this.suspendInput(250);
        requestAnimationFrame(loop);
        return;
      }
      if (now < (this.inputSuspendUntil || 0)) this.resetInputState();
      if (!this.paused) {
        this.update(dt);
        if (this.catchReveal) {
          this.catchReveal.elapsed += dt;
          if (this.catchReveal.elapsed >= this.catchReveal.duration) this.catchReveal = null;
        }
      }
      if (net.connected) sendMove(this.player, now, { mounted: this.mounted, mountId: this.mountId });
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}
