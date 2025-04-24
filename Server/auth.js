import fs from 'fs/promises';
import bcrypt from 'bcrypt';
import path from 'path';
import mysql from 'mysql2'

// Use the current working directory as the base path for users.json

//const usersFile = path.join(process.cwd(), "users.json");




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
    
    const isValid = await bcrypt.compare(password, user.PASSWORD);
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


  if (username.trim() === 'all') {
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
    ///await fs.writeFile(usersFile, JSON.stringify(users, null, 2));

    ///const newUser = new User({ username, password: hash });
    ///await newUser.save();


    const user = await pool.query(`INSERT INTO USER (USERNAME, PASSWORD) VALUES (?, ?)`, [username,password]); // ✅ assigning to outer variable




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