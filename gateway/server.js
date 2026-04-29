const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();
app.use(cors());

// Route to User Service (Running internally on 3001)
app.use('/user_service', createProxyMiddleware({ target: 'http://localhost:3001', changeOrigin: true }));

// Route to Task Service (Running internally on 3002)
app.use('/task_service', createProxyMiddleware({ target: 'http://localhost:3002', changeOrigin: true }));

// IMPORTANT: Use the port from your screenshot
app.listen(20199, () => console.log('API Gateway running on port 20199'));