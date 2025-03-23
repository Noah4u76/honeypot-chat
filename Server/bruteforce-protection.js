import fs from 'fs/promises';
import path from 'path';

// Map to track failed login attempts by IP address
const failedAttempts = new Map();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_TIME_MS = 15 * 60 * 1000; // 15 minutes

export async function checkBruteForceProtection(ip) {
  const now = Date.now();
  const attempt = failedAttempts.get(ip);
  
  if (attempt) {
    // IP is locked out
    if (attempt.lockedUntil && attempt.lockedUntil > now) {
      const remainingTime = Math.ceil((attempt.lockedUntil - now) / 1000 / 60);
      return {
        allowed: false,
        message: `Too many failed attempts. Try again in ${remainingTime} minutes.`
      };
    }
    
    // Lockout period expired, reset failed attempts
    if (attempt.lockedUntil && attempt.lockedUntil <= now) {
      failedAttempts.set(ip, { count: 0 });
    }
  }
  
  return { allowed: true };
}

export function recordFailedAttempt(ip) {
  const now = Date.now();
  const attempt = failedAttempts.get(ip) || { count: 0 };
  
  attempt.count += 1;
  
  // Lock account after MAX_FAILED_ATTEMPTS
  if (attempt.count >= MAX_FAILED_ATTEMPTS) {
    attempt.lockedUntil = now + LOCKOUT_TIME_MS;
    
    // Log suspicious activity
    logSuspiciousActivity(ip, attempt.count);
  }
  
  failedAttempts.set(ip, attempt);
}

export function resetFailedAttempts(ip) {
  failedAttempts.set(ip, { count: 0 });
}

async function logSuspiciousActivity(ip, attemptCount) {
  const logDir = path.join(process.cwd(), 'security_logs');
  const logFile = path.join(logDir, 'suspicious_activity.log');
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} - IP: ${ip} - Failed login attempts: ${attemptCount}\n`;
  
  try {
    // Create security_logs directory if it doesn't exist
    await fs.mkdir(logDir, { recursive: true });
    await fs.appendFile(logFile, logEntry);
  } catch (error) {
    console.error('Error writing to security log:', error);
  }
}