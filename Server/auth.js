import fs from 'fs/promises';
import bcrypt from 'bcrypt';
import path from 'path';
import mysql from 'mysql2'
import mongoose from 'mongoose'

// Use the current working directory as the base path for users.json

//const usersFile = path.join(process.cwd(), "users.json");




const uri = 'mongodb://0.0.0.0:27017/USERS';


try {
  await mongoose.connect(uri);
  console.log("MongoDB Connected");
} catch (err) {
  console.error("MongoDB Connection Error:", err);
}

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true }
});

const User = mongoose.model('User', userSchema);












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

  let users = [];
  try {
    /*const data = await fs.readFile(usersFile, 'utf8');
    users = data.trim() ? JSON.parse(data) : [];
    console.log("Loaded users:", users);*/
  } catch (error) {
    /*if (error.code === 'ENOENT') {
      console.log("users.json not found, creating a new one at", usersFile);
      try {
        await fs.writeFile(usersFile, JSON.stringify([], null, 2));
        users = [];
      } catch (err) {
        console.error("Error creating users.json:", err);
        client.send(JSON.stringify({ type: "error", error: "Server error." }));
        return false;
      }
    } else {
      console.error("Error reading users.json:", error);
      client.send(JSON.stringify({ type: "error", error: "Server error." }));
      return false;
    }*/
      console.error("Error reading users.json:", error);
      client.send(JSON.stringify({ type: "error", error: "Server error." }));
      return false;
  }

  let user = null;

  try {
    // Wait for the result of the MySQL query
    user = await User.findOne({ username }); // ✅ assigning to outer variable
    if (!user) 
    {
      console.log('User does not exist.');
    } 
    else 
    {
      console.log('User:', user);
    }
  } catch (err) 
  {
    console.error('Error executing query:', err);
    client.send(JSON.stringify({ type: "error", error: "Server error." }));
    return false;
  }
  console.log("User is, ", user)
  if (user === null) {
    // For new user registration, validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      client.send(JSON.stringify({ 
        type: "login", 
        status: "fail", 
        message: passwordValidation.message 
      }));
      return false;
    }

    /*const hash = await bcrypt.hash(password, 10);
    users.push({ username, password: hash });
    try {
      await fs.writeFile(usersFile, JSON.stringify(users, null, 2));
      console.log(`Created new user account for ${username}. Updated users.json:`, users);
    } catch (err) {
      console.error("Error writing to users.json:", err);
      client.send(JSON.stringify({ type: "error", error: "Server error." }));
      return false;
    }
    client.send(JSON.stringify({ type: "login", status: "success" }));
    return true;*/
  } 
  else 
  {
    // Existing user login
    const isValid = await bcrypt.compare(password, user.password);
    client.send(JSON.stringify({ type: "login", status: isValid ? "success" : "fail" }));
    return isValid;
  }
}

// Function to handle explicit registration (if you want to implement a separate registration process)
export async function handleRegistration(client, username, password) {
  if (!username || !password) {
    client.send(JSON.stringify({ 
      type: "registration", 
      status: "fail", 
      message: "Username and password required." 
    }));
    return;
  }

  // Validate password strength
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    client.send(JSON.stringify({ 
      type: "registration", 
      status: "fail", 
      message: passwordValidation.message 
    }));
    return;
  }

  let users = [];
  try {
    /*const data = await fs.readFile(usersFile, 'utf8');
    users = data.trim() ? JSON.parse(data) : [];*/
  } catch (error) {
    if (error.code === 'ENOENT') {
      try {
        /*await fs.writeFile(usersFile, JSON.stringify([], null, 2));
        users = [];*/
      } catch (err) {
        console.error("Error creating users.json:", err);
        client.send(JSON.stringify({ 
          type: "registration", 
          status: "fail", 
          message: "Server error." 
        }));
        return;
      }
    } else {
      console.error("Error reading users.json:", error);
      client.send(JSON.stringify({ 
        type: "registration", 
        status: "fail", 
        message: "Server error." 
      }));
      return;
    }
  }

  // Check if username already exists
  let user = await User.findOne({ username });
  if (user) {
    client.send(JSON.stringify({ 
      type: "registration", 
      status: "fail", 
      message: "Username already exists." 
    }));
    return;
  }

  // Create new user
  const hash = await bcrypt.hash(password, 10);
  users.push({ username, password: hash });
  
  try {
    await fs.writeFile(usersFile, JSON.stringify(users, null, 2));

    const newUser = new User({ username, password: hash });
    await newUser.save();



    console.log(`Created new user account for ${username}`);
    
    client.send(JSON.stringify({ 
      type: "registration", 
      status: "success" 
    }));




  } catch (err) {
    console.error("Error writing to users.json:", err);
    client.send(JSON.stringify({ 
      type: "registration", 
      status: "fail", 
      message: "Server error." 
    }));
  }
}