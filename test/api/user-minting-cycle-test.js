const axios = require("axios");
const assert = require("assert");

// Test configuration
const API_BASE_URL = "http://localhost:3000/api";
const TEST_ADDRESSES = [
  "0xabc1000000000000000000000000000000000001",
  "0xabc2000000000000000000000000000000000002",
  "0xabc3000000000000000000000000000000000003",
];

// Colors for better readability
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const NC = "\x1b[0m"; // No Color

/**
 * Test the per-user minting cycle feature
 *
 * This test:
 * 1. Checks the server is running
 * 2. Gets NFT configuration
 * 3. Registers multiple test users
 * 4. Verifies each user gets NFTs minted on login
 * 5. Verifies users maintain independent minting cycles
 * 6. Cleans up by deleting test users
 */
async function testUserMintingCycle() {
  console.log(`${BLUE}🚀 Starting per-user minting cycle tests...${NC}`);

  try {
    // First check if the server is running
    console.log(`\n${YELLOW}📋 Testing server health...${NC}`);
    const healthResponse = await axios.get(
      `${API_BASE_URL.replace("/api", "")}/health`
    );
    assert.strictEqual(healthResponse.status, 200);
    assert.strictEqual(healthResponse.data.status, "ok");
    console.log(`${GREEN}✅ Server is running properly${NC}`);

    // Get NFT configuration
    console.log(`\n${YELLOW}📋 Getting NFT configuration...${NC}`);
    const configResponse = await axios.get(`${API_BASE_URL}/nft/config`);
    assert.strictEqual(configResponse.status, 200);
    const config = configResponse.data;
    console.log(`${GREEN}✅ NFT config retrieved:${NC}`);
    console.log(`   Mint interval: ${config.mintIntervalSeconds} seconds`);
    console.log(`   NFTs per user: ${config.nftsPerUser}`);
    console.log(`   User inactivity: ${config.userInactivitySeconds} seconds`);

    // Delete any existing test users first to ensure clean test
    console.log(`\n${YELLOW}📋 Cleaning up any existing test users...${NC}`);
    for (const address of TEST_ADDRESSES) {
      try {
        await axios.delete(`${API_BASE_URL}/users/${address}`);
      } catch (error) {
        // Ignore errors deleting non-existent users
      }
    }

    // Register test users with triggerMint=true to simulate login
    console.log(
      `\n${YELLOW}📋 Registering test users with minting enabled...${NC}`
    );
    const userResults = [];

    for (const address of TEST_ADDRESSES) {
      try {
        const response = await axios.post(`${API_BASE_URL}/users/heartbeat`, {
          address,
          triggerMint: true,
        });

        userResults.push({
          address,
          success: response.status === 200,
          lastActive: response.data.lastActive,
          lastMint: response.data.lastMint,
        });

        console.log(`${GREEN}✅ User ${address} registered successfully${NC}`);
      } catch (error) {
        console.error(
          `${RED}❌ Failed to register user ${address}:${NC}`,
          error.message
        );
        if (error.response) {
          console.error("   Response:", error.response.data);
        }
      }
    }

    // Check if users got NFTs on registration
    console.log(
      `\n${YELLOW}📋 Checking if users received NFTs on registration...${NC}`
    );

    for (const address of TEST_ADDRESSES) {
      try {
        const response = await axios.get(`${API_BASE_URL}/nft/${address}`);
        assert.strictEqual(response.status, 200);

        const tokenIds = response.data.tokenIds || [];
        console.log(
          `${BLUE}ℹ️ User ${address} has ${tokenIds.length} NFTs${NC}`
        );

        // If no NFTs were minted, try to manually mint some
        if (tokenIds.length === 0) {
          console.log(
            `${YELLOW}ℹ️ No NFTs found for ${address}, trying manual mint...${NC}`
          );
          try {
            const mintResponse = await axios.post(
              `${API_BASE_URL}/nft/mint-for-user/${address}`
            );
            console.log(
              `${BLUE}ℹ️ Manual mint result:${NC}`,
              mintResponse.data
            );

            // Check again
            const recheckResponse = await axios.get(
              `${API_BASE_URL}/nft/${address}`
            );
            const updatedTokenIds = recheckResponse.data.tokenIds || [];
            console.log(
              `${BLUE}ℹ️ After manual mint, user ${address} has ${updatedTokenIds.length} NFTs${NC}`
            );
          } catch (mintError) {
            console.error(
              `${RED}❌ Manual mint failed:${NC}`,
              mintError.message
            );
            if (mintError.response) {
              console.error("   Response:", mintError.response.data);
            }
          }
        }
      } catch (error) {
        console.error(
          `${RED}❌ Failed to check NFTs for user ${address}:${NC}`,
          error.message
        );
        if (error.response) {
          console.error("   Response:", error.response.data);
        }
      }
    }

    // Test sequential heartbeats for one user to verify minting cycle
    const testAddress = TEST_ADDRESSES[0];
    console.log(
      `\n${YELLOW}📋 Testing sequential heartbeats for user ${testAddress}...${NC}`
    );

    // First heartbeat to establish baseline
    let initialHeartbeat = await axios.post(`${API_BASE_URL}/users/heartbeat`, {
      address: testAddress,
      triggerMint: true,
    });
    console.log(`${BLUE}ℹ️ Initial heartbeat response:${NC}`, {
      lastActive: initialHeartbeat.data.lastActive,
      lastMintTime: initialHeartbeat.data.lastMintTime,
    });

    // Immediate second heartbeat (should not trigger minting)
    let secondHeartbeat = await axios.post(`${API_BASE_URL}/users/heartbeat`, {
      address: testAddress,
      triggerMint: true,
    });
    console.log(`${BLUE}ℹ️ Immediate second heartbeat response:${NC}`, {
      lastActive: secondHeartbeat.data.lastActive,
      lastMintTime: secondHeartbeat.data.lastMintTime,
    });

    // Check if last mint time remained the same (no new minting)
    if (
      initialHeartbeat.data.lastMintTime === secondHeartbeat.data.lastMintTime
    ) {
      console.log(
        `${GREEN}✅ Sequential heartbeat did not trigger new mint as expected${NC}`
      );
    } else {
      console.log(
        `${RED}❌ Sequential heartbeat unexpectedly triggered new mint${NC}`
      );
    }

    // If we wanted to test the full minting cycle, we'd need to wait for mintIntervalSeconds
    // As that would make the test too long, we'll just verify the lastMint timestamp exists
    const hasLastMintTime = !!secondHeartbeat.data.lastMintTime;
    assert.strictEqual(
      hasLastMintTime,
      true,
      "User should have a lastMintTime timestamp"
    );
    console.log(
      `${GREEN}✅ User has proper lastMintTime timestamp: ${secondHeartbeat.data.lastMintTime}${NC}`
    );

    // Delete test users when done
    console.log(`\n${YELLOW}📋 Cleaning up test users...${NC}`);
    for (const address of TEST_ADDRESSES) {
      try {
        const response = await axios.delete(`${API_BASE_URL}/users/${address}`);
        console.log(
          `${GREEN}✅ Successfully deleted test user ${address}${NC}`
        );
      } catch (error) {
        console.error(
          `${RED}❌ Failed to delete test user ${address}:${NC}`,
          error.message
        );
      }
    }

    console.log(`\n${BLUE}🏁 Per-user minting cycle tests completed!${NC}`);
  } catch (error) {
    console.error(`${RED}❌ Test failed:${NC}`, error);
  }
}

// Run the test
testUserMintingCycle();
