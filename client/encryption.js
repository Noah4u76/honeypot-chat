import crypto from 'crypto';

const algorithm = 'aes-256-cbc';
const secretKey = crypto.scryptSync("your_super_secret_key", 'salt', 32);
const iv = crypto.randomBytes(16); // Unique for every encryption

export function encrypt(text) {
    const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + encrypted; // Append to encrypted message
}

export function decrypt(encryptedText) {
    const iv = Buffer.from(encryptedText.substring(0, 32), 'hex');
    const encrypted = encryptedText.substring(32);
    const decipher = crypto.createDecipheriv(algorithm, secretKey, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}
