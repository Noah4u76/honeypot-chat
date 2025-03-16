const SERVER_ADDRESS = "wss://localhost:8001"; //Change IP before commiting
const socket = new WebSocket(SERVER_ADDRESS);

document.getElementById("login-btn").addEventListener("click", () => {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!username || !password) {
    alert("Please enter both username and password.");
    return;
  }

  socket.send(JSON.stringify({ type: "login", username, password }));

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log("Received:", data);

    if (data.type === "login" && data.status === "success") {
      localStorage.setItem("username", username);
      window.location.href = "chat.html";
    } else {
      alert("Invalid credentials!");
    }
  };
});

