// Multiplayer config. The production source of truth is the Cloudflare Worker
// Durable Object. Shards are logical rooms on the same Worker endpoint; each
// room has its own synchronized boss and a hard 300-player ceiling.
export const MULTIPLAYER_ENABLED = true;
export const SERVER_BASE_URL = "wss://anasta-server.anasta-nxrskyaa.workers.dev";
export const SERVER_OPTIONS = Object.freeze([
  Object.freeze({ id: "verdant-01", name: "Verdant Grove", code: "01", capacity: 300 }),
  Object.freeze({ id: "azure-02", name: "Azure Coast", code: "02", capacity: 300 }),
  Object.freeze({ id: "umbral-03", name: "Umbral Wilds", code: "03", capacity: 300 }),
]);
export const MULTIPLAYER_WORLDS = Object.freeze([
  Object.freeze({ id: "overworld", name: "Verdant Overworld", pvp: false, boss: false }),
  Object.freeze({ id: "duel-arena", name: "Crimson Duel Court", pvp: true, boss: false }),
  Object.freeze({ id: "raid-sanctum", name: "Infernyx Raid Sanctum", pvp: false, boss: true }),
]);

export function getSelectedServerId() {
  try {
    const saved = localStorage.getItem("anasta_server");
    return SERVER_OPTIONS.some((server) => server.id === saved) ? saved : SERVER_OPTIONS[0].id;
  } catch { return SERVER_OPTIONS[0].id; }
}

export function setSelectedServerId(id) {
  const selected = SERVER_OPTIONS.some((server) => server.id === id) ? id : SERVER_OPTIONS[0].id;
  try { localStorage.setItem("anasta_server", selected); } catch {}
  return selected;
}

export function getServerUrl(id = getSelectedServerId(), worldId = "overworld") {
  const selected = SERVER_OPTIONS.some((server) => server.id === id) ? id : SERVER_OPTIONS[0].id;
  const world = MULTIPLAYER_WORLDS.some((entry) => entry.id === worldId) ? worldId : "overworld";
  return `${SERVER_BASE_URL}?server=${encodeURIComponent(selected)}&world=${encodeURIComponent(world)}`;
}

// Kept as a compatibility export for diagnostics and older integrations.
export const SERVER_URL = getServerUrl();

// Deployed from contracts/AnastaChronicleProfilesV2.sol on Ritual Testnet.
export const PROFILE_CONTRACT_ADDRESS = "0xec33bc86a1154d16C60f35CEE58CCB1a4ef0543B";
// Paste the deployed AnastaChronicleV3 address here. Until then the existing
// V2 profile remains readable, while recoverable saves and paid gacha stay locked.
export const GAME_V3_CONTRACT_ADDRESS = "0x855d56B905B3Fe23112bd6C597B11Da40A6a9DB2";
export const LEVEL_TX_FEE_RIT = "0.00067";
export const GACHA_GOLD_PRICE = 500;
export const GACHA_RITUAL_PRICE = "0.005";
export const RITUAL_TESTNET = Object.freeze({
  name: "Ritual Testnet",
  chainId: 1979,
  rpcUrl: "https://rpc.ritualfoundation.org",
  explorer: "https://explorer.ritualfoundation.org",
  symbol: "RITUAL",
});
