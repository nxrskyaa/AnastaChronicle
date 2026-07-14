import { Game } from "./game.js";
import { ITEMS } from "./crafting.js";
import { fishingContext, rollFish } from "./fishing.js";
import { getFishSprite } from "./fishart.js";

const T = 24, MAP_W = 110, MAP_H = 110;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const INTERACT_RADIUS = 48;
const TAP_TARGET_RADIUS = 30;

Game.prototype.resolveInteract = function (point = null) {
  const player = this.player;
  const focus = point || player;
  const offer = (list, target, kind, label, focusRadius) => {
    const focusDistance = Math.hypot(target.x - focus.x, target.y - focus.y);
    if (focusDistance > focusRadius) return;
    const distance = Math.hypot(target.x - player.x, target.y - player.y);
    list.push({ target, kind, label, distance, focusDistance, reachable: distance <= INTERACT_RADIUS });
  };

  const actors = [];
  const focusRadius = point ? TAP_TARGET_RADIUS : INTERACT_RADIUS;
  for (const npc of this.npcs) offer(actors, npc, "npc", `Talk to ${npc.name}`, focusRadius);
  for (const chest of this.chests) {
    if (!chest.opened) {
      const label = chest.starter ? "Bond Puffalo · Starter Mount" : chest.pet ? "Claim Companion Cache" : "Claim Supply Cache";
      offer(actors, chest, "chest", label, focusRadius);
    }
  }
  if (this.camp) offer(actors, this.camp, "cook", "Cook at the Hearth", focusRadius);
  actors.sort((a, b) => a.focusDistance - b.focusDistance || a.distance - b.distance);
  if (actors.length) return actors[0];

  const water = [];
  if (point) {
    const x = (point.x / T) | 0, y = (point.y / T) | 0;
    if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H && this.map[y * MAP_W + x] === 2) {
      const target = { x: (x + .5) * T, y: (y + .5) * T, water: true };
      offer(water, target, "fish", "Cast Fishing Line", T);
    }
  } else {
    const tileX = (player.x / T) | 0, tileY = (player.y / T) | 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = tileX + dx, y = tileY + dy;
      if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H || this.map[y * MAP_W + x] !== 2) continue;
      const target = { x: (x + .5) * T, y: (y + .5) * T, water: true };
      offer(water, target, "fish", "Cast Fishing Line", INTERACT_RADIUS);
    }
  }
  water.sort((a, b) => a.focusDistance - b.focusDistance || a.distance - b.distance);
  if (water.length) return water[0];
  return { target: null, kind: null, label: "" };
};

Game.prototype.updateInteract = function () {
  if (this.fishing) {
    const fishing = this.fishing;
    const label = fishing.state === "bite"
      ? "Set Hook"
      : fishing.state === "hooked"
        ? (this.keys.KeyF ? "Reeling — release on surge" : "Hold to Reel")
        : "Cancel Cast";
    this._interactTarget = null;
    this._interactKind = "fish";
    this.ui.setInteract(true, label);
    return;
  }

  const pending = this._pendingInteraction;
  if (pending) {
    const invalid = pending.kind === "chest" && pending.target.opened;
    const distance = Math.hypot(pending.target.x - this.player.x, pending.target.y - this.player.y);
    if (invalid) {
      this._pendingInteraction = null;
    } else if (distance <= INTERACT_RADIUS) {
      this._pendingInteraction = null;
      this.moveTarget = null;
      this.interact({ ...pending, distance, reachable: true });
      return;
    }
  }

  const resolved = this.resolveInteract();
  this._interactTarget = resolved.target;
  this._interactKind = resolved.kind;
  this.ui.setInteract(!!resolved.target, resolved.label);
};

Game.prototype.startFishing = function (spot, options = {}) {
  const player = this.player;
  const auto = options.auto === true;
  clearTimeout(this._autoFishingTimer);
  this._autoFishingTimer = null;
  if (this.autoBattle) this.setAutoBattle?.(false);
  if (this.mounted) this.toggleMount?.();
  this.moveTarget = null;
  this._pendingInteraction = null;
  player.dir = spot.y < player.y ? "up" : spot.y > player.y ? "down" : (spot.x < player.x ? "left" : "right");
  const context = fishingContext(this, spot);
  const fish = rollFish(context);
  this.fishing = {
    state: "cast",
    t: 0,
    totalT: 0,
    wait: 1.7 + Math.random() * 2.8 - context.rod.control * .6,
    spot,
    bobX: spot.x,
    bobY: spot.y,
    context,
    fish,
    progress: 0,
    tension: .18,
    phase: Math.random() * Math.PI * 2,
    auto,
    tip: auto ? `${context.rod.name} is auto-casting…` : `Waiting with ${context.rod.name}…`,
  };
  this.audio.sfx("ui");
  if (!options.quiet) this.ui.toast(auto ? `AUTO FISHING · ${context.condition}` : `Line cast · ${context.condition}`);
};

Game.prototype.failFishing = function (message) {
  if (!this.fishing) return;
  clearTimeout(this._autoFishingTimer);
  this._autoFishingTimer = null;
  this.fishing = null;
  this.audio.sfx("hurt");
  this.ui.toast(message);
};

Game.prototype.updateFishing = function (dt) {
  const fishing = this.fishing;
  if (!fishing) return;
  fishing.t += dt;

  if (fishing.state === "cast") {
    fishing.tip = fishing.t > fishing.wait * .72 ? "The bobber is twitching…" : "Wait for the bobber to dive…";
    if (fishing.t >= fishing.wait) {
      fishing.state = "bite";
      fishing.t = 0;
      fishing.window = fishing.fish.biteWindow;
      fishing.tip = fishing.auto ? "Auto hook reading the bite…" : "Tap F now to set the hook!";
      this.audio.sfx("quest");
      if (!fishing.auto) {
        this.ui.toast("Bite! Set the hook with F!");
        this.shake = Math.max(this.shake, 3);
      }
    }
    return;
  }

  if (fishing.state === "bite") {
    if (fishing.auto && fishing.t >= Math.min(.22, fishing.window * .35)) {
      fishing.state = "hooked";
      fishing.t = 0;
      fishing.totalT = 0;
      fishing.progress = .09;
      fishing.tension = .34;
      fishing.tip = "Auto reel active · managing line tension.";
      this.audio.sfx("attack");
      return;
    }
    if (fishing.t >= fishing.window) this.failFishing("Too slow — the fish stole the bait.");
    return;
  }
  if (fishing.state !== "hooked") return;

  fishing.totalT += dt;
  const difficulty = fishing.fish.difficulty;
  const control = fishing.context.rod.control;
  const surge = Math.sin(fishing.totalT * (2.6 + difficulty * 1.8) + fishing.phase) > .52;
  const pulling = fishing.auto ? (!surge && fishing.tension < .76) : !!this.keys.KeyF;
  fishing.surge = surge;

  if (pulling) {
    const reel = (.13 + (1 - difficulty) * .055) * fishing.context.rod.reel;
    fishing.progress += reel * dt * (surge ? .52 : 1);
    fishing.tension += dt * (.22 + difficulty * .16 + (surge ? .72 : 0) - control * .12);
  } else {
    fishing.tension -= dt * (.48 + control * .16);
    fishing.progress -= dt * (.012 + difficulty * .018 + (surge ? .05 : 0));
  }
  if (fishing.tension < .12) fishing.progress -= dt * .075;
  fishing.progress = clamp(fishing.progress, 0, 1);
  fishing.tension = clamp(fishing.tension, 0, 1.08);

  fishing.tip = fishing.auto ? (surge ? "Auto reel easing through a surge…" : "Auto reel keeping steady tension…") : fishing.tension > .82
    ? "Release F — the line is about to snap!"
    : surge && pulling
      ? "Fish surging! Release F for a moment."
      : fishing.tension < .2
        ? "Hold F — the line is going slack."
        : pulling
          ? "Steady reel… keep tension in the safe band."
          : "Hold F to reel when the surge eases.";

  fishing.splashT = (fishing.splashT || 0) - dt;
  if (surge && fishing.splashT <= 0) {
    fishing.splashT = .18;
    for (let i = 0; i < 3; i++) {
      this.particles.push({ x: fishing.bobX, y: fishing.bobY, vx: (Math.random() - .5) * 38, vy: -18 - Math.random() * 24, life: .35, color: "rgba(180,235,245,.9)" });
    }
  }

  if (fishing.tension >= 1) { this.failFishing("Line snapped! Release F during hard surges."); return; }
  if ((fishing.progress <= 0 && fishing.totalT > 4) || fishing.totalT > 24) { this.failFishing("The fish broke free after a long fight."); return; }
  if (fishing.progress >= 1) this.landFish(fishing);
};

Game.prototype.reelFish = function () {
  const fishing = this.fishing;
  if (!fishing) return;
  if (fishing.auto) {
    this.failFishing("Auto Fishing stopped · line reeled in.");
    return;
  }
  if (fishing.state === "cast") {
    this.fishing = null;
    this.ui.toast("Line reeled in.");
    return;
  }
  if (fishing.state === "bite") {
    fishing.state = "hooked";
    fishing.t = 0;
    fishing.totalT = 0;
    fishing.progress = .09;
    fishing.tension = .34;
    fishing.tip = "Hook set! Hold F to reel, release during surges.";
    this.audio.sfx("attack");
    this.shake = Math.max(this.shake, 2);
  }
};

Game.prototype.landFish = function (fishing) {
  const player = this.player, fish = fishing.fish;
  const controlled = fishing.tension >= .28 && fishing.tension <= .72;
  const bonus = controlled ? Math.round(fish.gold * .2) : 0;
  const reward = fish.gold + bonus;
  this.fishing = null;
  this.catchReveal = {
    fish,
    sprite: getFishSprite(fish),
    origin: { x: fishing.bobX, y: fishing.bobY },
    reward,
    bonus,
    elapsed: 0,
    duration: 2.4,
  };
  this.quests.fishCount++;
  player.gold += reward;
  player.inv.fish = (player.inv.fish || 0) + 1;

  const stats = this.fishingStats || (this.fishingStats = { total: 0, best: 0, records: {} });
  stats.total = (stats.total || 0) + 1;
  stats.best = Math.max(stats.best || 0, fish.size);
  stats.records = stats.records || {};
  const record = stats.records[fish.id] || { count: 0, best: 0 };
  record.count++;
  record.best = Math.max(record.best, fish.size);
  stats.records[fish.id] = record;

  const rare = fish.rarity === "rare" || fish.rarity === "legendary";
  const color = fish.rarity === "legendary" ? "rgba(255,220,110,.98)" : rare ? "rgba(190,150,255,.95)" : "rgba(140,225,245,.9)";
  for (let i = 0; i < (rare ? 24 : 14); i++) {
    this.particles.push({ x: fishing.bobX, y: fishing.bobY, vx: (Math.random() - .5) * 72, vy: -35 - Math.random() * 55, life: .8, color });
  }
  this.audio.sfx(rare ? "level" : "coin");
  const prefix = fish.rarity === "legendary" ? "LEGENDARY · " : fish.rarity === "rare" ? "RARE · " : "";
  this.ui.toast(`${prefix}${fish.name} ${fish.size.toFixed(1)}cm · +${reward}g${bonus ? " precision bonus" : ""}`);
  this.ui.sync();
  if (fishing.auto) {
    this._autoFishingTimer = setTimeout(() => {
      this._autoFishingTimer = null;
      if (this.fishing || this.paused || this.player.hp <= 0) return;
      if (Math.hypot(this.player.x - fishing.spot.x, this.player.y - fishing.spot.y) > 72) return;
      this.startFishing(fishing.spot, { auto: true, quiet: true });
    }, 1300);
  }
};

Game.prototype.interact = function (resolved = null) {
  if (this.paused) return;
  if (this.fishing) { this.reelFish(); return; }
  resolved = resolved?.target ? resolved : this.resolveInteract();
  if (!resolved?.target) return;
  const target = resolved.target, kind = resolved.kind;
  if (!target) return;
  if (kind === "fish") { this.ui.showFishingMode?.(target); return; }
  if (kind === "cook") { this.ui.toggle("cooking"); return; }
  if (kind === "npc") { this.ui.showDialog(target, this); return; }
  if (kind !== "chest" || target.opened) return;

  target.opened = true;
  target.openT = 0;
  this._interactTarget = null;
  this._interactKind = null;
  this.ui.setInteract(false, "");
  this.quests.chestCount++;
  this.audio.sfx("chest");
  const player = this.player;
  for (let i = 0; i < (target.pet ? 24 : 18); i++) {
    const petColor = i % 3 === 0 ? "rgba(199,151,255,.95)" : i % 2 ? "rgba(255,225,126,.95)" : "rgba(124,232,190,.9)";
    this.particles.push({ x: target.x, y: target.y - 8, vx: (Math.random() - .5) * (target.pet ? 88 : 68), vy: -35 - Math.random() * 58, life: .75 + Math.random() * .25, color: target.pet ? petColor : (i % 3 === 0 ? "rgba(126,231,190,.9)" : "rgba(255,220,120,.92)") });
  }
  this.fx.push({ kind: "chestburst", x: target.x, y: target.y - 9, pet: !!target.pet, t: 0, dur: target.pet ? 1.05 : .72 });

  if (target.starter) {
    this.flags.starterCache = true;
    player.gold += 12;
    player.inv.wood = (player.inv.wood || 0) + 3;
    player.inv.ore = (player.inv.ore || 0) + 3;
  }

  if (target.pet) {
    this.ui.showPet(target.pet, () => {
      const isNew = this.registerPet(target.pet);
      if (!this.setActivePet(target.pet)) return;
      const name = target.pet.charAt(0).toUpperCase() + target.pet.slice(1);
      if (!isNew && !target.starter) { player.gold += 5; this.onCompanionChange?.(); }
      const message = target.starter
        ? `${name} bonded · starter mount ready · +12g · +3 Wood · +3 Ore`
        : isNew ? `${name} joined your companions!` : `${name} is already bonded · +5g bond echo.`;
      this.ui.toast(message);
      this.ui.sync();
    });
    return;
  }

  const gold = 5 + (Math.random() * 15 | 0);
  player.gold += gold;
  const weapon = ["sword", "axe", "spear", "dagger", "bow"][(Math.random() * 5) | 0];
  player.inv[weapon] = (player.inv[weapon] || 0) + 1;
  this.ui.toast(`Supply cache claimed · +${gold}g · ${ITEMS[weapon]?.name || weapon}`);
  this.ui.sync();
};
