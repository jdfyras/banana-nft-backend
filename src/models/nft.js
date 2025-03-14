const dataModel = require("./data");
const { ethers } = require("ethers");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

/**
 * Select a random URI based on the configured weights
 * @returns {string} The selected URI
 */
function getRandomURI() {
  const urisData = dataModel.getURIDistribution();
  const entries = Object.entries(urisData);
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
  const rand = Math.random() * totalWeight;
  let cumulative = 0;
  for (const [uri, weight] of entries) {
    cumulative += weight;
    if (rand < cumulative) {
      return uri;
    }
  }
  // Fallback in case of rounding error.
  return entries[entries.length - 1][0];
}

/**
 * Generate an array of token IDs from a range
 * @param {number} startId - Starting token ID
 * @param {number} count - Number of tokens
 * @returns {Array} - Array of token IDs
 */
function generateTokenIdsFromRange(startId, count) {
  return Array.from({ length: count }, (_, i) => startId + i);
}

/**
 * Generate Merkle tree leaves for a range of token IDs
 * @param {number} startTokenId - Starting token ID
 * @param {number} count - Number of tokens
 * @param {Object} uris - Mapping of token IDs to URIs
 * @returns {Array} - Array of leaf hashes
 */
function generateLeaves(startTokenId, count, uris) {
  const leaves = [];
  for (let i = 0; i < count; i++) {
    const tokenId = startTokenId + i;
    const uri = uris[tokenId];
    if (!uri) {
      throw new Error(`URI not found for token ID ${tokenId}`);
    }

    // Only hash the token ID itself, not the URI
    // This matches the contract's expectation
    const tokenIdStr = tokenId.toString();
    const leaf = keccak256(Buffer.from(tokenIdStr));
    leaves.push(leaf);
  }
  return leaves;
}

/**
 * Find the batch that contains a specific token ID for a user
 * @param {string} userAddress - User's Ethereum address
 * @param {number} tokenId - Token ID to lookup
 * @returns {Object|null} - Batch object if found, null otherwise
 */
function findBatchForToken(userAddress, tokenId) {
  const batches = dataModel.getBatches();
  return batches.find((batch) => {
    if (batch.user !== userAddress.toLowerCase()) return false;
    const [startId, count] = batch.tokenIdRange;
    return tokenId >= startId && tokenId < startId + count;
  });
}

module.exports = {
  getRandomURI,
  generateTokenIdsFromRange,
  generateLeaves,
  findBatchForToken,
};
