// Configuration: Update these if your school server uses different ports
const USER_SERVICE_URL = 'https://tas.dcism.org/user_service';
const TASK_SERVICE_URL = 'https://tas.dcism.org/task_service';

document.addEventListener('DOMContentLoaded', () => {
    loadDashboardData();
});

function showSection(id, el) {
    // Hide all sections
    document.querySelectorAll('.tab-section').forEach(s => s.style.display = 'none');
    // Show the selected one
    const target = document.getElementById(id);
    if (target) target.style.display = 'block';
    
    // Update active class on sidebar links
    document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
    if (el) el.classList.add('active');
}

// Make sure it's globally accessible for the onclick attributes in HTML
window.showSection = showSection;

// --- DASHBOARD RENDERING ---
async function loadDashboardData() {
    await Promise.all([loadUsers(), loadTasks()]);
    updateStats();
}

function updateStats() {
    const unassignedCount = document.querySelectorAll('.task-card:not(.assigned)').length;
    const userCount = document.querySelectorAll('.user-row').length;
    
    document.getElementById('stat-unassigned').textContent = unassignedCount;
    document.getElementById('stat-users').textContent = userCount;
}

// --- USER SERVICE LOGIC ---
async function loadUsers() {
    try {
        const response = await fetch(`${USER_SERVICE_URL}/users`);
        const users = await response.json();
        const container = document.getElementById('user-container');
        
        if (users.length > 0) document.getElementById('user-empty').style.display = 'none';
        
        container.innerHTML = users.map(user => `
            <div class="user-row">
                <div class="user-avatar">${user.name.charAt(0)}</div>
                <div class="user-info">
                    <div class="user-row-name">${user.name}</div>
                    <span class="tag">${user.skill}</span>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error("Error loading users:", err);
    }
}

async function addUser() {
    const name = document.getElementById('user-name').value.trim();
    const skill = document.getElementById('user-skill').value;

    if (!name) return alert("Please enter a name");

    try {
        const response = await fetch(`${USER_SERVICE_URL}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, skill })
        });

        if (response.ok) {
            document.getElementById('user-name').value = '';
            loadUsers();
            updateStats();
        }
    } catch (err) {
        alert("Failed to add user to Service A");
    }
}

// --- TASK SERVICE LOGIC ---
async function loadTasks() {
    try {
        const response = await fetch(`${TASK_SERVICE_URL}/tasks`);
        const tasks = await response.json();
        const container = document.getElementById('task-container');
        
        if (tasks.length > 0) document.getElementById('task-empty').style.display = 'none';

        container.innerHTML = tasks.map(task => `
            <div class="task-card ${task.status}">
                <div>
                    <span class="tag">Required: ${task.required_skill}</span>
                    <h3>${task.title}</h3>
                    <p>Status: ${task.status}</p>
                </div>
                ${task.status === 'unassigned' ? 
                    `<button class="btn btn-primary" style="margin-top: 18px; width: 100%;" 
                     onclick="autoAssign(${task.id})">Auto-Assign Task</button>` : 
                    `<div class="tag success" style="width: 100%; text-align: center; margin-top: 18px;">Assigned</div>`}
            </div>
        `).join('');
    } catch (err) {
        console.error("Error loading tasks:", err);
    }
}

async function createTask() {
    const title = document.getElementById('task-title').value.trim();
    const required_skill = document.getElementById('task-skill-req').value;

    if (!title) return alert("Enter task title");

    try {
        await fetch(`${TASK_SERVICE_URL}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, required_skill })
        });
        loadTasks();
        updateStats();
    } catch (err) {
        alert("Failed to create task in Service B");
    }
}

// --- INTEGRATION POINT ---
async function autoAssign(taskId) {
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = "Matching Services..."; // Visual proof of integration
    btn.disabled = true;

    try {
        // This triggers the Service B -> Service A integration logic in the backend
        const response = await fetch(`${TASK_SERVICE_URL}/tasks/${taskId}/auto-assign`, {
            method: 'PUT'
        });
        const result = await response.json();

        if (response.ok) {
            alert(result.message);
            loadDashboardData();
        } else {
            alert(result.message || "No qualified members found");
            btn.textContent = originalText;
            btn.disabled = false;
        }
    } catch (err) {
        alert("Integration Error: Check if both services are running");
        btn.textContent = originalText;
        btn.disabled = false;
    }
}