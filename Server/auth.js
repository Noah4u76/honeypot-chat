import fs from 'fs/promises';
import bcrypt from 'bcrypt';

const usersFile = "users.json";

export async function handleLogin(client, username, password) {
  if (!username || !password) {
    client.send(JSON.stringify({ type: "error", error: "Username and password required." }));
    return false;
  }

  let users = [];
  try {
    const data = await fs.readFile(usersFile, 'utf8');
    users = data.trim() ? JSON.parse(data) : [];
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.writeFile(usersFile, JSON.stringify([], null, 2));
    } else {
      client.send(JSON.stringify({ type: "error", error: "Server error." }));
      return false;
    }
  }

  let user = users.find(u => u.username === username);
  if (!user) {
    const hash = await bcrypt.hash(password, 10);
    users.push({ username, password: hash });
    await fs.writeFile(usersFile, JSON.stringify(users, null, 2));
    client.send(JSON.stringify({ type: "login", status: "success" }));
    return true;
  } else {
    const isValid = await bcrypt.compare(password, user.password);
    client.send(JSON.stringify({ type: "login", status: isValid ? "success" : "fail" }));
    return isValid;
  }
}
