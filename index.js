// index.js
require("dotenv").config();
const app = require("./src/app");

// Set default port
const PORT = process.env.PORT || 3000;

// Start server
app.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════════════════════╗
  ║                                                    ║
  ║   🍌 Banana NFT Backend Server                     ║
  ║                                                    ║
  ║   Server running on port ${PORT}                     ║
  ║   Environment: ${
    process.env.NODE_ENV || "development"
  }                      ║
  ║                                                    ║
  ║   API Endpoints:                                   ║
  ║   - /api/nft                                       ║
  ║   - /api/users                                     ║
  ║   - /health                                        ║
  ║                                                    ║
  ╚════════════════════════════════════════════════════╝
  `);
});
