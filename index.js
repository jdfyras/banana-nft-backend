// index.js
require("dotenv").config();

// ==============================
// Required Packages and Modules
// ==============================
const express = require("express");
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

// ==============================
// File Paths (JSON "database" files)
// ==============================
const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

const LOGGED_USERS_FILE = path.join(DATA_DIR, "loggedUsers.json");
const MINTED_NFTS_FILE = path.join(DATA_DIR, "mintedNFTs.json");
const BATCHES_FILE = path.join(DATA_DIR, "batches.json");
const URIS_FILE = path.join(DATA_DIR, "designs_distribution.json");

// =====================================
// Initialize JSON files if not present
// =====================================
function initFiles() {
  if (!fs.existsSync(LOGGED_USERS_FILE)) {
    fs.writeFileSync(LOGGED_USERS_FILE, JSON.stringify({}), "utf8");
  }
  if (!fs.existsSync(MINTED_NFTS_FILE)) {
    // mintedNFTs.json holds a lastTokenId counter and mapping from user addresses to tokenIds.
    fs.writeFileSync(
      MINTED_NFTS_FILE,
      JSON.stringify({ lastTokenId: 0, users: {} }),
      "utf8"
    );
  }
  if (!fs.existsSync(BATCHES_FILE)) {
    // batches.json will store each minted batch with its merkle tree data.
    fs.writeFileSync(BATCHES_FILE, JSON.stringify([]), "utf8");
  }
  if (!fs.existsSync(URIS_FILE)) {
    // Sample weighted URIs file. Adjust the values as needed.
    console.error("Please set URIs file in designs_distribution.json");
    process.exit(1);
  }
}
initFiles();

// ==============================
// Helper Functions for File I/O
// ==============================
function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}
function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

// ==========================================
// Weighted Random Selection for NFT URIs
// ==========================================
function getRandomURI() {
  const urisData = readJSON(URIS_FILE);
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

// ==========================================
// Helper Functions to Manage Logged-in Users
// ==========================================
function updateUserHeartbeat(address) {
  const users = readJSON(LOGGED_USERS_FILE);
  users[address.toLowerCase()] = { lastActive: Date.now() };
  writeJSON(LOGGED_USERS_FILE, users);
}

function removeUser(address) {
  const users = readJSON(LOGGED_USERS_FILE);
  delete users[address.toLowerCase()];
  writeJSON(LOGGED_USERS_FILE, users);
}

// This function runs every minute to remove users inactive for over 5 minutes.
function checkOfflineUsers() {
  const users = readJSON(LOGGED_USERS_FILE);
  const now = Date.now();
  let changed = false;
  for (const [address, data] of Object.entries(users)) {
    if (now - data.lastActive > 5 * 60 * 1000) {
      console.log(
        `User ${address} considered offline (last active: ${new Date(
          data.lastActive
        )})`
      );
      delete users[address];
      changed = true;
    }
  }
  if (changed) writeJSON(LOGGED_USERS_FILE, users);
}

// ==========================================
// Helper Functions for Minted NFTs and Batches
// ==========================================
function getMintedNFTData() {
  return readJSON(MINTED_NFTS_FILE);
}
function saveMintedNFTData(data) {
  writeJSON(MINTED_NFTS_FILE, data);
}
function getBatches() {
  return readJSON(BATCHES_FILE);
}
function saveBatches(data) {
  writeJSON(BATCHES_FILE, data);
}

// ==========================================
// Ethers.js: Setup Provider, Wallet & Contract
// ==========================================
if (
  !process.env.RPC_URL ||
  !process.env.PRIVATE_KEY ||
  !process.env.CONTRACT_ADDRESS
) {
  console.error(
    "Please set RPC_URL, PRIVATE_KEY, and CONTRACT_ADDRESS in your environment variables."
  );
  process.exit(1);
}
const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// Minimal ABI including the functions we need (mintWithMerkle and reveal)
const contractABI = [
  "function mintWithMerkle(bytes32 _merkleRoot, address _user, uint256 _quantity) external",
  "function reveal(uint256 tokenId, uint256 rootIndex, bytes32[] calldata merkleProof, string calldata _uri) external",
];
const contract = new ethers.Contract(
  process.env.CONTRACT_ADDRESS,
  contractABI,
  wallet
);

// ==========================================
// Scheduled Job: Mint NFT Batches Every 5 Minutes
// ==========================================
async function mintBatches() {
  const loggedUsers = readJSON(LOGGED_USERS_FILE);
  const mintedData = getMintedNFTData();
  const batches = getBatches();

  for (const userAddress of Object.keys(loggedUsers)) {
    const batchTokenIds = [];
    const leaves = [];
    const chosenURIs = [];
    const startTokenId = mintedData.lastTokenId + 1;

    // For each of 50 NFTs in the batch:
    for (let i = 0; i < 50; i++) {
      const tokenId = startTokenId + i;
      const uri = getRandomURI();
      chosenURIs.push(uri);
      // Compute leaf: keccak256(abi.encodePacked(tokenId, uri))
      const encoded = ethers.utils.solidityPack(
        ["uint256", "string"],
        [tokenId, uri]
      );
      const leaf = ethers.utils.keccak256(encoded);
      leaves.push(leaf);
      batchTokenIds.push(tokenId);
    }

    // Build Merkle Tree (using sortPairs for consistency with the contract’s expected tree)
    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    const merkleRoot = tree.getHexRoot();

    console.log(
      `Minting batch for ${userAddress}. TokenIDs: ${batchTokenIds[0]} - ${
        batchTokenIds[batchTokenIds.length - 1]
      }`
    );
    try {
      // Call contract mint function
      const tx = await contract.mintWithMerkle(merkleRoot, userAddress, 50);
      await tx.wait();
      console.log(`Mint tx confirmed for ${userAddress}`);
    } catch (err) {
      console.error(`Error minting for ${userAddress}:`, err);
      continue;
    }

    // Update local minted NFT data
    if (!mintedData.users[userAddress.toLowerCase()]) {
      mintedData.users[userAddress.toLowerCase()] = [];
    }
    mintedData.users[userAddress.toLowerCase()] =
      mintedData.users[userAddress.toLowerCase()].concat(batchTokenIds);
    mintedData.lastTokenId += 50;

    // Create a batch record with details needed for reveal.
    // We assume that the contract’s merkleRoots array index is the same as our batches array index.
    const batchRecord = {
      batchId: batches.length, // using array index as rootIndex
      user: userAddress.toLowerCase(),
      tokenIds: batchTokenIds,
      merkleRoot: merkleRoot,
      leaves: leaves, // array of hex strings
      uris: {}, // mapping of tokenId -> chosen URI
    };
    for (let i = 0; i < batchTokenIds.length; i++) {
      batchRecord.uris[batchTokenIds[i]] = chosenURIs[i];
    }
    batches.push(batchRecord);
  }

  // Save updates to files.
  saveMintedNFTData(mintedData);
  saveBatches(batches);
}

// Schedule mintBatches every 5 minutes.
setInterval(mintBatches, 5 * 60 * 1000);

// ==========================================
// Express Server and HTTP Endpoints
// ==========================================
const app = express();
app.use(express.json());

// POST /login : log (or update) a user's heartbeat
app.post("/login", (req, res) => {
  const address = req.body.address;
  if (!address) {
    return res.status(400).json({ error: "Missing Ethereum address" });
  }
  updateUserHeartbeat(address);
  res.json({ status: "Logged in", address });
});

// DELETE /logout : remove a user's logged-in status
app.delete("/logout", (req, res) => {
  const address = req.body.address;
  if (!address) {
    return res.status(400).json({ error: "Missing Ethereum address" });
  }
  removeUser(address);
  res.json({ status: "Logged out", address });
});

// POST /reveal : reveal a minted NFT by generating its Merkle proof and calling the contract
app.post("/reveal", async (req, res) => {
  const address = req.body.address;
  const tokenId = req.body.tokenId;
  if (!address || tokenId === undefined) {
    return res
      .status(400)
      .json({ error: "Missing Ethereum address or tokenId" });
  }

  // Find the batch that includes this tokenId for the given user.
  const batches = getBatches();
  const targetBatch = batches.find(
    (batch) =>
      batch.user === address.toLowerCase() && batch.tokenIds.includes(tokenId)
  );

  if (!targetBatch) {
    return res
      .status(404)
      .json({ error: "No batch found for this user and tokenId" });
  }

  // Retrieve the chosen URI for this token.
  const uri = targetBatch.uris[tokenId];
  if (!uri) {
    return res.status(404).json({ error: "No URI found for this tokenId" });
  }

  // Recompute the leaf hash for (tokenId, uri)
  const encoded = ethers.utils.solidityPack(
    ["uint256", "string"],
    [tokenId, uri]
  );
  const leaf = ethers.utils.keccak256(encoded);

  // Rebuild the Merkle tree from stored leaves.
  const tree = new MerkleTree(targetBatch.leaves, keccak256, {
    sortPairs: true,
  });
  const proof = tree.getHexProof(leaf);
  const rootIndex = targetBatch.batchId; // our stored batch index

  try {
    const tx = await contract.reveal(tokenId, rootIndex, proof, uri);
    await tx.wait();
    res.json({ status: "NFT revealed", tokenId, uri, proof });
  } catch (err) {
    console.error("Error during NFT reveal:", err);
    res
      .status(500)
      .json({ error: "Error revealing NFT", details: err.toString() });
  }
});

// ==========================================
// Start the Server
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// ==========================================
// Additionally, schedule the offline check every minute.
// ==========================================
setInterval(checkOfflineUsers, 60 * 1000);
