import WebSocket from 'ws';
import readline from 'readline';

const SERVER_ADDRESS = "wss://localhost:8000"; //

// Start WebSocket connection
export function startWebSocket(username) {
    const cliSocket = new WebSocket(SERVER_ADDRESS, { rejectUnauthorized: false });

    cliSocket.on('open', () => {
        console.log("Connected to server.");
        cliSocket.send(JSON.stringify({ type: "join", username }));

        console.log("Type your message and press Enter (or type 'exit' to quit):");
        rl.prompt();
    });

    cliSocket.on('message', (data) => {
        handleIncomingMessage(data);
    });

    cliSocket.on('error', (error) => {
        console.error("WebSocket error:", error);
    });

    cliSocket.on('close', () => {
        console.log("Disconnected from server.");
        process.exit(0);
    });

    // Readline interface for user input
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: 'Your message: '
    });

    rl.on('line', (line) => {
        if (line.trim().toLowerCase() === 'exit') {
            cliSocket.close();
            rl.close();
            process.exit(0);
        }

        cliSocket.send(JSON.stringify({ username, message: line }));
        rl.prompt();
    });
}

// Handle incoming messages from the server
function handleIncomingMessage(data) {
    try {
        const received = JSON.parse(data.toString());

        process.stdout.clearLine();
        process.stdout.cursorTo(0);

        if (received.type === "notification" || received.type === "userList") {
            console.log(received.message);
        } else if (received.error) {
            console.log(`Error: ${received.error}`);
        } else {
            console.log(`Received from ${received.username}: ${received.message}`);
        }
    } catch (error) {
        console.error(`Error parsing message: ${error.message}`);
    }
}

