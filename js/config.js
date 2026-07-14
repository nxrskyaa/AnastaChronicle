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

export function getServerUrl(id = getSelectedServerId()) {
  const selected = SERVER_OPTIONS.some((server) => server.id === id) ? id : SERVER_OPTIONS[0].id;
  return `${SERVER_BASE_URL}?server=${encodeURIComponent(selected)}`;
}

// Kept as a compatibility export for diagnostics and older integrations.
export const SERVER_URL = getServerUrl();

// Deployed from contracts/AnastaChronicleProfilesV2.sol on Ritual Testnet.
export const PROFILE_CONTRACT_ADDRESS = "0xec33bc86a1154d16C60f35CEE58CCB1a4ef0543B";
export const LEVEL_TX_FEE_RIT = "0.00067";
export const RITUAL_TESTNET = Object.freeze({
  name: "Ritual Testnet",
  chainId: 1979,
  rpcUrl: "https://rpc.ritualfoundation.org",
  explorer: "https://explorer.ritualfoundation.org",
  symbol: "RITUAL",
});
