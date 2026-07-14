// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Anasta Chronicle V3
/// @notice Wallet-bound saves, level leaderboard and prototype onchain gacha.
/// @dev Gold balances are still game-client state in this browser prototype.
///      pullWithGold records the paid onchain action, but a production economy
///      must move gold validation to an authoritative game server or token.
contract AnastaChronicleV3 {
    uint256 public constant ACTION_FEE = 0.00067 ether;
    uint256 public constant RITUAL_PULL_PRICE = 0.005 ether;
    uint256 public constant GOLD_PULL_PRICE = 500;
    uint256 public constant MAX_SAVE_BYTES = 12_288;
    uint8 public constant STARTER_FREE_PULLS = 5;
    address payable public constant TREASURY = payable(0x645881c3e59eAed072FECDFCC757280C49F01ecD);

    struct Profile {
        string displayName;
        bytes32 lookHash;
        bytes32 lastSaveHash;
        uint32 level;
        uint32 totalLevelRecords;
        uint64 createdAt;
        uint64 updatedAt;
        uint64 nonce;
        bool active;
    }

    mapping(address => Profile) private profiles;
    mapping(address => bytes) private saveBlobs;
    mapping(address => uint8) public freePulls;
    mapping(address => uint16[]) private lastPullItems;
    mapping(address => mapping(uint16 => uint16)) private ownedWeapons;
    mapping(address => uint64) public totalPulls;
    address[] private leaderboard;
    mapping(address => bool) private listed;
    bool private entered;

    event ProfileRegistered(address indexed player, string displayName, uint32 level, uint8 freePulls);
    event ProgressSaved(address indexed player, uint32 level, bytes32 indexed saveHash, uint256 bytesStored);
    event ProfileDeleted(address indexed player);
    event GachaPulled(address indexed player, uint8 indexed paymentKind, uint8 count, uint16[] itemIds, uint64 nonce);

    modifier activeProfile() {
        require(profiles[msg.sender].active, "profile inactive");
        _;
    }

    modifier nonReentrant() {
        require(!entered, "reentrant call");
        entered = true;
        _;
        entered = false;
    }

    function version() external pure returns (uint256) { return 3; }

    function registerProfile(string calldata displayName, bytes32 lookHash) external {
        require(bytes(displayName).length > 0 && bytes(displayName).length <= 24, "invalid name");
        Profile storage profile = profiles[msg.sender];
        require(!profile.active, "profile active");
        profile.displayName = displayName;
        profile.lookHash = lookHash;
        profile.lastSaveHash = bytes32(0);
        profile.level = 1;
        profile.totalLevelRecords = 0;
        profile.createdAt = uint64(block.timestamp);
        profile.updatedAt = uint64(block.timestamp);
        profile.nonce += 1;
        profile.active = true;
        delete saveBlobs[msg.sender];
        delete lastPullItems[msg.sender];
        for (uint16 itemId = 1; itemId <= 24; ++itemId) delete ownedWeapons[msg.sender][itemId];
        freePulls[msg.sender] = STARTER_FREE_PULLS;
        totalPulls[msg.sender] = 0;
        if (!listed[msg.sender]) { listed[msg.sender] = true; leaderboard.push(msg.sender); }
        emit ProfileRegistered(msg.sender, displayName, 1, STARTER_FREE_PULLS);
    }

    function saveProgress(uint32 level, bytes32 saveHash, bytes calldata saveData)
        external payable activeProfile nonReentrant
    {
        require(msg.value == ACTION_FEE, "wrong action fee");
        require(keccak256(saveData) == saveHash, "save hash mismatch");
        _storeProgress(level, saveHash, saveData);
        _forward(msg.value);
    }

    /// @notice Backward-compatible level proof. It updates the level/hash but
    /// does not replace the latest recoverable save blob.
    function recordLevel(uint32 level, bytes32 saveHash) external payable activeProfile nonReentrant {
        require(msg.value == ACTION_FEE, "wrong action fee");
        _storeProgress(level, saveHash, saveBlobs[msg.sender]);
        _forward(msg.value);
    }

    function pullFree(uint8 count) external activeProfile {
        _validateCount(count);
        require(freePulls[msg.sender] >= count, "not enough free pulls");
        freePulls[msg.sender] -= count;
        _draw(count, 0);
    }

    function pullWithGold(uint8 count, bytes32 saveHash) external payable activeProfile nonReentrant {
        _validateCount(count);
        require(msg.value == ACTION_FEE, "wrong action fee");
        profiles[msg.sender].lastSaveHash = saveHash;
        profiles[msg.sender].updatedAt = uint64(block.timestamp);
        _draw(count, 1);
        _forward(msg.value);
    }

    function pullWithRitual(uint8 count) external payable activeProfile nonReentrant {
        _validateCount(count);
        require(msg.value == RITUAL_PULL_PRICE * count, "wrong pull payment");
        _draw(count, 2);
        _forward(msg.value);
    }

    function deleteProfile() external {
        Profile storage profile = profiles[msg.sender];
        require(profile.active, "profile inactive");
        profile.active = false;
        profile.updatedAt = uint64(block.timestamp);
        profile.nonce += 1;
        delete saveBlobs[msg.sender];
        delete lastPullItems[msg.sender];
        freePulls[msg.sender] = 0;
        emit ProfileDeleted(msg.sender);
    }

    function getProfile(address player) external view returns (Profile memory) { return profiles[player]; }
    function getSave(address player) external view returns (bytes memory) { return saveBlobs[player]; }
    function getLastPull(address player) external view returns (uint16[] memory) { return lastPullItems[player]; }
    function getOwnedWeapons(address player) external view returns (uint16[24] memory counts) {
        for (uint16 itemId = 1; itemId <= 24; ++itemId) counts[itemId - 1] = ownedWeapons[player][itemId];
    }
    function leaderboardSize() external view returns (uint256) { return leaderboard.length; }

    function getLeaderboard(uint256 offset, uint256 limit)
        external view returns (address[] memory players, uint32[] memory levels)
    {
        uint256 end = offset + limit;
        if (end > leaderboard.length) end = leaderboard.length;
        if (offset >= end) return (new address[](0), new uint32[](0));
        uint256 length = end - offset;
        players = new address[](length);
        levels = new uint32[](length);
        for (uint256 i; i < length; ++i) {
            players[i] = leaderboard[offset + i];
            levels[i] = profiles[players[i]].active ? profiles[players[i]].level : 0;
        }
    }

    function _storeProgress(uint32 level, bytes32 saveHash, bytes memory saveData) private {
        require(level > 0, "invalid level");
        require(saveData.length <= MAX_SAVE_BYTES, "save too large");
        Profile storage profile = profiles[msg.sender];
        require(level >= profile.level, "level regression");
        if (level > profile.level) profile.totalLevelRecords += 1;
        profile.level = level;
        profile.lastSaveHash = saveHash;
        profile.updatedAt = uint64(block.timestamp);
        profile.nonce += 1;
        saveBlobs[msg.sender] = saveData;
        emit ProgressSaved(msg.sender, level, saveHash, saveData.length);
    }

    function _validateCount(uint8 count) private pure { require(count == 1 || count == 10, "count must be 1 or 10"); }

    function _draw(uint8 count, uint8 paymentKind) private {
        Profile storage profile = profiles[msg.sender];
        delete lastPullItems[msg.sender];
        uint64 startNonce = profile.nonce;
        for (uint8 i; i < count; ++i) {
            profile.nonce += 1;
            uint256 random = uint256(keccak256(abi.encodePacked(
                block.prevrandao, block.timestamp, msg.sender, profile.nonce, blockhash(block.number - 1)
            )));
            uint8 rarity = _rarity(random % 10_000);
            uint16 itemId = uint16(uint16(rarity) * 3 + uint16((random >> 32) % 3) + 1);
            lastPullItems[msg.sender].push(itemId);
            ownedWeapons[msg.sender][itemId] += 1;
        }
        totalPulls[msg.sender] += count;
        profile.updatedAt = uint64(block.timestamp);
        emit GachaPulled(msg.sender, paymentKind, count, lastPullItems[msg.sender], startNonce + count);
    }

    // 50%, 25%, 12%, 7%, 3.5%, 1.7%, 0.65%, 0.15%
    function _rarity(uint256 roll) private pure returns (uint8) {
        if (roll < 15) return 7;       // Mythical Radiant
        if (roll < 80) return 6;       // Mythical
        if (roll < 250) return 5;      // Legendary
        if (roll < 600) return 4;      // Ultra Rare
        if (roll < 1_300) return 3;    // Epic
        if (roll < 2_500) return 2;    // Rare
        if (roll < 5_000) return 1;    // Uncommon
        return 0;                       // Common
    }

    function _forward(uint256 amount) private {
        (bool ok,) = TREASURY.call{value: amount}("");
        require(ok, "treasury transfer failed");
    }
}
