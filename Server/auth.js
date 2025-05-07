import fs from 'fs/promises';
import bcrypt from 'bcrypt';
<<<<<<< HEAD
import mongoose from 'mongoose'
=======
import path from 'path';
import mysql from 'mysql2'
>>>>>>> parent of 174cbc5 (changed to mongodb)

// Path to users file
const usersFile = 'Server/data/users.json';

<<<<<<< HEAD
// For MongoDB connection
const uri = process.env.MONGODB_URI;
let mongoConnected = false;
let User;
=======
//const usersFile = path.join(process.cwd(), "users.json");
>>>>>>> parent of 174cbc5 (changed to mongodb)

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

<<<<<<< HEAD
    User = mongoose.model('User', userSchema);
  } catch (err) {
    console.error("MongoDB Connection Error:", err);
    console.log("Continuing with local file-based authentication");
  }
} else {
  console.log("No MONGODB_URI environment variable found. Using local file-based authentication.");
}

=======

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'USERS',
}).promise()


const USER_TABLE = await pool.query(`CREATE TABLE IF NOT EXISTS USER (
    USER_ID INT NOT NULL AUTO_INCREMENT,
    USERNAME VARCHAR(255) NOT NULL UNIQUE,
    PASSWORD VARCHAR(255) NOT NULL,
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(USER_ID)
)`)





const MESSAGE_TABLE = await pool.query(`CREATE TABLE IF NOT EXISTS MESSAGE (
    MESSAGE_ID INT NOT NULL AUTO_INCREMENT,
    SENDER_ID INT NOT NULL,
    RECEIVER_ID INT, -- NULL for global messages
    CONTENT TEXT NOT NULL, -- Encrypted message content
    IS_FILE BOOLEAN DEFAULT FALSE,
    TIMESTAMP TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(MESSAGE_ID),
    FOREIGN KEY (SENDER_ID) REFERENCES USER(USER_ID),
    FOREIGN KEY (RECEIVER_ID) REFERENCES USER(USER_ID)
)`)



const FILE_META_TABLE = await pool.query(`CREATE TABLE IF NOT EXISTS FILE_META (
    FILE_ID INT NOT NULL AUTO_INCREMENT,
    MESSAGE_ID INT NOT NULL,
    FILENAME VARCHAR(255) NOT NULL,
    FILETYPE VARCHAR(100) NOT NULL,
    CLOUD_REFERENCE VARCHAR(255) NOT NULL, -- Reference to cloud storage
    PRIMARY KEY(FILE_ID),
    FOREIGN KEY (MESSAGE_ID) REFERENCES MESSAGE(MESSAGE_ID)
)`)



async function getUserFromDatabase(username) {
  const [rows] = await pool.query(`SELECT * FROM USER WHERE USERNAME = ?`, [username]);
  return rows;
}









>>>>>>> parent of 174cbc5 (changed to mongodb)
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
    /*const data = await fs.readFile(usersFile, 'utf8');
    users = data.trim() ? JSON.parse(data) : [];
<<<<<<< HEAD
    console.log("Loaded users from file:", users);
=======
    console.log("Loaded users:", users);*/
>>>>>>> parent of 174cbc5 (changed to mongodb)
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

<<<<<<< HEAD
  // First try MongoDB if available
  if (mongoConnected) {
=======
  let user = null;
  console.log("cyrr ",user)

  try {
    // Wait for the result of the MySQL query
    const results = await  getUserFromDatabase(username);
    console.log("results fds ", results)
    if (results.length === 0) 
    {
        console.log('User does not exist.');
    } 
    else 
    {
      console.log('User:', user);
      user = results[0];
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
>>>>>>> parent of 174cbc5 (changed to mongodb)
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
<<<<<<< HEAD
=======
    client.send(JSON.stringify({ type: "login", status: "success" }));
    return true;*/
  } 
  else 
  {
    // Existing user login
    
    const isValid = await bcrypt.compare(password, user.PASSWORD);
    client.send(JSON.stringify({ type: "login", status: isValid ? "success" : "fail" }));
>>>>>>> parent of 174cbc5 (changed to mongodb)
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

<<<<<<< HEAD
  // Check if username already exists in file
  if (users.some(u => u.username === username)) {
=======
  if (username.trim().toLowerCase() === 'all' || username) {
    client.send(JSON.stringify({ 
      type: "registration", 
      status: "fail", 
      message: "You can't make your username all." 
    }));
    return;
  }




  // Check if username already exists
  const results = await  getUserFromDatabase(username);
  if (results.length !== 0) {
>>>>>>> parent of 174cbc5 (changed to mongodb)
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
<<<<<<< HEAD
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
=======
    ///await fs.writeFile(usersFile, JSON.stringify(users, null, 2));

    ///const newUser = new User({ username, password: hash });
    ///await newUser.save();


    const user = await pool.query(`INSERT INTO USER (USERNAME, PASSWORD) VALUES (?, ?)`, [username,hash]); // ✅ assigning to outer variable




    console.log(`Created new user account for ${username}`);
>>>>>>> parent of 174cbc5 (changed to mongodb)
    
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