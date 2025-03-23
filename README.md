# SecureChat

SecureChat is a real-time chat system built with Node.js and WebSockets. It supports user authentication authentication with strong password requirements, message encryption, rate limiting, and comprehensive logging. This updated version uses a secure WebSocket connection (wss://) over HTTPS. This chat application serves as a secure chat room for global and private chats between users.

## Features

- **Real-Time Messaging:**  
  Send and receive messages instantly using WebSockets, supporting global and private chat communication.
  
- **User Authentication:**  
  Users log in using a username and password. Passwords are hashed with bcrypt and stored in a local `users.json` file. New accounts will be required to follow new password security requirements.

- **Password Security**
  - Minimum 8 characters
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
  - At least one special character
  - Real-time password strength feedback during account creation

- **Join/Disconnect Notifications:**  
  When a user joins or disconnects, notifications are broadcast to all connected clients, and newly connected users receive a list of current users.

- **Message Encryption:**  
  All messages are encrypted, protecting conversation content between clients. This is still a work in progress as keys are hardcoded so the server side can match with client side to be able to effectively decrypt messages.

- **Rate Limiting:**  
  Clients are limited to 5 messages per 5 seconds and 3 file uploads per 1 minute. Exceeding this limit triggers incremental timeouts to prevent spamming. Users will be able to chat again after the timeout period. NOTE: The server side recognizes these notifications and blocks user messages, but the client side does not. Still a work in progress.

- **Formatted Text & Emoji Support:**  
  Users can now format their text using bold, italics, and underlined text. Users also have the option to choose between a select few emojis for their chats.

- **File Sharing:**  
  Implemented the use for users to easily share files between chats. This allows users to securley download files in the chats, but there is a limit as stated above (3 files per minute). This is used so the server cannot get overwelmed by brute force attacks.

- **Logging:**  
  A log systems that documents when users logged in, joined a chat, left a chat, etc. Also a security log implementation that gives the time stamps of any bruteforce attacks (only limited to these attacks).

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/yourusername/SecureChat.git
cd CPSC-455-Project
npm install
```

## Running the Server

By default, the server listens on port 8001 using a secured WebSocket connection (wss://). Make sure to change your to your local IP in `chat.js` and `login.js`, as these are static pages.

Within the project go to the `Server` folder:
```bash
cd Server
```

Start the server (connects both server and client side) with:
```bash
node server.js
```
## Follow the on-screen prompts

- **Login:**  
  Enter your username and password. If the user does not exist, a new account is automatically created with that username and password.

- **Join:**  
  Once connected, a join message is sent and you will receive a list of connected users.

- **Chat:**  
  Type messages to chat with other connected users in global chat or privately with a selected user in the list.

- **Logout:**  
   Use `logout` to disconnect from the chat.


## Future Enhancements

- **Create Private Rooms:**
  Rather than selecting a user from the chat and privately chatting with them, a seperate chat room that has an option to send invites to more than one user. The "Host" of this chat will have moderation tools such as kick users, create room password, etc.

- **Create an Account Page:**
  Right now the application automatically creates an account if its not in our users database. For more authentication, creating a page where a user has to manually go in a fill out fields to create an account. Also implementing CAPTCHA when signing up to reduce the amount of bots.

- **Uploading to the internet:**
  Currently the web application runs on a secure websocket using self signed certificates on HTTPS. Creating a domain for our web application, it will automatically handle this.

