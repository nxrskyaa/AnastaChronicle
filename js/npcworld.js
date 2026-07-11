// Deterministic ambient residents and their lightweight daily routines.
// All coordinates are authored as map tiles, while faces, clothes and dialogue
// are assembled from small code palettes so the world stays asset-free.

const T = 24;
const DAY_START = 5 * 60;
const NIGHT_START = 19 * 60;

const SKINS = ["#ffe0c0", "#f0b892", "#d89b6e", "#c98a63", "#a86b45", "#8d5a3c", "#6b4228"];
const HAIR = ["#25262b", "#4a3225", "#8a5a34", "#caa24a", "#b5432f", "#7a5a86", "#4a6ea0", "#3a8a6a", "#d7d2c8"];
const SHIRTS = ["#3d6fa8", "#b0503f", "#8557a8", "#c9a23e", "#2b8a7a", "#a03a5a", "#4f7650", "#6b586e"];
const PANTS = ["#42486a", "#5a3f2e", "#37503a", "#2c2c34", "#7a6a4a", "#3a3a48"];
const ACCENTS = ["#e8c96a", "#6ee0b0", "#65b8e8", "#a87ae0", "#e06055", "#e887bd", "#f09b4e"];
const HAIRSTYLES = ["short", "spiky", "long", "ponytail", "bob", "braids", "undercut", "samurai", "waves", "twintails"];
const ACCESSORIES = ["none", "headband", "leafpin", "earring", "ribbon"];
const OUTFITS = ["wanderer", "vanguard", "mythic"];
const NAMES = [
  "Aoi", "Ren", "Mei", "Haru", "Sora", "Yuna", "Daichi", "Nami", "Kaito", "Fumi",
  "Akari", "Toma", "Rin", "Itsuki", "Mika", "Jun", "Noa", "Hotaru", "Riku", "Chiyo",
];

// Six lived-in regions with 20 residents in total. Routes deliberately sit on
// land and away from the starter camp; no runtime pathfinder is needed.
const SITES = [
  {
    region: "West Road", roles: ["Courier", "Wayfinder", "Caravan Hand", "Road Warden"],
    residents: [
      { at: [29, 52], routine: "patrol", route: [[24, 53], [34, 50]] },
      { at: [40, 58], routine: "wander", roam: 28 },
      { at: [71, 59], routine: "patrol", route: [[67, 60], [76, 57]] },
      { at: [83, 50], routine: "patrol", route: [[80, 52], [87, 48]], lantern: true },
    ],
  },
  {
    region: "Reed Pond", roles: ["Reed Angler", "Herbalist", "Pond Keeper"],
    residents: [
      { at: [64, 44], routine: "fish", face: "down" },
      { at: [67, 56], routine: "gather", roam: 24 },
      { at: [70, 50], routine: "work", roam: 18 },
    ],
  },
  {
    region: "North Shrine", roles: ["Shrine Keeper", "Pilgrim", "Bell Tender"],
    residents: [
      { at: [46, 41], routine: "wander", roam: 24 },
      { at: [55, 39], routine: "rest", roam: 10 },
      { at: [63, 42], routine: "work", roam: 15, lantern: true },
    ],
  },
  {
    region: "Umbral Forest", roles: ["Forager", "Resin Gatherer", "Moss Scholar", "Trail Warden"],
    residents: [
      { at: [82, 79], routine: "gather", roam: 34 },
      { at: [92, 83], routine: "work", roam: 22 },
      { at: [78, 96], routine: "wander", roam: 30 },
      { at: [99, 75], routine: "patrol", route: [[94, 73], [103, 79]], lantern: true },
    ],
  },
  {
    region: "Frostfield", roles: ["Frost Scout", "Tea Keeper", "Star Reader"],
    residents: [
      { at: [14, 12], routine: "patrol", route: [[10, 11], [20, 14]] },
      { at: [27, 14], routine: "work", roam: 18 },
      { at: [39, 10], routine: "rest", roam: 8, lantern: true },
    ],
  },
  {
    region: "Azure Coast", roles: ["Tide Angler", "Shell Collector", "Beacon Keeper"],
    residents: [
      { at: [66, 28], routine: "fish", face: "right" },
      { at: [80, 43], routine: "gather", roam: 22 },
      { at: [94, 28], routine: "work", roam: 14, lantern: true },
    ],
  },
];

const ROLE_LINES = {
  fish: ["The water changes its voice before a bite.", "Slow hands catch the silver ones."],
  gather: ["I only take what will grow back by morning.", "Fresh tracks make the best field notes."],
  patrol: ["I walk this route so travelers can breathe easy.", "The trail is calm, but I still count every footprint."],
  work: ["Small chores keep a distant outpost alive.", "There is always one more thing worth mending."],
  rest: ["A quiet stop can save a long journey.", "Sit a moment. The road will still be there."],
  wander: ["I follow whichever path the wind recommends.", "Every bend in the road has its own story."],
};

const REGION_LINES = {
  "West Road": "Camp lies east; follow the worn stones if the mist rolls in.",
  "Reed Pond": "Mind the pale reeds. That is where the pond becomes deep.",
  "North Shrine": "Ring the bell once for thanks, never for luck.",
  "Umbral Forest": "The moss glows brightest where the old roots meet.",
  Frostfield: "Keep moving when the snow turns blue; night is close then.",
  "Azure Coast": "The lake wind carries weather here before the clouds arrive.",
};

const NIGHT_LINES = {
  "West Road": "The lantern posts will guide you back to camp.",
  "Reed Pond": "At night the pond belongs to frogs and fireflies.",
  "North Shrine": "The shrine is quieter after the last bell.",
  "Umbral Forest": "Stay near the warm lanterns after dark.",
  Frostfield: "Stars look close enough to touch over the snow.",
  "Azure Coast": "Moonlight makes a second path across the water.",
};

function hash(text) {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function random(seed) {
  seed.value = (Math.imul(seed.value, 1664525) + 1013904223) >>> 0;
  return seed.value / 4294967296;
}

function pick(list, seed) { return list[Math.floor(random(seed) * list.length) % list.length]; }

function generatedLook(seedValue, routine, index) {
  const seed = { value: seedValue };
  const cls = routine === "patrol" ? "warrior" : routine === "gather" ? "archer" : index % 6 === 0 ? "mage" : "villager";
  return {
    cls,
    skin: pick(SKINS, seed), hair: pick(HAIR, seed), eyes: index % 3 === 0 ? "#2a4a6a" : "#3a2a1e",
    shirt: pick(SHIRTS, seed), pants: pick(PANTS, seed), boots: index % 2 ? "#3a3a42" : "#5c3c2c",
    accent: pick(ACCENTS, seed), style: pick(HAIRSTYLES, seed), accessory: pick(ACCESSORIES, seed),
    outfit: routine === "patrol" ? "vanguard" : pick(OUTFITS, seed), mark: index % 7 === 0 ? "freckles" : "none", aura: "none",
  };
}

export function createAmbientNpcDefs() {
  const defs = [];
  let index = 0;
  for (const site of SITES) for (let slot = 0; slot < site.residents.length; slot++) {
    const resident = site.residents[slot];
    const role = site.roles[slot % site.roles.length];
    const name = NAMES[index % NAMES.length];
    const seedValue = hash(`${site.region}:${name}:${role}`);
    const lineSeed = { value: seedValue ^ 0x9e3779b9 };
    const dayLine = `${pick(ROLE_LINES[resident.routine], lineSeed)} ${REGION_LINES[site.region]}`;
    defs.push({
      id: `ambient-${site.region.toLowerCase().replace(/\s+/g, "-")}-${slot + 1}`,
      name, role, region: site.region,
      tx: resident.at[0], ty: resident.at[1], routine: resident.routine,
      route: resident.route, roam: resident.roam, face: resident.face,
      carriesLantern: !!resident.lantern,
      look: generatedLook(seedValue, resident.routine, index),
      line: dayLine, dayLine,
      nightLine: NIGHT_LINES[site.region],
      seed: seedValue,
    });
    index++;
  }
  return defs;
}

export function createNpcRoutine(def, x, y, index = 0, ambient = false) {
  const role = def.role || "Villager";
  const routine = def.routine || (
    /Angler|Fisher/i.test(role) ? "fish" :
    /Guard|Champion|Scout/i.test(role) ? "patrol" :
    /Forge|Kitchen|Potions/i.test(role) ? "work" : "wander"
  );
  const route = (def.route || []).map(([tx, ty]) => ({ x: tx * T, y: ty * T }));
  return {
    ambient, region: def.region || "Basecamp", routine,
    hx: x, hy: y, targetX: x, targetY: y,
    route, routeIndex: index % Math.max(1, route.length), roam: def.roam || (ambient ? 22 : 12),
    seed: (def.seed ?? hash(`${def.name}:${role}:${index}`)) >>> 0,
    state: "pause", activity: routine, actionT: .7 + (index % 5) * .28,
    moving: false, vx: 0, vy: 0, speed: ambient ? 19 + index % 4 * 2 : 14,
    emote: null, emoteT: 0, reactionCd: 1.2 + index * .08,
    preferredDir: def.face || null, carriesLantern: !!def.carriesLantern,
    dayLine: def.dayLine || def.line, nightLine: def.nightLine || def.line,
  };
}

function nextNpcRandom(npc) {
  npc.seed = (Math.imul(npc.seed, 1664525) + 1013904223) >>> 0;
  return npc.seed / 4294967296;
}

function directionFrom(dx, dy, fallback = "down") {
  if (Math.abs(dx) < .1 && Math.abs(dy) < .1) return fallback;
  return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "up" : "down");
}

function chooseTarget(game, npc) {
  if (npc.routine === "fish" || npc.routine === "rest") {
    npc.state = "pause";
    npc.actionT = 1.8 + nextNpcRandom(npc) * 2.4;
    npc.emote = npc.routine === "fish" ? "fish" : "rest";
    npc.emoteT = .7;
    if (npc.preferredDir) npc.dir = npc.preferredDir;
    return;
  }

  if (npc.routine === "patrol" && npc.route.length) {
    const point = npc.route[npc.routeIndex % npc.route.length];
    npc.routeIndex = (npc.routeIndex + 1) % npc.route.length;
    npc.targetX = point.x; npc.targetY = point.y;
    npc.state = "move"; npc.actionT = 18;
    return;
  }

  for (let attempt = 0; attempt < 6; attempt++) {
    const angle = nextNpcRandom(npc) * Math.PI * 2;
    const distance = npc.roam * (.35 + nextNpcRandom(npc) * .65);
    const x = npc.hx + Math.cos(angle) * distance;
    const y = npc.hy + Math.sin(angle) * distance;
    if (game.tileAt(x, y) === 2) continue;
    npc.targetX = x; npc.targetY = y;
    npc.state = "move"; npc.actionT = 3 + nextNpcRandom(npc) * 3;
    return;
  }
  npc.state = "pause"; npc.actionT = 1.5;
}

// Keeps every NPC update O(1): tiny home-radius movement, no global path search.
export function updateNpcWorld(game, dt) {
  const isNight = game.time < DAY_START || game.time > NIGHT_START;
  const player = game.player;

  for (const npc of game.npcs) {
    npc.frameT += dt;
    npc.actionT -= dt;
    npc.emoteT = Math.max(0, (npc.emoteT || 0) - dt);
    npc.reactionCd = Math.max(0, (npc.reactionCd || 0) - dt);
    npc.line = isNight ? (npc.nightLine || npc.dayLine || npc.line) : (npc.dayLine || npc.line);

    const toPlayerX = player.x - npc.x, toPlayerY = player.y - npc.y;
    const playerDistance = Math.hypot(toPlayerX, toPlayerY);
    npc.nearPlayer = playerDistance < 70;
    if (npc.nearPlayer && npc.reactionCd <= 0) {
      npc.emote = npc.routine === "fish" ? "fish" : "wave";
      npc.emoteT = 1.25;
      npc.reactionCd = 8 + nextNpcRandom(npc) * 7;
      if (!npc.moving) npc.dir = directionFrom(toPlayerX, toPlayerY, npc.dir);
    }

    // At night most residents settle at their home marker. Lantern bearers and
    // patrols remain active, making roads feel watched instead of abandoned.
    const nightActive = npc.carriesLantern || npc.routine === "patrol";
    if (isNight && !nightActive) {
      const dx = npc.hx - npc.x, dy = npc.hy - npc.y, distance = Math.hypot(dx, dy);
      if (distance > 3) {
        npc.state = "move"; npc.targetX = npc.hx; npc.targetY = npc.hy;
      } else {
        npc.state = "pause"; npc.moving = false; npc.activity = "rest";
        if (npc.actionT <= 0) { npc.actionT = 2.4 + nextNpcRandom(npc) * 2; npc.emote = "rest"; npc.emoteT = .9; }
      }
    } else {
      npc.activity = npc.routine;
      if (npc.actionT <= 0) {
        if (npc.state === "move") {
          npc.state = "pause"; npc.moving = false;
          npc.actionT = .8 + nextNpcRandom(npc) * 2.2;
          if (npc.routine === "gather" || npc.routine === "work") { npc.emote = npc.routine; npc.emoteT = .85; }
        } else chooseTarget(game, npc);
      }
    }

    if (npc.state === "move") {
      const dx = npc.targetX - npc.x, dy = npc.targetY - npc.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 2) {
        npc.state = "pause"; npc.moving = false; npc.actionT = .7 + nextNpcRandom(npc) * 1.8;
      } else {
        const step = Math.min(distance, npc.speed * dt);
        npc.vx = dx / distance * npc.speed; npc.vy = dy / distance * npc.speed;
        npc.dir = directionFrom(dx, dy, npc.dir);
        game.moveEntity(npc, dx / distance * step, dy / distance * step, 5);
        npc.moving = true;
      }
    } else {
      npc.vx = 0; npc.vy = 0; npc.moving = false;
      if (npc.preferredDir && !npc.nearPlayer) npc.dir = npc.preferredDir;
    }

    const frameRate = npc.moving ? .15 : .42;
    if (npc.frameT >= frameRate) {
      npc.frameT %= frameRate;
      npc.frame = (npc.frame + 1) % 4;
    }
    npc.sortY = npc.y;
  }
}

export const AMBIENT_NPC_COUNT = SITES.reduce((count, site) => count + site.residents.length, 0);
export const AMBIENT_NPC_REGIONS = SITES.map(site => site.region);
