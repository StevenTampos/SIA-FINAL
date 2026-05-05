const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const app = express();
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type']
}));
app.use(express.json());

const db = mysql.createPool({
    host: 'localhost',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

// GET: All available skills
app.get('/api/skills', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM skills ORDER BY name');
        res.json(rows);
    } catch (err) {
        console.error('Error fetching skills:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST: Add new skill
app.post('/api/skills', async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Skill name required" });
    try {
        const [result] = await db.query('INSERT INTO skills (name) VALUES (?)', [name]);
        res.json({ id: result.insertId, name });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET: Returns users with a specific skill (Ordered by least active tasks)
app.get('/api/users/match/:skill', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT u.id, u.name, u.avatar_url
             FROM users u
             JOIN user_skills us ON u.id = us.user_id
             JOIN skills s ON us.skill_id = s.id
             WHERE s.name = ?
             ORDER BY u.active_tasks ASC
             LIMIT 1`,
            [req.params.skill]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "User Service Database Error" });
    }
});

// POST: Register new team member
app.post('/api/users', async (req, res) => {
    const { name, skill, skills, avatar_url } = req.body;
    const skillList = skills || (skill ? [skill] : []);

    if (!name) return res.status(400).json({ error: "Name required" });
    if (skillList.length === 0) return res.status(400).json({ error: "At least one skill required" });

    try {
        const conn = await db.getConnection();
        await conn.beginTransaction();

        const [result] = await conn.query(
            'INSERT INTO users (name, skill, avatar_url) VALUES (?, ?, ?)',
            [name, skillList[0], avatar_url || null]
        );
        const userId = result.insertId;

        // Insert all skills into user_skills
        for (const sk of skillList) {
            const [skillRows] = await conn.query('SELECT id FROM skills WHERE name = ?', [sk]);
            if (skillRows.length > 0) {
                await conn.query(
                    'INSERT IGNORE INTO user_skills (user_id, skill_id) VALUES (?, ?)',
                    [userId, skillRows[0].id]
                );
            }
        }

        await conn.commit();
        conn.release();

        res.json({ id: userId, name, skill: skillList[0], skills: skillList, avatar_url });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET: All team members with their skills
app.get('/api/users', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT u.id, u.name, u.skill, u.avatar_url, u.active_tasks, us.all_skills
             FROM users u
             LEFT JOIN (
                 SELECT us.user_id, GROUP_CONCAT(s.name) as all_skills
                 FROM user_skills us
                 JOIN skills s ON us.skill_id = s.id
                 GROUP BY us.user_id
             ) us ON u.id = us.user_id`
        );

        const users = rows.map(u => ({
            ...u,
            skills: u.all_skills ? u.all_skills.split(',') : [u.skill]
        }));

        res.json(users);
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE: Remove team member
app.delete('/api/users/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ message: "User deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(3001, () => console.log('User Service running on port 3001'));
