const express = require("express");
const morgan = require("morgan");
const nftRoutes = require("./routes/nft");
const userRoutes = require("./routes/users");
const cleanupService = require("./services/cleanup");
const userModel = require("./models/users");

// Create Express app
const app = express();

// Middleware
app.use(morgan("dev")); // Request logging
app.use(express.json()); // Parse JSON request bodies

// Routes
app.use("/api/nft", nftRoutes);
app.use("/api/users", userRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: "Internal Server Error",
    message: process.env.NODE_ENV === "production" ? null : err.message,
  });
});

// Schedule global cleanup tasks
cleanupService.scheduleCleanup(60); // Run cleanup every 60 minutes

// Schedule user cleanup
setInterval(userModel.checkOfflineUsers, 60 * 1000); // Check for offline users every minute

// Start user-specific minting cycles
userModel.startUserMintingCycles();

module.exports = app;
