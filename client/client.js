

let socket;
let isAuthenticated = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const SERVER_ADDRESS = "wss://192.168.1.233:8001"; // Change for LAN: Need for front end to work with backend. Temporary solution.

// Get Elements
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const loginButton = document.getElementById("login-btn");
const chatArea = document.getElementById("chat-area");
const chatBox = document.getElementById("chat");
const messageInput = document.getElementById("message");
const sendButton = document.getElementById("send-btn");
const logoutButton = document.getElementById("logout-btn");



// No import needed; CryptoJS is available globally from the CDN
const secretKey = "your_super_secret_key";
const iv = CryptoJS.lib.WordArray.random(16); // IV should be random for each encryption

function encrypt(text) {
    const encrypted = CryptoJS.AES.encrypt(text, CryptoJS.enc.Utf8.parse(secretKey), {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    });
    return iv.toString(CryptoJS.enc.Hex) + encrypted.toString(); // Append IV to encrypted text
}

 function decrypt(encryptedText) {
    const ivHex = encryptedText.substring(0, 32);
    const encrypted = encryptedText.substring(32);

    const iv = CryptoJS.enc.Hex.parse(ivHex);
    const decrypted = CryptoJS.AES.decrypt(encrypted, CryptoJS.enc.Utf8.parse(secretKey), {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    });

    return decrypted.toString(CryptoJS.enc.Utf8);
}





// Connect WebSocket
function connectWebSocket() {
    socket = new WebSocket(SERVER_ADDRESS);

    socket.onopen = () => {
        console.log("Connected to WebSocket server.");
        reconnectAttempts = 0;
    };

    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log("Received:", data);
    
            switch (data.type) {
                case "login":
                    if (data.status === "success") {
                        isAuthenticated = true;
                        document.getElementById("chat-area").style.display = "block";
                        document.getElementById("username").disabled = true;
                        document.getElementById("password").disabled = true;
                        messageInput.focus();
                    } else {
                        alert("Invalid credentials!");
                    }
                    break;
    
                case "message":
                    const decrypted_message = decrypt(data.message)
                    alert(decrypted_message)
                    updateChat(data.username, data.message);
                    break;
    
                case "error":
                    showError(data.error);
                    break;
    
                case "notification":
                    showNotification(data.message);
                    break;
    
                default:
                    console.warn("Unknown message type received:", data);
            }
        } catch (error) {
            console.error("Error parsing server response:", error);
        }
    };
    
    
}







// Login Function
function login() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
        alert("Please enter both username and password.");
        return;
    }

    if (!socket || socket.readyState !== WebSocket.OPEN) {
        connectWebSocket();
    }

    socket.onopen = () => {
        console.log("Connected to WebSocket, sending login request");
        socket.send(JSON.stringify({ type: "login", username, password }));
    };
}


// Send Message Function
function sendMessage() {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        alert("Not connected to the chat server!");
        return;
    }
    if (!isAuthenticated) {
        alert("You must be logged in to send messages.");
        return;
    }

    const message = messageInput.value.trim();
    if (!message) return;

    const username = usernameInput.value.trim();
    socket.send(JSON.stringify({ type: "message", username, message }));
    messageInput.value = "";
    messageInput.focus();
}

// Logout Function
function logout() {
    if (socket) socket.close();
    isAuthenticated = false;
    chatArea.style.display = "none";
    usernameInput.disabled = false;
    passwordInput.disabled = false;
    alert("Logged out.");
}

// Update Chat
function updateChat(username, message) {
    const msgElement = document.createElement("p");
    msgElement.innerHTML = `<b>${username}:</b> ${message}`;
    chatBox.appendChild(msgElement);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Auto Reconnect
function attemptReconnect() {
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        console.log(`Reconnecting Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
        setTimeout(connectWebSocket, 3000);
    } else {
        console.log("Max reconnect attempts reached. Unable to reconnect.");
    }
}

// Send message on Enter key press
messageInput.addEventListener("keypress", function (event) {
    if (event.key === "Enter") {
        event.preventDefault();
        sendMessage();
    }
});

// Button Event Listeners
document.getElementById("login-btn").addEventListener("click", login);
document.getElementById("send-btn").addEventListener("click", sendMessage);
document.getElementById("logout-btn").addEventListener("click", logout);

