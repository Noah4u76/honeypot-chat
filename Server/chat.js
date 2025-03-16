import { applyRateLimit } from './ratelimiting.js';
import { encrypt } from './encryption.js';

let userList = []



function addUser(username)
{
  userList.push(username);
}



function removeUser(username)
{
  const index = userList.indexOf(username)
  if (index > -1) { 
    userList.splice(index, 1); // Remove 1 element at the found index
  }
}

// Handle User Joining
export function handleJoin(client, username, wss) {
  client.username = username;
  console.log(`${username} joined the chat.`);
  addUser(username);
  console.log("herre is the list ", userList)
  const notification = JSON.stringify({
    type: "notification",
    username,
    userList,
    message: encrypt(`${username} joined the chat.`)
  });

  broadcast(notification, wss);
}

// Handle Messages
export function handleMessage(client, username, message, wss) {
  if (!applyRateLimit(client)) return;
  const encryptedMessage = encrypt(message);
  console.log(`Message from ${username}: ${message}`);

  const outgoing = JSON.stringify({ type: "message", username, message: encryptedMessage });
  broadcast(outgoing, wss);
}


//Handles file sharing
export function handleFile(client, username,sentfilename,sentfiletype ,contents, wss) {
  if (!applyRateLimit(client)) return;
  const encryptedContents = encrypt(contents);
  console.log(`Contents from ${username}: ${contents}`);

  const outgoing = JSON.stringify({ type: "file", username,filename: sentfilename,
  filetype:sentfiletype, data: encryptedContents });
  broadcast(outgoing, wss);
}

// Handle User Disconnecting
export function handleDisconnect(client, wss) {
  removeUser(client.username);
  console.log(`${client.username} disconnected.`);
  console.log("herre is the list ", userList)

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
