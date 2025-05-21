// backend/app.js
import express from 'express';
import path from 'path';
import { createServer } from 'http';


const PUBLIC_DIR = path.join(__dirname, '../../public');

const app = express();
const server = createServer(app); // use http server

console.log("Serving from",PUBLIC_DIR);

app.use(express.static(PUBLIC_DIR));
server.listen(3000, () => console.log('HTTP server on http://localhost:3000'));