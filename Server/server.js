import https from 'https';
import fs from 'fs';
import path from 'path';
import express from 'express';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';

import { handleLogin } from './auth.js';
import { handleMessage, handleJoin, handleDisconnect, handleFile } from './chat.js';
import { initLogging, logSystemEvent } from './logger.js';
import { initKeyStorage, generateKeyPair } from './advanced-encryption.js';
import { resetExceedCountPeriodically } from './ratelimiting.js';

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
app.use(express.json());

app.get('/', (req, res) => {
  res.sendFile(path.join(STATIC_DIR, 'login.html'));
});

// Add endpoint for key generation
app.post('/generate-keys', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    const keys = await generateKeyPair(username);
    res.json(keys);
  } catch (error) {
    console.error('Error generating keys:', error);
    res.status(500).json({ error: 'Failed to generate keys' });
  }
});

// Initialize key storage and logging system
async function init() {
  await initKeyStorage();
  await initLogging();
  await logSystemEvent('Server started');
}

// Create HTTPS Server
const httpsServer = https.createServer(serverOptions, app);
const wss = new WebSocketServer({ server: httpsServer });

console.log(`[${new Date().toISOString()}] Server running on https://0.0.0.0:8001`); //Change to IP, for debugging connection DONT COMMIT IP

wss.on('connection', (client, req) => {
  console.log("New client connected.");
  // Get the client's IP address
  const clientIP = req.socket.remoteAddress;
  client.ip = clientIP;
  
  client.authenticated = false;

  client.on('message', async (data) => {
    try {
      console.log(data);
      const parsedData = JSON.parse(data);
      console.log("Received:", parsedData);
      console.log("Server received raw data:", data);

      switch (parsedData.type) {
        case "login":
          // Handle login on this connection with password validation.
          const success = await handleLogin(client, parsedData.username, parsedData.password, clientIP);
          client.authenticated = success;
          // Response is sent by handleLogin function
          break;

        case "join":
          // For chat connections, mark them as authenticated
          client.authenticated = true;
          handleJoin(client, parsedData.username, wss);
          break;

        case "message":
          if (!client.authenticated) {
            client.send(JSON.stringify({ type: "error", error: "You must be logged in to send messages." }));
            return;
          }
          // Note: Pass the reciever field along to the handler.
          handleMessage(client, parsedData.username, parsedData.message, parsedData.reciever, wss);
          break;

        case "file":
          if (!client.authenticated) {
            client.send(JSON.stringify({ type: "error", error: "You must be logged in to send messages." }));
            return;
          }
          handleFile(client, parsedData.username, parsedData.filename, parsedData.filetype, parsedData.data, parsedData.reciever, wss);
          break;
          
        case "publicKey":
          // Handle a client sending their public key
          if (!client.authenticated) {
            client.send(JSON.stringify({ type: "error", error: "You must be logged in to exchange keys." }));
            return;
          }
          handlePublicKey(client, parsedData.username, parsedData.publicKey);
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

// Handle client public key submission
function handlePublicKey(client, username, publicKey) {
  try {
    setUserPublicKey(username, publicKey);
    client.send(JSON.stringify({ type: "keyExchange", status: "success" }));
    logSystemEvent(`Public key received from user ${username}`);
  } catch (error) {
    console.error("Error storing public key:", error);
    client.send(JSON.stringify({ 
      type: "error", 
      error: "Failed to store public key."
    }));
  }
}

// Initialize server
init().then(() => {
  httpsServer.listen(8001, () => console.log(`HTTPS running on https://0.0.0.0:8001`)); //Change to IP, for debugging connection DONT COMMIT IT
}).catch(error => {
  console.error('Failed to initialize server:', error);
});

setInterval(() => {
  wss.clients.forEach(client => {
    if (client.authenticated && client.rateLimitData) {
      resetExceedCountPeriodically(client);
    }
  });
}, 60000); // Check every minute

