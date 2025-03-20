import { applyRateLimit } from './ratelimiting.js';
import { encrypt } from './encryption.js';

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
export function handleJoin(client, username, wss) {
  client.username = username;
  console.log(`${username} joined the chat.`);
  addUser(username);
  console.log("here is the list ", userList);
  const notification = JSON.stringify({
    type: "notification",
    username,
    userList,
    message: encrypt(`${username} joined the chat.`)
  });
  broadcast(notification, wss);
}

// Handle Messages
export function handleMessage(client, username, message, reciever, wss) {
  if (!applyRateLimit(client)) return;
  const encryptedMessage = encrypt(message);
  console.log(`Message from ${username} to ${reciever}: ${message}`);

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

// Handles file sharing with recipient support
export function handleFile(client, username, sentfilename, sentfiletype, contents, reciever, wss) {
  if (!applyRateLimit(client)) return;
  const encryptedContents = encrypt(contents);
  console.log(`File from ${username} to ${reciever}: ${contents}`);

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
export function handleDisconnect(client, wss) {
  removeUser(client.username);
  console.log(`${client.username} disconnected.`);
  console.log("here is the list ", userList);

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
