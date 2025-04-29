import { applyRateLimit } from './ratelimiting.js';
import { encrypt } from './encryption.js';
import { logMessage, logSystemEvent } from './logger.js';
import mysql from 'mysql2'
import { 
  initUserPresence, 
  removeUserPresence, 
  setUserTyping, 
  updateUserStatus,
  broadcastPresenceUpdate,
  sendAllPresenceToClient 
} from './presence.js';




/*const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'USERS',
}).promise()*/




/*async function getUserIDFromDatabase(username) {
  const [rows] = await pool.query(`SELECT USER_ID FROM USER WHERE USERNAME = ?`, [username]);
  return rows;
}*/


/*const result = await getUserIDFromDatabase("user1")
console.log("user id ", result)*/




/*const MESSAGE_TABLE = await pool.query(`CREATE TABLE IF NOT EXISTS MESSAGE (
  MESSAGE_ID INT NOT NULL AUTO_INCREMENT,
  SENDER_ID INT NOT NULL,
  RECEIVER_ID INT, -- NULL for global messages
  CONTENT TEXT NOT NULL, -- Encrypted message content
  IS_FILE BOOLEAN DEFAULT FALSE,
  TIMESTAMP TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(MESSAGE_ID),
  FOREIGN KEY (SENDER_ID) REFERENCES USER(USER_ID),
  FOREIGN KEY (RECEIVER_ID) REFERENCES USER(USER_ID)
)`)*/



let userList = [];

function addUser(username) {
  userList.push(username);
}

function removeUser(username) {
  const index = userList.indexOf(username);
  if (index > -1) {
    userList.splice(index, 1); // Remove 1 element at the found index
  }
}

// Handle User Joining
export async function handleJoin(client, username, wss) {
  client.username = username;
  console.log(`${username} joined the chat.`);
  await logSystemEvent(`${username} joined the chat.`);
  
  addUser(username);
  console.log("here is the list ", userList);
  
  // Initialize rate limiting data for this client
  client.rateLimitData = {
    timestamps: [],
    fileTimestamps: [],
    exceedCount: 0,
    lastViolationTime: 0,
    timeoutEnd: 0
  };
  
  // Initialize and broadcast user's presence
  initUserPresence(username);
  broadcastPresenceUpdate(username);
  
  // Send presence data for all online users to the newly connected client
  sendAllPresenceToClient(client);
  
  // Legacy encryption for notifications
  const notification = JSON.stringify({
    type: "notification",
    username,
    userList,
    message: encrypt(`${username} joined the chat.`)
  });
  
  broadcast(notification, wss);
}

// Handle Messages with appropriate encryption
export async function handleMessage(client, username, message, reciever, wss) {
  // Apply rate limiting - if this returns false, exit the function early
  // Pass the wss object to allow for timeout notifications
  if (!applyRateLimit(client, 'message', wss)) {
    console.log(`Rate limit applied to user ${username}. Message rejected.`);
    return;
  }
  
  console.log(`Message from ${username} to ${reciever}: ${message}`);
  await logMessage('message', username, message, reciever);
  
  // Sanitize message to only allow <b>, <i>, <u> tags
  // This helps prevent XSS attacks while still allowing formatting
  const sanitizedMessage = sanitizeMessage(message);
  
  // Encrypt the message using the existing encryption function
  const encryptedMessage = encrypt(sanitizedMessage);
  
  const outgoing = JSON.stringify({ 
    type: "message", 
    username, 
    reciever, 
    message: encryptedMessage 
  });

  if (reciever === "All") {
    // Broadcast to everyone
    broadcast(outgoing, wss);
  } else {
    // Send only to the sender and the specific recipient
    wss.clients.forEach(c => {
      if (c.readyState === c.OPEN && (c.username === reciever || c.username === username)) {
        c.send(outgoing);
      }
    });
  }
}

// Function to sanitize message content to only allow certain HTML tags
function sanitizeMessage(message) {
  if (!message) return '';
  
  // Replace all HTML tags except b, i, u
  let sanitized = message
    // First convert < and > that are part of HTML tags to temp tokens
    .replace(/<(\/?(b|i|u))[^>]*>/gi, '§$1§')
    // Then escape all remaining < and > to prevent other HTML
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Finally restore the allowed tags 
    .replace(/§(\/?(b|i|u))§/gi, '<$1>');
  
  return sanitized;
}

// Handles file sharing with recipient support
export async function handleFile(client, username, sentfilename, sentfiletype, contents, reciever, wss) {
  // Apply rate limiting
  // Pass the wss object to allow for timeout notifications
  if (!applyRateLimit(client, 'file', wss)) {
    console.log(`Rate limit applied to user ${username}. File upload rejected.`);
    return;
  }
  
  console.log(`File from ${username} to ${reciever}: ${sentfilename}`);
  await logMessage('file', username, `File: ${sentfilename}`, reciever);
  
  // Use the existing encryption function
  const encryptedContents = encrypt(contents);

  const outgoing = JSON.stringify({ 
    type: "file", 
    username, 
    reciever,
    filename: sentfilename,
    filetype: sentfiletype, 
    data: encryptedContents 
  });
  
  if (reciever === "All") {
    broadcast(outgoing, wss);
  } else {
    // Send only to the sender and the designated recipient
    wss.clients.forEach(c => {
      if (c.readyState === c.OPEN && (c.username === reciever || c.username === username)) {
        c.send(outgoing);
      }
    });
  }
}

// Handle User Disconnecting
export async function handleDisconnect(client, wss) {
  if (!client.username) return;
  
  removeUser(client.username);
  // Update presence status to offline and broadcast
  removeUserPresence(client.username);
  broadcastPresenceUpdate(client.username);
  
  console.log(`${client.username} disconnected.`);
  console.log("here is the list ", userList);
  await logSystemEvent(`${client.username} disconnected.`);

  const disconnectMsg = JSON.stringify({
    type: "notification",
    userList,
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

// Send a system notification to the chat
export function sendSystemNotification(wss, message) {
  const encryptedMessage = encrypt(message);
  const notification = JSON.stringify({
    type: "notification",
    message: encryptedMessage
  });
  
  broadcast(notification, wss);
}

// Handle typing status updates
export function handleTypingStatus(client, username, isTyping, wss) {
  setUserTyping(username, isTyping);
  broadcastPresenceUpdate(username);
}