const RATE_LIMIT_WINDOW_MS = 5000;
const MAX_MESSAGES_PER_WINDOW = 5;
const RESET_VIOLATION_WINDOW_MS = 60000;

export function applyRateLimit(client) {
    const now = Date.now();

    // Initialize rate limiting data if missing
    if (!client.rateLimitData) {
        client.rateLimitData = {
            timestamps: [],
            exceedCount: 0,
            lastViolationTime: 0,
            timeoutEnd: 0
        };
    }

    // Check if client is already in timeout
    if (now < client.rateLimitData.timeoutEnd) {
        const remaining = Math.ceil((client.rateLimitData.timeoutEnd - now) / 1000);
        client.send(JSON.stringify({ type: "error", error: `Rate limit exceeded. Wait ${remaining} seconds.` }));
        return false;
    }

    // Remove timestamps older than RATE_LIMIT_WINDOW_MS (5 seconds)
    client.rateLimitData.timestamps = client.rateLimitData.timestamps.filter(
        timestamp => now - timestamp < RATE_LIMIT_WINDOW_MS
    );

    // If the client has exceeded the message limit in this window
    if (client.rateLimitData.timestamps.length >= MAX_MESSAGES_PER_WINDOW) {
        client.rateLimitData.exceedCount++;
        client.rateLimitData.lastViolationTime = now;

        // Increase timeout duration based on number of violations
        const timeoutDuration = client.rateLimitData.exceedCount * 10000; // 10s * violation count
        client.rateLimitData.timeoutEnd = now + timeoutDuration;

        client.send(JSON.stringify({ type: "error", error: `Rate limit exceeded. Timed out for ${timeoutDuration / 1000} seconds.` }));
        console.warn(`Rate limit exceeded for ${client.username}. Timed out for ${timeoutDuration / 1000} seconds.`);

        return false;
    }

    // Add new message timestamp
    client.rateLimitData.timestamps.push(now);

    return true;
}
