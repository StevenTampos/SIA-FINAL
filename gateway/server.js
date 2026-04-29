// gateway/server.js
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();
app.use(cors());

// Use pathRewrite to remove the prefix before passing to internal services
app.use('/user_service', createProxyMiddleware({ 
    target: 'http://localhost:3001', 
    pathRewrite: { '^/user_service': '' }, // Removes /user_service from the URL
    changeOrigin: true 
}));

app.use('/task_service', createProxyMiddleware({ 
    target: 'http://localhost:3002', 
    pathRewrite: { '^/task_service': '' },
    changeOrigin: true 
}));

app.listen(20199, () => console.log('Gateway alive on 20199'));