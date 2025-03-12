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



