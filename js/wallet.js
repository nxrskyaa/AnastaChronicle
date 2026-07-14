import { GAME_V3_CONTRACT_ADDRESS, PROFILE_CONTRACT_ADDRESS, LEVEL_TX_FEE_RIT, RITUAL_TESTNET } from "./config.js";

export const walletState = { address: "", chainId: null, connected: false, provider: null };
export const v3Configured = /^0x[a-fA-F0-9]{40}$/.test(GAME_V3_CONTRACT_ADDRESS);
const profileV2Configured = /^0x[a-fA-F0-9]{40}$/.test(PROFILE_CONTRACT_ADDRESS);
const activeContractAddress = () => v3Configured ? GAME_V3_CONTRACT_ADDRESS : PROFILE_CONTRACT_ADDRESS;
export const contractConfigured = v3Configured || profileV2Configured;
let listenersBound = false;
const subscribers = new Set();
const MASK_64 = (1n << 64n) - 1n;
const KECCAK_RC = [
  1n, 0x8082n, 0x800000000000808an, 0x8000000080008000n, 0x808bn,
  0x80000001n, 0x8000000080008081n, 0x8000000000008009n, 0x8an, 0x88n,
  0x80008009n, 0x8000000an, 0x8000808bn, 0x800000000000008bn, 0x8000000000008089n,
  0x8000000000008003n, 0x8000000000008002n, 0x8000000000000080n, 0x800an,
  0x800000008000000an, 0x8000000080008081n, 0x8000000000008080n, 0x80000001n,
  0x8000000080008008n,
];
const KECCAK_ROT = [
  [0, 36, 3, 41, 18], [1, 44, 10, 45, 2], [62, 6, 43, 15, 61],
  [28, 55, 25, 21, 56], [27, 20, 39, 8, 14],
];

function rotl64(value, shift) {
  const n = BigInt(shift);
  if (n === 0n) return value & MASK_64;
  return ((value << n) | (value >> (64n - n))) & MASK_64;
}
function keccakF(state) {
  for (const roundConstant of KECCAK_RC) {
    const c = new Array(5).fill(0n);
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) c[x] ^= state[x + 5 * y];
    const d = new Array(5);
    for (let x = 0; x < 5; x++) d[x] = c[(x + 4) % 5] ^ rotl64(c[(x + 1) % 5], 1);
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) state[x + 5 * y] = (state[x + 5 * y] ^ d[x]) & MASK_64;
    const b = new Array(25).fill(0n);
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) b[y + 5 * ((2 * x + 3 * y) % 5)] = rotl64(state[x + 5 * y], KECCAK_ROT[x][y]);
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) {
      state[x + 5 * y] = (b[x + 5 * y] ^ ((~b[(x + 1) % 5 + 5 * y]) & b[(x + 2) % 5 + 5 * y])) & MASK_64;
    }
    state[0] = (state[0] ^ roundConstant) & MASK_64;
  }
}

// Small browser-native Keccak-256 implementation; Ethereum selectors use Keccak, not SHA3-256.
export function keccak256(input) {
  const bytes = input instanceof Uint8Array ? input : new TextEncoder().encode(String(input));
  const rate = 136;
  const padded = new Uint8Array(Math.ceil((bytes.length + 1) / rate) * rate);
  padded.set(bytes); padded[bytes.length] = 0x01; padded[padded.length - 1] |= 0x80;
  const state = new Array(25).fill(0n);
  for (let offset = 0; offset < padded.length; offset += rate) {
    for (let lane = 0; lane < rate / 8; lane++) {
      let word = 0n;
      for (let byte = 0; byte < 8; byte++) word |= BigInt(padded[offset + lane * 8 + byte]) << BigInt(byte * 8);
      state[lane] ^= word;
    }
    keccakF(state);
  }
  const out = new Uint8Array(32);
  for (let byte = 0; byte < out.length; byte++) out[byte] = Number((state[Math.floor(byte / 8)] >> BigInt((byte % 8) * 8)) & 0xffn);
  return `0x${Array.from(out, (v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function selector(signature) { return keccak256(signature).slice(2, 10); }
function hexData(value) { const hex = String(value || "").replace(/^0x/, ""); return `0x${hex}`; }
function word(value) { return BigInt(value).toString(16).padStart(64, "0"); }
function bytes32(value) { return String(value || "0x").replace(/^0x/, "").padEnd(64, "0").slice(0, 64); }
function addressWord(value) { return String(value).replace(/^0x/, "").toLowerCase().padStart(64, "0"); }
function bytesToHex(bytes) { return Array.from(bytes, (v) => v.toString(16).padStart(2, "0")).join(""); }
function hexToBytes(hex) {
  const value = String(hex || "0x").replace(/^0x/, "");
  const even = value.length % 2 ? `0${value}` : value;
  const out = new Uint8Array(even.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(even.slice(i * 2, i * 2 + 2), 16);
  return out;
}
function readWord(bytes, index) { return bytesToHex(bytes.slice(index * 32, index * 32 + 32)).padStart(64, "0"); }
function readUint(bytes, index) { return BigInt(`0x${readWord(bytes, index)}`); }
function decimalToWei(value, decimals = 18) {
  const [whole, fraction = ""] = String(value).split(".");
  return (BigInt(whole || "0") * (10n ** BigInt(decimals))) + BigInt((fraction + "0".repeat(decimals)).slice(0, decimals) || "0");
}
function encodeRegister(name, lookHash) {
  const encoded = new TextEncoder().encode(String(name || "Traveler").slice(0, 24));
  const paddedLength = Math.ceil(encoded.length / 32) * 32;
  const padded = new Uint8Array(paddedLength); padded.set(encoded);
  return hexData(`${selector("registerProfile(string,bytes32)")}${word(64)}${bytes32(lookHash)}${word(encoded.length)}${bytesToHex(padded)}`);
}
function encodeRecordLevel(level, saveHash) { return hexData(`${selector("recordLevel(uint32,bytes32)")}${word(level)}${bytes32(saveHash)}`); }
function encodeAddressCall(signature, address) { return hexData(`${selector(signature)}${addressWord(address)}`); }
function encodeBytes(value) {
  const encoded = value instanceof Uint8Array ? value : new TextEncoder().encode(String(value || ""));
  const paddedLength = Math.ceil(encoded.length / 32) * 32;
  const padded = new Uint8Array(paddedLength); padded.set(encoded);
  return `${word(encoded.length)}${bytesToHex(padded)}`;
}
function encodeSaveProgress(level, saveHash, saveData) {
  return hexData(`${selector("saveProgress(uint32,bytes32,bytes)")}${word(level)}${bytes32(saveHash)}${word(96)}${encodeBytes(saveData)}`);
}
function encodePullFree(count) { return hexData(`${selector("pullFree(uint8)")}${word(count)}`); }
function encodePullGold(count, saveHash) { return hexData(`${selector("pullWithGold(uint8,bytes32)")}${word(count)}${bytes32(saveHash)}`); }
function encodePullRitual(count) { return hexData(`${selector("pullWithRitual(uint8)")}${word(count)}`); }

export function hashJson(value) { return keccak256(JSON.stringify(value)); }
export function hashLook(look) { return hashJson(look || {}); }
export function hashSave(save) { return hashJson(save || {}); }

export function walletShortAddress(address) {
  const value = String(address || "");
  return value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}
export function walletErrorMessage(error, fallback = "Wallet action could not be completed.") {
  const code = Number(error?.code);
  const message = String(error?.message || error || "");
  if (/no evm wallet detected|install metamask|wallet returned an invalid address/i.test(message)) return "No compatible wallet is connected. Install or unlock MetaMask/Rabby first.";
  if (code === 4001 || /user rejected|rejected|denied|cancelled|canceled/i.test(message)) return "Transaction cancelled in wallet.";
  if (/insufficient funds|insufficient balance|gas required exceeds/i.test(message)) return "Not enough RIT for gas. Add testnet RIT and try again.";
  if (/execution reverted|revert|inactive profile|profile is not active/i.test(message)) return "Ritual rejected this profile action. Sync the wallet and try again.";
  if (/chain|network|rpc|disconnected|not found/i.test(message)) return "Ritual network is unavailable. Check the selected chain and retry.";
  return fallback;
}
export function onWalletChange(callback) {
  if (typeof callback !== "function") return () => {};
  subscribers.add(callback); return () => subscribers.delete(callback);
}
function notify() { for (const callback of subscribers) { try { callback({ ...walletState }); } catch {} } }
function getProvider() {
  const provider = globalThis.ethereum || globalThis.window?.ethereum;
  if (!provider) throw new Error("No EVM wallet detected. Install MetaMask, Rabby, or another browser wallet.");
  walletState.provider = provider; return provider;
}
function parseChainId(value) { try { return Number(BigInt(String(value))); } catch { return Number(value) || 0; } }
async function ensureRitualNetwork(provider) {
  const current = parseChainId(await provider.request({ method: "eth_chainId" }));
  if (current === RITUAL_TESTNET.chainId) return current;
  const chainHex = `0x${RITUAL_TESTNET.chainId.toString(16)}`;
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chainHex }] });
  } catch (error) {
    if (error?.code !== 4902 && error?.code !== -32603) throw error;
    await provider.request({ method: "wallet_addEthereumChain", params: [{ chainId: chainHex, chainName: RITUAL_TESTNET.name, nativeCurrency: { name: "Ritual", symbol: RITUAL_TESTNET.symbol, decimals: 18 }, rpcUrls: [RITUAL_TESTNET.rpcUrl], blockExplorerUrls: [RITUAL_TESTNET.explorer] }] });
  }
  const after = parseChainId(await provider.request({ method: "eth_chainId" }));
  if (after !== RITUAL_TESTNET.chainId) throw new Error("Wallet did not switch to Ritual Testnet.");
  return after;
}
export async function connectRitualWallet() {
  const provider = getProvider();
  const accounts = await provider.request({ method: "eth_requestAccounts" });
  const address = String(accounts?.[0] || "").toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(address)) throw new Error("Wallet returned an invalid address.");
  const chainId = await ensureRitualNetwork(provider);
  walletState.address = address; walletState.chainId = chainId; walletState.connected = true;
  if (!listenersBound && typeof provider.on === "function") {
    listenersBound = true;
    provider.on("accountsChanged", (next) => { walletState.address = String(next?.[0] || "").toLowerCase(); walletState.connected = /^0x[a-f0-9]{40}$/.test(walletState.address); notify(); });
    provider.on("chainChanged", (next) => { walletState.chainId = parseChainId(next); walletState.connected = walletState.chainId === RITUAL_TESTNET.chainId && !!walletState.address; notify(); });
  }
  notify(); return { ...walletState, contractConfigured };
}
export function disconnectWallet() { walletState.address = ""; walletState.chainId = null; walletState.connected = false; notify(); }

async function contractCall(data, target = PROFILE_CONTRACT_ADDRESS) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(target)) throw new Error("Contract address is not configured.");
  const provider = walletState.provider || getProvider();
  return provider.request({ method: "eth_call", params: [{ to: target, data: hexData(data) }, "latest"] });
}
async function waitForTransaction(hash, timeoutMs = 120000) {
  const provider = walletState.provider || getProvider();
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const receipt = await provider.request({ method: "eth_getTransactionReceipt", params: [hash] });
    if (receipt) { if (receipt.status === "0x0") throw new Error("Ritual transaction reverted."); return receipt; }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Timed out waiting for the Ritual transaction.");
}
async function contractTransaction(data, value = 0n, target = PROFILE_CONTRACT_ADDRESS) {
  if (!walletState.connected) throw new Error("Connect the Ritual wallet first.");
  if (!/^0x[a-fA-F0-9]{40}$/.test(target)) throw new Error("Contract address is not configured.");
  const provider = walletState.provider || getProvider();
  const hash = await provider.request({ method: "eth_sendTransaction", params: [{ from: walletState.address, to: target, data: hexData(data), value: `0x${value.toString(16)}` }] });
  return { hash, receipt: await waitForTransaction(hash) };
}

export async function readOnchainProfile(address = walletState.address) {
  if (!contractConfigured || !/^0x[a-f0-9]{40}$/i.test(String(address || ""))) return null;
  const bytes = hexToBytes(await contractCall(encodeAddressCall("getProfile(address)", address), activeContractAddress()));
  if (bytes.length < 32 * 10) return null;
  const tupleOffset = Number(readUint(bytes, 0));
  if (!Number.isSafeInteger(tupleOffset) || tupleOffset < 0 || tupleOffset % 32 !== 0) return null;
  const base = tupleOffset / 32;
  const nameOffset = Number(readUint(bytes, base));
  if (!Number.isSafeInteger(nameOffset) || nameOffset < 32 * 9 || nameOffset % 32 !== 0) return null;
  const nameWord = (tupleOffset + nameOffset) / 32;
  const stringLength = Number(readUint(bytes, nameWord));
  const stringStart = (nameWord + 1) * 32;
  if (!Number.isSafeInteger(stringLength) || stringLength < 0 || stringStart + stringLength > bytes.length) return null;
  const nameBytes = bytes.slice(stringStart, stringStart + stringLength);
  return {
    displayName: new TextDecoder().decode(nameBytes),
    lookHash: `0x${readWord(bytes, base + 1)}`, lastSaveHash: `0x${readWord(bytes, base + 2)}`,
    level: Number(readUint(bytes, base + 3)), totalLevelRecords: Number(readUint(bytes, base + 4)),
    createdAt: Number(readUint(bytes, base + 5)), updatedAt: Number(readUint(bytes, base + 6)),
    nonce: Number(readUint(bytes, base + 7)), active: readUint(bytes, base + 8) !== 0n,
  };
}
export async function readOnchainLevelFee() {
  const bytes = hexToBytes(await contractCall(selector(v3Configured ? "ACTION_FEE()" : "levelFee()"), activeContractAddress()));
  return bytes.length >= 32 ? readUint(bytes, 0) : decimalToWei(LEVEL_TX_FEE_RIT);
}
export async function registerOnchainProfile(displayName, look) { return contractTransaction(encodeRegister(displayName, hashLook(look)), 0n, activeContractAddress()); }
export async function deleteOnchainProfile() { return contractTransaction(hexData(selector("deleteProfile()")), 0n, activeContractAddress()); }
export async function recordOnchainLevel(level, save) {
  const fee = await readOnchainLevelFee();
  return contractTransaction(encodeRecordLevel(level, hashSave(save)), fee, activeContractAddress());
}

function decodeDynamicBytes(result) {
  const bytes = hexToBytes(result);
  if (bytes.length < 64) return new Uint8Array();
  const offset = Number(readUint(bytes, 0));
  if (!Number.isSafeInteger(offset) || offset < 0 || offset + 32 > bytes.length) return new Uint8Array();
  const length = Number(BigInt(`0x${bytesToHex(bytes.slice(offset, offset + 32))}`));
  if (!Number.isSafeInteger(length) || length < 0 || offset + 32 + length > bytes.length) return new Uint8Array();
  return bytes.slice(offset + 32, offset + 32 + length);
}

export async function readV3Save(address = walletState.address) {
  if (!v3Configured || !/^0x[a-fA-F0-9]{40}$/i.test(String(address || ""))) return null;
  const raw = await contractCall(encodeAddressCall("getSave(address)", address), GAME_V3_CONTRACT_ADDRESS);
  const data = decodeDynamicBytes(raw);
  if (!data.length) return null;
  try { return JSON.parse(new TextDecoder().decode(data)); } catch { return null; }
}

export async function saveProgressOnchain(save) {
  if (!v3Configured) throw new Error("Anasta V3 contract is not configured.");
  const encoded = new TextEncoder().encode(JSON.stringify(save));
  if (encoded.length > 12288) throw new Error("Save exceeds the 12 KB onchain checkpoint limit.");
  return contractTransaction(encodeSaveProgress(save?.stats?.level || 1, hashSave(save), encoded), decimalToWei(LEVEL_TX_FEE_RIT), GAME_V3_CONTRACT_ADDRESS);
}

export async function readFreePulls(address = walletState.address) {
  if (!v3Configured) return 0;
  const bytes = hexToBytes(await contractCall(encodeAddressCall("freePulls(address)", address), GAME_V3_CONTRACT_ADDRESS));
  return bytes.length >= 32 ? Number(readUint(bytes, 0)) : 0;
}

export async function readLastPull(address = walletState.address) {
  if (!v3Configured) return [];
  const bytes = hexToBytes(await contractCall(encodeAddressCall("getLastPull(address)", address), GAME_V3_CONTRACT_ADDRESS));
  if (bytes.length < 64) return [];
  const offset = Number(readUint(bytes, 0)), base = offset / 32;
  if (!Number.isSafeInteger(base) || base < 1 || base >= bytes.length / 32) return [];
  const length = Math.min(10, Number(readUint(bytes, base)) || 0);
  return Array.from({ length }, (_, index) => Number(readUint(bytes, base + 1 + index)));
}

export async function readOwnedWeapons(address = walletState.address) {
  if (!v3Configured) return [];
  const bytes = hexToBytes(await contractCall(encodeAddressCall("getOwnedWeapons(address)", address), GAME_V3_CONTRACT_ADDRESS));
  if (bytes.length < 24 * 32) return [];
  return Array.from({ length: 24 }, (_, index) => Number(readUint(bytes, index)));
}

export async function pullGachaFree(count) {
  return contractTransaction(encodePullFree(count), 0n, GAME_V3_CONTRACT_ADDRESS);
}
export async function pullGachaGold(count, save) {
  return contractTransaction(encodePullGold(count, hashSave(save)), decimalToWei(LEVEL_TX_FEE_RIT), GAME_V3_CONTRACT_ADDRESS);
}
export async function pullGachaRitual(count) {
  return contractTransaction(encodePullRitual(count), decimalToWei("0.005") * BigInt(count), GAME_V3_CONTRACT_ADDRESS);
}

export function walletSaveKey(address = walletState.address) {
  const normalized = String(address || "").toLowerCase(); return normalized ? `anasta_wallet_${normalized}` : "";
}
export function getWalletSave(address = walletState.address) {
  const key = walletSaveKey(address); if (!key) return null;
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
export function putWalletSave(data, address = walletState.address) {
  const key = walletSaveKey(address); if (!key) return false;
  localStorage.setItem(key, JSON.stringify({ ...data, wallet: String(address).toLowerCase() })); return true;
}
export function clearWalletSave(address = walletState.address) { const key = walletSaveKey(address); if (key) localStorage.removeItem(key); }
