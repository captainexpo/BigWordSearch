// backend/app.js
const express = require('express');
const app = express();
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '../../public');

console.log("Serving from",PUBLIC_DIR);

app.use(express.static(PUBLIC_DIR));
app.listen(3000, () => console.log('HTTP server on http://localhost:3000'));