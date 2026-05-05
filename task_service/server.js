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

// Helper: Calculate project progress
async function calculateProjectProgress(projectId) {
    const [subtasks] = await db.query(
        'SELECT COUNT(*) as total, SUM(CASE WHEN status = "completed" THEN 1 ELSE 0 END) as completed FROM tasks WHERE parent_id = ?',
        [projectId]
    );
    const total = subtasks[0].total;
    const completed = subtasks[0].completed;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    await db.query('UPDATE tasks SET progress_percent = ? WHERE id = ?', [progress, projectId]);
    return { total, completed, progress };
}

// PUT: Auto-Assign Task
app.put('/api/tasks/:id/auto-assign', async (req, res) => {
    const taskId = req.params.id;
    try {
        const [tasks] = await db.query('SELECT required_skill, parent_id, status FROM tasks WHERE id = ?', [taskId]);
        if (tasks.length === 0) return res.status(404).json({ error: "Task not found" });

        const skillNeeded = tasks[0].required_skill;
        const parentId = tasks[0].parent_id;
        const prevStatus = tasks[0].status;

        // Query user data directly from shared database
        const [users] = await db.query(
            `SELECT u.id, u.name, u.avatar_url
             FROM users u
             JOIN user_skills us ON u.id = us.user_id
             JOIN skills s ON us.skill_id = s.id
             WHERE s.name = ?
             ORDER BY u.active_tasks ASC
             LIMIT 1`,
            [skillNeeded]
        );

        const bestUser = users[0];

        if (!bestUser) return res.status(404).json({ message: "No qualified members found" });

        await db.query(
            'UPDATE tasks SET assigned_user_id = ?, assigned_user_name = ?, status = "assigned" WHERE id = ?',
            [bestUser.id, bestUser.name, taskId]
        );

        // Only increment active_tasks if task was not already assigned
        if (prevStatus !== 'assigned') {
            await db.query('UPDATE users SET active_tasks = active_tasks + 1 WHERE id = ?', [bestUser.id]);
        }

        // If this task is a subtask, update parent project progress
        if (parentId) {
            await calculateProjectProgress(parentId);
        }

        res.json({ message: `Successfully assigned to ${bestUser.name}`, user: bestUser });
    } catch (err) {
        console.error('Auto-assign error:', err);
        res.status(500).json({ error: "Integration Layer Error: " + err.message });
    }
});

// POST: Create Task
app.post('/api/tasks', async (req, res) => {
    const { title, required_skill, description, specifications, parent_id, task_type } = req.body;
    try {
        const [result] = await db.query(
            `INSERT INTO tasks (title, description, specifications, required_skill, parent_id, task_type)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [title, description || null, specifications || null, required_skill, parent_id || null, task_type || 'task']
        );

        const newTask = {
            id: result.insertId,
            title,
            description,
            specifications,
            required_skill,
            parent_id: parent_id || null,
            task_type: task_type || 'task',
            status: 'unassigned',
            progress_percent: 0
        };

        // If this is a subtask, update parent project progress
        if (parent_id) {
            await calculateProjectProgress(parent_id);
        }

        res.json(newTask);
    } catch (err) {
        console.error('Create task error:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT: Update Task
app.put('/api/tasks/:id', async (req, res) => {
    const taskId = req.params.id;
    const { title, description, specifications, required_skill, status, parent_id, task_type } = req.body;

    try {
        const updates = [];
        const values = [];

        if (title !== undefined) { updates.push('title = ?'); values.push(title); }
        if (description !== undefined) { updates.push('description = ?'); values.push(description); }
        if (specifications !== undefined) { updates.push('specifications = ?'); values.push(specifications); }
        if (required_skill !== undefined) { updates.push('required_skill = ?'); values.push(required_skill); }
        if (status !== undefined) { updates.push('status = ?'); values.push(status); }
        if (parent_id !== undefined) { updates.push('parent_id = ?'); values.push(parent_id); }
        if (task_type !== undefined) { updates.push('task_type = ?'); values.push(task_type); }

        if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });

        values.push(taskId);
        await db.query(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`, values);

        // Handle status transitions
        if (status !== undefined) {
            const [task] = await db.query('SELECT assigned_user_id, parent_id, status as current_status FROM tasks WHERE id = ?', [taskId]);
            const currentStatus = task[0].current_status;

            // Transitioning TO completed
            if (status === 'completed' && currentStatus !== 'completed') {
                if (task[0].assigned_user_id) {
                    await db.query('UPDATE users SET active_tasks = GREATEST(active_tasks - 1, 0) WHERE id = ?', [task[0].assigned_user_id]);
                }
            }
            // Transitioning FROM completed
            else if (currentStatus === 'completed' && status !== 'completed') {
                if (task[0].assigned_user_id) {
                    await db.query('UPDATE users SET active_tasks = active_tasks + 1 WHERE id = ?', [task[0].assigned_user_id]);
                }
            }
            // Transitioning TO assigned FROM unassigned
            else if (status === 'assigned' && currentStatus === 'unassigned') {
                if (task[0].assigned_user_id) {
                    await db.query('UPDATE users SET active_tasks = active_tasks + 1 WHERE id = ?', [task[0].assigned_user_id]);
                }
            }
            // Transitioning FROM assigned TO unassigned
            else if (currentStatus === 'assigned' && status === 'unassigned') {
                if (task[0].assigned_user_id) {
                    await db.query('UPDATE users SET active_tasks = GREATEST(active_tasks - 1, 0) WHERE id = ?', [task[0].assigned_user_id]);
                }
            }

            if (task[0].parent_id) {
                await calculateProjectProgress(task[0].parent_id);
            }
        }

        // Get updated task
        const [rows] = await db.query('SELECT * FROM tasks WHERE id = ?', [taskId]);
        res.json(rows[0]);
    } catch (err) {
        console.error('Update task error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET: Single task with details
app.get('/api/tasks/:id', async (req, res) => {
    try {
        const [tasks] = await db.query(
            `SELECT t.*, u.avatar_url as assigned_user_avatar
             FROM tasks t
             LEFT JOIN users u ON t.assigned_user_id = u.id
             WHERE t.id = ?`,
            [req.params.id]
        );

        if (tasks.length === 0) return res.status(404).json({ error: "Task not found" });

        const task = tasks[0];

        // If project, get subtasks
        if (task.task_type === 'project') {
            const [subtasks] = await db.query(
                `SELECT t.*, u.avatar_url as assigned_user_avatar
                 FROM tasks t
                 LEFT JOIN users u ON t.assigned_user_id = u.id
                 WHERE t.parent_id = ?`,
                [task.id]
            );
            task.subtasks = subtasks;
            const progress = await calculateProjectProgress(task.id);
            task.progress = progress;
        }

        res.json(task);
    } catch (err) {
        console.error('Get task error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET: All tasks
app.get('/api/tasks', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT t.*, u.avatar_url as assigned_user_avatar
             FROM tasks t
             LEFT JOIN users u ON t.assigned_user_id = u.id
             ORDER BY t.created_at DESC`
        );

        // Calculate progress for projects
        for (const task of rows) {
            if (task.task_type === 'project') {
                const [subtasks] = await db.query(
                    'SELECT COUNT(*) as total, SUM(CASE WHEN status = "completed" THEN 1 ELSE 0 END) as completed FROM tasks WHERE parent_id = ?',
                    [task.id]
                );
                const total = subtasks[0].total;
                const completed = subtasks[0].completed;
                task.progress_percent = total > 0 ? Math.round((completed / total) * 100) : 0;
                task.subtask_count = total;
                task.subtask_completed = completed;
            }
        }

        res.json(rows);
    } catch (err) {
        console.error('Get tasks error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET: All projects with progress
app.get('/api/projects', async (req, res) => {
    try {
        const [projects] = await db.query(
            `SELECT t.*, u.avatar_url as assigned_user_avatar
             FROM tasks t
             LEFT JOIN users u ON t.assigned_user_id = u.id
             WHERE t.task_type = 'project'
             ORDER BY t.created_at DESC`
        );

        for (const project of projects) {
            const progress = await calculateProjectProgress(project.id);
            project.progress = progress;
        }

        res.json(projects);
    } catch (err) {
        console.error('Get projects error:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE: Delete task
app.delete('/api/tasks/:id', async (req, res) => {
    try {
        const taskId = req.params.id;

        // Check if this is a project and collect subtask assignments before cascade delete
        const [taskTypeRow] = await db.query('SELECT task_type FROM tasks WHERE id = ?', [taskId]);
        let subtasks = [];
        if (taskTypeRow[0]?.task_type === 'project') {
            const [subs] = await db.query('SELECT assigned_user_id, status FROM tasks WHERE parent_id = ?', [taskId]);
            subtasks = subs;
        }

        const [task] = await db.query('SELECT parent_id, assigned_user_id, status FROM tasks WHERE id = ?', [taskId]);
        const parentId = task[0]?.parent_id;
        const assignedUserId = task[0]?.assigned_user_id;
        const taskStatus = task[0]?.status;

        await db.query('DELETE FROM tasks WHERE id = ?', [taskId]);

        // Update parent progress if subtask deleted
        if (parentId) {
            await calculateProjectProgress(parentId);
        }

        // Decrement active_tasks for all affected users (task itself + subtasks if project)
        const affectedUsers = new Set();
        if (assignedUserId && taskStatus !== 'completed') {
            affectedUsers.add(assignedUserId);
        }
        for (const st of subtasks) {
            if (st.assigned_user_id && st.status !== 'completed') {
                affectedUsers.add(st.assigned_user_id);
            }
        }
        for (const userId of affectedUsers) {
            await db.query('UPDATE users SET active_tasks = GREATEST(active_tasks - 1, 0) WHERE id = ?', [userId]);
        }

        res.json({ message: "Task deleted" });
    } catch (err) {
        console.error('Delete task error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.listen(3002, () => console.log('Task Service running on port 3002'));
