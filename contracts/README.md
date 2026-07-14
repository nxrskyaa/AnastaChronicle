# Anasta Chronicle profile contract

Deploy `AnastaChronicleProfilesV2.sol` from Remix on Ritual Testnet (chain ID `1979`).

Current deployed V2 address: `0xec33bc86a1154d16C60f35CEE58CCB1a4ef0543B`

Constructor input: none.

That is `0.00067 RITUAL` when the native token uses 18 decimals. The contract enforces the configured fee exactly for `recordLevel`; the owner can update it with `setLevelFee` if the testnet economics change.

After deployment:

1. Copy the deployed address into `js/config.js` as `PROFILE_CONTRACT_ADDRESS`.
2. Keep `contracts/AnastaChronicleProfilesV2.abi.json` beside the source for Remix/frontend integration.
3. Test `registerProfile(name, lookHash)` once from the wallet, then call `recordLevel(newLevel, saveHash)` with the exact fee in Remix.

The contract deliberately stores only a compact display name, look hash, save hash, level and timestamps. Game inventory and combat remain client-side until a trusted game backend is introduced.
