import { applyRateLimit } from './ratelimiting.js';
import { encrypt } from './encryption.js';
import { 
  initUserPresence, 
  removeUserPresence, 
  setUserTyping, 
  updateUserStatus,
  broadcastPresenceUpdate,
  sendAllPresenceToClient 
} from './presence.js';

// Active users management
const activeUsers = new Set();

// Add a user to the active users list
function addActiveUser(username) {
  if (!username || typeof username !== 'string') {
    console.error('Invalid username provided to addActiveUser:', username);
    return false;
  }
  
  // Check if user already exists
  if (activeUsers.has(username)) {
    console.log(`User ${username} is already in the active users list`);
    return false;
  }
  
  activeUsers.add(username);
  console.log(`Added user ${username} to active users. Total users: ${activeUsers.size}`);
  return true;
}

// Remove a user from the active users list
function removeActiveUser(username) {
  if (!username || typeof username !== 'string') {
    console.error('Invalid username provided to removeActiveUser:', username);
    return false;
  }
  
  if (!activeUsers.has(username)) {
    console.log(`User ${username} was not found in the active users list`);
    return false;
  }
  
  activeUsers.delete(username);
  console.log(`Removed user ${username} from active users. Total users: ${activeUsers.size}`);
  return true;
}

// Get all active users as an array
function getActiveUsers() {
  return Array.from(activeUsers);
}

// Broadcast Message to all connected clients
function broadcast(message, wss) {
  wss.clients.forEach(client => {
    if (client.readyState === client.OPEN) {
      client.send(message);
    }
  });
}

// Function to sanitize message content to only allow certain HTML tags
function sanitizeMessage(message) {
  if (!message) return '';
  
  // Replace all HTML tags except b, i, u
  return message
    // First convert < and > that are part of allowed HTML tags to temp tokens
    .replace(/<(\/?(b|i|u))[^>]*>/gi, '§$1§')
    // Then escape all remaining < and > to prevent other HTML
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Finally restore the allowed tags 
    .replace(/§(\/?(b|i|u))§/gi, '<$1>');
}

// Handle User Joining
export async function handleJoin(client, username, wss) {
  client.username = username;
  console.log(`${username} joined the chat.`);
  
  addActiveUser(username);
  console.log("here is the list ", getActiveUsers());
  
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
  
  // Send join notification to all clients
  const notification = JSON.stringify({
    type: "notification",
    username,
    userList: getActiveUsers(),
    message: encrypt(`${username} joined the chat.`)
  });
  
  broadcast(notification, wss);
}

// Handle Messages with appropriate encryption
export async function handleMessage(client, username, message, receiver, wss) {
  // Apply rate limiting - if this returns false, exit the function early
  if (!applyRateLimit(client, 'message', wss)) {
    console.log(`Rate limit applied to user ${username}. Message rejected.`);
    return;
  }
  
  console.log(`Message from ${username} to ${receiver}: ${message}`);
  
  // Sanitize message to only allow <b>, <i>, <u> tags
  const sanitizedMessage = sanitizeMessage(message);
  
  // Encrypt the message
  const encryptedMessage = encrypt(sanitizedMessage);
  
  const outgoing = JSON.stringify({ 
    type: "message", 
    username, 
    receiver, 
    message: encryptedMessage 
  });

  if (receiver === "All") {
    // Broadcast to everyone
    broadcast(outgoing, wss);
  } else {
    // Send only to the sender and the specific recipient
    wss.clients.forEach(c => {
      if (c.readyState === c.OPEN && (c.username === receiver || c.username === username)) {
        c.send(outgoing);
      }
    });
  }
}

// Handles file sharing with recipient support
export async function handleFile(client, username, filename, filetype, contents, receiver, wss) {
  // Apply rate limiting
  if (!applyRateLimit(client, 'file', wss)) {
    console.log(`Rate limit applied to user ${username}. File upload rejected.`);
    return;
  }
  
  console.log(`File from ${username} to ${receiver}: ${filename}`);
  
  // Encrypt the file contents
  const encryptedContents = encrypt(contents);

  const outgoing = JSON.stringify({ 
    type: "file", 
    username, 
    receiver,
    filename,
    filetype, 
    data: encryptedContents 
  });
  
  if (receiver === "All") {
    broadcast(outgoing, wss);
  } else {
    // Send only to the sender and the designated recipient
    wss.clients.forEach(c => {
      if (c.readyState === c.OPEN && (c.username === receiver || c.username === username)) {
        c.send(outgoing);
      }
    });
  }
}

// Handle User Disconnecting
export async function handleDisconnect(client, wss) {
  if (!client.username) return;
  
  removeActiveUser(client.username);
  // Update presence status to offline and broadcast
  removeUserPresence(client.username);
  console.log(`${client.username} disconnected.`);
  
  // Send disconnection notification
  const notification = JSON.stringify({
    type: "notification",
    username: client.username,
    userList: getActiveUsers(),
    message: encrypt(`${client.username} left the chat.`)
  });
  
  broadcast(notification, wss);
}

// Send a system notification to all clients
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
  // Verify user exists in active users
  if (!activeUsers.has(username)) {
    console.log(`Typing status ignored for non-active user: ${username}`);
    return;
  }
  
  setUserTyping(username, isTyping);
  broadcastPresenceUpdate(username);
}

// Log active users
export function logActiveUsers() {
  console.log('--- ACTIVE USERS ---');
  console.log(`Total count: ${activeUsers.size}`);
  console.log(getActiveUsers());
  console.log('-------------------');
}