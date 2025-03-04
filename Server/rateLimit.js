const RATE_LIMIT_WINDOW_MS = 5000;
const MAX_MESSAGES_PER_WINDOW = 5;
const RESET_VIOLATION_WINDOW_MS = 60000;

// Apply Rate Limiting
export function applyRateLimit(client) {
    const now = Date.now();

    if (now < client.rateLimitData.timeoutEnd) {
        const remaining = Math.ceil((client.rateLimitData.timeoutEnd - now) / 1000);
        client.send(JSON.stringify({ type: "error", error: `Rate limit exceeded. Wait ${remaining} more seconds.` }));
        return false;
    }

    client.rateLimitData.timestamps = client.rateLimitData.timestamps.filter(
        timestamp => now - timestamp < RATE_LIMIT_WINDOW_MS
    );

    if (client.rateLimitData.timestamps.length >= MAX_MESSAGES_PER_WINDOW) {
        client.rateLimitData.exceedCount++;
        client.rateLimitData.timeoutEnd = now + client.rateLimitData.exceedCount * 10000;

        client.send(JSON.stringify({ type: "error", error: `Rate limit exceeded. Timed out.` }));
        console.warn(`Rate limit exceeded for ${client.username}. Timeout.`);
        return false;
    }

    client.rateLimitData.timestamps.push(now);
    return true;
}
