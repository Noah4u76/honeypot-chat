import fs from 'fs';
import path from 'path';
import express from 'express';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import crypto from 'crypto'; // Add crypto for CAPTCHA token generation

import { handleLogin, handleRegistration } from './auth.js';
import { handleMessage, handleJoin, handleDisconnect, handleFile, handleTypingStatus } from './chat.js';
import { initLogging, logSystemEvent } from './logger.js';
import { initKeyStorage, generateKeyPair } from './advanced-encryption.js';
import { resetExceedCountPeriodically } from './ratelimiting.js';
import { startKeepAlive } from './keep_alive.js'; // <<< NEW
import { setBroadcastFunction } from './presence.js';

// CAPTCHA storage - In production, use a proper database or Redis
const captchas = new Map();

// Paths & Directories Setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Express Server
const app = express();
const STATIC_DIR = path.join(__dirname, '../client');
app.use(express.static(STATIC_DIR));
app.use(express.json());

console.log("__filename ", __filename);
console.log("__dirname ", __dirname);
console.log("STATIC_DIR ", STATIC_DIR);

// Serve login page
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

// CAPTCHA generation endpoint
app.get('/api/captcha', (req, res) => {
  try {
    // Generate a random CAPTCHA code (6 alphanumeric characters)
    const captchaCode = crypto.randomBytes(3).toString('hex').toUpperCase();
    
    // Generate a token that will be used to verify this CAPTCHA
    const token = crypto.randomBytes(32).toString('hex');
    
    // Store the CAPTCHA code with the token (with 10-minute expiration)
    captchas.set(token, {
      code: captchaCode,
      expires: Date.now() + 10 * 60 * 1000 // 10 minutes
    });
    
    // Clean up expired CAPTCHAs
    cleanupExpiredCaptchas();
    
    // Send both the CAPTCHA code and token to the client
    res.json({ 
      token,
      captchaCode
    });
  } catch (error) {
    console.error('Error generating CAPTCHA:', error);
    res.status(500).json({ error: 'Failed to generate CAPTCHA' });
  }
});

// CAPTCHA verification endpoint
app.post('/api/verify-captcha', (req, res) => {
  try {
    const { token, userInput } = req.body;
    
    if (!token || !userInput) {
      return res.status(400).json({ 
        valid: false, 
        message: 'Token and user input are required' 
      });
    }
    
    // Get stored CAPTCHA data
    const captchaData = captchas.get(token);
    
    // Check if CAPTCHA exists and hasn't expired
    if (!captchaData) {
      return res.status(400).json({ 
        valid: false, 
        message: 'CAPTCHA token is invalid or expired' 
      });
    }
    
    if (Date.now() > captchaData.expires) {
      captchas.delete(token);
      return res.status(400).json({ 
        valid: false, 
        message: 'CAPTCHA has expired' 
      });
    }
    
    // Verify user input against the stored CAPTCHA code (case-insensitive)
    const isValid = userInput.toUpperCase() === captchaData.code;
    
    // If valid, delete the used CAPTCHA
    if (isValid) {
      captchas.delete(token);
    }
    
    res.json({ 
      valid: isValid,
      message: isValid ? 'CAPTCHA validation successful' : 'Incorrect CAPTCHA code'
    });
  } catch (error) {
    console.error('Error verifying CAPTCHA:', error);
    res.status(500).json({ 
      valid: false, 
      message: 'Error verifying CAPTCHA' 
    });
  }
});

// Helper function to clean up expired CAPTCHAs
function cleanupExpiredCaptchas() {
  const now = Date.now();
  for (const [token, data] of captchas.entries()) {
    if (now > data.expires) {
      captchas.delete(token);
    }
  }
}

// Initialize key storage and logging system
async function init() {
  await initKeyStorage();
  await initLogging();
  await logSystemEvent('Server started');
}

// Initialize server
const port = process.env.PORT || 8001;
const server = app.listen(port, () => {
  // Get the base URL from environment variables
  let baseUrl = process.env.RAILWAY_STATIC_URL || process.env.SELF_URL || `localhost:${port}`;
  
  // Ensure URL has a protocol
  const appUrl = baseUrl.startsWith('http') ? baseUrl : 
                (baseUrl.includes('localhost') ? `http://${baseUrl}` : `https://${baseUrl}`);
  
  console.log(`[${new Date().toISOString()}] Server running on ${appUrl}`);
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Configure broadcast function for presence updates
setBroadcastFunction((data) => {
  wss.clients.forEach(client => {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
});

// Ping all clients every 30 seconds to keep connections alive
const PING_INTERVAL = 30000; // 30 seconds
setInterval(() => {
  wss.clients.forEach(client => {
    if (client.readyState === client.OPEN) {
      // Set a timeout to terminate the connection if no pong is received
      client.isAlive = false;
      client.ping();
      
      // Log ping attempts in debug mode
      console.log(`[${new Date().toISOString()}] Sent ping to client`);
    }
  });
}, PING_INTERVAL);

// Handle WebSocket connections
wss.on('connection', (client, req) => {
  console.log("New client connected.");

  // Set up ping-pong mechanism
  client.isAlive = true;
  client.on('pong', () => {
    // Mark the connection as alive when pong is received
    client.isAlive = true;
    console.log(`[${new Date().toISOString()}] Received pong from client`);
  });

  // Set a timeout checker to close dead connections
  const connectionChecker = setInterval(() => {
    if (client.isAlive === false) {
      console.log(`[${new Date().toISOString()}] Client connection dead. Terminating.`);
      clearInterval(connectionChecker);
      client.terminate();
      handleDisconnect(client, wss);
      return;
    }
    
    // Mark as not alive until the next pong is received
    client.isAlive = false;
  }, PING_INTERVAL + 10000); // Check 10 seconds after ping to give time for pong

  // Clear interval on close to prevent memory leaks
  client.on('close', () => {
    clearInterval(connectionChecker);
    console.log("Client disconnected.");
    handleDisconnect(client, wss);
  });

  // Get the client's IP address
  const clientIP = req.socket.remoteAddress;
  client.ip = clientIP;
  client.authenticated = false;

  client.on('message', async (data) => {
    try {
      console.log("Server received raw data:", data);
      const parsedData = JSON.parse(data);
      console.log("Received:", parsedData);

      switch (parsedData.type) {
        case "login":
          const success = await handleLogin(client, parsedData.username, parsedData.password, clientIP);
          client.authenticated = success;
          break;

        case "registration":
          const registration_success = await handleRegistration(client, parsedData.username, parsedData.password, clientIP);
          client.authenticated = registration_success;
          break;

        case "join":
          client.authenticated = true;
          handleJoin(client, parsedData.username, wss);
          break;

        case "message":
          if (!client.authenticated) {
            client.send(JSON.stringify({ type: "error", error: "You must be logged in to send messages." }));
            return;
          }
          handleMessage(client, parsedData.username, parsedData.message, parsedData.reciever, wss);
          break;

        case "file":
          if (!client.authenticated) {
            client.send(JSON.stringify({ type: "error", error: "You must be logged in to send files." }));
            return;
          }
          handleFile(client, parsedData.username, parsedData.filename, parsedData.filetype, parsedData.data, parsedData.reciever, wss);
          break;

        case "publicKey":
          if (!client.authenticated) {
            client.send(JSON.stringify({ type: "error", error: "You must be logged in to exchange keys." }));
            return;
          }
          handlePublicKey(client, parsedData.username, parsedData.publicKey);
          break;

        case "typing":
          if (!client.authenticated) {
            client.send(JSON.stringify({ type: "error", error: "You must be logged in to send typing status." }));
            return;
          }
          handleTypingStatus(client, parsedData.username, parsedData.isTyping, wss);
          break;

        default:
          client.send(JSON.stringify({ type: "error", error: "Unknown message type." }));
      }
    } catch (error) {
      console.error("Error processing message:", error);
    }
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

// Periodically reset rate limiting
setInterval(() => {
  wss.clients.forEach(client => {
    if (client.authenticated && client.rateLimitData) {
      resetExceedCountPeriodically(client);
    }
  });
}, 60000);

// Start keep-alive pings
init()
  .then(() => {
    startKeepAlive();
  })
  .catch(error => {
    console.error('Failed to initialize server:', error);
  });
