const fs = require("fs");
const paths = require("../config/paths");

/**
 * Read a JSON file and parse its contents
 * @param {string} filePath - Path to the JSON file
 * @returns {Object} - Parsed JSON data
 */
function readJSON(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    // Handle empty files
    if (content.trim() === "") {
      // Return appropriate default based on expected structure
      if (filePath === paths.LOGGED_USERS_FILE) return {};
      if (filePath === paths.MINTED_NFTS_FILE)
        return { lastTokenId: 0, users: {} };
      if (filePath === paths.BATCHES_FILE) return [];
      if (filePath === paths.TOKEN_URIS_FILE) return {};
      return {};
    }
    return JSON.parse(content);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    // Return appropriate default structure
    if (filePath === paths.LOGGED_USERS_FILE) return {};
    if (filePath === paths.MINTED_NFTS_FILE)
      return { lastTokenId: 0, users: {} };
    if (filePath === paths.BATCHES_FILE) return [];
    if (filePath === paths.TOKEN_URIS_FILE) return {};
    return {};
  }
}

/**
 * Write data to a JSON file
 * @param {string} filePath - Path to the JSON file
 * @param {Object} data - Data to write
 */
function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

/**
 * Initialize JSON files with default values if they don't exist
 */
function initFiles() {
  const defaults = {
    [paths.LOGGED_USERS_FILE]: "{}",
    [paths.MINTED_NFTS_FILE]: JSON.stringify({ lastTokenId: 0, users: {} }),
    [paths.BATCHES_FILE]: "[]",
    [paths.URIS_FILE]: JSON.stringify({}),
    [paths.TOKEN_URIS_FILE]: "{}", // File to store token URIs separately
  };

  Object.entries(defaults).forEach(([path, content]) => {
    if (!fs.existsSync(path)) {
      fs.writeFileSync(path, content, "utf8");
    }
  });
}

// Initialize files on module load
initFiles();

module.exports = {
  readJSON,
  writeJSON,
  getMintedNFTData: () => readJSON(paths.MINTED_NFTS_FILE),
  saveMintedNFTData: (data) => writeJSON(paths.MINTED_NFTS_FILE, data),
  getBatches: () => readJSON(paths.BATCHES_FILE),
  saveBatches: (data) => writeJSON(paths.BATCHES_FILE, data),
  getTokenURIs: () => readJSON(paths.TOKEN_URIS_FILE),
  saveTokenURIs: (data) => writeJSON(paths.TOKEN_URIS_FILE, data),
  getURIDistribution: () => readJSON(paths.URIS_FILE),
  saveURIDistribution: (data) => writeJSON(paths.URIS_FILE, data),
  getLoggedUsers: () => readJSON(paths.LOGGED_USERS_FILE),
  saveLoggedUsers: (data) => writeJSON(paths.LOGGED_USERS_FILE, data),
};
