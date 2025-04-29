import fs from 'fs/promises';
import bcrypt from 'bcrypt';
import path from 'path';
import mysql from 'mysql2'
import mongoose from 'mongoose'

// Use the current working directory as the base path for users.json
const usersFile = path.join(process.cwd(), "users.json");

// For MongoDB connection
const uri = process.env.MONGODB_URI;
let mongoConnected = false;
let User;

// Try to connect to MongoDB, but don't stop the application if it fails
if (uri) {
  try {
    await mongoose.connect(uri);
    console.log("MongoDB Connected");
    mongoConnected = true;

    const userSchema = new mongoose.Schema({
      username: { type: String, unique: true, required: true },
      password: { type: String, required: true }
    });

    User = mongoose.model('User', userSchema);
  } catch (err) {
    console.error("❌ MongoDB Connection Error:", err);
    console.log("📢 Continuing with local file-based authentication");
  }
} else {
  console.log("⚠️ No MONGODB_URI environment variable found. Using local file-based authentication.");
}

// Password validation function
function validatePassword(password) {
  // Check length (minimum 8 characters)
  if (password.length < 8) {
    return { valid: false, message: "Password must be at least 8 characters long." };
  }
  
  // Check for at least one uppercase letter
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: "Password must contain at least one uppercase letter." };
  }
  
  // Check for at least one lowercase letter
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: "Password must contain at least one lowercase letter." };
  }
  
  // Check for at least one number
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: "Password must contain at least one number." };
  }
  
  // Check for at least one special character
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, message: "Password must contain at least one special character." };
  }
  
  return { valid: true };
}

export async function handleLogin(client, username, password, clientIP) {
  if (!username || !password) {
    client.send(JSON.stringify({ type: "error", error: "Username and password required." }));
    return false;
  }

  // Load users from local file
  let users = [];
  try {
    const data = await fs.readFile(usersFile, 'utf8');
    users = data.trim() ? JSON.parse(data) : [];
    console.log("Loaded users from file:", users);
  } catch (error) {
    console.error("Error reading users.json:", error);
    // Try to create the file if it doesn't exist
    if (error.code === 'ENOENT') {
      try {
        await fs.writeFile(usersFile, JSON.stringify([], null, 2));
        console.log("Created new users.json file");
      } catch (err) {
        console.error("Error creating users.json:", err);
      }
    }
  }

  // First try MongoDB if available
  if (mongoConnected) {
    try {
      const user = await User.findOne({ username });
      if (user) {
        const isValid = await bcrypt.compare(password, user.password);
        if (isValid) {
          client.send(JSON.stringify({ type: "login", status: "success" }));
        } else {
          client.send(JSON.stringify({ type: "login", status: "fail", reason: "invalid_password", message: "Invalid password." }));
        }
        return isValid;
      }
    } catch (err) {
      console.error('Error querying MongoDB:', err);
      // Fall back to file-based auth if MongoDB query fails
    }
  }

  // Fall back to file-based authentication
  const userFromFile = users.find(u => u.username === username);
  if (userFromFile) {
    const isValid = await bcrypt.compare(password, userFromFile.password);
    if (isValid) {
      client.send(JSON.stringify({ type: "login", status: "success" }));
    } else {
      client.send(JSON.stringify({ type: "login", status: "fail", reason: "invalid_password", message: "Invalid password." }));
    }
    return isValid;
  } else {
    // User doesn't exist - suggest registration
    client.send(JSON.stringify({ 
      type: "login", 
      status: "fail", 
      reason: "user_not_found",
      message: "User not found. Please check your username or create a new account." 
    }));
    return false;
  }
}

// Function to handle explicit registration
export async function handleRegistration(client, username, password) {
  if (!username || !password) {
    client.send(JSON.stringify({ 
      type: "registration", 
      status: "fail", 
      message: "Username and password required." 
    }));
    return false;
  }

  // Validate password strength
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    client.send(JSON.stringify({ 
      type: "registration", 
      status: "fail", 
      message: passwordValidation.message 
    }));
    return false;
  }

  // Load existing users from file
  let users = [];
  try {
    const data = await fs.readFile(usersFile, 'utf8');
    users = data.trim() ? JSON.parse(data) : [];
  } catch (error) {
    if (error.code === 'ENOENT') {
      try {
        await fs.writeFile(usersFile, JSON.stringify([], null, 2));
        users = [];
      } catch (err) {
        console.error("Error creating users.json:", err);
        client.send(JSON.stringify({ 
          type: "registration", 
          status: "fail", 
          message: "Server error." 
        }));
        return false;
      }
    } else {
      console.error("Error reading users.json:", error);
      client.send(JSON.stringify({ 
        type: "registration", 
        status: "fail", 
        message: "Server error." 
      }));
      return false;
    }
  }

  // Check if username already exists in file
  if (users.some(u => u.username === username)) {
    client.send(JSON.stringify({ 
      type: "registration", 
      status: "fail", 
      message: "Username already exists." 
    }));
    return false;
  }

  // Check MongoDB if connected
  if (mongoConnected) {
    try {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        client.send(JSON.stringify({ 
          type: "registration", 
          status: "fail", 
          message: "Username already exists in database." 
        }));
        return false;
      }
    } catch (err) {
      console.error("Error checking username in MongoDB:", err);
      // Continue with file-based registration
    }
  }

  // Create new user
  const hash = await bcrypt.hash(password, 10);
  users.push({ username, password: hash });
  
  try {
    // Save to file
    await fs.writeFile(usersFile, JSON.stringify(users, null, 2));
    console.log(`Created new user account for ${username} in users.json`);
    
    // Save to MongoDB if connected
    if (mongoConnected) {
      try {
        const newUser = new User({ username, password: hash });
        await newUser.save();
        console.log(`Created user in MongoDB: ${username}`);
      } catch (err) {
        console.error("Failed to create user in MongoDB:", err);
      }
    }
    
    client.send(JSON.stringify({ 
      type: "registration", 
      status: "success" 
    }));
    return true;
  } catch (err) {
    console.error("Error writing to users.json:", err);
    client.send(JSON.stringify({ 
      type: "registration", 
      status: "fail", 
      message: "Server error." 
    }));
    return false;
  }
}