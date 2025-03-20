const SERVER_ADDRESS = "wss://0.0.0.0:8001"; // Change IP before committing
const socket = new WebSocket(SERVER_ADDRESS);
let userList = [];
const username = localStorage.getItem("username");
if (!username) {
  // If there's no username in localStorage, redirect to login.
  window.location.href = "login.html";
}

// Object to store conversation histories.
// "All" holds global messages; private chats use a key built from both usernames (sorted for consistency).
const conversations = {
  All: []
};
// Active conversation key. Default is global chat "All".
let activeConversation = "All";

// Update the conversation header element to show who you are chatting with.
function updateConversationHeader() {
  const headerEl = document.getElementById("conversation-header");
  if (headerEl) {
    if (activeConversation === "All") {
      headerEl.innerText = "Global Chat";
    } else {
      // Derive the other participant's name by removing the current username from the key.
      const parts = activeConversation.split("|");
      const otherUser = parts.find((u) => u !== username) || parts[0];
      headerEl.innerText = `Chatting with: ${otherUser}`;
    }
  }
}

socket.onopen = () => {
  // After opening WebSocket, send "join" with the username.
  socket.send(JSON.stringify({ type: "join", username }));
};

socket.onmessage = (event) => {
  console.log("Raw data received:", event.data);
  const data = JSON.parse(event.data);
  console.log("Parsed data:", data);

  if (data.type === "message") {
    window.decrypt(data.message)
      .then((decryptedMessage) => {
        // Determine conversation key.
        let convKey = "All";
        if (data.reciever && data.reciever !== "All") {
          convKey = [username, data.username].sort().join("|");
        }
        // If the message is from self, check if we already added it optimistically.
        if (data.username === username) {
          const convHistory = conversations[convKey] || [];
          const lastMsg = convHistory[convHistory.length - 1];
          if (lastMsg && lastMsg.user === username && lastMsg.message === decryptedMessage) {
            // Skip duplicate echo from server.
            return;
          }
        }
        displayMessage(
          data.username,
          decryptedMessage,
          data.username === username ? "sent" : "received",
          convKey
        );
      })
      .catch((err) => {
        console.error("Decryption failed:", err);
      });
  } else if (data.type === "notification") {
    changeUserList(data.userList);
    window.decrypt(data.message)
      .then((decryptedMessage) => {
        // Always store system notifications in the global conversation.
        displaySystemMessage(decryptedMessage);
      })
      .catch((err) => {
        console.error("Decryption failed:", err);
      });
  } else if (data.type === "error") {
    console.error("Error from server:", data.error);
  } else if (data.type === "file") {
    window.decrypt(data.data)
      .then((decryptedData) => {
        displayFileLink(data.filename, decryptedData);
      })
      .catch((err) => {
        console.error("Decryption failed:", err);
      });
  }
};

document.getElementById("send-btn").addEventListener("click", sendMessage);

document.getElementById("message").addEventListener("keypress", function (event) {
  if (event.key === "Enter") {
    event.preventDefault();
    sendMessage();
  }
});

// When the recipient selection changes, update active conversation and header.
document.getElementById("who-to-send").addEventListener("change", function () {
  const selected = this.value; // "All" or a username.
  if (selected === "All") {
    activeConversation = "All";
  } else {
    activeConversation = [username, selected].sort().join("|");
  }
  updateConversationHeader();
  loadConversation();
});

// Sends a text message and/or file, and optimistically displays the text message.
function sendMessage() {
  const messageInput = document.getElementById("message");
  const fileInput = document.getElementById("fileInput");
  const reciever = document.getElementById("who-to-send").value;

  const message = messageInput.value.trim();
  const file = fileInput.files[0];

  if (!message && !file) return; // Do nothing if both are empty.

  // Determine the conversation key.
  let convKey = "All";
  if (reciever && reciever !== "All") {
    convKey = [username, reciever].sort().join("|");
  }

  if (message) {
    // Optimistically display the message immediately.
    displayMessage(username, message, "sent", convKey);
    socket.send(JSON.stringify({ type: "message", username, reciever, message }));
    messageInput.value = "";
  }

  if (file) {
    const reader = new FileReader();
    reader.onload = function (event) {
      const fileData = event.target.result;
      socket.send(JSON.stringify({
        type: "file",
        username,
        filename: file.name,
        filetype: file.type,
        data: fileData,
        reciever
      }));
      console.log("File sent:", file.name);
      fileInput.value = "";
    };
    reader.readAsText(file);
  }
}

document.getElementById("logout-btn").addEventListener("click", () => {
  localStorage.removeItem("username");
  window.location.href = "login.html";
});

// Stores a message in the appropriate conversation and renders it if active.
function displayMessage(user, message, type, convKey = "All") {
  if (!conversations[convKey]) {
    conversations[convKey] = [];
  }
  conversations[convKey].push({ user, message, type });

  // Display only if this conversation is active.
  if (activeConversation === convKey) {
    const chatDiv = document.getElementById("messages");
    const msgElement = document.createElement("div");
    msgElement.classList.add("message", type);
    msgElement.innerHTML = `<b>${user}:</b> ${message}`;
    chatDiv.appendChild(msgElement);
    chatDiv.scrollTop = chatDiv.scrollHeight;
  }
}

// Loads conversation history for the active conversation into the chat box.
function loadConversation() {
  const chatDiv = document.getElementById("messages");
  chatDiv.innerHTML = ""; // Clear current messages.
  const messages = conversations[activeConversation] || [];
  messages.forEach(msg => {
    const msgElement = document.createElement("div");
    msgElement.classList.add("message", msg.type);
    msgElement.innerHTML = `<b>${msg.user}:</b> ${msg.message}`;
    chatDiv.appendChild(msgElement);
  });
  chatDiv.scrollTop = chatDiv.scrollHeight;
  updateConversationHeader();
}

// Displays a download link for files.
function displayFileLink(filename, text) {
  const chatDiv = document.getElementById("messages");
  const msgElement = document.createElement("div");
  msgElement.classList.add("message", "received");

  const fileElement = document.createElement("a");
  fileElement.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  fileElement.setAttribute('download', filename);
  fileElement.innerText = `Download file: ${filename}`;
  fileElement.style.color = 'blue';
  fileElement.style.textDecoration = 'underline';

  msgElement.appendChild(fileElement);
  chatDiv.appendChild(msgElement);
  chatDiv.scrollTop = chatDiv.scrollHeight;
}

// Updates the user selection dropdown with the provided user list.
// It filters out the current user to avoid confusion.
function changeUserList(userlist) {
  const selectElement = document.getElementById('who-to-send');
  // Remove all options except the default "All".
  while (selectElement.options.length > 1) {
    selectElement.remove(1);
  }
  // Filter out the current user from the user list.
  userlist.filter(u => u !== username).forEach((element) => {
    const option = document.createElement('option');
    option.value = element;
    option.text = element;
    selectElement.append(option);
  });
}

// Displays system messages (like join/leave notifications) in the global conversation.
function displaySystemMessage(message) {
  // Always store system notifications in the global ("All") conversation.
  if (!conversations["All"]) {
    conversations["All"] = [];
  }
  conversations["All"].push({ user: "System", message, type: "received" });
  
  // If the active conversation is global, display the system message.
  if (activeConversation === "All") {
    const chatDiv = document.getElementById("messages");
    const msgElement = document.createElement("div");
    msgElement.classList.add("message", "received");
    msgElement.innerHTML = `<b>System:</b> ${message}`;
    chatDiv.appendChild(msgElement);
    chatDiv.scrollTop = chatDiv.scrollHeight;
  }
}

// Initialize the header when the page loads.
updateConversationHeader();
