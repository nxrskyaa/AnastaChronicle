// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Anasta Chronicle Profiles
/// @notice Minimal player-owned profile and level leaderboard for the Ritual testnet.
/// @dev Deploy from Remix with `initialLevelFee` set to 670000000000000
///      when the network uses 18 native-token decimals (0.00067 RITUAL).
contract AnastaChronicleProfiles {
    address public owner;
    uint256 public levelFee;

    struct Profile {
        string displayName;
        bytes32 lookHash;
        bytes32 lastSaveHash;
        uint32 level;
        uint32 totalLevelRecords;
        uint64 createdAt;
        uint64 updatedAt;
        uint32 nonce;
        bool active;
    }

    struct LeaderboardEntry {
        address player;
        uint32 level;
        string displayName;
        uint64 updatedAt;
    }

    mapping(address => Profile) private profiles;
    address[] private players;

    event ProfileRegistered(address indexed player, string displayName, uint32 nonce);
    event ProfileDeleted(address indexed player, uint32 nonce);
    event LevelRecorded(address indexed player, uint32 indexed level, bytes32 saveHash, uint256 fee);
    event LevelFeeUpdated(uint256 previousFee, uint256 newFee);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(uint256 initialLevelFee) {
        owner = msg.sender;
        levelFee = initialLevelFee;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function registerProfile(string calldata displayName, bytes32 lookHash) external {
        require(bytes(displayName).length > 0 && bytes(displayName).length <= 24, "name length");
        Profile storage profile = profiles[msg.sender];
        require(!profile.active, "profile active");
        if (profile.nonce == 0) {
            players.push(msg.sender);
        }
        profile.displayName = displayName;
        profile.lookHash = lookHash;
        profile.lastSaveHash = bytes32(0);
        profile.level = 1;
        profile.totalLevelRecords = 0;
        profile.createdAt = uint64(block.timestamp);
        profile.updatedAt = uint64(block.timestamp);
        profile.nonce += 1;
        profile.active = true;
        emit ProfileRegistered(msg.sender, displayName, profile.nonce);
    }

    /// @notice Record a strictly higher level. The game decides when to submit a milestone.
    function recordLevel(uint32 newLevel, bytes32 saveHash) external payable {
        Profile storage profile = profiles[msg.sender];
        require(profile.active, "profile inactive");
        require(newLevel > profile.level, "level not higher");
        require(msg.value == levelFee, "incorrect level fee");
        profile.level = newLevel;
        profile.lastSaveHash = saveHash;
        profile.totalLevelRecords += 1;
        profile.updatedAt = uint64(block.timestamp);
        emit LevelRecorded(msg.sender, newLevel, saveHash, msg.value);
    }

    function deleteProfile() external {
        Profile storage profile = profiles[msg.sender];
        require(profile.active, "profile inactive");
        profile.active = false;
        profile.updatedAt = uint64(block.timestamp);
        emit ProfileDeleted(msg.sender, profile.nonce);
    }

    function getProfile(address player) external view returns (Profile memory) {
        return profiles[player];
    }

    function playerCount() external view returns (uint256) {
        return players.length;
    }

    /// @notice Read a sorted page. This is intentionally a view: no gas is spent by the client.
    /// @dev Keep the page size small (the UI requests <= 25) so RPC response sizes stay sane.
    function getLeaderboard(uint256 offset, uint256 limit) external view returns (LeaderboardEntry[] memory) {
        require(limit > 0 && limit <= 50, "limit");
        uint256 activeCount;
        for (uint256 i; i < players.length; i++) {
            if (profiles[players[i]].active) activeCount++;
        }
        if (offset >= activeCount) return new LeaderboardEntry[](0);
        uint256 wanted = activeCount - offset;
        if (wanted > limit) wanted = limit;
        LeaderboardEntry[] memory sorted = new LeaderboardEntry[](activeCount);
        uint256 count;
        for (uint256 i; i < players.length; i++) {
            Profile storage profile = profiles[players[i]];
            if (!profile.active) continue;
            uint256 j = count;
            while (j > 0 && sorted[j - 1].level < profile.level) {
                sorted[j] = sorted[j - 1];
                j--;
            }
            sorted[j] = LeaderboardEntry(players[i], profile.level, profile.displayName, profile.updatedAt);
            count++;
        }
        LeaderboardEntry[] memory page = new LeaderboardEntry[](wanted);
        for (uint256 i; i < wanted; i++) page[i] = sorted[offset + i];
        return page;
    }

    function setLevelFee(uint256 newFee) external onlyOwner {
        emit LevelFeeUpdated(levelFee, newFee);
        levelFee = newFee;
    }

    function withdrawFees(address payable recipient) external onlyOwner {
        require(recipient != address(0), "zero recipient");
        (bool sent, ) = recipient.call{value: address(this).balance}("");
        require(sent, "withdraw failed");
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
