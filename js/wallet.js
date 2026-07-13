import { PROFILE_CONTRACT_ADDRESS, RITUAL_TESTNET } from "./config.js";

export const walletState = { address: "", chainId: null, connected: false, provider: null };
let listenersBound = false;
const subscribers = new Set();

export function walletShortAddress(address) {
  const value = String(address || "");
  return value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}

export function onWalletChange(callback) {
  if (typeof callback !== "function") return () => {};
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

function notify() { for (const callback of subscribers) { try { callback({ ...walletState }); } catch {} } }
function getProvider() {
  const provider = globalThis.ethereum || globalThis.window?.ethereum;
  if (!provider) throw new Error("No EVM wallet detected. Install MetaMask, Rabby, or another browser wallet.");
  walletState.provider = provider;
  return provider;
}
function parseChainId(value) {
  try { return Number(BigInt(String(value))); } catch { return Number(value) || 0; }
}

async function ensureRitualNetwork(provider) {
  const current = parseChainId(await provider.request({ method: "eth_chainId" }));
  if (current === RITUAL_TESTNET.chainId) return current;
  const chainHex = `0x${RITUAL_TESTNET.chainId.toString(16)}`;
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chainHex }] });
  } catch (error) {
    if (error?.code !== 4902 && error?.code !== -32603) throw error;
    await provider.request({ method: "wallet_addEthereumChain", params: [{
      chainId: chainHex,
      chainName: RITUAL_TESTNET.name,
      nativeCurrency: { name: "Ritual", symbol: RITUAL_TESTNET.symbol, decimals: 18 },
      rpcUrls: [RITUAL_TESTNET.rpcUrl],
      blockExplorerUrls: [RITUAL_TESTNET.explorer],
    }] });
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
  walletState.address = address;
  walletState.chainId = chainId;
  walletState.connected = true;
  if (!listenersBound && typeof provider.on === "function") {
    listenersBound = true;
    provider.on("accountsChanged", (next) => {
      walletState.address = String(next?.[0] || "").toLowerCase();
      walletState.connected = /^0x[a-f0-9]{40}$/.test(walletState.address);
      notify();
    });
    provider.on("chainChanged", (next) => {
      walletState.chainId = parseChainId(next);
      walletState.connected = walletState.chainId === RITUAL_TESTNET.chainId && !!walletState.address;
      notify();
    });
  }
  notify();
  return { ...walletState, contractConfigured: Boolean(PROFILE_CONTRACT_ADDRESS) };
}

export function disconnectWallet() {
  walletState.address = "";
  walletState.chainId = null;
  walletState.connected = false;
  notify();
}

export function walletSaveKey(address = walletState.address) {
  const normalized = String(address || "").toLowerCase();
  return normalized ? `anasta_wallet_${normalized}` : "";
}
export function getWalletSave(address = walletState.address) {
  const key = walletSaveKey(address);
  if (!key) return null;
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
export function putWalletSave(data, address = walletState.address) {
  const key = walletSaveKey(address);
  if (!key) return false;
  localStorage.setItem(key, JSON.stringify({ ...data, wallet: String(address).toLowerCase() }));
  return true;
}
export function clearWalletSave(address = walletState.address) {
  const key = walletSaveKey(address);
  if (key) localStorage.removeItem(key);
}
