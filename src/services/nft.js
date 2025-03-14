const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");
const { ethers } = require("ethers");
const dataModel = require("../models/data");
const nftModel = require("../models/nft");
const contractConfig = require("../config/contract");

// Import user model only for updateUserLastMintTime function
// to avoid circular dependency
let userModel;
setTimeout(() => {
  userModel = require("../models/users");
}, 0);

/**
 * Mint new NFTs for a user
 *
 * Creates new NFTs, generates a Merkle tree for verification,
 * and records the minting data for future revealing.
 *
 * @param {string} userAddress - User's Ethereum address
 * @param {number} quantity - Number of NFTs to mint
 * @returns {Object} Minting result with token IDs and transaction hash
 */
async function mintNFTs(userAddress, quantity) {
  try {
    // Normalize user address
    const normalizedAddress = userAddress.toLowerCase();

    // Get current minted NFT data
    const mintedData = dataModel.getMintedNFTData();
    const tokenURIs = dataModel.getTokenURIs();

    // Cap quantity to max NFTs per user if specified in env
    const maxNFTsPerUser = contractConfig.getNFTsPerUser();
    if (quantity > maxNFTsPerUser) {
      console.log(
        `Limiting mint quantity from ${quantity} to ${maxNFTsPerUser}`
      );
      quantity = maxNFTsPerUser;
    }

    // Calculate new token IDs
    const startTokenId = mintedData.lastTokenId + 1;
    const endTokenId = startTokenId + quantity - 1;

    // Generate URIs for new tokens
    for (let tokenId = startTokenId; tokenId <= endTokenId; tokenId++) {
      tokenURIs[tokenId] = nftModel.getRandomURI();
    }

    // Generate leaves for Merkle tree
    const leaves = nftModel.generateLeaves(startTokenId, quantity, tokenURIs);

    // Create Merkle tree
    const merkleTree = new MerkleTree(leaves, keccak256, { sort: true });
    const merkleRoot = merkleTree.getHexRoot();

    // Call contract to mint NFTs
    const tx = await contractConfig.contract.mintWithMerkle(
      merkleRoot,
      normalizedAddress,
      quantity
    );

    // Wait for transaction to be mined
    const receipt = await tx.wait();

    // Update local data
    // 1. Update minted NFTs data
    if (!mintedData.users[normalizedAddress]) {
      mintedData.users[normalizedAddress] = [];
    }

    // Add the new range to the user's tokens
    mintedData.users[normalizedAddress].push([startTokenId, quantity]);
    mintedData.lastTokenId = endTokenId;

    // 2. Add batch data with current timestamp
    const batches = dataModel.getBatches();
    batches.push({
      user: normalizedAddress,
      tokenIdRange: [startTokenId, quantity],
      merkleRoot,
      timestamp: Math.floor(Date.now() / 1000), // Current time in seconds
    });

    // Save updated data
    dataModel.saveMintedNFTData(mintedData);
    dataModel.saveBatches(batches);
    dataModel.saveTokenURIs(tokenURIs);

    // Update user's last mint time
    if (userModel) {
      userModel.updateUserLastMintTime(normalizedAddress);
    }

    // Calculate reveal expiration
    const revealThreshold = await contractConfig.getRevealThreshold();
    const expiresAt = new Date(
      (Math.floor(Date.now() / 1000) + revealThreshold) * 1000
    );

    return {
      success: true,
      startTokenId,
      endTokenId,
      quantity,
      transactionHash: receipt.hash,
      revealExpiresAt: expiresAt.toISOString(),
      revealThresholdSeconds: revealThreshold,
    };
  } catch (error) {
    console.error("Error minting NFTs:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Mint NFTs specifically for a user based on their address
 *
 * Handles the business logic for determining how many NFTs to mint
 * and when to mint them based on user activity patterns.
 *
 * @param {string} userAddress - Ethereum address of the user
 * @returns {Object} Result of the minting operation
 */
async function mintNFTsForUser(userAddress) {
  try {
    const normalizedAddress = userAddress.toLowerCase();
    const nftsPerUser = contractConfig.getNFTsPerUser();

    console.log(`Minting ${nftsPerUser} NFTs for user ${normalizedAddress}`);
    const result = await mintNFTs(normalizedAddress, nftsPerUser);

    return {
      success: result.success,
      address: normalizedAddress,
      result,
    };
  } catch (error) {
    console.error(`Error minting NFTs for user ${userAddress}:`, error);
    return {
      success: false,
      error: error.message,
      address: userAddress,
    };
  }
}

/**
 * Reveal an NFT by providing its URI and Merkle proof
 *
 * Generates the necessary Merkle proof for the token ID and submits
 * it to the contract for verification, making the metadata accessible.
 *
 * @param {string} userAddress - Owner's Ethereum address
 * @param {number} tokenId - Token ID to reveal
 * @returns {Object} Reveal result with URI and transaction details
 */
async function revealNFT(userAddress, tokenId) {
  try {
    // Normalize user address
    const normalizedAddress = userAddress.toLowerCase();

    // Find the batch for this token
    const batch = nftModel.findBatchForToken(normalizedAddress, tokenId);
    if (!batch) {
      return {
        success: false,
        error: "Token not found or not owned by user",
      };
    }

    // Check if the token is still within the reveal window
    const revealThreshold = await contractConfig.getRevealThreshold();
    const now = Math.floor(Date.now() / 1000); // Current time in seconds
    if (now - batch.timestamp > revealThreshold) {
      return {
        success: false,
        error: "Reveal period has expired for this token",
        timeElapsed: now - batch.timestamp,
        revealThreshold,
      };
    }

    // Get the token URI
    const tokenURIs = dataModel.getTokenURIs();
    const uri = tokenURIs[tokenId];
    if (!uri) {
      return {
        success: false,
        error: "URI not found for token",
      };
    }

    // Generate Merkle proof
    const [startId, count] = batch.tokenIdRange;
    const leaves = nftModel.generateLeaves(startId, count, tokenURIs);
    const merkleTree = new MerkleTree(leaves, keccak256, { sort: true });

    // Find the index of this token in the batch
    const tokenIndex = tokenId - startId;
    const leaf = leaves[tokenIndex];
    const proof = merkleTree.getHexProof(leaf);

    // Find the batch index
    const batches = dataModel.getBatches();
    const rootIndex = batches.findIndex(
      (b) => b.merkleRoot === batch.merkleRoot
    );

    // Call contract to reveal NFT
    const tx = await contractConfig.contract.reveal(
      tokenId,
      rootIndex,
      proof,
      uri
    );

    // Wait for transaction to be mined
    const receipt = await tx.wait();

    // Calculate remaining time for other tokens in this batch
    const timeRemaining = revealThreshold - (now - batch.timestamp);
    const expiresAt = new Date((now + timeRemaining) * 1000);

    return {
      success: true,
      tokenId,
      uri,
      transactionHash: receipt.hash,
      batchExpiresAt: expiresAt.toISOString(),
      timeRemainingSeconds: timeRemaining,
    };
  } catch (error) {
    console.error("Error revealing NFT:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get all NFTs owned by a user
 *
 * Retrieves the complete list of tokens owned by the user,
 * and filters which ones are currently eligible for revealing.
 *
 * @param {string} userAddress - User's Ethereum address
 * @returns {Object} NFT data including tokenIds and revealable tokens
 */
async function getUserNFTs(userAddress) {
  const normalizedAddress = userAddress.toLowerCase();
  const mintedData = dataModel.getMintedNFTData();
  const revealThreshold = await contractConfig.getRevealThreshold();
  const now = Math.floor(Date.now() / 1000);

  if (!mintedData.users[normalizedAddress]) {
    return { tokenIds: [], revealableTokenIds: [] };
  }

  // Get all batches for this user
  const batches = dataModel
    .getBatches()
    .filter((batch) => batch.user === normalizedAddress);

  // Convert ranges to full token ID arrays
  const tokenIds = [];
  const revealableTokenIds = [];

  mintedData.users[normalizedAddress].forEach(([startId, count]) => {
    for (let i = 0; i < count; i++) {
      const tokenId = startId + i;
      tokenIds.push(tokenId);

      // Check if this token is still revealable
      const batch = batches.find((b) => {
        const [batchStartId, batchCount] = b.tokenIdRange;
        return tokenId >= batchStartId && tokenId < batchStartId + batchCount;
      });

      if (batch && now - batch.timestamp < revealThreshold) {
        revealableTokenIds.push(tokenId);
      }
    }
  });

  return {
    tokenIds,
    revealableTokenIds,
    revealThresholdSeconds: revealThreshold,
  };
}

module.exports = {
  mintNFTs,
  mintNFTsForUser,
  revealNFT,
  getUserNFTs,
};
