/*import crypto from 'crypto';

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
}*/



import CryptoJS from "crypto-js";

const secretKey = "your_super_secret_key"; // Must be 256 bits (32 characters for AES-256)
const iv = CryptoJS.lib.WordArray.random(16); // IV should be random for each encryption

export function encrypt(text) {
    const encrypted = CryptoJS.AES.encrypt(text, CryptoJS.enc.Utf8.parse(secretKey), {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    });
    return iv.toString(CryptoJS.enc.Hex) + encrypted.toString(); // Append IV to encrypted text
}

export function decrypt(encryptedText) {
    const ivHex = encryptedText.substring(0, 32);
    const encrypted = encryptedText.substring(32);

    const iv = CryptoJS.enc.Hex.parse(ivHex);
    const decrypted = CryptoJS.AES.decrypt(encrypted, CryptoJS.enc.Utf8.parse(secretKey), {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    });

    return decrypted.toString(CryptoJS.enc.Utf8);
}



