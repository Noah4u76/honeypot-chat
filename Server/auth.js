import fs from 'fs/promises';
import bcrypt from 'bcrypt';
import path from 'path';

// Use the current working directory as the base path for users.json
const usersFile = path.join(process.cwd(), "users.json");

export async function handleLogin(client, username, password) {
  if (!username || !password) {
    client.send(JSON.stringify({ type: "error", error: "Username and password required." }));
    return false;
  }

  let users = [];
  try {
    const data = await fs.readFile(usersFile, 'utf8');
    users = data.trim() ? JSON.parse(data) : [];
    console.log("Loaded users:", users);
  } catch (error) {
    if (error.code === 'ENOENT') {
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
    }
  }

  let user = users.find(u => u.username === username);
  if (!user) {
    const hash = await bcrypt.hash(password, 10);
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
    return true;
  } else {
    const isValid = await bcrypt.compare(password, user.password);
    client.send(JSON.stringify({ type: "login", status: isValid ? "success" : "fail" }));
    return isValid;
  }
}
