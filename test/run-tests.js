#!/usr/bin/env node

const { spawn } = require("child_process");
const path = require("path");

// Colors for better readability
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const MAGENTA = "\x1b[35m";
const CYAN = "\x1b[36m";
const NC = "\x1b[0m"; // No Color

// Tests to run in sequence
const tests = [
  {
    name: "API Tests",
    script: path.join(__dirname, "api/api-test.js"),
    description: "Tests all API endpoints",
  },
  {
    name: "User Minting Cycle Tests",
    script: path.join(__dirname, "api/user-minting-cycle-test.js"),
    description: "Tests the per-user minting cycle functionality",
  },
  {
    name: "Merkle Tree Tests",
    script: path.join(__dirname, "contract/merkle-test.js"),
    description: "Tests Merkle tree generation and verification",
  },
  // You can add the curl test here if needed, but it requires a bash shell
  // {
  //   name: 'API Curl Tests',
  //   script: path.join(__dirname, 'api/api-curl-test.sh'),
  //   description: 'Tests API endpoints using curl commands'
  // }
];

/**
 * Run a single test script
 * @param {Object} test Test configuration
 * @returns {Promise<boolean>} Success status
 */
function runTest(test) {
  return new Promise((resolve) => {
    console.log(
      `\n${MAGENTA}=====================================================${NC}`
    );
    console.log(`${MAGENTA}▶ Running ${test.name}${NC}`);
    console.log(`${MAGENTA}   ${test.description}${NC}`);
    console.log(
      `${MAGENTA}=====================================================${NC}\n`
    );

    const isWindowsShellScript =
      process.platform === "win32" && test.script.endsWith(".sh");

    // For Windows running .sh scripts, use a different approach
    const proc = isWindowsShellScript
      ? spawn("bash", [test.script], { stdio: "inherit" })
      : spawn("node", [test.script], { stdio: "inherit" });

    proc.on("close", (code) => {
      if (code === 0) {
        console.log(`\n${GREEN}✅ ${test.name} completed successfully!${NC}`);
        resolve(true);
      } else {
        console.error(
          `\n${RED}❌ ${test.name} failed with exit code ${code}${NC}`
        );
        resolve(false);
      }
    });

    proc.on("error", (err) => {
      console.error(
        `\n${RED}❌ Failed to start ${test.name}: ${err.message}${NC}`
      );
      resolve(false);
    });
  });
}

/**
 * Run all tests in sequence
 */
async function runAllTests() {
  console.log(`${CYAN}🧪 Starting Banana NFT Backend Test Suite${NC}`);
  console.log(`${YELLOW}ℹ️ Server must be running for these tests${NC}`);

  const results = [];

  for (const test of tests) {
    const success = await runTest(test);
    results.push({ test: test.name, success });
  }

  // Print summary
  console.log(`\n${CYAN}=======================>${NC}`);
  console.log(`${CYAN}📊 Test Results Summary${NC}`);
  console.log(`${CYAN}=======================>${NC}\n`);

  for (const result of results) {
    if (result.success) {
      console.log(`${GREEN}✅ ${result.test}: PASSED${NC}`);
    } else {
      console.log(`${RED}❌ ${result.test}: FAILED${NC}`);
    }
  }

  const successCount = results.filter((r) => r.success).length;
  console.log(
    `\n${YELLOW}Tests passed: ${successCount}/${results.length} (${Math.round(
      (successCount / results.length) * 100
    )}%)${NC}`
  );

  if (successCount === results.length) {
    console.log(`${GREEN}🎉 All tests passed!${NC}`);
  } else {
    console.log(
      `${RED}⚠️ Some tests failed. Please review the output above.${NC}`
    );
    process.exit(1);
  }
}

// Check if server is running
const axios = require("axios");
axios
  .get("http://localhost:3000/health")
  .then(() => {
    runAllTests();
  })
  .catch((error) => {
    console.error(
      `${RED}❌ Server is not running at http://localhost:3000${NC}`
    );
    console.error(
      `${YELLOW}ℹ️ Please start the server before running tests:${NC}`
    );
    console.error(`${YELLOW}   npm start${NC}`);
    process.exit(1);
  });
