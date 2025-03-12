const SERVER_ADDRESS = "wss://0.0.0.0:8001"; //Change IP before commiting
const socket = new WebSocket(SERVER_ADDRESS);

const username = localStorage.getItem("username");
if (!username) {
  // If there's no username in localStorage, redirect to login.
  window.location.href = "login.html";
}

socket.onopen = () => {
  // After opening WebSocket, send "join" with the username
  socket.send(JSON.stringify({ type: "join", username }));
};

socket.onmessage = (event) => {
  console.log("Raw data received:", event.data);
  const data = JSON.parse(event.data);
  console.log("Parsed data:", data);

  if (data.type === "message") {
    // Decrypt the message before displaying
    window.decrypt(data.message)
      .then((decryptedMessage) => {
        displayMessage(data.username, decryptedMessage, data.username === username ? "sent" : "received");
      })
      .catch((err) => {
        console.error("Decryption failed:", err);
      });
  } else if (data.type === "notification") {
    window.decrypt(data.message)
      .then((decryptedMessage) => {
        displaySystemMessage(decryptedMessage);
      })
      .catch((err) => {
        console.error("Decryption failed:", err);
      });
  } else if (data.type === "error") {
    console.error("Error from server:", data.error);
  }
};

document.getElementById("send-btn").addEventListener("click", sendMessage);

document.getElementById("message").addEventListener("keypress", function (event) {
  if (event.key === "Enter") {
    event.preventDefault();
    sendMessage();
  }
});

function sendMessage() {
  const messageInput = document.getElementById("message");
  const message = messageInput.value.trim();
  if (!message) return;
  // Send plain text message; the server will encrypt it.
  socket.send(JSON.stringify({ type: "message", username, message }));
  messageInput.value = "";
}

document.getElementById("logout-btn").addEventListener("click", () => {
  localStorage.removeItem("username");
  window.location.href = "login.html";
});

function displayMessage(user, message, type) {
  const chatDiv = document.getElementById("messages");
  const msgElement = document.createElement("div");
  msgElement.classList.add("message", type);
  msgElement.innerHTML = `<b>${user}:</b> ${message}`;
  chatDiv.appendChild(msgElement);
  chatDiv.scrollTop = chatDiv.scrollHeight;
}

function displaySystemMessage(message) {
  const chatDiv = document.getElementById("messages");
  const msgElement = document.createElement("div");
  msgElement.classList.add("message", "received");
  msgElement.innerHTML = `<b>System:</b> ${message}`;
  chatDiv.appendChild(msgElement);
  chatDiv.scrollTop = chatDiv.scrollHeight;
}
