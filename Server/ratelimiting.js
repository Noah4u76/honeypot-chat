const RATE_LIMIT_WINDOW_MS = 5000;     // 5 seconds window
const MAX_MESSAGES_PER_WINDOW = 5;     // 5 messages per 5 seconds (easier to trigger for testing)
const MAX_FILE_UPLOADS_PER_MINUTE = 3; // 3 file uploads per minute

import { sendTimeoutNotification } from './rate-notifications.js';

export function applyRateLimit(client, actionType = 'message', wss = null) {
  const now = Date.now();

  // Initialize rate limiting data if missing
  if (!client.rateLimitData) {
    client.rateLimitData = {
      timestamps: [],
      fileTimestamps: [],
      exceedCount: 0,
      lastViolationTime: 0,
      timeoutEnd: 0
    };
  }

  // Check if client is already in timeout
  if (now < client.rateLimitData.timeoutEnd) {
    const remaining = Math.ceil((client.rateLimitData.timeoutEnd - now) / 1000);
    client.send(JSON.stringify({ 
      type: "error", 
      error: `Rate limit exceeded. Wait ${remaining} seconds.` 
    }));
    return false;
  }

  if (actionType === 'file') {
    // Special handling for file uploads
    const oneMinuteAgo = now - 60000; // 1 minute ago
    
    // Remove timestamps older than 1 minute
    client.rateLimitData.fileTimestamps = client.rateLimitData.fileTimestamps.filter(
      timestamp => timestamp > oneMinuteAgo
    );
    
    // Check against file upload limit
    if (client.rateLimitData.fileTimestamps.length >= MAX_FILE_UPLOADS_PER_MINUTE) {
      client.rateLimitData.exceedCount++;
      client.rateLimitData.lastViolationTime = now;
      
      // Shorter timeout for testing
      const timeoutDuration = 10000; // Fixed 10 seconds for testing
      client.rateLimitData.timeoutEnd = now + timeoutDuration;
      
      client.send(JSON.stringify({ 
        type: "error", 
        error: `File upload rate limit exceeded. Timed out for ${timeoutDuration/1000} seconds.` 
      }));
      
      // Send a system notification to chat about the timeout
      if (wss && client.username) {
        sendTimeoutNotification(wss, client.username, timeoutDuration/1000, 'file uploads');
      }
      
      console.warn(`File upload rate limit exceeded for ${client.username}. Timed out for ${timeoutDuration/1000} seconds.`);
      return false;
    }
    
    // Record this file upload timestamp
    client.rateLimitData.fileTimestamps.push(now);
    return true;
  }
  
  // Standard message rate limiting
  // Remove timestamps older than RATE_LIMIT_WINDOW_MS (5 seconds)
  client.rateLimitData.timestamps = client.rateLimitData.timestamps.filter(
    timestamp => now - timestamp < RATE_LIMIT_WINDOW_MS
  );

  // If the client has exceeded the message limit in this window
  if (client.rateLimitData.timestamps.length >= MAX_MESSAGES_PER_WINDOW) {
    client.rateLimitData.exceedCount++;
    client.rateLimitData.lastViolationTime = now;

    // Shorter timeout for testing
    const timeoutDuration = 10000; // Fixed 10 seconds for testing
    client.rateLimitData.timeoutEnd = now + timeoutDuration;
    
    client.send(JSON.stringify({ 
      type: "error", 
      error: `Message rate limit exceeded. Timed out for ${timeoutDuration/1000} seconds.` 
    }));
    
    // Send a system notification to chat about the timeout
    if (wss && client.username) {
        console.log(`Sending timeout notification for ${client.username}`);
        sendTimeoutNotification(wss, client.username, timeoutDuration/1000, 'messaging');
    }
    
    console.warn(`Rate limit exceeded for ${client.username}. Timed out for ${timeoutDuration/1000} seconds.`);
    return false;
  }

  // Record this message timestamp
  client.rateLimitData.timestamps.push(now);
  return true;
}

// Gradually reduce the exceedCount over time to allow redemption
export function resetExceedCountPeriodically(client) {
  const now = Date.now();
  
  // If it's been more than 10 minutes since last violation, reduce the exceed count
  if (client.rateLimitData && 
      client.rateLimitData.lastViolationTime && 
      (now - client.rateLimitData.lastViolationTime > 600000)) {
    
    if (client.rateLimitData.exceedCount > 0) {
      client.rateLimitData.exceedCount--;
      // Update the last violation time to now to prevent immediate reduction again
      client.rateLimitData.lastViolationTime = now;
    }
  }
}


