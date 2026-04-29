const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());

// 1. Serve the frontend dashboard directly from the main folder
app.use(express.static(path.join(__dirname, '../main')));

// 2. Route to User Service (Strips the prefix)
app.use('/user_service', createProxyMiddleware({ 
    target: 'http://localhost:3001', 
    pathRewrite: { '^/user_service': '' },
    changeOrigin: true 
}));

// 3. Route to Task Service (Strips the prefix)
app.use('/task_service', createProxyMiddleware({ 
    target: 'http://localhost:3002', 
    pathRewrite: { '^/task_service': '' },
    changeOrigin: true 
}));

app.listen(20199, '0.0.0.0', () => console.log('Gateway and Dashboard running on port 20199'));