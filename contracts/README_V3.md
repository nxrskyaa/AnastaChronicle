# Anasta Chronicle V3 — Remix deployment

1. Open Remix and create `AnastaChronicleV3.sol` using the adjacent source file.
2. Compile with Solidity `0.8.24` and optimization enabled (`200` runs).
3. In MetaMask/Rabby select Ritual Testnet (chain ID `1979`) and deploy with no constructor arguments.
4. Copy the deployed address into `GAME_V3_CONTRACT_ADDRESS` in `js/config.js`.
5. Keep the deployer wallet safe. Player revenue is forwarded immediately to
   `0x645881c3e59eAed072FECDFCC757280C49F01ecD`; it is not held by the contract.

The frontend automatically prefers V3 after that address is configured. Existing
V2 profiles are not magically migrated because contracts cannot read another
contract's private save data. Players create a V3 profile once, receive five free
pulls, and can then create recoverable wallet checkpoints.

Gold is currently browser-game state. `pullWithGold` records the wallet action and
the contract-owned weapon result, but cannot prove the client's gold balance. Before
mainnet or tradable assets, validate gold through an authoritative server signature
or an onchain token. The current pseudo-random draw is suitable for this testnet
prototype, not for prizes with real monetary value; replace it with verifiable
randomness before mainnet.
