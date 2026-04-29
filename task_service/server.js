const express = require('express');
const mysql = require('mysql2/promise');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const app = express();
app.use(cors({
    origin: ['http://127.0.0.1:5500', 'http://localhost:5500', 'https://tas.dcism.org'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

const db = mysql.createPool({
    host: 'dbadmin.dcism.org',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

// PUT: Auto-Assign Task (The Integration Point)
app.put('/api/tasks/:id/auto-assign', async (req, res) => {
    const taskId = req.params.id;
    try {
        const [tasks] = await db.query('SELECT required_skill FROM tasks WHERE id = ?', [taskId]);
        if (tasks.length === 0) return res.status(404).json({ error: "Task not found" });
        
        const skillNeeded = tasks[0].required_skill;

        // Call User Service on port 3001
        const userRes = await axios.get(`https://tas.dcism.org/api/users/match/${skillNeeded}`);
        const bestUser = userRes.data[0];

        if (!bestUser) return res.status(404).json({ message: "No qualified members found" });

        await db.query(
            'UPDATE tasks SET assigned_user_id = ?, status = "assigned" WHERE id = ?', 
            [bestUser.id, taskId]
        );
        
        // Update user workload in User Service table
        await db.query('UPDATE users SET active_tasks = active_tasks + 1 WHERE id = ?', [bestUser.id]);
        
        res.json({ message: `Successfully assigned to ${bestUser.name}` });
    } catch (err) {
        res.status(500).json({ error: "Integration Layer Error" });
    }
});

// POST: Create Task
app.post('/api/tasks', async (req, res) => {
    const { title, required_skill } = req.body;
    try {
        const [result] = await db.query(
            'INSERT INTO tasks (title, required_skill) VALUES (?, ?)', 
            [title, required_skill]
        );
        res.json({ id: result.insertId, title, required_skill });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET: All tasks
app.get('/api/tasks', async (req, res) => {
    const [rows] = await db.query('SELECT * FROM tasks');
    res.json(rows);
});

app.listen(3002, () => console.log('Task Service running on port 3002'));