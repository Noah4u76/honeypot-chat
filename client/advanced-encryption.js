// Store the user's key pair
let privateKey = null;
let publicKey = null;

// Generate or load RSA key pair
async function initializeKeys() {
  // First, check if we have keys in local storage
  const savedPrivateKey = localStorage.getItem('privateKey');
  const savedPublicKey = localStorage.getItem('publicKey');
  
  if (savedPrivateKey && savedPublicKey) {
    privateKey = savedPrivateKey;
    publicKey = savedPublicKey;
    return { privateKey, publicKey };
  }
  
  // If no saved keys, generate new ones
  return generateKeyPair();
}

// Generate a new RSA key pair
async function generateKeyPair() {
  const username = localStorage.getItem('username');
  // Request key generation from server
  const response = await fetch('/generate-keys', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ username })
  });
  
  if (!response.ok) {
    throw new Error('Failed to generate keys');
  }
  
  const keys = await response.json();
  
  // Store keys
  privateKey = keys.privateKey;
  publicKey = keys.publicKey;
  
  // Save to localStorage
  localStorage.setItem('privateKey', privateKey);
  localStorage.setItem('publicKey', publicKey);
  
  return { privateKey, publicKey };
}

// Decrypt a message using the user's private key and an encrypted session key
async function decryptE2EE(encryptedData) {
  if (!privateKey) {
    await initializeKeys();
  }
  
  // Parse the encrypted data
  const { encryptedMessage, encryptedKey, iv } = JSON.parse(encryptedData);
  
  // Decrypt the session key with the user's private key
  const sessionKey = crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING
    },
    Buffer.from(encryptedKey, 'base64')
  );
  
  // Decrypt the message with the session key
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc', 
    sessionKey, 
    Buffer.from(iv, 'base64')
  );
  
  let decrypted = decipher.update(encryptedMessage, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// For backward compatibility with existing encryption
async function decrypt(encryptedMessage) {
  // Check if this is an E2EE message
  if (encryptedMessage.startsWith('{') && encryptedMessage.endsWith('}')) {
    return decryptE2EE(encryptedMessage);
  }
  
  // Otherwise, use the old AES decryption
  const [ivHex, dataHex] = encryptedMessage.split(':');
  const iv = hexStringToArrayBuffer(ivHex);
  const encryptedData = hexStringToArrayBuffer(dataHex);
  const key = await window.crypto.subtle.importKey(
    "raw",
    SECRET_KEY,
    { name: "AES-CBC" },
    false,
    ["decrypt"]
  );
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-CBC", iv: iv },
    key,
    encryptedData
  );
  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

function hexStringToArrayBuffer(hexString) {
  const result = new Uint8Array(hexString.length / 2);
  for (let i = 0; i < hexString.length; i += 2) {
    result[i / 2] = parseInt(hexString.substr(i, 2), 16);
  }
  return result;
}

// Expose functions globally
window.initializeE2EE = initializeKeys;
window.decrypt = decrypt;