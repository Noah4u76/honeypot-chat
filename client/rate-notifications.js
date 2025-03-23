import { encrypt } from './encryption.js';

export function sendTimeoutNotification(wss, username, seconds, reason) {
  try {
    // First, collect all usernames from connected clients
    const currentUserList = [];
    wss.clients.forEach(client => {
      if (client.username && !currentUserList.includes(client.username)) {
        currentUserList.push(client.username);
      }
    });
    
    console.log("Current user list for notification:", currentUserList);
    
    // Create notification with the current userList to prevent client errors
    const notification = JSON.stringify({
      type: "notification",
      userList: currentUserList, // Important: send the actual user list, not null
      message: encrypt(`${username} has been timed out for ${seconds} seconds due to excessive ${reason}.`)
    });
    
    // Send to all connected users
    wss.clients.forEach(client => {
      if (client.readyState === client.OPEN) {
        client.send(notification);
      }
    });
    console.log(`Sent timeout notification for user ${username}`);
  } catch (error) {
    console.error('Error sending timeout notification:', error);
  }
}