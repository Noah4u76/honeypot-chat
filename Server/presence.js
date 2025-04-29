// User presence tracking system
// Tracks online status and typing indicators for all users

// Store user presence data with their status and last activity timestamp
const userPresence = new Map();

// Status constants
const STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  TYPING: 'typing'
};

// Initialize a user's presence when they connect
export function initUserPresence(username) {
  userPresence.set(username, {
    status: STATUS.ONLINE,
    lastActivity: Date.now(),
    typingTimeout: null
  });
}

// Update a user's status
export function updateUserStatus(username, status) {
  if (!userPresence.has(username)) {
    initUserPresence(username);
  }
  
  const user = userPresence.get(username);
  user.status = status;
  user.lastActivity = Date.now();
  userPresence.set(username, user);
}

// Handle typing indicator (with auto-reset after inactivity)
export function setUserTyping(username, isTyping) {
  if (!userPresence.has(username)) {
    initUserPresence(username);
  }
  
  const user = userPresence.get(username);
  
  // Clear any existing timeout
  if (user.typingTimeout) {
    clearTimeout(user.typingTimeout);
    user.typingTimeout = null;
  }
  
  if (isTyping) {
    user.status = STATUS.TYPING;
    
    // Auto-reset typing status after 3 seconds of inactivity
    user.typingTimeout = setTimeout(() => {
      if (userPresence.has(username)) {
        const updatedUser = userPresence.get(username);
        if (updatedUser.status === STATUS.TYPING) {
          updatedUser.status = STATUS.ONLINE;
          userPresence.set(username, updatedUser);
          broadcastPresenceUpdate(username);
        }
      }
    }, 3000);
  } else {
    user.status = STATUS.ONLINE;
  }
  
  userPresence.set(username, user);
}

// Remove a user when they disconnect
export function removeUserPresence(username) {
  if (userPresence.has(username)) {
    const user = userPresence.get(username);
    if (user.typingTimeout) {
      clearTimeout(user.typingTimeout);
    }
    userPresence.delete(username);
  }
}

// Get current presence information for a specific user
export function getUserPresence(username) {
  return userPresence.has(username) 
    ? userPresence.get(username) 
    : { status: STATUS.OFFLINE, lastActivity: 0 };
}

// Get presence information for all users
export function getAllPresence() {
  const presenceData = {};
  
  for (const [username, data] of userPresence.entries()) {
    presenceData[username] = {
      status: data.status,
      lastActivity: data.lastActivity
    };
  }
  
  return presenceData;
}

// Broadcast function to be set by server.js
let broadcastFn = null;

// Set the broadcast function from server.js
export function setBroadcastFunction(fn) {
  broadcastFn = fn;
}

// Broadcast presence update to all clients
export function broadcastPresenceUpdate(username) {
  if (!broadcastFn) return;
  
  const user = getUserPresence(username);
  broadcastFn({
    type: "presence",
    username: username,
    status: user.status,
    timestamp: user.lastActivity
  });
}

// Broadcast all users' presence to a specific client
export function sendAllPresenceToClient(client) {
  const allPresence = getAllPresence();
  
  client.send(JSON.stringify({
    type: "presenceList",
    users: allPresence
  }));
} 