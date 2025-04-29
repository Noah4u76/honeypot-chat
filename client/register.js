document.addEventListener("DOMContentLoaded", () => {
  const SERVER_ADDRESS = window.location.protocol === 'https:' 
    ? `wss://${window.location.host}` 
    : `ws://${window.location.host}`;
  
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
  // WebSocket connection and reconnection
  let socket;
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 3000; // 3 seconds
  
  // CAPTCHA variables
  let captchaToken = '';
  let captchaVerified = false;
  
  function connectWebSocket() {
    socket = new WebSocket(SERVER_ADDRESS);
    
    // Connection established
    socket.onopen = () => {
      console.log("WebSocket connection established.");
      reconnectAttempts = 0; // Reset reconnect counter
      document.getElementById("connection-status").textContent = "Connected";
      document.getElementById("connection-status").style.color = "green";
      document.getElementById("register-button").disabled = true; // Default to disabled until CAPTCHA is verified
      
      // Load CAPTCHA once connected
      loadCaptcha();
    };
    
    // Handle all incoming messages from the server
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("Received from server:", data);
  
      if (data.type === "registration" && data.status === "success") {
        const username = document.getElementById("username").value.trim();
        localStorage.setItem("username", username);
        localStorage.setItem("authenticated", "true"); // Set authentication flag
        window.location.href = "chat.html";
      } else if (data.type === "registration" && data.status === "fail") {
        // Show the error message if provided, otherwise show a generic error
        alert(data.message || "Failed to create an account");
        
        // If username already exists, offer to go to login
        if (data.message && data.message.includes("already exists")) {
          if (confirm("This username already exists. Would you like to log in instead?")) {
            window.location.href = "login.html";
          }
        }
      }
    };
    
    // Handle connection closure
    socket.onclose = (event) => {
      console.log(`WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`);
      document.getElementById("connection-status").textContent = "Disconnected";
      document.getElementById("connection-status").style.color = "red";
      document.getElementById("register-button").disabled = true;
      
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
  
  // Add connection status indicator to the register form
  const registerForm = document.getElementById("register-form");
  const statusElement = document.createElement("div");
  statusElement.id = "connection-status";
  statusElement.textContent = "Connecting...";
  statusElement.style.color = "orange";
  statusElement.style.marginBottom = "10px";
  statusElement.style.textAlign = "center";
  registerForm.prepend(statusElement);
  
  // Modify the register button to have an ID
  const registerButton = registerForm.querySelector('button[type="submit"]');
  registerButton.id = "register-button";
  registerButton.disabled = true; // Disabled until connection is established and CAPTCHA is verified
  
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

  // CAPTCHA functions
  function loadCaptcha() {
    const captchaCodeElement = document.getElementById("captcha-code");
    captchaCodeElement.textContent = "Loading...";
    
    // Reset verification status
    captchaVerified = false;
    document.getElementById("register-button").disabled = true;
    
    // Fetch a new CAPTCHA from the server
    fetch('/api/captcha')
      .then(response => response.json())
      .then(data => {
        captchaToken = data.token;
        captchaCodeElement.textContent = data.captchaCode;
      })
      .catch(error => {
        console.error('Error loading CAPTCHA:', error);
        captchaCodeElement.textContent = "Error";
        document.getElementById("captcha-message").textContent = "Failed to load CAPTCHA";
        document.getElementById("captcha-message").className = "captcha-error";
      });
  }
  
  // Verify CAPTCHA input
  function verifyCaptcha(userInput) {
    if (!captchaToken) {
      document.getElementById("captcha-message").textContent = "CAPTCHA not loaded, please refresh";
      document.getElementById("captcha-message").className = "captcha-error";
      return Promise.reject("CAPTCHA not loaded");
    }
    
    return fetch('/api/verify-captcha', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        token: captchaToken,
        userInput: userInput
      })
    })
    .then(response => response.json())
    .then(data => {
      if (data.valid) {
        document.getElementById("captcha-message").textContent = "CAPTCHA verified";
        document.getElementById("captcha-message").className = "captcha-success";
        captchaVerified = true;
        
        // Enable the register button if connected
        if (socket.readyState === WebSocket.OPEN) {
          document.getElementById("register-button").disabled = false;
        }
        
        return true;
      } else {
        document.getElementById("captcha-message").textContent = data.message || "Incorrect CAPTCHA";
        document.getElementById("captcha-message").className = "captcha-error";
        captchaVerified = false;
        document.getElementById("register-button").disabled = true;
        
        // Load a new CAPTCHA
        loadCaptcha();
        return false;
      }
    })
    .catch(error => {
      console.error('Error verifying CAPTCHA:', error);
      document.getElementById("captcha-message").textContent = "Verification failed";
      document.getElementById("captcha-message").className = "captcha-error";
      return false;
    });
  }
  
  // Add CAPTCHA input verification
  const captchaInput = document.getElementById("captcha-input");
  if (captchaInput) {
    captchaInput.addEventListener("blur", function() {
      if (this.value.trim()) {
        verifyCaptcha(this.value.trim());
      }
    });
  }
  
  // Add refresh button functionality
  const refreshButton = document.getElementById("refresh-captcha");
  if (refreshButton) {
    refreshButton.addEventListener("click", function(e) {
      e.preventDefault();
      loadCaptcha();
    });
  }

  // Listen for form submission
  registerForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!username || !password) {
      alert("Please enter both username and password.");
      return;
    }
    
    // Check if socket is connected
    if (socket.readyState !== WebSocket.OPEN) {
      alert("Cannot register. Connection to server lost. Please wait for reconnection or refresh the page.");
      return;
    }
    
    // Verify CAPTCHA
    if (!captchaVerified) {
      const captchaInput = document.getElementById("captcha-input").value.trim();
      if (!captchaInput) {
        alert("Please complete the CAPTCHA verification.");
        return;
      }
      
      verifyCaptcha(captchaInput)
        .then(isValid => {
          if (isValid) {
            processRegistration(username, password);
          } else {
            alert("CAPTCHA verification failed. Please try again.");
          }
        })
        .catch(() => {
          alert("CAPTCHA verification error. Please refresh the page and try again.");
        });
    } else {
      processRegistration(username, password);
    }
  });
  
  // Process registration after CAPTCHA verification
  function processRegistration(username, password) {
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

    // Send registration request to the server
    socket.send(JSON.stringify({ type: "registration", username, password }));
  }
});
  