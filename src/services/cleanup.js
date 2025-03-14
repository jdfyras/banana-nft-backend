const dataModel = require("../models/data");
const contractConfig = require("../config/contract");

/**
 * Cleans up batches that have exceeded the reveal threshold
 *
 * Identifies and removes batch records that are no longer valid for revealing.
 * Handles backward compatibility by adding timestamps to legacy batch records.
 *
 * @returns {number} Number of batches removed during cleanup
 */
async function cleanupExpiredBatches() {
  const batches = dataModel.getBatches();
  const revealThreshold = await contractConfig.getRevealThreshold();
  const now = Math.floor(Date.now() / 1000); // Current time in seconds

  // Add timestamps to batches that don't have them (for backwards compatibility)
  batches.forEach((batch) => {
    if (!batch.timestamp) {
      batch.timestamp = now - (revealThreshold + 60); // Assume it's expired
      console.log(`Added timestamp to batch for ${batch.user}`);
    }
  });

  const validBatches = batches.filter((batch) => {
    // Keep batches that are still within the reveal window
    return now - batch.timestamp < revealThreshold;
  });

  const removedCount = batches.length - validBatches.length;

  if (removedCount > 0) {
    console.log(`Cleaned up ${removedCount} expired batches`);
    dataModel.saveBatches(validBatches);
  }

  return removedCount;
}

/**
 * Removes token URIs that are no longer needed
 *
 * Identifies token URIs that belong to expired batches and removes them
 * to prevent storage bloat. Only URIs for tokens in valid batches are kept.
 *
 * @returns {number} Number of token URIs removed during cleanup
 */
async function cleanupExpiredTokenURIs() {
  const tokenURIs = dataModel.getTokenURIs();
  const batches = dataModel.getBatches();
  const revealThreshold = await contractConfig.getRevealThreshold();
  const now = Math.floor(Date.now() / 1000); // Current time in seconds

  // Create a set of all token IDs that are still within valid batches
  const validTokenIds = new Set();
  batches.forEach((batch) => {
    if (now - (batch.timestamp || 0) < revealThreshold) {
      const [startId, count] = batch.tokenIdRange;
      for (let i = 0; i < count; i++) {
        validTokenIds.add(String(startId + i));
      }
    }
  });

  // Filter the token URIs to keep only those with valid token IDs
  const initialCount = Object.keys(tokenURIs).length;
  const cleanedTokenURIs = {};

  Object.entries(tokenURIs).forEach(([tokenId, uri]) => {
    if (validTokenIds.has(tokenId)) {
      cleanedTokenURIs[tokenId] = uri;
    }
  });

  const removedCount = initialCount - Object.keys(cleanedTokenURIs).length;

  if (removedCount > 0) {
    console.log(`Cleaned up ${removedCount} expired token URIs`);
    dataModel.saveTokenURIs(cleanedTokenURIs);
  } else if (initialCount > 0) {
    // Log that we checked but found no URIs to clean up
    console.log(`Checked ${initialCount} token URIs, none expired`);
  }

  return removedCount;
}

/**
 * Performs batch cleanup for a specific user
 *
 * Focuses cleanup on a single user's batches rather than the entire dataset,
 * allowing for more targeted and frequent cleanup operations.
 *
 * @param {string} userAddress - Ethereum address of the user
 * @returns {number} Number of batches removed for the user
 */
async function cleanupUserBatches(userAddress) {
  const batches = dataModel.getBatches();
  const revealThreshold = await contractConfig.getRevealThreshold();
  const now = Math.floor(Date.now() / 1000); // Current time in seconds
  const normalizedAddress = userAddress.toLowerCase();

  // Filter batches for this user
  const userBatches = batches.filter(
    (batch) => batch.user === normalizedAddress
  );

  if (userBatches.length === 0) {
    return 0;
  }

  // Add timestamps for backwards compatibility
  userBatches.forEach((batch) => {
    if (!batch.timestamp) {
      batch.timestamp = now - (revealThreshold + 60); // Assume it's expired
      console.log(`Added timestamp to batch for user ${normalizedAddress}`);
    }
  });

  // Keep track of which batches to remove
  const batchesToRemove = userBatches.filter(
    (batch) => now - batch.timestamp >= revealThreshold
  );

  if (batchesToRemove.length === 0) {
    return 0;
  }

  // Get the merkle roots of the batches to remove
  const rootsToRemove = new Set(
    batchesToRemove.map((batch) => batch.merkleRoot)
  );

  // Filter out the expired batches
  const updatedBatches = batches.filter(
    (batch) =>
      batch.user !== normalizedAddress || // Keep all batches from other users
      !rootsToRemove.has(batch.merkleRoot) // And keep this user's unexpired batches
  );

  // Save updated batches
  dataModel.saveBatches(updatedBatches);

  console.log(
    `Cleaned up ${batchesToRemove.length} expired batches for user ${normalizedAddress}`
  );
  return batchesToRemove.length;
}

/**
 * Executes a complete global cleanup of expired data
 *
 * Runs all cleanup operations to remove expired batches and unneeded token URIs.
 * This is typically scheduled to run periodically.
 *
 * @returns {Object} Results of the cleanup operation
 */
async function runCleanup() {
  try {
    const batchesRemoved = await cleanupExpiredBatches();
    const urisRemoved = await cleanupExpiredTokenURIs();

    return {
      batchesRemoved,
      urisRemoved,
      success: true,
      revealThreshold: await contractConfig.getRevealThreshold(),
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error during cleanup:", error);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Executes cleanup operations for a specific user
 *
 * Combines user-specific batch cleanup with global token URI cleanup
 * to maintain data integrity for the specified user.
 *
 * @param {string} userAddress - Ethereum address of the user
 * @returns {Object} Results of the user-specific cleanup operation
 */
async function runUserCleanup(userAddress) {
  try {
    const batchesRemoved = await cleanupUserBatches(userAddress);
    // We still run global token URI cleanup as it's more efficient
    const urisRemoved = await cleanupExpiredTokenURIs();

    return {
      batchesRemoved,
      urisRemoved,
      success: true,
      user: userAddress,
      revealThreshold: await contractConfig.getRevealThreshold(),
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`Error during cleanup for user ${userAddress}:`, error);
    return {
      success: false,
      error: error.message,
      user: userAddress,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Schedules periodic cleanup operations
 *
 * Sets up an interval to run cleanup operations automatically,
 * maintaining system performance and storage efficiency.
 *
 * @param {number} intervalMinutes - Time between cleanup operations in minutes
 */
function scheduleCleanup(intervalMinutes = 60) {
  // Run cleanup immediately on startup
  runCleanup().then((result) => {
    console.log(
      `Initial cleanup complete: ${result.batchesRemoved} batches and ${result.urisRemoved} URIs removed`
    );
  });

  // Schedule periodic cleanup
  const intervalMs = intervalMinutes * 60 * 1000;
  setInterval(runCleanup, intervalMs);

  console.log(`Scheduled automatic cleanup every ${intervalMinutes} minutes`);
}

module.exports = {
  cleanupExpiredBatches,
  cleanupExpiredTokenURIs,
  cleanupUserBatches,
  runCleanup,
  runUserCleanup,
  scheduleCleanup,
};
