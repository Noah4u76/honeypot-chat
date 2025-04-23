document.addEventListener("DOMContentLoaded", () => {
  const SERVER_ADDRESS = "wss://192.168.1.96:8001"; // Adjust as needed
  const socket = new WebSocket(SERVER_ADDRESS);

  // Password validation function
  function validatePasswordStrength(password) {
    // Create an object to track requirements
    const requirements = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    };
    
    // Check if all requirements are met
    const allMet = Object.values(requirements).every(req => req === true);
    
    return {
      valid: allMet,
      requirements: requirements
    };
  }

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
      // Show the error message if provided, otherwise show a generic error
      alert(data.message || "Invalid credentials!");
    }
  };

  // Add password strength feedback as user types
  const passwordInput = document.getElementById("password");
  if (passwordInput) {
    passwordInput.addEventListener("input", function() {
      const password = this.value;
      const validation = validatePasswordStrength(password);
      
      // Get or create feedback element
      let feedbackElement = document.getElementById("password-feedback");
      if (!feedbackElement) {
        feedbackElement = document.createElement("div");
        feedbackElement.id = "password-feedback";
        feedbackElement.style.fontSize = "12px";
        feedbackElement.style.marginTop = "5px";
        this.parentNode.insertBefore(feedbackElement, this.nextSibling);
      }
      
      // Update feedback
      feedbackElement.innerHTML = `
        <div style="color: ${validation.requirements.length ? 'green' : 'red'}">
          ${validation.requirements.length ? '✓' : '✗'} At least 8 characters
        </div>
        <div style="color: ${validation.requirements.uppercase ? 'green' : 'red'}">
          ${validation.requirements.uppercase ? '✓' : '✗'} At least one uppercase letter
        </div>
        <div style="color: ${validation.requirements.lowercase ? 'green' : 'red'}">
          ${validation.requirements.lowercase ? '✓' : '✗'} At least one lowercase letter
        </div>
        <div style="color: ${validation.requirements.number ? 'green' : 'red'}">
          ${validation.requirements.number ? '✓' : '✗'} At least one number
        </div>
        <div style="color: ${validation.requirements.special ? 'green' : 'red'}">
          ${validation.requirements.special ? '✓' : '✗'} At least one special character
        </div>
      `;
    });
  }

  // Listen for form submission
  document.getElementById("login-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!username || !password) {
      alert("Please enter both username and password.");
      return;
    }
    
    // For new account creation, validate password strength
    const existingAccounts = localStorage.getItem("seenAccounts") || "";
    if (!existingAccounts.includes(username)) {
      const validation = validatePasswordStrength(password);
      if (!validation.valid) {
        alert("Your password doesn't meet the security requirements.");
        return;
      }
      
      // Remember this account for future login attempts
      localStorage.setItem("seenAccounts", existingAccounts + "," + username);
    }

    // Send login request to the server
    socket.send(JSON.stringify({ type: "login", username, password }));
  });
});
