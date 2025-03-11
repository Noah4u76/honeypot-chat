import https from 'https';
import fs from 'fs';
import { WebSocketServer } from 'ws';
import { handleLogin } from './auth.js';
import { handleMessage, handleJoin, handleDisconnect } from './chat.js';

// Load SSL/TLS Certificates
const serverOptions = {
    key: fs.readFileSync('../certs/key.pem'),
    cert: fs.readFileSync('../certs/cert.pem')
};

// Create HTTPS Server (Required for WSS)
const httpsServer = https.createServer(serverOptions);

// Create Secure WebSocket Server
const wss = new WebSocketServer({ server: httpsServer });

console.log(`[${new Date().toISOString()}] Secure WebSocket server running on https://0.0.0.0:8001`); // Your IP Address (Dont commit IP Address)

wss.on('connection', (client) => {
    console.log("New client connected.");
    client.authenticated = false; // Ensure client is marked unauthenticated initially

    client.on('message', async (data) => {
        try {
            const message = typeof data === "string" ? data.trim() : data.toString().trim();

            if (!message) {
                console.warn("Received empty message. Ignoring.");
                return;
            }

            const parsedData = JSON.parse(message);

            if (parsedData.type === "login") {
                const loginSuccess = await handleLogin(client, parsedData.username, parsedData.password);
                if (loginSuccess) {
                    client.authenticated = true; // Mark as authenticated
                    console.log(`${parsedData.username} authenticated successfully.`);
                    console.log("join occured")
                    handleJoin(client, parsedData.username, wss);
                }
            } else if (parsedData.type === "message") {
                if (!client.authenticated) {
                    console.warn("Blocked unauthenticated user from sending a message.");
                    client.send(JSON.stringify({ type: "error", error: "You must be logged in to send messages." }));
                    return;
                }
                handleMessage(client, parsedData.username, parsedData.message, wss);
            } 
        } catch (error) {
            console.error("Error parsing message:", error.message);
            client.send(JSON.stringify({ type: "error", error: "Invalid JSON format." }));
        }
    });

    client.on('close', () => handleDisconnect(client, wss));
});

// Start HTTPS + WSS Server
httpsServer.listen(8001, '0.0.0.0', () => {
    console.log(`Secure WebSocket server running on https://0.0.0.0:8001`); // Your IP Address (Dont commit IP Address)
});
