import { applyRateLimit } from './ratelimiting.js';
import { encrypt } from './encryption.js';

// Handle User Joining
export function handleJoin(client, username, wss) {
  client.username = username;
  console.log(`${username} joined the chat.`);

  const notification = JSON.stringify({
    type: "notification",
    username,
    message: encrypt(`${username} joined the chat.`)
  });

  broadcast(notification, wss);
}

// Handle Messages
export function handleMessage(client, username, message, wss) {
  if (!applyRateLimit(client)) return;
  const encryptedMessage = encrypt(message);
  console.log(`Message from ${username}: ${message}`);

  const outgoing = JSON.stringify({ type: "message", username, message: encryptedMessage });
  broadcast(outgoing, wss);
}


//Handles file sharing
export function handleFile(client, username,sentfilename,sentfiletype ,contents, wss) {
  if (!applyRateLimit(client)) return;
  const encryptedContents = encrypt(contents);
  console.log(`Contents from ${username}: ${contents}`);

  const outgoing = JSON.stringify({ type: "file", username,filename: sentfilename,
  filetype:sentfiletype, data: encryptedContents });
  broadcast(outgoing, wss);
}

// Handle User Disconnecting
export function handleDisconnect(client, wss) {
  console.log(`${client.username} disconnected.`);
  const disconnectMsg = JSON.stringify({
    type: "notification",
    message: encrypt(`${client.username} disconnected.`)
  });

  broadcast(disconnectMsg, wss);
}

// Broadcast Message
function broadcast(message, wss) {
  wss.clients.forEach(client => {
    if (client.readyState === client.OPEN) {
      client.send(message);
    }
  });
}
