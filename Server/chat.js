import { applyRateLimit } from './rateLimit.js';

// Handle User Joining
export function handleJoin(client, username, wss) {
    client.username = username;
    console.log(`${username} joined the chat.`);

    const joinNotification = JSON.stringify({
        type: "notification",
        message: `${username} joined the chat.`
    });

    broadcast(joinNotification, wss, client);

    // Send user list
    const userList = Array.from(wss.clients)
        .map(c => c.username)
        .filter(name => name !== "Anonymous")
        .join(", ");

    client.send(JSON.stringify({ type: "userList", message: `Users in chat: ${userList}` }));
}


// Handle Incoming Messages (with Rate Limiting)
export function handleMessage(client, username, message) {
    if (!applyRateLimit(client)) return;

    console.log(`Message from ${username}: ${message}`);

    // Broadcast message
    const msg = JSON.stringify({ type: "message", username, message });
    broadcast(msg, client);
}

// Handle User Disconnection
export function handleDisconnect(client) {
    const disconnectMsg = JSON.stringify({
        type: "notification",
        message: `${client.username} disconnected.`
    });

    console.log(`${client.username} disconnected.`);
    broadcast(disconnectMsg, client);
}

// Broadcast Message to All Clients (Except Sender)
function broadcast(message, wss, sender = null) {
    wss.clients.forEach(client => {
        if (client !== sender && client.readyState === client.OPEN) {
            client.send(message);
        }
    });
}