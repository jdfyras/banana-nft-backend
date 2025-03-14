# 🍌 Banana NFT Backend

A backend service for minting and revealing NFTs with Merkle tree-based verification. This service provides a secure and efficient way to manage NFT minting, revealing, and storage with an emphasis on optimized performance and user-centric processing.

## Features

- **Efficient Storage**: Uses token ID ranges instead of arrays for better storage efficiency and reduced memory footprint
- **Automatic Cleanup**: Periodically removes expired batches and token URIs to save storage and maintain system performance
- **Merkle Tree Verification**: Secure NFT minting and revealing using cryptographic Merkle trees for proof verification
- **RESTful API**: Clean, well-documented API endpoints for all operations
- **User-Centric Management**: Each user has their own independent minting cycle and cleanup process
- **Independent Minting**: NFTs are minted as soon as a user logs in, with periodic refreshes based on configurable intervals

## Project Structure

```
├── data/                  # JSON data storage
├── src/
│   ├── config/            # Configuration files
│   ├── models/            # Data models
│   ├── routes/            # API routes
│   ├── services/          # Business logic
│   ├── utils/             # Utility functions
│   └── app.js             # Express application
├── test/                  # Test scripts
│   ├── api/               # API test scripts
│   └── contract/          # Contract test scripts
├── index.js               # Entry point
└── package.json           # Dependencies
```

## API Endpoints Reference

### NFT Operations

#### `GET /api/nft/:address`

Gets all NFTs owned by a user.

**Parameters:**

- `address`: Ethereum address of the user (path parameter)

**Response:**

```json
{
  "success": true,
  "address": "0x...",
  "tokenIds": [1, 2, 3],
  "revealableTokenIds": [2, 3],
  "totalCount": 3,
  "revealableCount": 2
}
```

#### `POST /api/nft/mint`

Mints new NFTs for a user.

**Request Body:**

```json
{
  "address": "0x...",
  "quantity": 2
}
```

**Response:**

```json
{
  "success": true,
  "startTokenId": 101,
  "endTokenId": 102,
  "quantity": 2,
  "transactionHash": "0x...",
  "revealExpiresAt": "2023-04-10T15:30:00Z"
}
```

#### `POST /api/nft/reveal`

Reveals an NFT, making its metadata accessible.

**Request Body:**

```json
{
  "address": "0x...",
  "tokenId": 101
}
```

**Response:**

```json
{
  "success": true,
  "tokenId": 101,
  "uri": "ipfs://...",
  "transactionHash": "0x...",
  "batchExpiresAt": "2023-04-10T15:30:00Z",
  "timeRemainingSeconds": 120
}
```

#### `GET /api/nft/cleanup`

Runs global cleanup operations (requires admin privileges in production).

**Response:**

```json
{
  "success": true,
  "batchesRemoved": 2,
  "urisRemoved": 5,
  "timestamp": "2023-04-10T15:30:00Z"
}
```

#### `GET /api/nft/cleanup/:address`

Runs cleanup operations for a specific user.

**Parameters:**

- `address`: Ethereum address of the user (path parameter)

**Response:**

```json
{
  "success": true,
  "batchesRemoved": 1,
  "urisRemoved": 2,
  "address": "0x..."
}
```

#### `GET /api/nft/mint-for-user/:address`

Triggers minting for a specific user.

**Parameters:**

- `address`: Ethereum address of the user (path parameter)

**Response:**

```json
{
  "success": true,
  "startTokenId": 103,
  "endTokenId": 107,
  "quantity": 5,
  "address": "0x...",
  "transactionHash": "0x..."
}
```

#### `GET /api/nft/config`

Gets current NFT configuration values.

**Response:**

```json
{
  "success": true,
  "revealThresholdSeconds": 60,
  "nftsPerUser": 5,
  "mintIntervalSeconds": 60,
  "userInactivitySeconds": 300
}
```

### User Management

#### `GET /api/users`

Gets all active users.

**Response:**

```json
{
  "success": true,
  "users": [
    {
      "address": "0x...",
      "lastActive": "2023-04-10T15:30:00Z",
      "lastMintTime": "2023-04-10T15:25:00Z",
      "isActive": true,
      "inactiveInSeconds": 0
    }
  ],
  "count": 1,
  "inactivityThresholdSeconds": 300
}
```

#### `POST /api/users/heartbeat`

Updates user heartbeat and triggers minting if needed.

**Request Body:**

```json
{
  "address": "0x...",
  "triggerMint": true
}
```

**Response:**

```json
{
  "success": true,
  "address": "0x...",
  "lastActive": "2023-04-10T15:30:00Z",
  "lastMintTime": "2023-04-10T15:25:00Z",
  "timestamp": 1649602200000,
  "mintingTriggered": true
}
```

#### `DELETE /api/users/:address`

Removes a user and cleans up their data.

**Parameters:**

- `address`: Ethereum address of the user (path parameter)

**Response:**

```json
{
  "success": true,
  "address": "0x...",
  "cleanupResult": {
    "batchesRemoved": 1,
    "urisRemoved": 2
  }
}
```

#### `GET /api/users/cleanup`

Cleans up inactive users.

**Response:**

```json
{
  "success": true,
  "usersRemoved": 1,
  "remainingUsers": 2,
  "inactivityThresholdSeconds": 300
}
```

### System

#### `GET /health`

Health check endpoint to verify service is operating correctly.

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2023-04-10T15:30:00Z",
  "uptime": 3600.5
}
```

## User-Centric Processing

The system operates on a per-user basis with the following workflow:

1. **Independent Minting**: Each user has their own minting cycle, triggered by login

   - When a user logs in (heartbeat), the system checks if they're new or returning after inactivity
   - If so, NFTs are immediately minted for the user
   - Subsequent mints occur periodically based on the configured mint interval

2. **User-Specific Cleanup**: Data is cleaned up on a per-user basis when it expires

   - Each batch of minted NFTs has its own expiration timestamp
   - When batches expire, they are removed during cleanup operations
   - User-specific cleanup ensures one user's expired batches don't affect others

3. **Automatic NFT Minting**: New NFTs are minted as soon as a user logs in and periodically after that

   - The system tracks the last mint time for each user
   - New NFTs are minted when the mint interval has passed
   - This ensures users always have NFTs available to reveal

4. **Configurable Inactivity**: The system automatically logs out users after a configurable period of inactivity
   - User activity is tracked through heartbeat requests
   - After the configured inactivity period, users are considered offline
   - Inactive users can be automatically removed during cleanup operations

## Automatic Cleanup Mechanisms

The system implements multiple cleanup mechanisms to maintain optimal performance:

1. **Expired Batches**: Batches that are past the reveal threshold are automatically removed

   - Each batch has a timestamp indicating when it was created
   - When current time - timestamp > reveal threshold, the batch is considered expired
   - Expired batches are removed during cleanup operations

2. **Unused Token URIs**: URIs for tokens that can no longer be revealed are pruned

   - Token URIs are only kept for tokens that are in valid batches
   - When a batch expires, its token URIs become candidates for cleanup
   - This prevents accumulation of unused metadata

3. **Inactive Users**: Users that have been inactive for the configured time period are removed
   - User activity is tracked through the heartbeat mechanism
   - Users inactive for longer than the configured threshold are marked for removal
   - This prevents the system from tracking users who are no longer using the service

## Configuration

The system is configured through environment variables:

| Variable                 | Description                                                  | Default | Example     |
| ------------------------ | ------------------------------------------------------------ | ------- | ----------- |
| REVEAL_THRESHOLD_SECONDS | Time in seconds users have to reveal NFTs after minting      | 300     | 60          |
| NFTS_PER_USER            | Number of NFTs to mint per user during minting               | 5       | 10          |
| MINT_INTERVAL_SECONDS    | Interval in seconds between minting operations for each user | 300     | 60          |
| USER_INACTIVITY_SECONDS  | Time in seconds after which a user is considered inactive    | 300     | 600         |
| PORT                     | Server port                                                  | 3000    | 8080        |
| RPC_URL                  | Ethereum RPC URL                                             | -       | https://... |
| PRIVATE_KEY              | Ethereum wallet private key                                  | -       | 0x12345...  |
| CONTRACT_ADDRESS         | NFT contract address                                         | -       | 0xabcd...   |
| NODE_ENV                 | Environment (development, production)                        | -       | production  |

## Setup and Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file with the following variables:
   ```
   PORT=3000
   RPC_URL=your_ethereum_rpc_url
   PRIVATE_KEY=your_private_key
   CONTRACT_ADDRESS=your_contract_address
   REVEAL_THRESHOLD_SECONDS=60
   NFTS_PER_USER=5
   MINT_INTERVAL_SECONDS=60
   USER_INACTIVITY_SECONDS=300
   NODE_ENV=development
   ```
4. Start the server:
   ```bash
   npm start
   ```

## Development

Run the server in development mode with automatic reloading:

```bash
npm run dev
```

## Testing

The project includes a comprehensive test suite that verifies all aspects of the system. Before running tests, ensure the server is running.

### Running Tests

```bash
# Start the server (in a separate terminal)
npm start

# Running test suites
npm test                # Run all tests
npm run test:api        # Test just the API endpoints
npm run test:users      # Test user-specific minting functionality
npm run test:merkle     # Test Merkle tree verification
npm run test:mocha      # Run Mocha-based tests
```

### Test Suite Components

1. **API Tests** (`test/api/api-test.js`):

   - Verifies all REST endpoints work correctly
   - Tests request/response formats
   - Validates error handling

2. **User Minting Tests** (`test/api/user-minting-cycle-test.js`):

   - Validates the per-user minting cycle functionality
   - Tests user registration and heartbeat
   - Verifies NFTs are minted correctly for each user
   - Confirms sequential heartbeats behave as expected

3. **Merkle Tree Tests** (`test/contract/merkle-test.js`):

   - Confirms correct Merkle tree generation
   - Tests proof verification
   - Validates URI verification against the Merkle tree

4. **Test Runner** (`test/run-tests.js`):
   - A main script that executes all tests in sequence
   - Provides a comprehensive test report

### Writing New Tests

When creating new tests, follow these guidelines:

1. Place API endpoint tests in `test/api/`
2. Place contract-related tests in `test/contract/`
3. Use the provided test utilities and assertions
4. Ensure tests clean up after themselves

## Production Deployment

When deploying to production, consider the following:

1. Set `NODE_ENV=production` in your environment variables
2. Configure appropriate timeout and threshold values based on your expected user behavior
3. Implement proper authentication for admin endpoints like `/api/nft/cleanup`
4. Monitor the data directory to ensure cleanup is working as expected
5. Back up the data directory regularly

## Monitoring and Maintenance

To ensure the system continues to operate correctly:

1. Set up health check monitoring on the `/health` endpoint
2. Monitor disk usage of the data directory
3. Set up alerts for failed transactions or minting errors
4. Periodically check user counts and token counts for unexpected growth

## License

ISC
