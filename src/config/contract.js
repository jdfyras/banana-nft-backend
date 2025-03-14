require("dotenv").config();
const { ethers } = require("ethers");

// Validate environment variables
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

// Provider and wallet setup
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// Minimal ABI including the functions we need (mintWithMerkle and reveal)
const contractABI = [
  "function mintWithMerkle(bytes32 _merkleRoot, address _user, uint256 _quantity) external",
  "function reveal(uint256 tokenId, uint256 rootIndex, bytes32[] calldata merkleProof, string calldata _uri) external",
  "function revealThreshold() view returns (uint256)",
];

// Create contract instance
const contract = new ethers.Contract(
  process.env.CONTRACT_ADDRESS,
  contractABI,
  wallet
);

// Get the configured reveal threshold from .env or fallback to contract value
const configuredRevealThreshold = process.env.REVEAL_THRESHOLD_SECONDS
  ? parseInt(process.env.REVEAL_THRESHOLD_SECONDS)
  : 300; // Default: 5 minutes (in seconds)

module.exports = {
  provider,
  wallet,
  contract,
  getRevealThreshold: async () => {
    try {
      // If REVEAL_THRESHOLD_SECONDS is set in .env, use that value
      if (process.env.REVEAL_THRESHOLD_SECONDS) {
        return configuredRevealThreshold;
      }
      // Otherwise get it from the contract
      return await contract.revealThreshold();
    } catch (error) {
      console.error("Error getting reveal threshold:", error);
      return configuredRevealThreshold; // Default fallback
    }
  },
  getNFTsPerUser: () => {
    return parseInt(process.env.NFTS_PER_USER || "5");
  },
  getMintIntervalSeconds: () => {
    return parseInt(process.env.MINT_INTERVAL_SECONDS || "300");
  },
  getUserInactivitySeconds: () => {
    return parseInt(process.env.USER_INACTIVITY_SECONDS || "300");
  },
};
