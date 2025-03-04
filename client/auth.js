import fs from 'fs/promises';
import bcrypt from 'bcrypt';

const usersFile = "users.json";

export async function handleLogin(client, username, password) {
    try {
        if (!username || !password) {
            console.warn("Login attempt with missing username or password.");
            client.send(JSON.stringify({ type: "error", error: "Username and password required." }));
            return false;
        }

        console.log(`Login attempt from ${username}`);

        let users = [];
        try {
            // ✅ Ensure users.json exists and is valid before reading
            const data = await fs.readFile(usersFile, 'utf8');

            if (data.trim() === "") {
                console.warn("Users file is empty, initializing with an empty array.");
                users = [];
            } else {
                users = JSON.parse(data); // ✅ Parse only if valid
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.warn("Users file not found. Creating a new one.");
                await fs.writeFile(usersFile, JSON.stringify([], null, 2));
                users = [];
            } else {
                console.error("Error reading users file:", error);
                client.send(JSON.stringify({ type: "error", error: "Server error. Try again later." }));
                return false;
            }
        }

        let user = users.find(u => u.username === username);

        if (!user) {
            // ✅ Register new user
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(password, salt);

            const newUser = { username, password: hash };
            users.push(newUser);

            // ✅ Properly write updated users list to JSON file
            await fs.writeFile(usersFile, JSON.stringify(users, null, 2));

            console.log(`New user created: ${username}`);
            client.send(JSON.stringify({ type: "login", status: "success" }));
        } else {
            // ✅ Validate existing user
            const isValid = await bcrypt.compare(password, user.password);
            if (isValid) {
                console.log(`User ${username} successfully logged in.`);
            } else {
                console.warn(`User ${username} provided incorrect password.`);
            }
            client.send(JSON.stringify({ type: "login", status: isValid ? "success" : "fail" }));
        }
    } catch (error) {
        console.error("Error handling login:", error);
        client.send(JSON.stringify({ type: "error", error: "Server error. Try again later." }));
        return false;
    }
}
