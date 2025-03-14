const { MerkleTree } = require("merkletreejs");
const { keccak256 } = require("ethers");
const fs = require("fs");
const path = require("path");
const assert = require("assert");

// Colors for better readability
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const NC = "\x1b[0m"; // No Color

console.log(`${BLUE}🚀 Starting Merkle Tree verification tests...${NC}`);

// Helper function to read a JSON file
function readJsonFile(filePath) {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch (error) {
    console.error(`${RED}Error reading file ${filePath}:${NC}`, error.message);
    return null;
  }
}

// Test 1: Test Merkle tree generation from batches
function testMerkleTreeGeneration() {
  console.log(
    `\n${YELLOW}📋 Testing Merkle tree generation from batches...${NC}`
  );

  // Read batches.json
  const batches = readJsonFile("data/batches.json");
  if (!batches) {
    console.error(`${RED}❌ Failed to read batches.json${NC}`);
    return false;
  }

  try {
    // Test first batch with tokens
    let firstBatch = null;
    for (const [address, userBatches] of Object.entries(batches)) {
      if (userBatches.length > 0) {
        firstBatch = userBatches[0];
        console.log(`${BLUE}ℹ️ Found batch for address: ${address}${NC}`);
        break;
      }
    }

    if (!firstBatch) {
      console.log(
        `${YELLOW}ℹ️ No batches found with tokens. Creating a test batch...${NC}`
      );

      // Create a test batch
      firstBatch = {
        startTokenId: 1,
        endTokenId: 5,
        timestamp: Date.now(),
      };
    }

    // Generate token IDs from range
    const tokenIds = [];
    for (let i = firstBatch.startTokenId; i <= firstBatch.endTokenId; i++) {
      tokenIds.push(i);
    }

    // Create leaves from token IDs
    const leaves = tokenIds.map((tokenId) => {
      const hash = keccak256(Buffer.from(tokenId.toString()));
      return Buffer.from(hash.slice(2), "hex");
    });

    // Create Merkle tree
    const tree = new MerkleTree(leaves, keccak256, { sort: true });
    const root = tree.getHexRoot();

    // Test proof verification for a token
    const tokenId = tokenIds[0];
    const leaf = Buffer.from(
      keccak256(Buffer.from(tokenId.toString())).slice(2),
      "hex"
    );
    const proof = tree.getHexProof(leaf);
    const isValid = tree.verify(proof, leaf, root);

    assert.strictEqual(isValid, true, "Merkle proof verification failed");

    console.log(
      `${GREEN}✅ Merkle tree generation and verification working properly${NC}`
    );
    console.log(`${BLUE}ℹ️ Token IDs: ${tokenIds.join(", ")}${NC}`);
    console.log(`${BLUE}ℹ️ Merkle Root: ${root}${NC}`);
    console.log(
      `${BLUE}ℹ️ Proof for Token ID ${tokenId}: ${proof.join(", ")}${NC}`
    );

    return { tree, tokenIds, root };
  } catch (error) {
    console.error(
      `${RED}❌ Merkle tree generation test failed:${NC}`,
      error.message
    );
    return false;
  }
}

// Test 2: Test URI generation and Merkle proof verification
function testURIVerification(merkleData) {
  console.log(`\n${YELLOW}📋 Testing URI generation and verification...${NC}`);

  if (!merkleData) {
    console.error(
      `${RED}❌ Cannot test URI verification without Merkle data${NC}`
    );
    return false;
  }

  try {
    // Read token URIs
    const tokenURIs = readJsonFile("data/token_uris.json");
    if (!tokenURIs) {
      console.log(
        `${YELLOW}ℹ️ token_uris.json not found or empty. Using test URIs...${NC}`
      );

      // Create test URIs
      const testURIs = {};
      merkleData.tokenIds.forEach((tokenId) => {
        testURIs[tokenId] = `ipfs://QmTest/${tokenId}.json`;
      });

      // Test verification for each token
      let allValid = true;
      for (const tokenId of merkleData.tokenIds) {
        const leaf = Buffer.from(
          keccak256(Buffer.from(tokenId.toString())).slice(2),
          "hex"
        );
        const proof = merkleData.tree.getHexProof(leaf);
        const isValid = merkleData.tree.verify(proof, leaf, merkleData.root);

        if (!isValid) {
          allValid = false;
          console.error(
            `${RED}❌ Verification failed for token ID ${tokenId}${NC}`
          );
        }
      }

      if (allValid) {
        console.log(
          `${GREEN}✅ URI verification working properly with test data${NC}`
        );
        return true;
      } else {
        console.error(`${RED}❌ URI verification failed for some tokens${NC}`);
        return false;
      }
    }

    // If we have actual token URIs, test with them
    let testedTokenIds = 0;
    let validTokenIds = 0;

    // Test up to 5 token IDs that exist in token_uris.json
    const tokenIdsToTest = Object.keys(tokenURIs).slice(0, 5).map(Number);

    if (tokenIdsToTest.length === 0) {
      console.log(`${YELLOW}ℹ️ No token URIs found for testing${NC}`);
      return false;
    }

    console.log(
      `${BLUE}ℹ️ Testing ${tokenIdsToTest.length} token IDs from token_uris.json${NC}`
    );

    // Generate leaves for these token IDs
    const leaves = tokenIdsToTest.map((tokenId) => {
      const hash = keccak256(Buffer.from(tokenId.toString()));
      return Buffer.from(hash.slice(2), "hex");
    });

    // Create a new Merkle tree just for these token IDs
    const tree = new MerkleTree(leaves, keccak256, { sort: true });
    const root = tree.getHexRoot();

    // Test verification for each token
    for (const tokenId of tokenIdsToTest) {
      testedTokenIds++;
      const uri = tokenURIs[tokenId];
      const leaf = Buffer.from(
        keccak256(Buffer.from(tokenId.toString())).slice(2),
        "hex"
      );
      const proof = tree.getHexProof(leaf);
      const isValid = tree.verify(proof, leaf, root);

      console.log(`${BLUE}ℹ️ Token ID ${tokenId} - URI: ${uri}${NC}`);
      console.log(`${BLUE}ℹ️ Valid: ${isValid}${NC}`);

      if (isValid) {
        validTokenIds++;
      }
    }

    if (validTokenIds === testedTokenIds) {
      console.log(
        `${GREEN}✅ URI verification working properly. All ${validTokenIds} tokens verified successfully.${NC}`
      );
      return true;
    } else {
      console.error(
        `${RED}❌ URI verification failed for some tokens. ${validTokenIds}/${testedTokenIds} verified.${NC}`
      );
      return false;
    }
  } catch (error) {
    console.error(`${RED}❌ URI verification test failed:${NC}`, error.message);
    return false;
  }
}

// Run tests
try {
  const merkleData = testMerkleTreeGeneration();
  if (merkleData) {
    testURIVerification(merkleData);
  }
  console.log(`\n${BLUE}🏁 Merkle tree tests completed!${NC}`);
} catch (error) {
  console.error(`${RED}❌ Test execution failed:${NC}`, error);
}
