import fs from 'fs';
import bcrypt from 'bcrypt';
import promptSync from 'prompt-sync';

const prompt = promptSync();
const usersFile = 'users.json';

// Ensure users.json exists
if (!fs.existsSync(usersFile)) {
    fs.writeFileSync(usersFile, JSON.stringify([]));
}

function getUsers() {
    return JSON.parse(fs.readFileSync(usersFile));
}

// Check if a user exists
function userExists(username) {
    return getUsers().some(user => user.username === username);
}

// Validate password
async function isValidPassword(username, password) {
    const users = getUsers();
    const user = users.find(u => u.username === username);
    return user ? await bcrypt.compare(password, user.password) : false;
}

// Register a new user
async function registerUser(username, password) {
    const users = getUsers();
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    users.push({ username, password: hash });
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
    console.log("User registered successfully.");
}

// Handle user login
export async function loginUser() {
    const username = prompt("Enter Username: ");
    const password = prompt.hide("Enter a Password: ");

    if (!userExists(username)) {
        await registerUser(username, password);
    } else if (!(await isValidPassword(username, password))) {
        throw new Error("Invalid password.");
    }

    return { username };
}
