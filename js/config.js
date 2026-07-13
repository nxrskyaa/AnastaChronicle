// Multiplayer config. Set MULTIPLAYER_ENABLED=true and point SERVER_URL at your
// deployed Colyseus server (wss:// for HTTPS tunnel, ws:// for local).
export const MULTIPLAYER_ENABLED = true;
export const SERVER_URL = "wss://hurricane-pathology-cigarette-disciplines.trycloudflare.com";

// Deployed from contracts/AnastaChronicleProfiles.sol on Ritual Testnet.
export const PROFILE_CONTRACT_ADDRESS = "0x6eDc6a30D2735E71afDB622026a46343e6dD81fa";
export const LEVEL_TX_FEE_RIT = "0.00067";
export const RITUAL_TESTNET = Object.freeze({
  name: "Ritual Testnet",
  chainId: 1979,
  rpcUrl: "https://rpc.ritualfoundation.org",
  explorer: "https://explorer.ritualfoundation.org",
  symbol: "RITUAL",
});
