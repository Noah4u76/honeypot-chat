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

    broadcast(notification, wss, client);
}

// Handle Messages
export function handleMessage(client, username, message, wss) {
    if (!applyRateLimit(client)) return;
    const encryptedMessage = encrypt(message);
    console.log(`Message from ${username}: ${message}`);

    const outgoing = JSON.stringify({ type: "message", username, message: encryptedMessage });
    broadcast(outgoing, wss, client);
}

// Handle User Disconnecting
export function handleDisconnect(client, wss) {
    console.log(`${client.username} disconnected.`);
    const disconnectMsg = JSON.stringify({
        type: "notification",
        message: encrypt(`${client.username} disconnected.`)
    });

    broadcast(disconnectMsg, wss, client);
}

// Broadcast Message
function broadcast(message, wss, sender = null) {
    wss.clients.forEach(client => {
        if (client !== sender && client.readyState === client.OPEN) {
            client.send(message);
        }
    });
}
