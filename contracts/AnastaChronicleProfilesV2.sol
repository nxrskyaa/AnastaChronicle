// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Anasta Chronicle Profiles V2
/// @notice Player-owned Ritual profiles with milestone saves and a level leaderboard.
/// @dev Remix deployment needs no constructor arguments. The level fee starts at
///      exactly 0.00067 native RIT and can be changed by the owner later.
contract AnastaChronicleProfilesV2 {
    uint16 public constant VERSION = 2;
    uint256 public constant DEFAULT_LEVEL_FEE = 0.00067 ether;

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

    constructor() {
        owner = msg.sender;
        levelFee = DEFAULT_LEVEL_FEE;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function registerProfile(string calldata displayName, bytes32 lookHash) external {
        uint256 nameLength = bytes(displayName).length;
        require(nameLength > 0 && nameLength <= 24, "name length");
        Profile storage profile = profiles[msg.sender];
        require(!profile.active, "profile active");

        if (profile.nonce == 0) players.push(msg.sender);
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

    /// @notice Idempotent delete: repeating the action never reverts.
    /// @return changed True only when an active profile was actually disabled.
    function deleteProfile() external returns (bool changed) {
        Profile storage profile = profiles[msg.sender];
        changed = profile.active;
        if (changed) {
            profile.active = false;
            profile.updatedAt = uint64(block.timestamp);
        }
        emit ProfileDeleted(msg.sender, profile.nonce);
    }

    function getProfile(address player) external view returns (Profile memory) {
        return profiles[player];
    }

    function playerCount() external view returns (uint256) {
        return players.length;
    }

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
