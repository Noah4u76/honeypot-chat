import https from 'https';
import fs from 'fs';
import path from 'path';
import express from 'express';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';

import { handleLogin } from './auth.js';
import { handleMessage, handleJoin, handleDisconnect } from './chat.js';

// Paths & Directories Setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SSL/TLS Certificates
const CERT_PATH = path.join(__dirname, '../certs');
const serverOptions = {
    key: fs.readFileSync(path.join(CERT_PATH, 'key.pem')),
    cert: fs.readFileSync(path.join(CERT_PATH, 'cert.pem'))
};

// Express Server
const app = express();
const STATIC_DIR = path.join(__dirname, '../client');
app.use(express.static(STATIC_DIR));

app.get('/', (req, res) => {
    res.sendFile(path.join(STATIC_DIR, 'index.html'));
});

// Create HTTPS Server
const httpsServer = https.createServer(serverOptions, app);
const wss = new WebSocketServer({ server: httpsServer });

console.log(`[${new Date().toISOString()}] Server running on https://192.168.1.233:8001`); //Change to IP, for debugging connection

wss.on('connection', (client) => {
    console.log("New client connected.");
    client.authenticated = false;

    client.on('message', async (data) => {
        try {
            const parsedData = JSON.parse(data);
            console.log("Received:", parsedData);

            switch (parsedData.type) {
                case "login":
                    const success = await handleLogin(client, parsedData.username, parsedData.password);
                    client.authenticated = success;
                    client.send(JSON.stringify({ type: "login", status: success ? "success" : "fail" }));

                    if (success) {
                        handleJoin(client, parsedData.username, wss);
                    }
                    break;

                case "message":
                    if (!client.authenticated) {
                        client.send(JSON.stringify({ type: "error", error: "You must be logged in to send messages." }));
                        return;
                    }
                    handleMessage(client, parsedData.username, parsedData.message, wss);
                    break;
            }
        } catch (error) {
            console.error("Error processing message:", error);
        }
    });

    client.on('close', () => {
        console.log("Client disconnected.");
        handleDisconnect(client, wss);
    });
});


httpsServer.listen(8001, () => console.log(`HTTPS running on https://192.168.1.233:8001`)); //Change to IP, for debugging connection
