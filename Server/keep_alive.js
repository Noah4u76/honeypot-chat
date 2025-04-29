import https from 'https';

export function startKeepAlive() {
  // Get the base URL from environment variables
  let baseUrl = process.env.RAILWAY_STATIC_URL || process.env.SELF_URL || "your-railway-app.up.railway.app";
  
  // Ensure URL has a protocol (https://)
  const SELF_URL = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`;
  
  console.log(`[${new Date().toISOString()}] Keep-alive configured for URL: ${SELF_URL}`);

  if (process.env.NODE_ENV === 'production') {
    setInterval(() => {
      try {
        https.get(SELF_URL, (res) => {
          console.log(`[${new Date().toISOString()}] Self-ping status: ${res.statusCode}`);
          // Check for unexpected non-2xx status codes, which could indicate an issue.
          if (res.statusCode >= 400) {
            console.warn(`[${new Date().toISOString()}] Warning: Received status code ${res.statusCode} from self-ping.`);
          }
        }).on('error', (err) => {
          console.error(`[${new Date().toISOString()}] Self-ping error:`, err.message);
        });
      } catch (err) {
        console.error(`[${new Date().toISOString()}] Keep-alive error:`, err);
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }
}
