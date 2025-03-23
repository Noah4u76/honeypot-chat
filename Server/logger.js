import fs from 'fs/promises';
import path from 'path';
import { decrypt } from './encryption.js';

// Create a unique session ID for each chat session
const SESSION_ID = Date.now().toString(36) + Math.random().toString(36).substring(2);
const LOG_DIR = path.join(process.cwd(), 'chat_logs');

// Initialize logging system
export async function initLogging() {
  try {
    // Create logs directory if it doesn't exist
    await fs.mkdir(LOG_DIR, { recursive: true });
    console.log(`Chat logging initialized for session ${SESSION_ID}`);
  } catch (error) {
    console.error('Error initializing logging system:', error);
  }
}

// Log a message to the appropriate log file
export async function logMessage(type, username, message, receiver = 'All') {
  try {
    const timestamp = new Date().toISOString();
    let logFileName;
    
    if (receiver === 'All') {
      // Global chat logs
      logFileName = `global_chat_${SESSION_ID}.txt`;
    } else {
      // Private chat logs - sort usernames for consistent file naming
      const participants = [username, receiver].sort().join('_');
      logFileName = `private_${participants}_${SESSION_ID}.txt`;
    }
    
    const logFilePath = path.join(LOG_DIR, logFileName);
    
    // Decrypt message for logging if it's encrypted
    let messageContent;
    try {
      if (type === 'message' && message.includes(':')) {
        messageContent = await decrypt(message);
      } else {
        messageContent = message;
      }
    } catch (error) {
      // If decryption fails, log the encrypted message
      messageContent = '[ENCRYPTED MESSAGE]';
    }
    
    const logEntry = `[${timestamp}] ${username} ${type === 'file' ? 'sent a file' : 'said'}: ${messageContent}\n`;
    await fs.appendFile(logFilePath, logEntry);
  } catch (error) {
    console.error('Error writing to chat log:', error);
  }
}

// Log system events
export async function logSystemEvent(event) {
  try {
    const timestamp = new Date().toISOString();
    const logFileName = `system_${SESSION_ID}.txt`;
    const logFilePath = path.join(LOG_DIR, logFileName);
    
    const logEntry = `[${timestamp}] SYSTEM: ${event}\n`;
    await fs.appendFile(logFilePath, logEntry);
  } catch (error) {
    console.error('Error writing system event to log:', error);
  }
}