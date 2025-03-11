import { applyRateLimit } from './ratelimiting.js';
import { encrypt } from './encryption.js'; 

// Handle User Joining
export function handleJoin(client, username, wss) {
    client.username = username;

    const encryptedNotification =encrypt(`${username} joined the chat.`,3) 
    console.log(`${username} joined the chat.`);

    const joinNotification = JSON.stringify({
        type: "notification",
        username : username,
        message: encryptedNotification
    });

    broadcast(joinNotification, wss, client);

    // Send user list
    /*const userList = Array.from(wss.clients)
        .map(c => c.username)
        .filter(name => name !== "Anonymous")
        .join(", ");

    client.send(JSON.stringify({ type: "userList", message: `Users in chat: ${userList}` }));*/
}

// Handle a user sending a message
export function handleMessage(client, username, message, wss) {
    if (!applyRateLimit(client)) {
        return;
    }

    const sanitizedMessage = sanitizeInput(message);
    const encryptedMessage = encrypt(sanitizedMessage,3)

    console.log(`Message from ${username}: ${sanitizedMessage}`);
    console.log(`Message from ${username}: ${encryptedMessage}`);

    const outgoingMessage = JSON.stringify({
        type: "message",
        username: username,
        message: encryptedMessage
    });

    broadcast(outgoingMessage, wss, client);
}

function sanitizeInput(input) {
    return input.replace(/</g, "&lt;").replace(/>/g, "&gt;"); // Prevents XSS
}


// Handle a user disconnecting from the chat
export function handleDisconnect(client, wss) {
    const encryptedNotification =encrypt(`${client.username} disconnected.`,3) 

    console.log(`${client.username} disconnected.`);
    console.log(encryptedNotification);

    const disconnectMsg = JSON.stringify({
        type: "notification",
        message: encryptedNotification
    });

    broadcast(disconnectMsg, wss, client);
}

// Broadcast a message to all connected clients (except sender)
function broadcast(message, wss, sender = null) {
    if (!wss || !wss.clients) {
        console.error("WebSocket server (wss) is undefined.");
        return;
    }

    wss.clients.forEach(client => {
        if (client !== sender && client.readyState === client.OPEN) {
            client.send(message);
        }
    });
}
