import https from 'https';
import fs from 'fs';
import express from 'express';

const app = express();
const PORT = 8001;

// Load SSL/TLS Certificates for HTTPS Web Server
const serverOptions = {
    key: fs.readFileSync('../certs/key.pem'),
    cert: fs.readFileSync('../certs/cert.pem')
};


// Serve the client files (index.html, CSS, JS)
app.use(express.static('.'));

// Create an HTTPS Server for Serving the Web Client
const httpsServer = https.createServer(serverOptions, app);

httpsServer.listen(PORT, () => {
    console.log(`HTTPS Web Client running at https://localhost:${PORT}`); //CHANGE TO IP (DONT COMMIT) localhost:8001
});
