const dataModel = require("./data");
const contractConfig = require("../config/contract");
const nftService = require("../services/nft");

/**
 * Updates a user's activity status and manages their minting cycle
 *
 * Tracks user activity, determines when a user should receive new NFTs,
 * and handles the transition between inactive and active states.
 * Acts as the primary entry point for user interaction with the system.
 *
 * @param {string} address - User's Ethereum address
 * @param {boolean} triggerMint - Whether to trigger NFT minting for this update
 * @returns {Object} Updated user data including activity timestamps
 */
async function updateUserHeartbeat(address, triggerMint = true) {
  const users = dataModel.getLoggedUsers();
  const normalizedAddress = address.toLowerCase();
  const now = Date.now();

  // Check if this is a new login or a returning user
  const isFirstLogin = !users[normalizedAddress];
  const wasInactive =
    users[normalizedAddress] &&
    now - users[normalizedAddress].lastActive >
      contractConfig.getUserInactivitySeconds() * 1000;

  // Initialize or update user data
  if (!users[normalizedAddress]) {
    users[normalizedAddress] = {
      lastActive: now,
      lastMintTime: 0, // We'll mint immediately for new users
    };
  } else {
    users[normalizedAddress].lastActive = now;
  }

  // Save updated user data
  dataModel.saveLoggedUsers(users);

  // Mint NFTs if this is a new login or the user was inactive
  if (triggerMint && (isFirstLogin || wasInactive)) {
    console.log(
      `Triggering mint for user ${normalizedAddress} (new: ${isFirstLogin}, returning after inactivity: ${wasInactive})`
    );
    await nftService.mintNFTsForUser(normalizedAddress);
  }

  return users[normalizedAddress];
}

/**
 * Removes a user and their associated data from the system
 *
 * Handles the complete removal of a user including all tracking data.
 * Typically called when a user explicitly logs out or is purged after
 * extended inactivity.
 *
 * @param {string} address - User's Ethereum address
 * @returns {boolean} Success status of the operation
 */
function removeUser(address) {
  const users = dataModel.getLoggedUsers();
  delete users[address.toLowerCase()];
  dataModel.saveLoggedUsers(users);
}

/**
 * Evaluates when to mint additional NFTs for a user
 *
 * Compares the elapsed time since last mint operation against the
 * configured mint interval to determine if new NFTs should be minted.
 * Central to the per-user minting cycle implementation.
 *
 * @param {string} address - User's Ethereum address
 */
async function checkAndMintForUser(address) {
  const users = dataModel.getLoggedUsers();
  const normalizedAddress = address.toLowerCase();

  if (!users[normalizedAddress]) return;

  const now = Date.now();
  const mintInterval = contractConfig.getMintIntervalSeconds() * 1000;
  const lastMintTime = users[normalizedAddress].lastMintTime || 0;

  // Check if it's time to mint more NFTs for this user
  if (now - lastMintTime >= mintInterval) {
    // Time to mint more NFTs
    console.log(
      `Minting interval reached for user ${normalizedAddress}, minting more NFTs`
    );
    await nftService.mintNFTsForUser(normalizedAddress);
  }
}

/**
 * Removes inactive users from the system
 *
 * Identifies users whose last activity exceeds the inactivity threshold
 * and removes them from the active user list. Essential for maintaining
 * system performance and resource utilization.
 *
 * @returns {Object} Results of the cleanup operation
 */
function checkOfflineUsers() {
  const users = dataModel.getLoggedUsers();
  const now = Date.now();
  const inactivityThreshold = contractConfig.getUserInactivitySeconds() * 1000;
  let changed = false;

  for (const [address, data] of Object.entries(users)) {
    if (now - data.lastActive > inactivityThreshold) {
      console.log(
        `User ${address} considered offline (last active: ${new Date(
          data.lastActive
        )}, threshold: ${inactivityThreshold / 1000}s)`
      );
      delete users[address];
      changed = true;
    }
  }

  if (changed) dataModel.saveLoggedUsers(users);
}

/**
 * Records the time when a user last received NFTs
 *
 * Updates the minting timestamp to track when users should next
 * receive NFTs based on the configured minting interval.
 *
 * @param {string} address - User's Ethereum address
 */
function updateUserLastMintTime(address) {
  const users = dataModel.getLoggedUsers();
  const normalizedAddress = address.toLowerCase();

  if (users[normalizedAddress]) {
    users[normalizedAddress].lastMintTime = Date.now();
    dataModel.saveLoggedUsers(users);
  }
}

/**
 * Initializes the user-specific minting cycle system
 *
 * Sets up the periodic checking of all active users to determine
 * if they should receive additional NFTs. Core component of the
 * auto-minting functionality.
 */
function startUserMintingCycles() {
  // Check every minute if any active users need more NFTs
  setInterval(() => {
    const users = dataModel.getLoggedUsers();

    Object.keys(users).forEach((address) => {
      checkAndMintForUser(address).catch((err) => {
        console.error(`Error checking minting for user ${address}:`, err);
      });
    });
  }, 60 * 1000); // Check every minute

  console.log("Started user-specific minting cycles");
}

module.exports = {
  updateUserHeartbeat,
  removeUser,
  checkOfflineUsers,
  updateUserLastMintTime,
  startUserMintingCycles,
};
