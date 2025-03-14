const express = require("express");
const router = express.Router();
const nftService = require("../services/nft");
const userModel = require("../models/users");
const cleanupService = require("../services/cleanup");
const contractConfig = require("../config/contract");

/**
 * Middleware to validate Ethereum address
 */
function validateAddress(req, res, next) {
  const address = req.params.address || req.body.address;

  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return res.status(400).json({
      success: false,
      error: "Invalid Ethereum address",
    });
  }

  // Update user heartbeat
  userModel.updateUserHeartbeat(address);

  next();
}

/**
 * GET /nft/config - Get NFT configuration
 * This endpoint doesn't require address validation
 */
router.get("/config", async (req, res) => {
  const revealThreshold = await contractConfig.getRevealThreshold();
  const nftsPerUser = contractConfig.getNFTsPerUser();
  const mintIntervalSeconds = contractConfig.getMintIntervalSeconds();
  const userInactivitySeconds = contractConfig.getUserInactivitySeconds();

  res.json({
    success: true,
    revealThresholdSeconds: revealThreshold,
    nftsPerUser,
    mintIntervalSeconds,
    userInactivitySeconds,
  });
});

/**
 * GET /nft/cleanup - Run global cleanup operations
 */
router.get("/cleanup", async (req, res) => {
  // In a real app, you would add authentication here
  const result = await cleanupService.runCleanup();
  res.json(result);
});

/**
 * GET /nft/cleanup/:address - Run cleanup operations for a specific user
 */
router.get("/cleanup/:address", validateAddress, async (req, res) => {
  const address = req.params.address;
  const result = await cleanupService.runUserCleanup(address);
  res.json(result);
});

/**
 * GET /nft/mint-for-user/:address - Trigger minting for a specific user
 */
router.get("/mint-for-user/:address", validateAddress, async (req, res) => {
  const address = req.params.address;
  const result = await nftService.mintNFTsForUser(address);
  res.json(result);
});

/**
 * POST /nft/mint - Mint new NFTs
 */
router.post("/mint", validateAddress, async (req, res) => {
  const { address, quantity } = req.body;

  // Get max NFTs per user from config
  const maxNFTsPerUser = contractConfig.getNFTsPerUser();

  if (!quantity || quantity < 1) {
    return res.status(400).json({
      success: false,
      error: `Invalid quantity. Must be at least 1.`,
    });
  }

  if (quantity > maxNFTsPerUser) {
    console.log(
      `Requested quantity ${quantity} exceeds max ${maxNFTsPerUser}, will be limited.`
    );
  }

  const result = await nftService.mintNFTs(address, quantity);
  res.json(result);
});

/**
 * POST /nft/reveal - Reveal an NFT
 */
router.post("/reveal", validateAddress, async (req, res) => {
  const { address, tokenId } = req.body;

  if (!tokenId || isNaN(tokenId)) {
    return res.status(400).json({
      success: false,
      error: "Invalid token ID",
    });
  }

  const result = await nftService.revealNFT(address, parseInt(tokenId));
  res.json(result);
});

/**
 * GET /nft/:address - Get all NFTs owned by a user
 * This wildcard route should be at the end to avoid catching other routes
 */
router.get("/:address", validateAddress, async (req, res) => {
  const address = req.params.address;
  const nftData = await nftService.getUserNFTs(address);

  res.json({
    success: true,
    address,
    ...nftData,
  });
});

module.exports = router;
