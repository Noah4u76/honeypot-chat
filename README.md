# HoneyPot-Chat

HoneyPot-Chat is a real-time chat system built with Node.js and WebSockets. It supports user authentication with strong password requirements, message encryption, rate limiting, and comprehensive logging. This application has been migrated to Railway and uses secure WebSocket connections (wss://) for global and private chats between users.

## Live Demo

Visit the live application: [HoneyPot-Chat on Railway](https://honey-pot-chat-production.up.railway.app/)

## Features

- **Real-Time Messaging:**  
  Send and receive messages instantly using WebSockets, supporting global and private chat communication.
  
- **Enhanced Authentication:**  
  Users can create accounts or log in with existing credentials. Passwords are hashed with bcrypt and stored in MongoDB (with file-based fallback). The system includes proper authentication state management and secure redirects.

- **Password Security:**
  - Minimum 8 characters
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
  - At least one special character
  - Real-time password strength feedback during account creation

- **Persistent WebSocket Connections:**  
  WebSocket ping/pong mechanism keeps connections alive even during periods of inactivity. Automatic reconnection with exponential backoff handles network disruptions gracefully.

- **Join/Disconnect Notifications:**  
  When a user joins or disconnects, notifications are broadcast to all connected clients, and newly connected users receive a list of current users.

- **Message Encryption:**  
  All messages are encrypted, protecting conversation content between clients.

- **Rate Limiting:**  
  Clients are limited to 5 messages per 5 seconds and 3 file uploads per 1 minute. Exceeding this limit triggers incremental timeouts to prevent spamming.

- **Formatted Text & Emoji Support:**  
  Users can format their text using bold, italics, and underlined text. A built-in emoji picker allows for expression in conversations.

- **File Sharing:**  
  Users can securely share files in chats with rate limits to prevent abuse (3 files per minute).

- **Comprehensive Logging:**  
  Detailed logging of user activities, connection events, and security incidents.

## Local Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/Noah4u76/honeypot-chat.git
cd honeypot-chat
npm install
```

## Running Locally

Start the server:
```bash
node Server/server.js
```

By default, the server listens on port 8001. Access the application at http://localhost:8001.

## Railway Deployment

This application is configured for easy deployment on Railway:

1. **Prerequisites:**
   - A [Railway](https://railway.app/) account
   - [Railway CLI](https://docs.railway.app/develop/cli) installed
   - A MongoDB Atlas database

2. **Deploy via Railway Dashboard:**
   - Fork this repository
   - Link your forked repository to Railway
   - Railway will automatically detect the Dockerfile and deploy your application

3. **Deploy via Railway CLI:**
   ```bash
   # Login to Railway
   railway login

   # Initialize your project
   railway init

   # Deploy your application
   railway up
   ```

4. **Environment Variables:**
   - Set the following environment variables in Railway dashboard:
     - `NODE_ENV=production`
     - `PORT=8080`
     - `MONGODB_URI=mongodb+srv://your-username:your-password@your-cluster.mongodb.net/your-database` 
       (Optional - without this, the app will use file-based authentication)

5. **MongoDB Setup:**
   - Create a free MongoDB Atlas cluster at https://www.mongodb.com/cloud/atlas
   - In Atlas, add "0.0.0.0/0" to the IP access list to allow connections from Railway
   - Update the MONGODB_URI environment variable in Railway with your connection string

## Using the Application

- **Register/Login:**  
  Create a new account or log in with existing credentials. The system enforces strong password requirements.

- **Global Chat:**  
  By default, you'll be in the global chat room where all users can see your messages.

- **Private Messaging:**  
  Select a user from the dropdown to start a private conversation.

- **File Sharing:**  
  Use the file input to share files with other users.

- **Text Formatting:**  
  Use the formatting toolbar to make your messages bold, italic, or underlined.

- **Emojis:**  
  Click the emoji button to access the emoji picker.

- **Logout:**  
  Click the logout button to securely end your session.

## Implementation Details

- **Docker Containerization:**  
  The application is containerized using Docker for consistent deployment across environments.

- **WebSocket Reliability:**  
  Advanced ping/pong mechanism with configurable intervals ensures persistent connections.

- **Fallback Authentication:**  
  The system uses MongoDB for authentication when available but gracefully falls back to file-based authentication when needed.

- **Connection Status Indicators:**  
  Visual feedback on connection status helps users understand when network issues occur.

## Future Enhancements

- **Private Rooms:**
  Create separate chat rooms with multiple users and room-specific controls.

- **Enhanced Account Management:**
  Add profile settings, avatar uploads, and account recovery options.

- **End-to-End Encryption:**
  Implement true end-to-end encryption for maximum privacy.

- **Message Search:**
  Allow users to search through their message history.

- **Mobile Responsive Design:**
  Optimize the interface for mobile devices.
