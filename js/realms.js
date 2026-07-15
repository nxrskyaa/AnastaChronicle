const T = 24;
const MAP_W = 110;
const MAP_H = 110;

export const BATTLE_REALMS = Object.freeze({
  overworld: Object.freeze({ id: "overworld", name: "Verdant Overworld", short: "OVERWORLD" }),
  "duel-arena": Object.freeze({ id: "duel-arena", name: "Crimson Duel Court", short: "PVP COURT", spawn: { x: 55 * T, y: 61 * T } }),
  "raid-sanctum": Object.freeze({ id: "raid-sanctum", name: "Infernyx Raid Sanctum", short: "CO-OP RAID", spawn: { x: 55 * T, y: 65 * T } }),
});

const WORLD_KEYS = [
  "map", "vmap", "buildings", "trees", "bushes", "rocks", "flowers", "plants",
  "npcs", "enemies", "chests", "critters", "tufts", "camp", "bossArena", "duelArena",
  "time", "weather", "weatherT",
];

function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function captureOverworld(game) {
  if (game._overworldSnapshot) return;
  const snapshot = {};
  for (const key of WORLD_KEYS) snapshot[key] = game[key];
  snapshot.position = { x: game.player.x, y: game.player.y, dir: game.player.dir };
  game._overworldSnapshot = snapshot;
}

function decorateOuterRing(game, random, centerX, centerY, radius, palette) {
  for (let i = 0; i < 150; i++) {
    const angle = random() * Math.PI * 2;
    const distance = radius + 48 + random() * 330;
    const x = centerX + Math.cos(angle) * distance;
    const y = centerY + Math.sin(angle) * distance;
    if (x < 4 * T || y < 4 * T || x > (MAP_W - 4) * T || y > (MAP_H - 4) * T) continue;
    if (i % 4 === 0) game.rocks.push({ x, y, sortY: y, snow: palette === "ash" });
    else game.trees.push({ x, y, sortY: y, v: palette === "crimson" ? 3 : i % 4 });
  }
}

function makeBattleMap(kind) {
  const map = new Uint8Array(MAP_W * MAP_H);
  const vmap = new Uint8Array(MAP_W * MAP_H);
  const cx = 55, cy = kind === "duel-arena" ? 55 : 51;
  const random = seeded(kind === "duel-arena" ? 0xd0e1 : 0xa551);
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const i = y * MAP_W + x;
      const dx = (x - cx) / (kind === "duel-arena" ? 1.18 : 1.08);
      const dy = y - cy;
      const distance = Math.hypot(dx, dy);
      vmap[i] = Math.floor(random() * 8);
      if (kind === "duel-arena") {
        const bridge = Math.abs(x - cx) <= 2 || Math.abs(y - cy) <= 2;
        if (distance < 14.5) map[i] = distance < 11.5 ? 1 : (x + y) % 4 === 0 ? 5 : 1;
        else if (distance < 18.5 && !bridge) map[i] = 2;
        else map[i] = 5;
      } else {
        const southBridge = Math.abs(x - cx) <= 2 && y >= cy;
        if (distance < 15.5) map[i] = distance < 7 ? 1 : (x * 3 + y) % 5 === 0 ? 4 : 5;
        else if (distance < 19 && !southBridge) map[i] = 2;
        else map[i] = y < cy - 9 ? 4 : 5;
      }
    }
  }
  return { map, vmap };
}

function resetTransientWorld(game) {
  game.buildings = [];
  game.trees = [];
  game.bushes = [];
  game.rocks = [];
  game.flowers = [];
  game.plants = [];
  game.npcs = [];
  game.enemies = [];
  game.chests = [];
  game.critters = [];
  game.tufts = [];
  game.boss = null;
  game.bossTimer = null;
  game.projectiles = [];
  game.particles = [];
  game.fx = [];
  game.moveTarget = null;
  game._pendingInteraction = null;
}

function place(game, type, tx, ty, offset = 0) {
  game.buildings.push({ type, x: tx * T, y: ty * T, sortY: ty * T + offset });
}

function buildDuelCourt(game) {
  const { map, vmap } = makeBattleMap("duel-arena");
  resetTransientWorld(game);
  game.map = map;
  game.vmap = vmap;
  game.realmWorld = "duel-arena";
  game.camp = { x: 55 * T, y: 59 * T };
  game.duelArena = { x: 55 * T, y: 55 * T, radius: 14 * T };
  game.bossArena = null;
  game.time = 18 * 60 + 20;
  game.weather = "clear";
  const structures = [
    ["torii", 55, 70], ["pagoda", 55, 38],
    ["lantern", 43, 47], ["lantern", 67, 47], ["lantern", 43, 63], ["lantern", 67, 63],
    ["waystone", 48, 44], ["waystone", 62, 44], ["waystone", 48, 66], ["waystone", 62, 66],
    ["field_shrine", 39, 55], ["field_shrine", 71, 55],
  ];
  for (const [type, x, y] of structures) place(game, type, x, y);
  decorateOuterRing(game, seeded(0xc0115e), 55 * T, 55 * T, 18 * T, "crimson");
}

function buildRaidSanctum(game) {
  const { map, vmap } = makeBattleMap("raid-sanctum");
  resetTransientWorld(game);
  game.map = map;
  game.vmap = vmap;
  game.realmWorld = "raid-sanctum";
  game.camp = { x: 55 * T, y: 63 * T };
  game.duelArena = null;
  game.bossArena = { x: 55 * T, y: 49 * T, radius: 7 * T };
  game.time = 23 * 60 + 10;
  game.weather = "clear";
  const structures = [
    ["torii", 55, 69], ["field_shrine", 47, 63], ["field_shrine", 63, 63],
    ["lantern", 49, 58], ["lantern", 61, 58], ["lantern", 45, 49], ["lantern", 65, 49],
    ["waystone", 49, 43], ["waystone", 61, 43], ["pagoda", 55, 31],
  ];
  for (const [type, x, y] of structures) place(game, type, x, y);
  decorateOuterRing(game, seeded(0x1f3e2), 55 * T, 51 * T, 19 * T, "ash");
}

export function enterBattleRealm(game, worldId) {
  if (!game?.player || !BATTLE_REALMS[worldId] || worldId === "overworld") return null;
  captureOverworld(game);
  if (worldId === "duel-arena") buildDuelCourt(game);
  else buildRaidSanctum(game);
  const spawn = BATTLE_REALMS[worldId].spawn;
  game.player.x = spawn.x;
  game.player.y = spawn.y;
  game.player.vx = 0;
  game.player.vy = 0;
  game.player.dir = "up";
  game.player.moving = false;
  if (game.pet) { game.pet.x = spawn.x - 18; game.pet.y = spawn.y + 16; game.pet.sortY = game.pet.y; }
  game.cam.x = Math.max(0, spawn.x - 320);
  game.cam.y = Math.max(0, spawn.y - 180);
  game.resetInputState?.();
  return { ...spawn };
}

export function leaveBattleRealm(game) {
  const snapshot = game?._overworldSnapshot;
  if (!game?.player || !snapshot) return null;
  for (const key of WORLD_KEYS) game[key] = snapshot[key];
  game.realmWorld = "overworld";
  game.boss = null;
  game.bossTimer = null;
  game.projectiles = [];
  game.particles = [];
  game.fx = [];
  game.player.x = snapshot.position.x;
  game.player.y = snapshot.position.y;
  game.player.dir = snapshot.position.dir;
  game.player.vx = 0;
  game.player.vy = 0;
  game.player.moving = false;
  if (game.pet) { game.pet.x = game.player.x - 18; game.pet.y = game.player.y + 16; game.pet.sortY = game.pet.y; }
  game._overworldSnapshot = null;
  game.resetInputState?.();
  return { x: game.player.x, y: game.player.y };
}

export function persistentRealmPosition(game) {
  return game?._overworldSnapshot?.position || (game?.player ? { x: game.player.x, y: game.player.y, dir: game.player.dir } : null);
}

export function renderBattleRealmGround(ctx, game, camx, camy) {
  if (game.realmWorld === "duel-arena" && game.duelArena) {
    const x = Math.round(game.duelArena.x - camx), y = Math.round(game.duelArena.y - camy);
    const pulse = .55 + Math.sin(game.t * 2.8) * .18;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = "rgba(25,8,12,.28)"; ctx.beginPath(); ctx.ellipse(0, 5, 274, 176, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(225,83,70,${pulse})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 5, 252, 151, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = `rgba(112,226,184,${pulse * .7})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(0, 5, 205, 118, 0, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const angle = i / 12 * Math.PI * 2;
      const rx = Math.round(Math.cos(angle) * 232), ry = Math.round(5 + Math.sin(angle) * 138);
      ctx.fillStyle = i % 2 ? "#4bb18c" : "#b94543"; ctx.fillRect(rx - 4, ry - 4, 8, 8);
      ctx.fillStyle = "#e8d49a"; ctx.fillRect(rx - 1, ry - 7, 2, 14); ctx.fillRect(rx - 7, ry - 1, 14, 2);
    }
    ctx.fillStyle = "rgba(232,212,154,.72)"; ctx.fillRect(-2, -88, 4, 176); ctx.fillRect(-145, 3, 290, 4);
    ctx.restore();
  }
  if (game.realmWorld === "raid-sanctum" && game.bossArena) {
    const x = Math.round(game.bossArena.x - camx), y = Math.round(game.bossArena.y - camy);
    const pulse = .35 + Math.sin(game.t * 3.4) * .14;
    ctx.save(); ctx.translate(x, y); ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 16; i++) {
      const angle = i / 16 * Math.PI * 2 + game.t * .03;
      const inner = 74, outer = 126 + (i % 2) * 18;
      ctx.strokeStyle = `rgba(${i % 2 ? "230,87,45" : "120,71,188"},${pulse})`;
      ctx.beginPath(); ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner * .55);
      ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer * .55); ctx.stroke();
    }
    ctx.restore();
  }
}
