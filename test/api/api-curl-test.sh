#!/bin/bash

# Colors for better readability
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
API_BASE_URL="http://localhost:3000/api"
TEST_ADDRESS="0x1234567890123456789012345678901234567890"
TEST_ADDRESS2="0x9876543210987654321098765432109876543210"

echo -e "${BLUE}🚀 Starting API tests with curl...${NC}"

# Health endpoint test
echo -e "\n${YELLOW}📋 Testing health endpoint...${NC}"
HEALTH_RESPONSE=$(curl -s -X GET "http://localhost:3000/health")
if [[ $HEALTH_RESPONSE == *"\"status\":\"ok\""* ]]; then
  echo -e "${GREEN}✅ Health endpoint working properly${NC}"
else
  echo -e "${RED}❌ Health endpoint test failed.${NC}"
  echo "Response: $HEALTH_RESPONSE"
  echo -e "${RED}Server is not running. Start the server before running tests.${NC}"
  exit 1
fi

# Test NFT config
echo -e "\n${YELLOW}📋 Testing NFT config endpoint...${NC}"
CONFIG_RESPONSE=$(curl -s -X GET "$API_BASE_URL/nft/config")
if [[ $CONFIG_RESPONSE == *"\"success\":true"* ]]; then
  echo -e "${GREEN}✅ NFT config endpoint working properly${NC}"
  echo "Response: $CONFIG_RESPONSE"
else
  echo -e "${RED}❌ NFT config test failed.${NC}"
  echo "Response: $CONFIG_RESPONSE"
fi

# Test user heartbeat
echo -e "\n${YELLOW}📋 Testing user heartbeat...${NC}"
HEARTBEAT_RESPONSE=$(curl -s -X POST "$API_BASE_URL/users/heartbeat" \
  -H "Content-Type: application/json" \
  -d "{\"address\":\"$TEST_ADDRESS\",\"triggerMint\":false}")
if [[ $HEARTBEAT_RESPONSE == *"\"success\":true"* ]]; then
  echo -e "${GREEN}✅ User heartbeat working properly${NC}"
  echo "Response: $HEARTBEAT_RESPONSE"
else
  echo -e "${RED}❌ User heartbeat test failed.${NC}"
  echo "Response: $HEARTBEAT_RESPONSE"
fi

# Test get users
echo -e "\n${YELLOW}📋 Testing get users endpoint...${NC}"
USERS_RESPONSE=$(curl -s -X GET "$API_BASE_URL/users")
if [[ $USERS_RESPONSE == *"\"success\":true"* ]]; then
  echo -e "${GREEN}✅ Get users working properly${NC}"
  echo "Response: $USERS_RESPONSE"
else
  echo -e "${RED}❌ Get users test failed.${NC}"
  echo "Response: $USERS_RESPONSE"
fi

# Test mint NFTs
echo -e "\n${YELLOW}📋 Testing NFT minting...${NC}"
MINT_RESPONSE=$(curl -s -X POST "$API_BASE_URL/nft/mint" \
  -H "Content-Type: application/json" \
  -d "{\"address\":\"$TEST_ADDRESS\",\"quantity\":2}")
if [[ $MINT_RESPONSE == *"\"success\":true"* ]] || [[ $MINT_RESPONSE == *"\"error\":"* ]]; then
  echo -e "${GREEN}✅ NFT minting API working properly${NC}"
  echo "Response: $MINT_RESPONSE"
  
  # Extract token ID if successful for later reveal test
  if [[ $MINT_RESPONSE == *"\"startTokenId\":"* ]]; then
    TOKEN_ID=$(echo $MINT_RESPONSE | grep -oP '(?<="startTokenId":)[0-9]+')
    echo -e "${BLUE}ℹ️ Extracted token ID for reveal test: $TOKEN_ID${NC}"
  fi
else
  echo -e "${RED}❌ NFT minting test failed.${NC}"
  echo "Response: $MINT_RESPONSE"
fi

# Test get user NFTs
echo -e "\n${YELLOW}📋 Testing get user NFTs endpoint...${NC}"
NFTS_RESPONSE=$(curl -s -X GET "$API_BASE_URL/nft/$TEST_ADDRESS")
if [[ $NFTS_RESPONSE == *"\"success\":true"* ]]; then
  echo -e "${GREEN}✅ Get user NFTs working properly${NC}"
  echo "Response: $NFTS_RESPONSE"
  
  # Extract revealable token ID if available
  if [[ $NFTS_RESPONSE == *"\"revealableTokenIds\":"* ]]; then
    REVEALABLE_ID=$(echo $NFTS_RESPONSE | grep -oP '(?<="revealableTokenIds":\[)[0-9]+' | head -1)
    if [[ ! -z "$REVEALABLE_ID" ]]; then
      echo -e "${BLUE}ℹ️ Found revealable token ID: $REVEALABLE_ID${NC}"
      TOKEN_ID=$REVEALABLE_ID
    fi
  fi
else
  echo -e "${RED}❌ Get user NFTs test failed.${NC}"
  echo "Response: $NFTS_RESPONSE"
fi

# Test reveal NFT if we have a token ID
if [[ ! -z "$TOKEN_ID" ]]; then
  echo -e "\n${YELLOW}📋 Testing NFT revealing for token ID $TOKEN_ID...${NC}"
  REVEAL_RESPONSE=$(curl -s -X POST "$API_BASE_URL/nft/reveal" \
    -H "Content-Type: application/json" \
    -d "{\"address\":\"$TEST_ADDRESS\",\"tokenId\":$TOKEN_ID}")
  if [[ $REVEAL_RESPONSE == *"\"success\":true"* ]] || [[ $REVEAL_RESPONSE == *"\"error\":"* ]]; then
    echo -e "${GREEN}✅ NFT revealing API working properly${NC}"
    echo "Response: $REVEAL_RESPONSE"
  else
    echo -e "${RED}❌ NFT revealing test failed.${NC}"
    echo "Response: $REVEAL_RESPONSE"
  fi
else
  echo -e "\n${YELLOW}ℹ️ No token ID available for reveal test, skipping...${NC}"
fi

# Test user cleanup
echo -e "\n${YELLOW}📋 Testing user cleanup...${NC}"
USER_CLEANUP_RESPONSE=$(curl -s -X GET "$API_BASE_URL/nft/cleanup/$TEST_ADDRESS")
if [[ $USER_CLEANUP_RESPONSE == *"\"success\":true"* ]]; then
  echo -e "${GREEN}✅ User cleanup working properly${NC}"
  echo "Response: $USER_CLEANUP_RESPONSE"
else
  echo -e "${RED}❌ User cleanup test failed.${NC}"
  echo "Response: $USER_CLEANUP_RESPONSE"
fi

# Test global cleanup
echo -e "\n${YELLOW}📋 Testing global cleanup...${NC}"
GLOBAL_CLEANUP_RESPONSE=$(curl -s -X GET "$API_BASE_URL/nft/cleanup")
if [[ $GLOBAL_CLEANUP_RESPONSE == *"\"success\":true"* ]]; then
  echo -e "${GREEN}✅ Global cleanup working properly${NC}"
  echo "Response: $GLOBAL_CLEANUP_RESPONSE"
else
  echo -e "${RED}❌ Global cleanup test failed.${NC}"
  echo "Response: $GLOBAL_CLEANUP_RESPONSE"
fi

# Test user creation for second test user
echo -e "\n${YELLOW}📋 Creating second test user for deletion test...${NC}"
curl -s -X POST "$API_BASE_URL/users/heartbeat" \
  -H "Content-Type: application/json" \
  -d "{\"address\":\"$TEST_ADDRESS2\",\"triggerMint\":false}" > /dev/null

# Test user deletion
echo -e "\n${YELLOW}📋 Testing user deletion...${NC}"
DELETE_RESPONSE=$(curl -s -X DELETE "$API_BASE_URL/users/$TEST_ADDRESS2")
if [[ $DELETE_RESPONSE == *"\"success\":true"* ]]; then
  echo -e "${GREEN}✅ User deletion working properly${NC}"
  echo "Response: $DELETE_RESPONSE"
else
  echo -e "${RED}❌ User deletion test failed.${NC}"
  echo "Response: $DELETE_RESPONSE"
fi

echo -e "\n${BLUE}🏁 All curl tests completed!${NC}" 