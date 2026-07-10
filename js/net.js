// Networking (Tier 1 presence) — plain JSON WebSocket relay.
// Replaces the Colyseus client: colyseus.js 0.15.x binary protocol silently
// fails to deliver state over wss:// in browsers. A raw wss:// + JSON socket
// is 100% reliable in the browser. Keeps net.remote shaped exactly as render.js
// expects: { x, y, rx, ry, dir, moving, name, look, frame, frameT, cache }.

import { SERVER_URL, MULTIPLAYER_ENABLED } from "./config.js";

export const net = {
  connected: false,
  room: null,            // kept for API compat (unused)
  ws: null,
  remote: {},            // id -> { x, y, rx, ry, dir, moving, name, look, frame, frameT, cache }
  selfId: null,
  _lastSend: 0,
  _chat: [],
  onChat: null,
};

function applyState(r, s) {
  r.x = s.x; r.y = s.y; r.dir = s.dir; r.moving = !!s.moving;
  if (r.name === undefined) { r.name = s.name; r.look = s.look; }
}

export async function connectMultiplayer(look, name, spawn) {
  if (!MULTIPLAYER_ENABLED) return null;
  try {
    const ws = new WebSocket(SERVER_URL);
    net.ws = ws;

    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = (e) => reject(new Error("ws error"));
    });

    ws.onmessage = (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      if (m.t === "welcome") {
        net.selfId = m.id;
        net.connected = true;
      } else if (m.t === "players") {
        for (const s of m.list) {
          if (s.id === net.selfId) continue;
          if (!net.remote[s.id]) net.remote[s.id] = { x: s.x, y: s.y, rx: s.x, ry: s.y, dir: s.dir, moving: s.moving, name: s.name, look: s.look, frame: 0, frameT: 0, cache: null };
          else applyState(net.remote[s.id], s);
        }
      } else if (m.t === "join") {
        const s = m.player;
        if (s.id === net.selfId) return;
        net.remote[s.id] = { x: s.x, y: s.y, rx: s.x, ry: s.y, dir: s.dir, moving: s.moving, name: s.name, look: s.look, frame: 0, frameT: 0, cache: null };
      } else if (m.t === "state") {
        if (m.id === net.selfId) return;
        if (!net.remote[m.id]) net.remote[m.id] = { x: m.x, y: m.y, rx: m.x, ry: m.y, dir: m.dir, moving: m.moving, name: "?", look: "{}", frame: 0, frameT: 0, cache: null };
        else applyState(net.remote[m.id], m);
      } else if (m.t === "leave") {
        delete net.remote[m.id];
      } else if (m.t === "chat") {
        net._chat.push(m);
        if (net._chat.length > 30) net._chat.shift();
        if (net.onChat) net.onChat(m);
      }
    };

    ws.onclose = () => { net.connected = false; };
    ws.onerror = () => { net.connected = false; };

    // Keepalive: Railway's TLS proxy drops idle sockets. Send a tiny ping
    // every 4s so the connection stays warm in the browser.
    net._ping = setInterval(() => {
      if (ws.readyState === ws.OPEN) { try { ws.send(JSON.stringify({ t: "ping" })); } catch {} }
    }, 4000);

    // send join
    ws.send(JSON.stringify({
      t: "join",
      name: name || "Traveler",
      look: JSON.stringify(look || {}),
      x: spawn?.x, y: spawn?.y,
    }));

    return ws;
  } catch (e) {
    console.warn("Multiplayer unavailable, running singleplayer:", e.message);
    net.connected = false;
    return null;
  }
}

// Throttled position push (call every frame; sends ~12x/sec)
export function sendMove(p, now) {
  if (!net.connected || !net.ws) return;
  if (now - net._lastSend < 84) return;
  net._lastSend = now;
  net.ws.send(JSON.stringify({ t: "move", x: Math.round(p.x), y: Math.round(p.y), dir: p.dir, moving: !!p.moving }));
}

export function sendChat(text) {
  if (net.connected && net.ws) net.ws.send(JSON.stringify({ t: "chat", text }));
}

export function remoteCount() {
  return Object.keys(net.remote).length;
}
