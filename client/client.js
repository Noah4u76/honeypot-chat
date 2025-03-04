import { loginUser } from './auth.js';
import { startWebSocket } from './socketClient.js';

async function main() {
    try {
        const user = await loginUser(); // Authenticate user
        console.log(`Welcome, ${user.username}!`);
        startWebSocket(user.username);
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
}

main();
