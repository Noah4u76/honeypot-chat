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

    client.username = "Anonymous";
    client.rateLimitData = { timestamps: [], exceedCount: 0, timeoutEnd: 0 };

    client.on('message', (data) => {
        try {
            const parsedData = JSON.parse(data);
            switch (parsedData.type) {
                case "login":
                    handleLogin(client, parsedData.username, parsedData.password);
                    break;
                case "message":
                    handleMessage(client, parsedData.username, parsedData.message);
                    break;
                case "join":
                    handleJoin(client, parsedData.username, wss); // ✅ Pass wss
                    break;
                default:
                    console.warn("Unknown message type received.");
            }
        } catch (error) {
            console.error("Failed to parse message:", error);
        }
    });

    client.on('close', () => handleDisconnect(client));
});

// Start HTTPS + WSS Server
httpsServer.listen(8000, '0.0.0.0', () => {
    console.log(`Secure WebSocket server running on https://localhost:8000`);
});
