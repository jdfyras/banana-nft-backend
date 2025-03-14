const path = require("path");

// File Paths Configuration
const DATA_DIR = path.join(__dirname, "../../data");

// Ensure data directory exists
if (!require("fs").existsSync(DATA_DIR)) {
  require("fs").mkdirSync(DATA_DIR);
}

module.exports = {
  DATA_DIR,
  // JSON database files
  LOGGED_USERS_FILE: path.join(DATA_DIR, "loggedUsers.json"),
  MINTED_NFTS_FILE: path.join(DATA_DIR, "mintedNFTs.json"),
  BATCHES_FILE: path.join(DATA_DIR, "batches.json"),
  URIS_FILE: path.join(DATA_DIR, "designs_distribution.json"),
  TOKEN_URIS_FILE: path.join(DATA_DIR, "token_uris.json"),
};
