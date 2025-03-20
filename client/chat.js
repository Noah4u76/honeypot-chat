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

socket.onopen = () => {
  socket.send(JSON.stringify({ type: "join", username }));
};

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

function insertAtCaret(el, text) {
  let sel, range;
  if (window.getSelection) {
    sel = window.getSelection();
    if (sel.rangeCount) {
      range = sel.getRangeAt(0);
      range.deleteContents();
      const textNode = document.createTextNode(text);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }
}

// Initialization: set up emoji panel and formatting buttons.
document.addEventListener("DOMContentLoaded", () => {
  // Toggle hardcoded emoji panel on emoji button click.
  const emojiBtn = document.getElementById("emoji-btn");
const emojiPanel = document.getElementById("emoji-panel");
emojiBtn.addEventListener("click", () => {
  // Toggle display
  emojiPanel.style.display = 
    (emojiPanel.style.display === "none" || !emojiPanel.style.display)
      ? "block"
      : "none";
});

// For each emoji in the panel, insert the emoji character into #message-input
document.querySelectorAll("#emoji-panel .emoji").forEach(emoji => {
  emoji.addEventListener("click", () => {
    const messageInput = document.getElementById("message-input");
    insertAtCaret(messageInput, emoji.innerText);  // Insert text only
    messageInput.focus();
    // Optionally hide panel after picking an emoji:
    emojiPanel.style.display = "none";
  });
});

// Insert text at caret helper
function insertAtCaret(el, text) {
  let sel = window.getSelection();
  if (!sel || !sel.rangeCount) {
    // Fallback: just append if no selection
    el.appendChild(document.createTextNode(text));
    return;
  }
  let range = sel.getRangeAt(0);
  range.deleteContents();
  const textNode = document.createTextNode(text);
  range.insertNode(textNode);
  // Move caret after inserted text
  range.setStartAfter(textNode);
  range.setEndAfter(textNode);
  sel.removeAllRanges();
  sel.addRange(range);
}

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