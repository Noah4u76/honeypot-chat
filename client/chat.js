const SERVER_ADDRESS = window.location.protocol === 'https:' 
  ? `wss://${window.location.host}` 
  : `ws://${window.location.host}`;

// Websocket and reconnection setup
let socket;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000; // 3 seconds

function connectWebSocket() {
  socket = new WebSocket(SERVER_ADDRESS);
  
  // Connection established
  socket.onopen = () => {
    console.log("Connection established with server");
    reconnectAttempts = 0; // Reset reconnect counter on successful connection
    
    // Announce presence to server
    const username = localStorage.getItem("username");
    if (username) {
      socket.send(JSON.stringify({ type: "join", username }));
    }
  };
  
  // Handle incoming messages
  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "message") {
      // Decrypt and display a text message.
      window.decrypt(data.message)
        .then(decryptedMessage => {
          // Figure out which conversation this belongs to.
          let convKey = "All";
          if (data.reciever && data.reciever !== "All") {
            convKey = [data.username, data.reciever].sort().join("|");
          }
          // Prevent duplicate self-message echo.
          if (data.username === username) {
            const convHistory = conversations[convKey] || [];
            const lastMsg = convHistory[convHistory.length - 1];
            if (lastMsg && lastMsg.user === username && lastMsg.message === decryptedMessage) return;
          }
          displayMessage(data.username, decryptedMessage, data.username === username ? "sent" : "received", convKey);
        })
        .catch(err => console.error("Decryption failed:", err));
    } else if (data.type === "notification") {
      // User join/leave notifications
      changeUserList(data.userList);
      window.decrypt(data.message)
        .then(decryptedMessage => {
          displaySystemMessage(decryptedMessage);
        })
        .catch(err => console.error("Decryption failed:", err));
    } else if (data.type === "error") {
      console.error("Error from server:", data.error);
    } else if (data.type === "file") {
      // Decrypt and display a file message.
      window.decrypt(data.data)
        .then(decryptedData => {
          let convKey = "All";
          if (data.reciever && data.reciever !== "All") {
            convKey = [data.username, data.reciever].sort().join("|");
          }
          // Show the file link with correct sender styling.
          displayFileLink(data.filename, decryptedData, convKey, data.username);
        })
        .catch(err => console.error("Decryption failed:", err));
    }
  };
  
  // Handle connection closure
  socket.onclose = (event) => {
    console.log(`WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`);
    
    // Attempt to reconnect if not a normal closure and within attempts limit
    if (event.code !== 1000 && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      const delay = RECONNECT_DELAY * reconnectAttempts; // Exponential backoff
      console.log(`Attempting to reconnect in ${delay/1000} seconds... (Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
      
      displaySystemMessage(`Connection lost. Attempting to reconnect in ${delay/1000} seconds... (Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
      
      setTimeout(connectWebSocket, delay);
    } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      displaySystemMessage("Connection lost. Maximum reconnection attempts reached. Please refresh the page.");
    }
  };
  
  // Handle connection errors
  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
    displaySystemMessage("Connection error. Please check your network connection.");
  };
}

// Initialize WebSocket connection
connectWebSocket();

// Authentication check
let userList = [];
const username = localStorage.getItem("username");
const isAuthenticated = localStorage.getItem("authenticated");

// Redirect unauthenticated users to login
if (!username || !isAuthenticated) {
  console.log("User not authenticated, redirecting to login");
  localStorage.removeItem("username"); // Clear any partial auth data
  localStorage.removeItem("authenticated");
  window.location.href = "login.html";
}

// Object to store conversation histories.
// "All" holds global messages; private chats use a key built from both usernames (sorted for consistency).
const conversations = { All: [] };
let activeConversation = "All";

// Update the conversation header element to show who you are chatting with.
function updateConversationHeader() {
  const headerEl = document.getElementById("conversation-header");
  if (headerEl) {
    headerEl.innerText =
      activeConversation === "All"
        ? "Global Chat"
        : "Chatting with: " + activeConversation.split("|").find(u => u !== username);
  }
}

document.getElementById("send-btn").addEventListener("click", sendMessage);
document.getElementById("message-input").addEventListener("keypress", function (event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});
// When the recipient selection changes, update active conversation and header.
document.getElementById("who-to-send").addEventListener("change", function () {
  const selected = this.value;
  activeConversation = selected === "All" ? "All" : [username, selected].sort().join("|");
  updateConversationHeader();
  loadConversation();
});
// Sends a text message and/or file, and optimistically displays the text message.
function sendMessage() {
  const messageInputDiv = document.getElementById("message-input");
  const fileInput = document.getElementById("fileInput");
  const reciever = document.getElementById("who-to-send").value;
  const message = messageInputDiv.innerHTML.trim();
  const file = fileInput.files[0];
  
  // Check if the socket is open before sending
  if (socket.readyState !== WebSocket.OPEN) {
    displaySystemMessage("Cannot send message. Connection to server lost. Trying to reconnect...");
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      connectWebSocket();
    }
    return;
  }
  
  if (!message && !file) return; // Do nothing if both are empty.

  // Determine the conversation key.
  let convKey = "All";
  if (reciever && reciever !== "All") {
    convKey = [username, reciever].sort().join("|");
  }

  // If it's a text message, show it immediately.
  if (message) {
    displayMessage(username, message, "sent", convKey);
    socket.send(JSON.stringify({ type: "message", username, reciever, message }));
    messageInputDiv.innerHTML = "";
  }

  // If it's a file, read and send it.
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
      fileInput.value = "";
    };
    reader.readAsDataURL(file);
  }
}

document.getElementById("logout-btn").addEventListener("click", () => {
  localStorage.removeItem("username");
  localStorage.removeItem("authenticated");
  window.location.href = "login.html";
});

// Stores a message in the appropriate conversation and renders it if active.
function displayMessage(user, message, type, convKey = "All") {
  if (!conversations[convKey]) conversations[convKey] = [];
  conversations[convKey].push({ user, message, type });

  // Display only if this conversation is active.
  if (activeConversation === convKey) {
    const chatDiv = document.getElementById("messages");
    const msgElement = document.createElement("div");
    msgElement.classList.add("message", type);
    msgElement.innerHTML = `<b>${user}:</b> ` + message;
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
    // Decide if it's from self or another user
    const cssClass = msg.user === username ? "sent" : "received";
    const msgElement = document.createElement("div");
    msgElement.classList.add("message", cssClass);
    if (msg.type === "file") {
      // For file messages, create a download link
      msgElement.innerHTML = `<b>${msg.user}:</b> `;
      const fileElement = document.createElement("a");
      fileElement.setAttribute("href", msg.fileData);
      fileElement.setAttribute("download", msg.filename);
      fileElement.innerText = `Download file: ${msg.filename}`;
      fileElement.style.color = "blue";
      fileElement.style.textDecoration = "underline";
      msgElement.appendChild(fileElement);
    } else {
      // For text messages
      msgElement.innerHTML = `<b>${msg.user}:</b> ` + msg.message;
    }
    chatDiv.appendChild(msgElement);
  });
  chatDiv.scrollTop = chatDiv.scrollHeight;
  updateConversationHeader();
}

// Displays a download link for file messages with correct bubble styling.
function displayFileLink(filename, fileData, convKey, sender) {
  if (!conversations[convKey]) conversations[convKey] = [];
  // We'll store the file message with type "file" so we can re-render it properly.
  const messageObj = { user: sender, type: "file", filename, fileData };
  conversations[convKey].push(messageObj);
  if (activeConversation === convKey) {
    const chatDiv = document.getElementById("messages");
    const cssClass = sender === username ? "sent" : "received";
    const msgElement = document.createElement("div");
    msgElement.classList.add("message", cssClass);
    msgElement.innerHTML = `<b>${sender}:</b> `;
    const fileElement = document.createElement("a");
    fileElement.setAttribute("href", fileData);
    fileElement.setAttribute("download", filename);
    fileElement.innerText = `Download file: ${filename}`;
    fileElement.style.color = "blue";
    fileElement.style.textDecoration = "underline";
    msgElement.appendChild(fileElement);
    chatDiv.appendChild(msgElement);
    chatDiv.scrollTop = chatDiv.scrollHeight;
  }
}

// Updates the user selection dropdown with the provided user list.
// It filters out the current user to avoid confusion.
function changeUserList(userlist) {
  const selectElement = document.getElementById('who-to-send');
  while (selectElement.options.length > 1) {
    selectElement.remove(1);
  }
  // Filter out the current user from the user list.
  userlist.filter(u => u !== username).forEach(element => {
    const option = document.createElement('option');
    option.value = element;
    option.text = element;
    selectElement.append(option);
  });
}

// Displays system messages (like join/leave notifications) in the global conversation.
function displaySystemMessage(message) {
  if (!conversations["All"]) conversations["All"] = [];
  conversations["All"].push({ user: "System", message, type: "received" });
  if (activeConversation === "All") {
    const chatDiv = document.getElementById("messages");
    const msgElement = document.createElement("div");
    msgElement.classList.add("message", "received");
    msgElement.innerHTML = `<b>System:</b> ` + message;
    chatDiv.appendChild(msgElement);
    chatDiv.scrollTop = chatDiv.scrollHeight;
  }
}

// Store the last known caret position
let lastCaretPosition = null;

// Track the last caret position when user clicks or types in the message input
function saveCaretPosition(element) {
  if (window.getSelection) {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      lastCaretPosition = selection.getRangeAt(0).cloneRange();
    }
  }
}

function insertAtCaret(el, text) {
  if (!el) return;
  
  // Focus the element to ensure we can place the caret
  el.focus();
  
  // If we have a saved caret position, use it
  if (lastCaretPosition && window.getSelection) {
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(lastCaretPosition);
  }
  
  // Now insert at the current position
  if (document.selection) {
    var sel = document.selection.createRange();
    sel.text = text;
  } else if (window.getSelection) {
    var sel = window.getSelection();
    if (sel.rangeCount > 0) {
      var range = sel.getRangeAt(0);
      
      // Delete the current selection first (if any)
      range.deleteContents();
      
      // Create a text node with our emoji
      var textNode = document.createTextNode(text);
      range.insertNode(textNode);
      
      // Move the caret to after the inserted text
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      sel.removeAllRanges();
      sel.addRange(range);
      
      // Save this new position
      lastCaretPosition = range.cloneRange();
    } else {
      // No selection - append to the end
      el.appendChild(document.createTextNode(text));
    }
  } else {
    // Fallback - just append to the end
    el.innerHTML += text;
  }
}

// Initialization: set up emoji panel and formatting buttons.
document.addEventListener("DOMContentLoaded", () => {
  // Toggle hardcoded emoji panel on emoji button click.
  const emojiBtn = document.getElementById("emoji-btn");
  const emojiPanel = document.getElementById("emoji-panel");
  const messageInput = document.getElementById("message-input");
  
  // Add event listeners to track caret position
  messageInput.addEventListener('click', function() {
    saveCaretPosition(this);
  });
  
  messageInput.addEventListener('keyup', function() {
    saveCaretPosition(this);
  });
  
  emojiBtn.addEventListener("click", () => {
    // Position the emoji panel to the right of the emoji button
    const btnRect = emojiBtn.getBoundingClientRect();
    emojiPanel.style.top = (btnRect.top + window.scrollY) + 'px';
    emojiPanel.style.left = (btnRect.right + window.scrollX + 5) + 'px'; // 5px gap between button and panel
    
    // Toggle display
    if (emojiPanel.style.display === "none" || !emojiPanel.style.display) {
      emojiPanel.style.display = "block";
    } else {
      emojiPanel.style.display = "none";
    }
  });

  // For each emoji in the panel, insert the emoji character into #message-input
  document.querySelectorAll("#emoji-panel .emoji").forEach(emoji => {
    // Remove any existing event listeners (to prevent duplicates)
    const newEmoji = emoji.cloneNode(true);
    emoji.parentNode.replaceChild(newEmoji, emoji);
    
    newEmoji.addEventListener("click", () => {
      const messageInput = document.getElementById("message-input");
      insertAtCaret(messageInput, newEmoji.innerText);
      
      // Hide panel after picking an emoji
      emojiPanel.style.display = "none";
    });
  });

  // Formatting buttons for Bold, Italic, Underline.
  document.getElementById("bold-btn").addEventListener("click", () => {
    document.execCommand("bold");
  });
  document.getElementById("italic-btn").addEventListener("click", () => {
    document.execCommand("italic");
  });
  document.getElementById("underline-btn").addEventListener("click", () => {
    document.execCommand("underline");
  });
});

updateConversationHeader();