document.addEventListener("DOMContentLoaded", () => {
  const SERVER_ADDRESS = window.location.protocol === 'https:' 
    ? `wss://${window.location.host}` 
    : `ws://${window.location.host}`;
  
  // WebSocket connection and reconnection
  let socket;
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 3000; // 3 seconds
  
  function connectWebSocket() {
    socket = new WebSocket(SERVER_ADDRESS);
    
    // Connection established
    socket.onopen = () => {
      console.log("WebSocket connection established.");
      reconnectAttempts = 0; // Reset reconnect counter
      document.getElementById("connection-status").textContent = "Connected";
      document.getElementById("connection-status").style.color = "green";
      document.getElementById("login-button").disabled = false;
    };
    
    // Handle all incoming messages from the server
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("Received from server:", data);

      if (data.type === "login" && data.status === "success") {
        const username = document.getElementById("username").value.trim();
        localStorage.setItem("username", username);
        localStorage.setItem("authenticated", "true"); // Set authentication flag
        window.location.href = "chat.html";
      } else if (data.type === "login" && data.status === "fail") {
        // Show the error message if provided, otherwise show a generic error
        alert(data.message || "Invalid credentials!");
        
        // If login failed because user doesn't exist, offer to create account
        if (data.reason === "user_not_found") {
          if (confirm("This username doesn't exist. Would you like to create a new account?")) {
            window.location.href = "acount.html";
          }
        }
      }
    };
    
    // Handle connection closure
    socket.onclose = (event) => {
      console.log(`WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`);
      document.getElementById("connection-status").textContent = "Disconnected";
      document.getElementById("connection-status").style.color = "red";
      document.getElementById("login-button").disabled = true;
      
      // Attempt to reconnect
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        const delay = RECONNECT_DELAY * reconnectAttempts; // Exponential backoff
        console.log(`Attempting to reconnect in ${delay/1000} seconds... (Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
        
        document.getElementById("connection-status").textContent = `Reconnecting (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`;
        document.getElementById("connection-status").style.color = "orange";
        
        setTimeout(connectWebSocket, delay);
      } else {
        document.getElementById("connection-status").textContent = "Connection failed. Please refresh the page.";
      }
    };
    
    // Handle connection errors
    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
      document.getElementById("connection-status").textContent = "Connection error";
      document.getElementById("connection-status").style.color = "red";
    };
  }
  
  // Initialize connection
  connectWebSocket();
  
  // Add connection status indicator to the login form
  const loginForm = document.getElementById("login-form");
  const statusElement = document.createElement("div");
  statusElement.id = "connection-status";
  statusElement.textContent = "Connecting...";
  statusElement.style.color = "orange";
  statusElement.style.marginBottom = "10px";
  statusElement.style.textAlign = "center";
  loginForm.prepend(statusElement);
  
  // Modify the login button to have an ID
  const loginButton = loginForm.querySelector('button[type="submit"]');
  loginButton.id = "login-button";
  loginButton.disabled = true; // Disabled until connection is established

  // Listen for form submission
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!username || !password) {
      alert("Please enter both username and password.");
      return;
    }
    
    // Check if socket is connected
    if (socket.readyState !== WebSocket.OPEN) {
      alert("Cannot log in. Connection to server lost. Please wait for reconnection or refresh the page.");
      return;
    }

    // Send login request to the server
    socket.send(JSON.stringify({ type: "login", username, password }));
  });
});
