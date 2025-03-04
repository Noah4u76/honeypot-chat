import fs from 'fs';
import bcrypt from 'bcrypt';

const usersFile = "users.json";

// Handle User Login & Registration
export async function handleLogin(client, username, password) {
    if (!fs.existsSync(usersFile)) {
        fs.writeFileSync(usersFile, JSON.stringify([]));
    }

    let users = JSON.parse(fs.readFileSync(usersFile));
    let user = users.find(u => u.username === username);

    if (!user) {
        // Register new user
        const salt = bcrypt.genSaltSync(10);
        const hash = await bcrypt.hash(password, salt);

        users.push({ username, password: hash });
        fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));

        console.log(`New user created: ${username}`);
        client.send(JSON.stringify({ type: "login", status: "success" }));
    } else {
        const isValid = await bcrypt.compare(password, user.password);
        client.send(JSON.stringify({ type: "login", status: isValid ? "success" : "fail" }));
    }
}
