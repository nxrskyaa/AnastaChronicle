// Realtime multiplayer transport. Presence stays compatible with the original
// JSON relay while protocol v2 adds chat, mutual duel events and a shared boss.

import { getServerUrl, getSelectedServerId, MULTIPLAYER_ENABLED, MULTIPLAYER_WORLDS } from "./config.js";

export const net = {
  connected: false,
  room: null,
  ws: null,
  remote: {},
  selfId: null,
  resumeToken: null,
  protocol: 1,
  serverId: getSelectedServerId(),
  worldId: "overworld",
  worldName: "Verdant Overworld",
  capabilities: { pvp: false, boss: false },
  duelActive: false,
  boss: null,
  _lastSend: 0,
  _chat: [],
  _ping: null,
  _join: null,
  _reconnectTimer: null,
  _reconnectAttempts: 0,
  onChat: null,
  onDuel: null,
  onPvpHit: null,
  onPvpReject: null,
  onBossState: null,
  onBossHit: null,
  onBossAttack: null,
  onBossDefeated: null,
  onBossReward: null,
  onBossReject: null,
  onWelcome: null,
  onWorld: null,
};

const validWorld = (value) => MULTIPLAYER_WORLDS.some((world) => world.id === value) ? value : "overworld";

function worldFromLook(look) {
  try {
    const parsed = typeof look === "string" ? JSON.parse(look) : look;
    return validWorld(parsed?._realm);
  } catch { return "overworld"; }
}

function remotePlayer(state) {
  return {
    x: state.x,
    y: state.y,
    rx: state.x,
    ry: state.y,
    dir: state.dir,
    moving: !!state.moving,
    name: state.name,
    look: state.look,
    worldId: worldFromLook(state.look),
    duel: !!state.duel,
    mounted: !!state.mounted,
    mountId: typeof state.mountId === "string" ? state.mountId : null,
    frame: 0,
    frameT: 0,
    cache: null,
  };
}

function applyState(remote, state) {
  remote.x = state.x;
  remote.y = state.y;
  remote.dir = state.dir;
  remote.moving = !!state.moving;
  if (state.name !== undefined) remote.name = state.name;
  if (state.look !== undefined) { remote.look = state.look; remote.worldId = worldFromLook(state.look); }
  if (state.duel !== undefined) remote.duel = !!state.duel;
  if (state.mounted !== undefined) remote.mounted = !!state.mounted;
  if (state.mountId !== undefined) remote.mountId = typeof state.mountId === "string" ? state.mountId : null;
}

function canSend() {
  return !!(net.connected && net.ws && net.ws.readyState === 1);
}

function scheduleReconnect(delayOverride) {
  if (!MULTIPLAYER_ENABLED || !net._join || net.connected || net._reconnectTimer) return;
  const delay = delayOverride ?? Math.min(12000, 700 * 2 ** Math.min(4, net._reconnectAttempts));
  net._reconnectTimer = setTimeout(() => {
    net._reconnectTimer = null;
    const join = net._join;
    connectMultiplayer(join.look, join.name, join.spawn).catch(() => {});
  }, delay);
}

function send(object) {
  if (!canSend()) return false;
  try {
    net.ws.send(JSON.stringify(object));
    return true;
  } catch {
    return false;
  }
}

function setBossState(message) {
  net.boss = message.boss ? { ...message.boss } : null;
  if (net.boss && Number.isFinite(message.contribution)) net.boss.contribution = message.contribution;
  net.onBossState?.(net.boss, message);
}

function handleMessage(message) {
  if (message.t === "welcome") {
    net.selfId = message.id;
    net.protocol = message.protocol || 1;
    net.connected = true;
    // Protocol v1 has no world field. Preserve the world requested by this
    // client instead of silently snapping its network state back to overworld.
    if (message.world !== undefined) net.worldId = validWorld(message.world);
    net.worldName = String(message.worldName || MULTIPLAYER_WORLDS.find((world) => world.id === net.worldId)?.name || "Verdant Overworld");
    net.capabilities = { pvp: !!message.capabilities?.pvp, boss: !!message.capabilities?.boss };
    net._reconnectAttempts = 0;
    if (message.resumeToken) net.resumeToken = message.resumeToken;
    net.onWelcome?.(message);
    net.onWorld?.(net.worldId, message);
  } else if (message.t === "players") {
    for (const state of message.list || []) {
      if (state.id === net.selfId) {
        net.duelActive = !!state.duel;
        continue;
      }
      if (!net.remote[state.id]) net.remote[state.id] = remotePlayer(state);
      else applyState(net.remote[state.id], state);
    }
  } else if (message.t === "join") {
    const state = message.player;
    if (!state || state.id === net.selfId) return;
    net.remote[state.id] = remotePlayer(state);
  } else if (message.t === "state") {
    if (message.id === net.selfId) return;
    if (!net.remote[message.id]) {
      net.remote[message.id] = remotePlayer({
        ...message,
        name: "?",
        look: "{}",
      });
    } else {
      applyState(net.remote[message.id], message);
    }
  } else if (message.t === "leave") {
    delete net.remote[message.id];
  } else if (message.t === "chat") {
    net._chat.push(message);
    if (net._chat.length > 30) net._chat.shift();
    net.onChat?.(message);
  } else if (message.t === "duel") {
    if (message.id === net.selfId) net.duelActive = !!message.active;
    else if (net.remote[message.id]) net.remote[message.id].duel = !!message.active;
    net.onDuel?.(message);
  } else if (message.t === "pvp_hit") {
    net.onPvpHit?.(message);
  } else if (message.t === "pvp_reject") {
    net.onPvpReject?.(message);
  } else if (message.t === "boss_spawn" || message.t === "boss_state") {
    setBossState(message);
  } else if (message.t === "boss_hit") {
    if (net.boss?.id === message.bossId) {
      net.boss.hp = message.hp;
      net.boss.maxHp = message.maxHp;
      net.boss.phase = message.phase;
    }
    net.onBossHit?.(message);
  } else if (message.t === "boss_attack") {
    net.onBossAttack?.(message);
  } else if (message.t === "boss_defeated") {
    if (message.boss) net.boss = { ...message.boss };
    else if (net.boss) { net.boss.active = false; net.boss.hp = 0; }
    net.onBossDefeated?.(message);
  } else if (message.t === "boss_reward") {
    net.onBossReward?.(message);
  } else if (message.t === "boss_reject") {
    net.onBossReject?.(message);
  }
}

export async function connectMultiplayer(look, name, spawn, worldId = net.worldId) {
  if (!MULTIPLAYER_ENABLED) return null;
  net.worldId = validWorld(worldId);
  net._join = { look, name, spawn: { x: spawn?.x, y: spawn?.y }, worldId: net.worldId };
  if (net.ws && (net.ws.readyState === 0 || net.ws.readyState === 1)) return net.ws;
  if (net._reconnectTimer) { clearTimeout(net._reconnectTimer); net._reconnectTimer = null; }
  let ws = null;
  try {
    if (net._ping) clearInterval(net._ping);
    net.serverId = getSelectedServerId();
    ws = new WebSocket(getServerUrl(net.serverId, net.worldId));
    net.ws = ws;

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("ws timeout")), 8000);
      ws.onopen = () => { clearTimeout(timeout); resolve(); };
      ws.onerror = () => { clearTimeout(timeout); reject(new Error("ws error")); };
    });

    ws.onmessage = (event) => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      handleMessage(message);
    };

    const markDisconnected = () => {
      if (net.ws !== ws) return;
      net.connected = false;
      net.duelActive = false;
      net.capabilities = { pvp: false, boss: false };
      net.remote = {};
      net.boss = null;
      net.ws = null;
      if (net._ping) clearInterval(net._ping);
      net._ping = null;
      net._reconnectAttempts++;
      scheduleReconnect();
    };
    ws.onclose = markDisconnected;
    ws.onerror = markDisconnected;

    net._ping = setInterval(() => {
      if (ws.readyState === 1) {
        try { ws.send(JSON.stringify({ t: "ping" })); } catch { /* close handler updates state */ }
      }
    }, 4000);

    ws.send(JSON.stringify({
      t: "join",
      name: name || "Traveler",
      look: JSON.stringify({ ...(look || {}), _realm: net.worldId }),
      x: spawn?.x,
      y: spawn?.y,
      resumeToken: net.resumeToken,
      world: net.worldId,
    }));

    return ws;
  } catch (error) {
    console.warn("Multiplayer unavailable, running singleplayer:", error.message);
    net.connected = false;
    try { ws?.close(); } catch { /* already closed */ }
    if (net.ws === ws) net.ws = null;
    net._reconnectAttempts++;
    scheduleReconnect();
    return null;
  }
}

// Throttled position push (call every frame; sends about 12 times per second).
export function sendMove(player, now, presence = null) {
  if (!canSend() || now - net._lastSend < 84) return false;
  net._lastSend = now;
  return send({
    t: "move",
    x: Math.round(player.x),
    y: Math.round(player.y),
    dir: player.dir,
    moving: !!player.moving,
    mounted: !!presence?.mounted,
    mountId: presence?.mounted && typeof presence.mountId === "string" ? presence.mountId : null,
  });
}

export function sendChat(text) {
  const clean = String(text || "").replace(/\s+/g, " ").trim().slice(0, 200);
  return clean ? send({ t: "chat", text: clean }) : false;
}

export function sendDuel(active) {
  if (!net.capabilities.pvp) return false;
  return send({ t: "duel", active: !!active });
}

export function sendPvpHit(target, damage, kind = "basic") {
  if (!net.capabilities.pvp || !target || target === net.selfId) return false;
  return send({ t: "pvp_hit", target, damage, kind });
}

export function requestBossState() {
  if (!net.capabilities.boss) return false;
  return send({ t: "boss_sync" });
}

export function sendBossHit(damage, bossId = net.boss?.id) {
  if (!net.capabilities.boss || !bossId) return false;
  return send({ t: "boss_hit", bossId, damage });
}

export async function switchMultiplayerWorld(worldId, spawn) {
  const nextWorld = validWorld(worldId);
  const join = net._join;
  if (!join) return null;
  if (net._reconnectTimer) { clearTimeout(net._reconnectTimer); net._reconnectTimer = null; }
  if (net._ping) { clearInterval(net._ping); net._ping = null; }
  const previous = net.ws;
  if (previous) {
    previous.onclose = null;
    previous.onerror = null;
    try { previous.close(1000, "world switch"); } catch { /* already closed */ }
  }
  net.connected = false;
  net.ws = null;
  net.remote = {};
  net.selfId = null;
  net.resumeToken = null;
  net.duelActive = false;
  net.boss = null;
  net.capabilities = { pvp: false, boss: false };
  net.worldId = nextWorld;
  return connectMultiplayer(join.look, join.name, spawn, nextWorld);
}

export function remoteCount() {
  return Object.values(net.remote).filter((remote) => (remote.worldId || "overworld") === net.worldId).length;
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden || net.connected || !net._join) return;
    if (net._reconnectTimer) { clearTimeout(net._reconnectTimer); net._reconnectTimer = null; }
    scheduleReconnect(120);
  });
}

// DEBUG: expose for console inspection
if (typeof window !== "undefined") window.__net = net;
