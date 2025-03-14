const express = require("express");
const router = express.Router();
const userModel = require("../models/users");
const dataModel = require("../models/data");
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

  next();
}

/**
 * GET /users - Get all active users
 */
router.get("/", (req, res) => {
  const users = dataModel.getLoggedUsers();
  const inactivityThreshold = contractConfig.getUserInactivitySeconds() * 1000;
  const now = Date.now();

  // Format the response
  const formattedUsers = Object.entries(users).map(([address, data]) => ({
    address,
    lastActive: new Date(data.lastActive).toISOString(),
    lastMintTime: data.lastMintTime
      ? new Date(data.lastMintTime).toISOString()
      : null,
    isActive: now - data.lastActive < inactivityThreshold,
    inactiveInSeconds: Math.max(0, Math.floor((now - data.lastActive) / 1000)),
  }));

  res.json({
    success: true,
    users: formattedUsers,
    count: formattedUsers.length,
    inactivityThresholdSeconds: contractConfig.getUserInactivitySeconds(),
  });
});

/**
 * POST /users/heartbeat - Update user heartbeat and potentially trigger minting
 */
router.post("/heartbeat", validateAddress, async (req, res) => {
  const { address } = req.body;
  const triggerMint = req.body.triggerMint !== false; // Default to true

  const userData = await userModel.updateUserHeartbeat(address, triggerMint);

  res.json({
    success: true,
    address,
    lastActive: new Date(userData.lastActive).toISOString(),
    lastMintTime: userData.lastMintTime
      ? new Date(userData.lastMintTime).toISOString()
      : null,
    timestamp: Date.now(),
    mintingTriggered: triggerMint,
  });
});

/**
 * DELETE /users/:address - Remove a user
 */
router.delete("/:address", validateAddress, async (req, res) => {
  const address = req.params.address;

  // Run cleanup for this user first
  await cleanupService.runUserCleanup(address);

  // Then remove the user
  userModel.removeUser(address);

  res.json({
    success: true,
    address,
    message: "User removed successfully",
  });
});

/**
 * GET /users/cleanup - Clean up inactive users
 */
router.get("/cleanup", (req, res) => {
  // In a real app, you would add authentication here
  const beforeCount = Object.keys(dataModel.getLoggedUsers()).length;

  userModel.checkOfflineUsers();

  const afterCount = Object.keys(dataModel.getLoggedUsers()).length;

  res.json({
    success: true,
    removedCount: beforeCount - afterCount,
    remainingCount: afterCount,
    inactivityThresholdSeconds: contractConfig.getUserInactivitySeconds(),
  });
});

module.exports = router;
