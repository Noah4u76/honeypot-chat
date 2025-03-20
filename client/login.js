document.addEventListener("DOMContentLoaded", () => {
  const SERVER_ADDRESS = "wss://0.0.0.0:8001"; // Adjust as needed
  const socket = new WebSocket(SERVER_ADDRESS);

  // Set up WebSocket event handlers
  socket.onopen = () => {
    console.log("WebSocket connection established.");
  };

  // Handle all incoming messages from the server
  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log("Received from server:", data);

    if (data.type === "login" && data.status === "success") {
      const username = document.getElementById("username").value.trim();
      localStorage.setItem("username", username);
      window.location.href = "chat.html";
    } else if (data.type === "login" && data.status === "fail") {
      alert("Invalid credentials!");
    }
  };

  // Listen for form submission
  document.getElementById("login-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!username || !password) {
      alert("Please enter both username and password.");
      return;
    }

    // Send login request to the server
    socket.send(JSON.stringify({ type: "login", username, password }));
  });
});