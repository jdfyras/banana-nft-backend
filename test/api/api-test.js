const axios = require("axios");
const assert = require("assert");

// Test configuration
const API_BASE_URL = "http://localhost:3000/api";
const TEST_ADDRESS = "0x1234567890123456789012345678901234567890"; // Test Ethereum address
const TEST_ADDRESS2 = "0x9876543210987654321098765432109876543210"; // Second test address

// Test functions
async function testHealthEndpoint() {
  console.log("\n📋 Testing health endpoint...");
  try {
    const response = await axios.get(
      `${API_BASE_URL.replace("/api", "")}/health`
    );
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.data.status, "ok");
    console.log("✅ Health endpoint working properly");
    return true;
  } catch (error) {
    console.error("❌ Health endpoint test failed:", error.message);
    return false;
  }
}

async function testUserHeartbeat() {
  console.log("\n📋 Testing user heartbeat...");
  try {
    const response = await axios.post(`${API_BASE_URL}/users/heartbeat`, {
      address: TEST_ADDRESS,
      triggerMint: false, // Don't mint NFTs for this test
    });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.data.success, true);
    assert.strictEqual(response.data.address, TEST_ADDRESS);
    assert.ok(response.data.lastActive);
    console.log("✅ User heartbeat working properly");
    return response.data;
  } catch (error) {
    console.error("❌ User heartbeat test failed:", error.message);
    return null;
  }
}

async function testGetUsers() {
  console.log("\n📋 Testing get users endpoint...");
  try {
    const response = await axios.get(`${API_BASE_URL}/users`);

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.data.success, true);
    assert.ok(Array.isArray(response.data.users));
    console.log(
      `✅ Get users working properly, found ${response.data.users.length} active users`
    );
    return response.data;
  } catch (error) {
    console.error("❌ Get users test failed:", error.message);
    return null;
  }
}

async function testGetNFTConfig() {
  console.log("\n📋 Testing NFT config endpoint...");
  try {
    const response = await axios.get(`${API_BASE_URL}/nft/config`);

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.data.success, true);
    assert.ok(response.data.revealThresholdSeconds > 0);
    assert.ok(response.data.nftsPerUser > 0);
    assert.ok(response.data.mintIntervalSeconds > 0);
    assert.ok(response.data.userInactivitySeconds > 0);

    console.log("✅ NFT config endpoint working properly");
    console.log(
      `   Reveal threshold: ${response.data.revealThresholdSeconds} seconds`
    );
    console.log(`   NFTs per user: ${response.data.nftsPerUser}`);
    console.log(
      `   Mint interval: ${response.data.mintIntervalSeconds} seconds`
    );
    console.log(
      `   User inactivity: ${response.data.userInactivitySeconds} seconds`
    );
    return response.data;
  } catch (error) {
    console.error("❌ NFT config test failed:", error.message);
    return null;
  }
}

async function testMintNFTs() {
  console.log("\n📋 Testing NFT minting...");
  try {
    const response = await axios.post(`${API_BASE_URL}/nft/mint`, {
      address: TEST_ADDRESS,
      quantity: 2,
    });

    assert.strictEqual(response.status, 200);
    if (!response.data.success) {
      console.log("ℹ️ Mint unsuccessful but API working:", response.data.error);
      return response.data;
    }

    assert.ok(response.data.startTokenId > 0);
    assert.ok(response.data.endTokenId >= response.data.startTokenId);
    assert.ok(response.data.quantity > 0);
    assert.ok(response.data.transactionHash);
    assert.ok(response.data.revealExpiresAt);

    console.log("✅ NFT minting working properly");
    console.log(
      `   Minted ${response.data.quantity} NFTs from ID ${response.data.startTokenId} to ${response.data.endTokenId}`
    );
    console.log(`   Transaction hash: ${response.data.transactionHash}`);
    return response.data;
  } catch (error) {
    console.error("❌ NFT minting test failed:", error.message);
    if (error.response) {
      console.error("   Response:", error.response.data);
    }
    return null;
  }
}

async function testGetUserNFTs() {
  console.log("\n📋 Testing get user NFTs endpoint...");
  try {
    const response = await axios.get(`${API_BASE_URL}/nft/${TEST_ADDRESS}`);

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.data.success, true);
    assert.ok(Array.isArray(response.data.tokenIds));
    assert.ok(Array.isArray(response.data.revealableTokenIds));

    console.log("✅ Get user NFTs working properly");
    console.log(`   User has ${response.data.tokenIds.length} NFTs total`);
    console.log(
      `   User has ${response.data.revealableTokenIds.length} revealable NFTs`
    );
    return response.data;
  } catch (error) {
    console.error("❌ Get user NFTs test failed:", error.message);
    return null;
  }
}

async function testRevealNFT(tokenId) {
  console.log(`\n📋 Testing NFT revealing for token ID ${tokenId}...`);
  if (!tokenId) {
    console.log("ℹ️ No token ID provided, skipping reveal test");
    return null;
  }

  try {
    const response = await axios.post(`${API_BASE_URL}/nft/reveal`, {
      address: TEST_ADDRESS,
      tokenId: tokenId,
    });

    assert.strictEqual(response.status, 200);
    if (!response.data.success) {
      console.log(
        "ℹ️ Reveal unsuccessful but API working:",
        response.data.error
      );
      return response.data;
    }

    assert.strictEqual(response.data.tokenId, tokenId);
    assert.ok(response.data.uri);
    assert.ok(response.data.transactionHash);
    assert.ok(response.data.batchExpiresAt);
    assert.ok(response.data.timeRemainingSeconds >= 0);

    console.log("✅ NFT revealing working properly");
    console.log(`   Revealed token ID ${response.data.tokenId}`);
    console.log(`   URI: ${response.data.uri}`);
    console.log(`   Transaction hash: ${response.data.transactionHash}`);
    return response.data;
  } catch (error) {
    console.error("❌ NFT revealing test failed:", error.message);
    if (error.response) {
      console.error("   Response:", error.response.data);
    }
    return null;
  }
}

async function testUserCleanup() {
  console.log("\n📋 Testing user cleanup for a specific user...");
  try {
    const response = await axios.get(
      `${API_BASE_URL}/nft/cleanup/${TEST_ADDRESS}`
    );

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.data.success, true);
    assert.ok("batchesRemoved" in response.data);
    assert.ok("urisRemoved" in response.data);

    console.log("✅ User cleanup working properly");
    console.log(
      `   Removed ${response.data.batchesRemoved} batches and affected ${response.data.urisRemoved} URIs`
    );
    return response.data;
  } catch (error) {
    console.error("❌ User cleanup test failed:", error.message);
    return null;
  }
}

async function testGlobalCleanup() {
  console.log("\n📋 Testing global cleanup...");
  try {
    const response = await axios.get(`${API_BASE_URL}/nft/cleanup`);

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.data.success, true);
    assert.ok("batchesRemoved" in response.data);
    assert.ok("urisRemoved" in response.data);

    console.log("✅ Global cleanup working properly");
    console.log(
      `   Removed ${response.data.batchesRemoved} batches and ${response.data.urisRemoved} URIs`
    );
    return response.data;
  } catch (error) {
    console.error("❌ Global cleanup test failed:", error.message);
    return null;
  }
}

async function testDeleteUser() {
  console.log("\n📋 Testing user deletion...");
  try {
    // Create a second test user first
    await axios.post(`${API_BASE_URL}/users/heartbeat`, {
      address: TEST_ADDRESS2,
      triggerMint: false,
    });

    // Now delete it
    const response = await axios.delete(
      `${API_BASE_URL}/users/${TEST_ADDRESS2}`
    );

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.data.success, true);
    assert.strictEqual(response.data.address, TEST_ADDRESS2);

    console.log("✅ User deletion working properly");
    return response.data;
  } catch (error) {
    console.error("❌ User deletion test failed:", error.message);
    return null;
  }
}

// Run all tests
async function runAllTests() {
  console.log("🚀 Starting API tests...");

  // First check if the server is running
  const healthOk = await testHealthEndpoint();
  if (!healthOk) {
    console.error(
      "❌ Server is not running. Start the server before running tests."
    );
    return;
  }

  // Get config first
  await testGetNFTConfig();

  // User tests
  await testUserHeartbeat();
  await testGetUsers();

  // NFT tests
  const mintResult = await testMintNFTs();
  const userNFTs = await testGetUserNFTs();

  // Attempt to reveal the first revealable NFT if any
  let tokenToReveal = null;
  if (userNFTs && userNFTs.revealableTokenIds.length > 0) {
    tokenToReveal = userNFTs.revealableTokenIds[0];
  }
  await testRevealNFT(tokenToReveal);

  // Cleanup tests
  await testUserCleanup();
  await testGlobalCleanup();

  // Finally test user deletion
  await testDeleteUser();

  console.log("\n🏁 All tests completed!");
}

// Start the tests
runAllTests().catch((error) => {
  console.error("❌ Test execution failed:", error);
});
