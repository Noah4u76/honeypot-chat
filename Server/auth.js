import bcrypt from 'bcrypt';
import mongoose from 'mongoose'

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
    console.error("MongoDB Connection Error:", err);
    console.log("No database available. Registration and login will fail.");
  }
} else {
  console.log("No MONGODB_URI environment variable found. Registration and login will fail.");
}

// Password validation function
function validatePassword(password) {
  if (password.length < 8) {
    return { valid: false, message: "Password must be at least 8 characters long." };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: "Password must contain at least one uppercase letter." };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: "Password must contain at least one lowercase letter." };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: "Password must contain at least one number." };
  }
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
  if (!mongoConnected) {
    client.send(JSON.stringify({ type: "login", status: "fail", message: "Database not available." }));
    return false;
  }
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
    } else {
      client.send(JSON.stringify({ 
        type: "login", 
        status: "fail", 
        reason: "user_not_found",
        message: "User not found. Please check your username or create a new account." 
      }));
      return false;
    }
  } catch (err) {
    console.error('Error querying MongoDB:', err);
    client.send(JSON.stringify({ type: "login", status: "fail", message: "Server error (database)." }));
    return false;
  }
}

export async function handleRegistration(client, username, password) {
  if (!username || !password) {
    client.send(JSON.stringify({ 
      type: "registration", 
      status: "fail", 
      message: "Username and password required." 
    }));
    return false;
  }
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    client.send(JSON.stringify({ 
      type: "registration", 
      status: "fail", 
      message: passwordValidation.message 
    }));
    return false;
  }
  if (!mongoConnected) {
    client.send(JSON.stringify({ type: "registration", status: "fail", message: "Database not available." }));
    return false;
  }
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
    const hash = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hash });
    await newUser.save();
    console.log(`Created user in MongoDB: ${username}`);
    client.send(JSON.stringify({ 
      type: "registration", 
      status: "success" 
    }));
    return true;
  } catch (err) {
    console.error("MongoDB registration error:", err);
    client.send(JSON.stringify({ 
      type: "registration", 
      status: "fail", 
      message: "Server error (database)." 
    }));
    return false;
  }
}