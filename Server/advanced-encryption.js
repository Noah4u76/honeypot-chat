import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

// Store user public keys
const userKeys = new Map();
const KEY_DIR = path.join(process.cwd(), 'keys');

// Initialize key storage
export async function initKeyStorage() {
  try {
    await fs.mkdir(KEY_DIR, { recursive: true });
  } catch (error) {
    console.error('Error initializing key storage:', error);
  }
}

// Generate RSA key pair for a user
export async function generateKeyPair(username) {
  return new Promise((resolve, reject) => {
    crypto.generateKeyPair('rsa', {
      modulusLength: 4096,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    }, async (err, publicKey, privateKey) => {
      if (err) {
        reject(err);
        return;
      }
      
      try {
        // Store public key in server's memory for message encryption
        userKeys.set(username, publicKey);
        
        // Save keys to files
        const publicKeyPath = path.join(KEY_DIR, `${username}_public.pem`);
        await fs.writeFile(publicKeyPath, publicKey);
        
        resolve({ publicKey, privateKey });
      } catch (error) {
        reject(error);
      }
    });
  });
}

// Get a user's public key
export function getUserPublicKey(username) {
  return userKeys.get(username);
}

// Set a user's public key
export function setUserPublicKey(username, publicKey) {
  userKeys.set(username, publicKey);
}

// Encrypt a message with recipient's public key (ensures only recipient can decrypt)
export function encryptWithPublicKey(publicKey, message) {
  const buffer = Buffer.from(message, 'utf8');
  const encrypted = crypto.publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING
    },
    buffer
  );
  return encrypted.toString('base64');
}

// E2EE Message Exchange Steps:
// 1. Generate AES session key for the message
// 2. Encrypt the message with AES session key
// 3. Encrypt the AES session key with recipient's public RSA key
// 4. Send both encrypted message and encrypted session key
export function encryptMessage(recipientPublicKey, message) {
  // Generate random AES-256 session key
  const sessionKey = crypto.randomBytes(32);
  
  // Encrypt message with AES session key
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', sessionKey, iv);
  let encryptedMessage = cipher.update(message, 'utf8', 'base64');
  encryptedMessage += cipher.final('base64');
  
  // Encrypt session key with recipient's public key
  const encryptedKey = crypto.publicEncrypt(
    {
      key: recipientPublicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING
    },
    sessionKey
  );
  
  // Return everything needed for recipient to decrypt
  return {
    encryptedMessage,
    encryptedKey: encryptedKey.toString('base64'),
    iv: iv.toString('base64')
  };
}

// Helper function for AES encryption
export function encryptWithAES(message, key = null) {
  const iv = crypto.randomBytes(16);
  // Use provided key or fallback to the hardcoded one
  const secretKey = key || Buffer.from("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", "hex");
  
  const cipher = crypto.createCipheriv('aes-256-cbc', secretKey, iv);
  let encrypted = cipher.update(message, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return `${iv.toString('hex')}:${encrypted}`;
}