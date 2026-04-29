const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const app = express();
app.use(cors({
    origin: 'http://127.0.0.1:5500',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type']
}));
app.use(express.json());

const db = mysql.createPool({
    host: 'dbadmin.dcism.org',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

// GET: Returns users with a specific skill (Ordered by least active tasks)
app.get('/api/users/match/:skill', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT id, name FROM users WHERE skill = ? ORDER BY active_tasks ASC LIMIT 1',
            [req.params.skill]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "User Service Database Error" });
    }
});

// POST: Register new team member
app.post('/api/users', async (req, res) => {
    const { name, skill } = req.body;
    try {
        const [result] = await db.query('INSERT INTO users (name, skill) VALUES (?, ?)', [name, skill]);
        res.json({ id: result.insertId, name, skill });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET: All team members
app.get('/api/users', async (req, res) => {
    const [rows] = await db.query('SELECT * FROM users');
    res.json(rows);
});

app.listen(3001, () => console.log('User Service running on port 3001'));