// Networking (Tier 1 presence). Connects to the Colyseus "forest" room,
// tracks remote players, and sends this player's position at a throttled rate.
// Loaded lazily so the game runs fine offline if multiplayer is disabled.
//
// The Colyseus client is loaded from a CDN ESM build pinned to 0.15 to match
// the server's schema version. If it fails to load, multiplayer stays off and
// the game continues as singleplayer.

import { SERVER_URL, MULTIPLAYER_ENABLED } from "./config.js";

export const net = {
  connected: false,
  room: null,
  remote: {},          // sessionId -> { x, y, dir, moving, name, look, rx, ry, frame, frameT, cache }
  selfId: null,
  _lastSend: 0,
  _chat: [],
};

let Client = null;

function addRemote(p, id) {
  net.remote[id] = {
    x: p.x, y: p.y, rx: p.x, ry: p.y, dir: p.dir, moving: p.moving,
    name: p.name, look: p.look, frame: 0, frameT: 0, cache: null,
  };
  // live updates
  p.onChange = () => {
    const r = net.remote[id]; if (!r) return;
    r.x = p.x; r.y = p.y; r.dir = p.dir; r.moving = p.moving; r.name = p.name;
  };
}

async function loadClient() {
  if (Client) return Client;
  const mod = await import("https://cdn.jsdelivr.net/npm/colyseus.js@0.15.26/+esm");
  Client = mod.Client;
  return Client;
}

export async function connectMultiplayer(look, name, spawn) {
  if (!MULTIPLAYER_ENABLED) return null;
  try {
    await loadClient();
    const client = new Client(SERVER_URL);
    const room = await client.joinOrCreate("forest", {
      name: name || "Traveler",
      look: JSON.stringify(look || {}),
      x: spawn?.x, y: spawn?.y,
    });
    net.room = room;
    net.selfId = room.sessionId;
    net.connected = true;

    room.state.players.onAdd = (p, id) => {
      if (id === net.selfId) return;
      addRemote(p, id);
    };
    // First state sync may not have arrived when joinOrCreate resolves, so scan
    // existing players on the first onStateChange too (covers the late-join race).
    let _scanned = false;
    room.onStateChange(() => {
      if (_scanned) return;
      _scanned = true;
      console.log('[MP] first onStateChange, players:', room.state.players.size);
      room.state.players.forEach((p, id) => {
        if (id !== net.selfId && !net.remote[id]) addRemote(p, id);
      });
      console.log('[MP] after scan, remote:', Object.keys(net.remote).length);
    });
    room.state.players.onRemove = (p, id) => { delete net.remote[id]; };

    room.onMessage("chat", (m) => {
      net._chat.push(m);
      if (net._chat.length > 30) net._chat.shift();
      if (net.onChat) net.onChat(m);
    });

    room.onLeave(() => { net.connected = false; });

    return room;
  } catch (e) {
    console.warn("Multiplayer unavailable, running singleplayer:", e.message);
    net.connected = false;
    return null;
  }
}

// Throttled position push (call every frame; sends ~12x/sec)
export function sendMove(p, now) {
  if (!net.connected || !net.room) return;
  if (now - net._lastSend < 84) return;
  net._lastSend = now;
  net.room.send("move", { x: Math.round(p.x), y: Math.round(p.y), dir: p.dir, moving: !!p.moving });
}

export function sendChat(text) {
  if (net.connected && net.room) net.room.send("chat", text);
}

export function remoteCount() {
  return Object.keys(net.remote).length;
}
