import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
// Hardcoded key for testing (64 hex characters = 32 bytes) DONT DO THIS IS PRODUCTION
const SECRET_KEY = Buffer.from("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", "hex");

// Encrypt Message
export function encrypt(message) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
  let encrypted = cipher.update(message, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

// Decrypt Message on the server
export function decrypt(encryptedMessage) {
  const [ivHex, encrypted] = encryptedMessage.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
