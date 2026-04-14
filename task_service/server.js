// task-service/server.js snippet
const axios = require('axios'); // Use axios for service-to-service calls

app.put('/api/tasks/:taskId/auto-assign', async (req, res) => {
    const taskId = req.params.taskId;

    try {
        // 1. Get task details from DB
        const [task] = await db.query('SELECT * FROM tasks WHERE id = ?', [taskId]);
        const requiredSkill = task[0].required_skill;

        // 2. THE INTEGRATION POINT: Call the User Service
        // Change 'localhost:3001' to wherever your User Service is running
        const userResponse = await axios.get(`http://localhost:3001/api/users/match/${requiredSkill}`);
        const bestUser = userResponse.data[0]; // Assuming user service returns sorted list

        if (!bestUser) {
            return res.status(404).json({ message: "No qualified user found" });
        }

        // 3. Update Task in DB
        await db.query('UPDATE tasks SET assigned_user_id = ? WHERE id = ?', [bestUser.id, taskId]);
        
        res.json({ message: `Successfully assigned to ${bestUser.name}` });
    } catch (error) {
        res.status(500).send("Integration Error");
    }
});