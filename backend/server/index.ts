import express from 'express';
import path from 'path';
import { createServer } from 'http';

const PUBLIC_DIR = path.join(__dirname, '../../public');

const app = express();
const server = createServer(app); // use http server

console.log("Serving from",PUBLIC_DIR);

app.use(express.static(PUBLIC_DIR));
server.listen(8080, () => console.log('HTTP server on http://0.0.0.0:8080'));

app.get('/env', (req, res) => {
    res.json({
        WS_URL: process.env.PUBLIC_WEBSOCKET_URL || 'ws://localhost:8081',
    })
});