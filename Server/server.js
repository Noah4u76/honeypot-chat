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

console.log(`[${new Date().toISOString()}] Secure WebSocket server running on wss://localhost:8000`);

wss.on('connection', (client) => {
    console.log("New client connected.");

    client.authenticated = false;

    client.on('message', (data) => {
        try {
            const parsedData = JSON.parse(data);

            if (parsedData.type === "login") {
                if (handleLogin(client, parsedData.username, parsedData.password)) {
                    client.authenticated = true;
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
            console.error("Failed to parse message:", error);
        }
    });

    client.on('close', () => handleDisconnect(client, wss));
});

// Start HTTPS + WSS Server
httpsServer.listen(8000, '0.0.0.0', () => {
    console.log(`Secure WebSocket server running on https://localhost:8000`);
});
