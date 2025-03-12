// test/index.test.js

const fs = require("fs");
const path = require("path");
const { expect } = require("chai");
const sinon = require("sinon");
const supertest = require("supertest");

// Paths to the JSON "database" files (adjust if necessary)
const DATA_DIR = path.join(__dirname, "../data");
const LOGGED_USERS_FILE = path.join(DATA_DIR, "loggedUsers.json");
const MINTED_NFTS_FILE = path.join(DATA_DIR, "mintedNFTs.json");
const BATCHES_FILE = path.join(DATA_DIR, "batches.json");
const URIS_FILE = path.join(DATA_DIR, "designs_distribution.json");

// Ensure the DATA_DIR exists before tests
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

// Set dummy environment variables so that the process does not exit.
process.env.RPC_URL = "https://testnet.aurora.dev";
process.env.PRIVATE_KEY =
  "8203b32f9a9fa5b6629e89fa00e057b7c873a04d2e6f214b05da470f825abdab";
process.env.CONTRACT_ADDRESS = "0x8ab00C521C71C57958DaA58d92AEFF7D7Bf5ff05";

// Import the index file (assumes key functions and app are exported)
const indexModule = require("../index");
const {
  updateUserHeartbeat,
  removeUser,
  checkOfflineUsers,
  getRandomURI,
  mintBatches,
  app,
  contract,
} = indexModule;

// Create a Supertest request agent
const request = supertest(app);

describe("File Initialization and Helper Functions", function () {
  beforeEach(() => {
    // For tests, write a dummy designs_distribution.json file so that initFiles does not exit.
    fs.writeFileSync(
      URIS_FILE,
      JSON.stringify({ "http://example.com/uri": 1 }),
      "utf8"
    );
  });
  afterEach(() => {
    // Clean up all JSON files after each test.
    [LOGGED_USERS_FILE, MINTED_NFTS_FILE, BATCHES_FILE, URIS_FILE].forEach(
      (file) => {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      }
    );
  });

  it("should have created the required JSON files on startup", function () {
    // Since initFiles runs immediately on load, check that the files exist.
    expect(fs.existsSync(LOGGED_USERS_FILE)).to.be.true;
    expect(fs.existsSync(MINTED_NFTS_FILE)).to.be.true;
    expect(fs.existsSync(BATCHES_FILE)).to.be.true;
  });

  describe("User management functions", function () {
    beforeEach(() => {
      fs.writeFileSync(LOGGED_USERS_FILE, JSON.stringify({}), "utf8");
    });
    afterEach(() => {
      if (fs.existsSync(LOGGED_USERS_FILE)) fs.unlinkSync(LOGGED_USERS_FILE);
    });
    it("updateUserHeartbeat() should add or update a user", function () {
      updateUserHeartbeat("0xABC");
      const users = JSON.parse(fs.readFileSync(LOGGED_USERS_FILE, "utf8"));
      expect(users["0xabc"]).to.have.property("lastActive");
    });

    it("removeUser() should remove a user", function () {
      updateUserHeartbeat("0xABC");
      removeUser("0xABC");
      const users = JSON.parse(fs.readFileSync(LOGGED_USERS_FILE, "utf8"));
      expect(users).to.not.have.property("0xabc");
    });
  });

  describe("checkOfflineUsers()", function () {
    beforeEach(() => {
      const now = Date.now();
      const users = {
        "0xactive": { lastActive: now },
        "0xinactive": { lastActive: now - 6 * 60 * 1000 }, // 6 minutes ago
      };
      fs.writeFileSync(LOGGED_USERS_FILE, JSON.stringify(users), "utf8");
    });
    afterEach(() => {
      if (fs.existsSync(LOGGED_USERS_FILE)) fs.unlinkSync(LOGGED_USERS_FILE);
    });
    it("should remove users inactive for over 5 minutes", function () {
      checkOfflineUsers();
      const users = JSON.parse(fs.readFileSync(LOGGED_USERS_FILE, "utf8"));
      expect(users).to.have.property("0xactive");
      expect(users).to.not.have.property("0xinactive");
    });
  });

  describe("getRandomURI()", function () {
    beforeEach(() => {
      // Setup a designs_distribution.json with multiple URIs and weights.
      const uris = { "http://uri1.com": 1, "http://uri2.com": 2 };
      fs.writeFileSync(URIS_FILE, JSON.stringify(uris), "utf8");
    });
    afterEach(() => {
      if (fs.existsSync(URIS_FILE)) fs.unlinkSync(URIS_FILE);
    });
    it("should return a URI from the distribution", function () {
      const uri = getRandomURI();
      const availableURIs = Object.keys(
        JSON.parse(fs.readFileSync(URIS_FILE, "utf8"))
      );
      expect(availableURIs).to.include(uri);
    });
  });
});

describe("mintBatches()", function () {
  let mintWithMerkleStub;
  beforeEach(() => {
    // Set up a dummy logged user.
    fs.writeFileSync(
      LOGGED_USERS_FILE,
      JSON.stringify({ "0xuser": { lastActive: Date.now() } }),
      "utf8"
    );
    fs.writeFileSync(
      MINTED_NFTS_FILE,
      JSON.stringify({ lastTokenId: 0, users: {} }),
      "utf8"
    );
    fs.writeFileSync(BATCHES_FILE, JSON.stringify([]), "utf8");
    // Stub the ethers contract mintWithMerkle method so no real network call is made.
    mintWithMerkleStub = sinon
      .stub(contract, "mintWithMerkle")
      .callsFake(async () => {
        return { wait: async () => {} };
      });
  });
  afterEach(() => {
    mintWithMerkleStub.restore();
    [LOGGED_USERS_FILE, MINTED_NFTS_FILE, BATCHES_FILE].forEach((file) => {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    });
  });
  it("should mint a batch for each logged user and update mintedNFTs and batches files", async function () {
    await mintBatches();

    // Verify mintedNFTs.json is updated with 50 new token IDs.
    const mintedData = JSON.parse(fs.readFileSync(MINTED_NFTS_FILE, "utf8"));
    expect(mintedData.lastTokenId).to.equal(50);
    expect(mintedData.users["0xuser"]).to.be.an("array").with.length(50);

    // Verify batches.json contains one batch with expected properties.
    const batches = JSON.parse(fs.readFileSync(BATCHES_FILE, "utf8"));
    expect(batches).to.be.an("array").with.length(1);
    expect(batches[0]).to.have.property("merkleRoot");
    expect(batches[0])
      .to.have.property("tokenIds")
      .that.is.an("array")
      .with.length(50);
  });
});

describe("Express Endpoints", function () {
  beforeEach(() => {
    // Ensure all JSON files are reset.
    fs.writeFileSync(LOGGED_USERS_FILE, JSON.stringify({}), "utf8");
    fs.writeFileSync(
      MINTED_NFTS_FILE,
      JSON.stringify({ lastTokenId: 0, users: {} }),
      "utf8"
    );
    fs.writeFileSync(BATCHES_FILE, JSON.stringify([]), "utf8");
    fs.writeFileSync(
      URIS_FILE,
      JSON.stringify({ "http://example.com/uri": 1 }),
      "utf8"
    );
  });
  afterEach(() => {
    [LOGGED_USERS_FILE, MINTED_NFTS_FILE, BATCHES_FILE, URIS_FILE].forEach(
      (file) => {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      }
    );
  });

  it("POST /login should log in a user", async function () {
    const res = await request.post("/login").send({ address: "0xTest" });
    expect(res.status).to.equal(200);
    expect(res.body).to.deep.equal({ status: "Logged in", address: "0xTest" });
  });

  it("DELETE /logout should log out a user", async function () {
    // Log in a user first.
    await request.post("/login").send({ address: "0xTest" });
    const res = await request.delete("/logout").send({ address: "0xTest" });
    expect(res.status).to.equal(200);
    expect(res.body).to.deep.equal({ status: "Logged out", address: "0xTest" });
  });

  describe("POST /reveal", function () {
    let revealStub;
    const tokenId = 1;
    const uri = "http://example.com/uri";

    beforeEach(() => {
      // Create a batch record that includes the tokenId for user 0xtest.
      const ethers = require("ethers");
      const encoded = ethers.utils.solidityPack(
        ["uint256", "string"],
        [tokenId, uri]
      );
      const leaf = ethers.utils.keccak256(encoded);
      const batchRecord = {
        batchId: 0,
        user: "0xtest",
        tokenIds: [tokenId],
        merkleRoot: "0xabc",
        leaves: [leaf],
        uris: { [tokenId]: uri },
      };
      fs.writeFileSync(BATCHES_FILE, JSON.stringify([batchRecord]), "utf8");

      // Stub the ethers contract reveal method.
      revealStub = sinon.stub(contract, "reveal").callsFake(async () => {
        return { wait: async () => {} };
      });
    });
    afterEach(() => {
      revealStub.restore();
      if (fs.existsSync(BATCHES_FILE)) fs.unlinkSync(BATCHES_FILE);
    });

    it("should reveal an NFT and return the proof", async function () {
      const res = await request
        .post("/reveal")
        .send({ address: "0xtest", tokenId });
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("status", "NFT revealed");
      expect(res.body).to.have.property("tokenId", tokenId);
      expect(res.body).to.have.property("uri", uri);
      expect(res.body).to.have.property("proof").that.is.an("array");
    });

    it("should return 404 for non-existent batch record", async function () {
      const res = await request
        .post("/reveal")
        .send({ address: "0xunknown", tokenId: 999 });
      expect(res.status).to.equal(404);
      expect(res.body).to.have.property("error");
    });

    it("should return 400 when required fields are missing", async function () {
      const res = await request.post("/reveal").send({ address: "0xtest" });
      expect(res.status).to.equal(400);
      expect(res.body).to.have.property("error");
    });
  });
});
