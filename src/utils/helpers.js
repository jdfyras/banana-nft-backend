/**
 * Validates an Ethereum address
 * @param {string} address - Ethereum address to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function isValidEthereumAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Formats a timestamp to a human-readable date string
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {string} - Formatted date string
 */
function formatTimestamp(timestamp) {
  return new Date(timestamp * 1000).toISOString();
}

/**
 * Calculates time remaining until expiration
 * @param {number} timestamp - Unix timestamp in seconds when the item was created
 * @param {number} threshold - Threshold in seconds
 * @returns {Object} - Time remaining information
 */
function calculateTimeRemaining(timestamp, threshold) {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = timestamp + threshold;
  const secondsRemaining = Math.max(0, expiresAt - now);

  if (secondsRemaining <= 0) {
    return {
      expired: true,
      secondsRemaining: 0,
      formattedRemaining: "Expired",
    };
  }

  // Format the remaining time
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const formattedRemaining = `${minutes}m ${seconds}s`;

  return {
    expired: false,
    secondsRemaining,
    formattedRemaining,
    expiresAt: formatTimestamp(expiresAt),
  };
}

/**
 * Generates a random string of specified length
 * @param {number} length - Length of the string to generate
 * @returns {string} - Random string
 */
function generateRandomString(length = 10) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

module.exports = {
  isValidEthereumAddress,
  formatTimestamp,
  calculateTimeRemaining,
  generateRandomString,
};
