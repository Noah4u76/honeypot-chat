// This key MUST match the one set on the server.
const SECRET_KEY_HEX = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

function hexStringToArrayBuffer(hexString) {
  const result = new Uint8Array(hexString.length / 2);
  for (let i = 0; i < hexString.length; i += 2) {
    result[i / 2] = parseInt(hexString.substr(i, 2), 16);
  }
  return result;
}

const SECRET_KEY = hexStringToArrayBuffer(SECRET_KEY_HEX);

// Decrypt function I used the Web Crypto API
async function decrypt(encryptedMessage) {
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

// Expose the decrypt function globally for chat.js
window.decrypt = decrypt;
