# SecureChat

SecureChat is a real-time chat system built with Node.js and WebSockets. It supports user authentication (with bcrypt for password hashing), rate limiting to prevent spamming, join/disconnect notifications, and connection handling. Although this version uses an unsecured WebSocket connection (ws://), it lays the foundation for secure team communication. In production, you can upgrade to wss:// by configuring an HTTPS server with valid certificates.

## Features

- **Real-Time Messaging:**  
  Send and receive messages instantly using WebSockets.
  
- **User Authentication:**  
  Users log in using a username and password. Passwords are hashed with bcrypt and stored in a local `users.json` file.

- **Join/Disconnect Notifications:**  
  When a user joins or disconnects, notifications are broadcast to all connected clients, and newly connected users receive a list of current users.

- **Rate Limiting:**  
  Clients are limited to 5 messages per 5 seconds. Exceeding this limit triggers incremental timeouts to prevent spamming.

- **Connection Handling:**  
  The project detects join/disconnect events and can be extended to support additional features like heartbeat and auto-reconnect.

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/yourusername/SecureChat.git
cd CPSC-455-Project
npm install
```

## Running the Server

By default, the server listens on port 8000 using an unsecured WebSocket connection (ws://).

Start the server with:
```bash
node server.js
```
## Running the Client

Open a new terminal window for each client and run the client:
```bash
node client.js
```

## Follow the on-screen prompts

- **Login:**  
  Enter your username and password. If the user does not exist, a new account is created.

- **Join:**  
  Once connected, a join message is sent and you will receive a list of connected users.

- **Chat:**  
  Type messages to chat with other connected users.

- **Exit:**  
   Type `exit` to disconnect from the chat.


## Future Enhancements

- **End-to-End Encryption:**
  Encrypt messages on the client-side so only the intended recipients can decrypt them.

- **Auto-Reconnect and Heartbeat:**
  Improve connection reliability with heartbeat messages and automatic reconnection features.

- **Advanced Session Management:**
  Implement token-based authentication for enhanced security and scalability.

