const SERVER_ADDRESS = window.location.protocol === 'https:' 
  ? `wss://${window.location.host}` 
  : `ws://${window.location.host}`;

// Websocket and reconnection setup
let socket;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000; // 3 seconds

// Store user presence data
const userPresence = {};

// Typing indicator variables
let typingTimer;
const TYPING_TIMER_LENGTH = 1000; // 1 second

// Add rate limit timeout variables
let isRateLimited = false;
let rateLimitEndTime = 0;
let rateLimitTimer = null;

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
    } else if (data.type === "presence") {
      // Handle individual presence update
      updateUserPresence(data.username, data.status);
    } else if (data.type === "presenceList") {
      // Handle bulk presence updates
      for (const [username, presenceData] of Object.entries(data.users)) {
        updateUserPresence(username, presenceData.status);
      }
    } else if (data.type === "error") {
      console.error("Error from server:", data.error);
      
      // Check if this is a rate limit error
      if (data.error && data.error.includes("Rate limit exceeded")) {
        handleRateLimitError(data.error);
      }
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

// Add event listeners for the message input to track typing status
document.getElementById("message-input").addEventListener("input", function() {
  if (!typingTimer) {
    // Send typing indicator only if this is a new typing session
    sendTypingStatus(true);
  }
  
  // Clear any existing timer
  clearTimeout(typingTimer);
  
  // Set a new timer
  typingTimer = setTimeout(() => {
    // When timer expires, user has stopped typing
    sendTypingStatus(false);
    typingTimer = null;
  }, TYPING_TIMER_LENGTH);
});

document.getElementById("send-btn").addEventListener("click", sendMessage);
document.getElementById("message-input").addEventListener("keypress", function (event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
    // Clear typing status immediately after sending
    sendTypingStatus(false);
    clearTimeout(typingTimer);
    typingTimer = null;
  }
});

// When the recipient selection changes, update active conversation and header.
document.getElementById("who-to-send").addEventListener("change", function () {
  const selected = this.value;
  
  // Don't reload if we're already in this conversation
  const newConversation = selected === "All" ? "All" : [username, selected].sort().join("|");
  
  console.log(`Selection changed from ${activeConversation} to ${newConversation}, selected=${selected}`);
  
  if (newConversation !== activeConversation) {
    activeConversation = newConversation;
    updateConversationHeader();
    loadConversation();
    
    console.log(`Switched to conversation: ${activeConversation}`);
  }
});

// Send typing status to the server
function sendTypingStatus(isTyping) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: "typing",
      username: username,
      isTyping: isTyping
    }));
  }
}

// Update the displayed presence status for a user
function updateUserPresence(username, status) {
  // Store the status
  userPresence[username] = status;
  
  // Update the user list UI to show status
  updateUserListUI();
  
  // Show typing indicator in active conversation if applicable
  updateTypingIndicator();
}

// Update typing indicator in the chat area
function updateTypingIndicator() {
  // Remove any existing typing indicator
  const existingIndicator = document.getElementById("typing-indicator");
  if (existingIndicator) {
    existingIndicator.remove();
  }
  
  const chatMessages = document.getElementById("chat-messages");
  
  if (activeConversation === "All") {
    // For global chat, show all users who are typing
    const typingUsers = Object.entries(userPresence)
      .filter(([user, status]) => status === 'typing' && user !== username)
      .map(([user]) => user);
    
    if (typingUsers.length > 0) {
      const typingDiv = document.createElement("div");
      typingDiv.id = "typing-indicator";
      typingDiv.className = "typing-indicator";
      
      if (typingUsers.length === 1) {
        typingDiv.textContent = `${typingUsers[0]} is typing`;
      } else if (typingUsers.length === 2) {
        typingDiv.textContent = `${typingUsers[0]} and ${typingUsers[1]} are typing`;
      } else if (typingUsers.length === 3) {
        typingDiv.textContent = `${typingUsers[0]}, ${typingUsers[1]} and ${typingUsers[2]} are typing`;
      } else {
        typingDiv.textContent = `${typingUsers.length} people are typing`;
      }
      
      chatMessages.appendChild(typingDiv);
      typingDiv.scrollIntoView({ behavior: "smooth" });
    }
  } else {
    // For private chats
    const otherUser = activeConversation.split("|").find(u => u !== username);
    
    // If the other user is typing, show the indicator
    if (userPresence[otherUser] === 'typing') {
      const typingDiv = document.createElement("div");
      typingDiv.id = "typing-indicator";
      typingDiv.className = "typing-indicator";
      typingDiv.textContent = `${otherUser} is typing`;
      chatMessages.appendChild(typingDiv);
      
      // Scroll to the indicator
      typingDiv.scrollIntoView({ behavior: "smooth" });
    }
  }
}

// Update the user list display to show presence indicators
function updateUserListUI() {
  const selectElement = document.getElementById("who-to-send");
  
  // Store the currently selected conversation
  let currentRecipient = selectElement.value;
  
  // If we're in a private conversation, get the username of the other person
  if (activeConversation !== "All") {
    const otherUser = activeConversation.split("|").find(u => u !== username);
    // If the current recipient doesn't match who we're talking to, update it
    if (otherUser !== currentRecipient) {
      currentRecipient = otherUser;
    }
  }
  
  // Clear all options except "All"
  while (selectElement.options.length > 1) {
    selectElement.remove(1);
  }
  
  // Add back all users with their status indicators
  for (const user of userList) {
    if (user !== username) {
      const option = document.createElement("option");
      option.value = user;
      
      // Add status indicator based on presence
      const status = userPresence[user] || 'offline';
      let statusEmoji = '⚪️'; // Default/offline
      
      if (status === 'online') {
        statusEmoji = '🟢';
      } else if (status === 'typing') {
        statusEmoji = '✏️';
      }
      
      option.textContent = `${statusEmoji} ${user}`;
      selectElement.appendChild(option);
    }
  }
  
  // Try to restore the selected value
  if (currentRecipient !== "All") {
    // Find if there's an option that matches our current recipient
    const matchingOption = Array.from(selectElement.options)
      .find(option => option.value === currentRecipient);
    
    if (matchingOption) {
      selectElement.value = currentRecipient;
    }
  }
}

// Update changeUserList to call our new UI update function
function changeUserList(userlist) {
  userList = userlist;
  
  // Use the new function that includes presence indicators
  updateUserListUI();
}

// Sends a text message and/or file, and optimistically displays the text message.
function sendMessage() {
  // Don't allow sending if rate limited
  if (isRateLimited) {
    const remainingSeconds = Math.ceil((rateLimitEndTime - Date.now()) / 1000);
    displaySystemMessage(`You can't send messages for ${remainingSeconds} more seconds due to rate limiting.`);
    return;
  }
  
  const messageInputDiv = document.getElementById("message-input");
  const fileInput = document.getElementById("fileInput");
  const receiverDropdown = document.getElementById("who-to-send");
  const file = fileInput.files[0];
  let receiver = receiverDropdown.value;
  const message = messageInputDiv.innerHTML.trim();
  
  // Check if the socket is open before sending
  if (socket.readyState !== WebSocket.OPEN) {
    displaySystemMessage("Cannot send message. Connection to server lost. Trying to reconnect...");
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      connectWebSocket();
    }
    return;
  }
  
  if (!message && !file) return; // Do nothing if both are empty.

  // Determine the conversation key and ensure it's in sync with dropdown
  let convKey = "All";
  
  if (activeConversation !== "All") {
    // Extract the other user from the active conversation
    const otherUser = activeConversation.split("|").find(u => u !== username);
    
    // Update receiver if it doesn't match
    if (receiver !== otherUser) {
      receiver = otherUser;
      
      // Also update the dropdown to match
      for (let i = 0; i < receiverDropdown.options.length; i++) {
        if (receiverDropdown.options[i].value === receiver) {
          receiverDropdown.selectedIndex = i;
          break;
        }
      }
    }
    
    convKey = activeConversation;
  } else if (receiver !== "All") {
    // We're in global chat but sending to specific user, so update the active conversation
    convKey = [username, receiver].sort().join("|");
    activeConversation = convKey;
    updateConversationHeader();
    loadConversation();
  }

  // If it's a text message, show it immediately and send it
  if (message) {
    displayMessage(username, message, "sent", convKey);
    socket.send(JSON.stringify({ type: "message", username, reciever: receiver, message }));
    messageInputDiv.innerHTML = "";
  }

  // If it's a file, read and send it
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
        reciever: receiver
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

// Displays a message in the appropriate conversation.
function displayMessage(username, message, type, convKey = "All") {
  // Initialize the array if it doesn't exist yet.
  conversations[convKey] = conversations[convKey] || [];
  
  // Add message to conversation history.
  conversations[convKey].push({
    user: username,
    message: message,
    type: type,
    isFile: false
  });
  
  // If this is the active conversation, display it immediately.
  if (convKey === activeConversation) {
    const chatMessages = document.getElementById("chat-messages");
    
    const messageDiv = document.createElement("div");
    messageDiv.className = "message " + type;
    
    const userSpan = document.createElement("span");
    userSpan.className = "user";
    userSpan.textContent = username;
    
    const contentSpan = document.createElement("span");
    contentSpan.className = "content";
    // Use innerHTML instead of textContent to render HTML formatting
    contentSpan.innerHTML = message;
    
    messageDiv.appendChild(userSpan);
    messageDiv.appendChild(contentSpan);
    
    chatMessages.appendChild(messageDiv);
    
    // Scroll to the bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

// Loads conversation history for the active conversation into the chat box.
function loadConversation() {
  const messages = document.getElementById("chat-messages");
  messages.innerHTML = ""; // Clear the current messages
  
  // Get the appropriate conversation history
  const history = conversations[activeConversation] || [];
  
  // Create and append all message elements
  history.forEach(item => {
    const messageDiv = document.createElement("div");
    messageDiv.className = "message " + item.type;
    
    // Different display for system messages versus user messages
    if (item.type === "system") {
      messageDiv.textContent = item.message;
    } else {
      const userSpan = document.createElement("span");
      userSpan.className = "user";
      userSpan.textContent = item.user;
      
      const contentSpan = document.createElement("span");
      contentSpan.className = "content";
      
      // If it's a file, create a link
      if (item.isFile) {
        const link = document.createElement("a");
        link.href = item.fileData;
        link.download = item.fileName;
        link.textContent = `📎 ${item.fileName}`;
        contentSpan.appendChild(link);
      } else {
        // Use innerHTML instead of textContent to render HTML formatting
        contentSpan.innerHTML = item.message;
      }
      
      messageDiv.appendChild(userSpan);
      messageDiv.appendChild(contentSpan);
    }
    
    messages.appendChild(messageDiv);
  });
  
  // Check if we need to show a typing indicator in this conversation
  updateTypingIndicator();
  
  // Scroll to the bottom of the messages
  messages.scrollTop = messages.scrollHeight;
}

// Displays a file link in the appropriate conversation.
function displayFileLink(filename, fileData, convKey, sender) {
  // Initialize the array if it doesn't exist yet.
  conversations[convKey] = conversations[convKey] || [];
  
  // Add to conversation history.
  conversations[convKey].push({
    user: sender,
    fileName: filename,
    fileData: fileData,
    type: sender === username ? "sent" : "received",
    isFile: true
  });
  
  // If this is the active conversation, display it immediately.
  if (convKey === activeConversation) {
    const chatMessages = document.getElementById("chat-messages");
    
    const messageDiv = document.createElement("div");
    messageDiv.className = "message " + (sender === username ? "sent" : "received");
    
    const userSpan = document.createElement("span");
    userSpan.className = "user";
    userSpan.textContent = sender;
    
    const contentSpan = document.createElement("span");
    contentSpan.className = "content";
    
    const link = document.createElement("a");
    link.href = fileData;
    link.download = filename;
    link.textContent = `📎 ${filename}`;
    
    contentSpan.appendChild(link);
    messageDiv.appendChild(userSpan);
    messageDiv.appendChild(contentSpan);
    
    chatMessages.appendChild(messageDiv);
    
    // Scroll to the bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

// Displays a system message in the global conversation only.
function displaySystemMessage(message) {
  // System messages are only shown in the global chat.
  conversations["All"] = conversations["All"] || [];
  
  // Add message to conversation history.
  conversations["All"].push({
    message: message,
    type: "system"
  });
  
  // If global chat is active, display it immediately.
  if (activeConversation === "All") {
    const chatMessages = document.getElementById("chat-messages");
    
    const messageDiv = document.createElement("div");
    messageDiv.className = "message system";
    messageDiv.textContent = message;
    
    chatMessages.appendChild(messageDiv);
    
    // Scroll to the bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
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

  // Improved Formatting buttons for Bold, Italic, Underline.
  document.getElementById("bold-btn").addEventListener("click", () => {
    // Focus the input field first
    messageInput.focus();
    // Try standard execCommand first
    const success = document.execCommand("bold");
    if (!success) {
      // Fallback for browsers that don't support execCommand
      const selectedText = window.getSelection().toString();
      if (selectedText) {
        insertAtCaret(messageInput, `<b>${selectedText}</b>`);
      } else {
        insertAtCaret(messageInput, "<b>Bold text</b>");
      }
    }
    saveCaretPosition(messageInput);
  });
  
  document.getElementById("italic-btn").addEventListener("click", () => {
    // Focus the input field first
    messageInput.focus();
    // Try standard execCommand first
    const success = document.execCommand("italic");
    if (!success) {
      // Fallback for browsers that don't support execCommand
      const selectedText = window.getSelection().toString();
      if (selectedText) {
        insertAtCaret(messageInput, `<i>${selectedText}</i>`);
      } else {
        insertAtCaret(messageInput, "<i>Italic text</i>");
      }
    }
    saveCaretPosition(messageInput);
  });
  
  document.getElementById("underline-btn").addEventListener("click", () => {
    // Focus the input field first
    messageInput.focus();
    // Try standard execCommand first
    const success = document.execCommand("underline");
    if (!success) {
      // Fallback for browsers that don't support execCommand
      const selectedText = window.getSelection().toString();
      if (selectedText) {
        insertAtCaret(messageInput, `<u>${selectedText}</u>`);
      } else {
        insertAtCaret(messageInput, "<u>Underlined text</u>");
      }
    }
    saveCaretPosition(messageInput);
  });

  // Make sure the conversation header is updated
  updateConversationHeader();
  
  // Load the active conversation (starts with "All")
  loadConversation();
  
  console.log("Chat interface initialized with conversation:", activeConversation);
});

// Function to handle rate limit errors
function handleRateLimitError(errorMessage) {
  // Extract seconds from error message
  const secondsMatch = errorMessage.match(/Wait (\d+) seconds|Timed out for (\d+) seconds/);
  if (!secondsMatch) return;
  
  const seconds = parseInt(secondsMatch[1] || secondsMatch[2], 10);
  if (isNaN(seconds)) return;
  
  // Set rate limit state
  isRateLimited = true;
  rateLimitEndTime = Date.now() + (seconds * 1000);
  
  // Display rate limit notification
  showRateLimitNotification(seconds);
  
  // Clear any existing timer
  if (rateLimitTimer) {
    clearInterval(rateLimitTimer);
  }
  
  // Start countdown timer
  rateLimitTimer = setInterval(updateRateLimitCountdown, 1000);
  
  // Disable input and send button
  updateInputStateForRateLimit(true);
}

// Show rate limit notification
function showRateLimitNotification(seconds) {
  // Create rate limit notification element if it doesn't exist
  let rateLimitNotice = document.getElementById("rate-limit-notice");
  if (!rateLimitNotice) {
    rateLimitNotice = document.createElement("div");
    rateLimitNotice.id = "rate-limit-notice";
    rateLimitNotice.className = "rate-limit-notice";
    document.getElementById("chat-container").insertBefore(
      rateLimitNotice, 
      document.getElementById("input-area")
    );
  }
  
  rateLimitNotice.innerHTML = `
    <div class="rate-limit-icon">⚠️</div>
    <div class="rate-limit-message">
      <strong>Rate limit exceeded!</strong><br>
      You're sending messages too quickly. Please wait <span id="rate-limit-countdown">${seconds}</span> seconds.
    </div>
  `;
  
  // Show the notification
  rateLimitNotice.style.display = "flex";
}

// Update countdown timer
function updateRateLimitCountdown() {
  const remainingSeconds = Math.ceil((rateLimitEndTime - Date.now()) / 1000);
  const countdownElement = document.getElementById("rate-limit-countdown");
  
  if (countdownElement) {
    countdownElement.textContent = remainingSeconds.toString();
  }
  
  // If timer has expired
  if (remainingSeconds <= 0) {
    // Clear interval
    clearInterval(rateLimitTimer);
    rateLimitTimer = null;
    
    // Reset rate limit state
    isRateLimited = false;
    
    // Hide notification
    const rateLimitNotice = document.getElementById("rate-limit-notice");
    if (rateLimitNotice) {
      rateLimitNotice.style.display = "none";
    }
    
    // Enable input and send button
    updateInputStateForRateLimit(false);
  }
}

// Update input state based on rate limit
function updateInputStateForRateLimit(isLimited) {
  const messageInput = document.getElementById("message-input");
  const sendButton = document.getElementById("send-btn");
  const fileInput = document.getElementById("fileInput");
  
  if (isLimited) {
    // Disable input
    messageInput.setAttribute("contenteditable", "false");
    messageInput.classList.add("disabled");
    
    // Disable send button
    sendButton.disabled = true;
    sendButton.classList.add("disabled");
    
    // Disable file input
    fileInput.disabled = true;
  } else {
    // Enable input
    messageInput.setAttribute("contenteditable", "true");
    messageInput.classList.remove("disabled");
    
    // Enable send button
    sendButton.disabled = false;
    sendButton.classList.remove("disabled");
    
    // Enable file input
    fileInput.disabled = false;
  }
}