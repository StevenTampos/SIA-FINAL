// Configuration: Update these if your school server uses different ports
const USER_SERVICE_URL = '/user_service/api';
const TASK_SERVICE_URL = '/task_service/api';

let allSkills = [];
let allUsers = [];
let allTasks = [];
let currentModalTask = null;
let isEditMode = false;

// Leave the rest of the file exactly the same...

document.addEventListener('DOMContentLoaded', () => {
    loadDashboardData();
});

function showSection(id, el) {
    document.querySelectorAll('.tab-section').forEach(s => s.style.display = 'none');
    const target = document.getElementById(id);
    if (target) target.style.display = 'block';

    document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
    if (el) el.classList.add('active');

    if (id === 'project-section') {
        loadProjects();
    }
}

window.showSection = showSection;

// --- DATA LOADING ---
async function loadDashboardData() {
    await Promise.all([loadSkills(), loadUsers(), loadTasks()]);
    updateStats();
    populateSkillDropdowns();
    await populateParentSelector();
}

async function loadSkills() {
    try {
        const response = await fetch(`${USER_SERVICE_URL}/skills`);
        if (!response.ok) {
            console.error(`Skills API error: ${response.status}`);
            allSkills = [];
            return;
        }
        const data = await response.json();
        allSkills = Array.isArray(data) ? data : [];
    } catch (err) {
        console.error("Error loading skills:", err);
        allSkills = [];
    }
}

function populateSkillDropdowns() {
    const taskSkillReq = document.getElementById('task-skill-req');
    if (taskSkillReq && taskSkillReq.options.length <= 1) {
        taskSkillReq.innerHTML = '<option value="">Select skill...</option>' +
            allSkills.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
    }

    const skillSelector = document.getElementById('user-skill-selector');
    if (skillSelector) {
        skillSelector.innerHTML = allSkills.map(s => `
            <label class="skill-checkbox">
                <input type="checkbox" value="${s.name}" name="user-skills">
                <span>${s.name}</span>
            </label>
        `).join('');
    }
}

async function populateParentSelector() {
    const parentSelect = document.getElementById('task-parent');
    if (!parentSelect) return;
    try {
        const response = await fetch(`${TASK_SERVICE_URL}/projects`);
        if (!response.ok) {
            console.error(`Projects API error: ${response.status}`);
            parentSelect.innerHTML = '<option value="">-- No Parent --</option>';
            return;
        }
        const projects = await response.json();
        const projectList = Array.isArray(projects) ? projects : [];
        parentSelect.innerHTML = '<option value="">-- No Parent --</option>' +
            projectList.map(p => `<option value="${p.id}">${p.title}</option>`).join('');
    } catch (err) {
        console.error("Error loading projects for parent selector:", err);
        parentSelect.innerHTML = '<option value="">-- No Parent --</option>';
    }
}

function toggleParentSelector() {
    const typeSelect = document.getElementById('task-type');
    const parentSelect = document.getElementById('task-parent');
    if (typeSelect && parentSelect) {
        parentSelect.style.display = typeSelect.value === 'task' ? 'block' : 'none';
    }
}

// --- STATS & PROGRESS ---
function updateStats() {
    const tasks = Array.isArray(allTasks) ? allTasks : [];
    const users = Array.isArray(allUsers) ? allUsers : [];

    const unassignedCount = tasks.filter(t => t.status === 'unassigned' && t.task_type === 'task').length;
    const userCount = users.length;
    const totalTasks = tasks.filter(t => t.task_type === 'task').length;
    const completedTasks = tasks.filter(t => t.status === 'completed' && t.task_type === 'task').length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const velocity = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 10) : 0;

    document.getElementById('stat-unassigned').textContent = unassignedCount;
    document.getElementById('stat-users').textContent = userCount;
    document.getElementById('stat-completion').textContent = completionRate + '%';
    document.getElementById('stat-completion-bar').style.width = completionRate + '%';
    document.getElementById('stat-velocity').textContent = velocity;
    document.getElementById('stat-velocity-bar').style.width = Math.min(velocity * 10, 100) + '%';

    // Project stats
    const projects = tasks.filter(t => t.task_type === 'project');
    const activeProjects = projects.filter(p => p.progress_percent < 100).length;
    const avgCompletion = projects.length > 0
        ? Math.round(projects.reduce((sum, p) => sum + (p.progress_percent || 0), 0) / projects.length)
        : 0;

    const statActiveProjects = document.getElementById('stat-active-projects');
    if (statActiveProjects) statActiveProjects.textContent = activeProjects;
    const statAvgCompletion = document.getElementById('stat-avg-completion');
    if (statAvgCompletion) statAvgCompletion.textContent = avgCompletion + '%';
    const statAvgBar = document.getElementById('stat-avg-bar');
    if (statAvgBar) statAvgBar.style.width = avgCompletion + '%';
}

// --- USER SERVICE LOGIC ---
async function loadUsers() {
    try {
        const response = await fetch(`${USER_SERVICE_URL}/users`);
        if (!response.ok) {
            console.error(`Users API error: ${response.status}`);
            allUsers = [];
            return;
        }
        const data = await response.json();
        allUsers = Array.isArray(data) ? data : [];
        const container = document.getElementById('user-container');

        if (allUsers.length === 0) {
            container.innerHTML = `
                <div class="empty-state" id="user-empty">
                    <div class="empty-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="32" height="32">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                            <circle cx="9" cy="7" r="4"/>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                        </svg>
                    </div>
                    <p>No team members yet &mdash; add one above!</p>
                </div>`;
            return;
        }

        container.innerHTML = allUsers.map(user => `
            <div class="user-row" style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 14px;">
                    <div class="user-avatar" style="background-image: url('${user.avatar_url || ''}'); background-size: cover;">
                        ${user.avatar_url ? '' : user.name.charAt(0)}
                    </div>
                    <div class="user-info">
                        <div class="user-row-name">${user.name}</div>
                        <div class="user-skills">
                            ${(user.skills || [user.skill]).map(sk => `<span class="tag">${sk}</span>`).join('')}
                        </div>
                    </div>
                </div>
                <button class="btn btn-ghost" onclick="deleteUser(${user.id})" style="color: #ef4444; border-color: #fca5a5;">Delete</button>
            </div>
        `).join('');
    } catch (err) {
        console.error("Error loading users:", err);
    }
}

async function addUser() {
    const name = document.getElementById('user-name').value.trim();
    const avatar_url = document.getElementById('user-avatar').value.trim() || null;
    const skillCheckboxes = document.querySelectorAll('input[name="user-skills"]:checked');
    const skills = Array.from(skillCheckboxes).map(cb => cb.value);

    if (!name) return alert("Please enter a name");
    if (skills.length === 0) return alert("Please select at least one skill");

    try {
        const response = await fetch(`${USER_SERVICE_URL}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, skills, avatar_url })
        });

        if (response.ok) {
            document.getElementById('user-name').value = '';
            document.getElementById('user-avatar').value = '';
            skillCheckboxes.forEach(cb => cb.checked = false);
            loadUsers();
            updateStats();
        }
    } catch (err) {
        alert("Failed to add user to Service A");
    }
}

async function addNewSkill() {
    const name = document.getElementById('new-skill-name').value.trim();
    if (!name) return alert("Please enter a skill name");

    try {
        const response = await fetch(`${USER_SERVICE_URL}/skills`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });

        if (response.ok) {
            document.getElementById('new-skill-name').value = '';
            await loadSkills();
            populateSkillDropdowns();
        }
    } catch (err) {
        alert("Failed to add skill");
    }
}

// --- TASK SERVICE LOGIC ---
async function loadTasks() {
    try {
        const response = await fetch(`${TASK_SERVICE_URL}/tasks`);
        if (!response.ok) {
            console.error(`Tasks API error: ${response.status}`);
            allTasks = [];
            return;
        }
        const data = await response.json();
        allTasks = Array.isArray(data) ? data : [];
        const container = document.getElementById('task-container');
        const displayTasks = allTasks.filter(t => t.task_type !== 'project');

        if (displayTasks.length === 0) {
            container.innerHTML = `
                <div class="empty-state" id="task-empty">
                    <div class="empty-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="32" height="32">
                            <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                            <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                        </svg>
                    </div>
                    <p>No tasks yet &mdash; create one above!</p>
                </div>`;
            return;
        }

        container.innerHTML = displayTasks.map(task => renderTaskCard(task)).join('');
    } catch (err) {
        console.error("Error loading tasks:", err);
        allTasks = [];
    }
}

function renderTaskCard(task) {
    const assignedUser = allUsers.find(u => u.id === task.assigned_user_id);
    const isProjectChild = task.parent_id ? true : false;

    return `
        <div class="task-card ${task.status}" onclick="openTaskModal(${task.id})" style="cursor: pointer;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                <span class="tag">${task.required_skill}</span>
                <button class="btn btn-ghost" onclick="event.stopPropagation(); deleteTask(${task.id})" style="padding: 2px 8px; font-size: 0.75rem; color: #ef4444; border: none;">&#10006;</button>
            </div>
            <div style="flex: 1;">
                <h3>${task.title}</h3>
                <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 8px;">
                    ${task.description ? task.description.substring(0, 60) + (task.description.length > 60 ? '...' : '') : 'No description'}
                </p>
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
                    <span class="status-badge ${task.status}">${task.status}</span>
                    ${isProjectChild ? '<span class="tag blue">Sub-task</span>' : ''}
                </div>
            </div>
            ${assignedUser ? `
                <div style="display: flex; align-items: center; gap: 8px; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border);">
                    <div class="user-avatar small" style="background-image: url('${assignedUser.avatar_url || ''}'); background-size: cover;">
                        ${assignedUser.avatar_url ? '' : assignedUser.name.charAt(0)}
                    </div>
                    <span style="font-size: 0.8rem; color: var(--text-muted);">${assignedUser.name}</span>
                </div>
            ` : ''}
            ${task.status === 'unassigned' ?
                `<button class="btn btn-primary" style="margin-top: 14px; width: 100%;"
                 onclick="event.stopPropagation(); autoAssign(${task.id})">Auto-Assign Task</button>` :
                task.status === 'assigned' ?
                `<button class="btn btn-success" style="margin-top: 14px; width: 100%;"
                 onclick="event.stopPropagation(); completeTask(${task.id})">Mark Complete</button>` :
                `<div class="tag success" style="width: 100%; text-align: center; margin-top: 14px;">Completed</div>`}
        </div>
    `;
}

async function loadProjects() {
    try {
        const response = await fetch(`${TASK_SERVICE_URL}/projects`);
        if (!response.ok) {
            console.error(`Projects API error: ${response.status}`);
            const container = document.getElementById('project-container');
            if (container) container.innerHTML = '<div class="empty-state"><p>Unable to load projects.</p></div>';
            return;
        }
        const projects = await response.json();
        const projectList = Array.isArray(projects) ? projects : [];
        const container = document.getElementById('project-container');

        if (projectList.length === 0) {
            container.innerHTML = `
                <div class="empty-state" id="project-empty">
                    <div class="empty-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="32" height="32">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                        </svg>
                    </div>
                    <p>No projects yet &mdash; create one above!</p>
                </div>`;
            return;
        }

        container.innerHTML = projectList.map(project => `
            <div class="project-card" onclick="openTaskModal(${project.id})" style="cursor: pointer;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                    <div>
                        <span class="tag">Project</span>
                        <h3 style="margin-top: 6px;">${project.title}</h3>
                        <p style="font-size: 0.85rem; color: var(--text-muted);">
                            ${project.description ? project.description.substring(0, 80) + '...' : 'No description'}
                        </p>
                    </div>
                    <span class="project-progress-value">${project.progress?.progress || 0}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${project.progress?.progress || 0}%"></div>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 0.75rem; color: var(--text-muted);">
                    <span>${project.progress?.completed || 0} / ${project.progress?.total || 0} tasks completed</span>
                    <span>${project.status}</span>
                </div>
            </div>
        `).join('');

        const statActiveProjects = document.getElementById('stat-active-projects');
        if (statActiveProjects) statActiveProjects.textContent = projectList.filter(p => (p.progress?.progress || 0) < 100).length;

        const avgCompletion = projectList.length > 0
            ? Math.round(projectList.reduce((sum, p) => sum + (p.progress?.progress || 0), 0) / projectList.length)
            : 0;
        const statAvgCompletion = document.getElementById('stat-avg-completion');
        if (statAvgCompletion) statAvgCompletion.textContent = avgCompletion + '%';
        const statAvgBar = document.getElementById('stat-avg-bar');
        if (statAvgBar) statAvgBar.style.width = avgCompletion + '%';
    } catch (err) {
        console.error("Error loading projects:", err);
    }
}

async function createTask() {
    const title = document.getElementById('task-title').value.trim();
    const required_skill = document.getElementById('task-skill-req').value;
    const description = document.getElementById('task-description').value.trim();
    const specifications = document.getElementById('task-specifications').value.trim();
    const parent_id = document.getElementById('task-parent').value;

    if (!title) return alert("Enter task title");
    if (!required_skill) return alert("Select a required skill");

    try {
        await fetch(`${TASK_SERVICE_URL}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                required_skill,
                description,
                specifications,
                task_type: 'task',
                parent_id: parent_id || null
            })
        });
        document.getElementById('task-title').value = '';
        document.getElementById('task-description').value = '';
        document.getElementById('task-specifications').value = '';
        document.getElementById('task-parent').value = '';
        await loadTasks();
        await populateParentSelector();
        updateStats();
    } catch (err) {
        alert("Failed to create task in Service B");
    }
}

async function createProject() {
    const title = document.getElementById('project-title').value.trim();
    const description = document.getElementById('project-description').value.trim();
    const specifications = document.getElementById('project-specifications').value.trim();

    if (!title) return alert("Enter project title");

    try {
        await fetch(`${TASK_SERVICE_URL}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                required_skill: 'project-management',
                description,
                specifications,
                task_type: 'project',
                parent_id: null
            })
        });
        document.getElementById('project-title').value = '';
        document.getElementById('project-description').value = '';
        document.getElementById('project-specifications').value = '';
        await loadProjects();
        await populateParentSelector();
        updateStats();
    } catch (err) {
        alert("Failed to create project");
    }
}

// --- TASK MODAL ---
async function openTaskModal(taskId) {
    try {
        const response = await fetch(`${TASK_SERVICE_URL}/tasks/${taskId}`);
        const task = await response.json();
        currentModalTask = task;
        isEditMode = false;
        renderModal();
        document.getElementById('task-modal').style.display = 'flex';
    } catch (err) {
        console.error("Error loading task details:", err);
    }
}

function closeTaskModal() {
    document.getElementById('task-modal').style.display = 'none';
    currentModalTask = null;
    isEditMode = false;
}

function renderModal() {
    const task = currentModalTask;
    if (!task) return;

    const assignedUser = allUsers.find(u => u.id === task.assigned_user_id);

    document.getElementById('modal-type-tag').textContent = task.task_type === 'project' ? 'Project' : 'Task';
    document.getElementById('modal-title-display').textContent = task.title;

    const body = document.getElementById('modal-body');
    const editBtn = document.getElementById('modal-edit-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');

    // Clean up dynamic complete button
    const existingCompleteBtn = document.getElementById('modal-complete-btn');
    if (existingCompleteBtn) existingCompleteBtn.remove();

    if (isEditMode) {
        editBtn.textContent = 'Save';
        editBtn.onclick = saveTaskEdit;
        cancelBtn.style.display = 'inline-block';

        body.innerHTML = `
            <div class="modal-field">
                <label>Title</label>
                <input type="text" id="edit-title" value="${escapeHtml(task.title)}">
            </div>
            <div class="modal-field">
                <label>Description</label>
                <textarea id="edit-description" rows="3">${escapeHtml(task.description || '')}</textarea>
            </div>
            <div class="modal-field">
                <label>Detailed Specifications</label>
                <textarea id="edit-specifications" rows="3">${escapeHtml(task.specifications || '')}</textarea>
            </div>
            <div class="modal-field">
                <label>Required Skill</label>
                <select id="edit-skill">
                    ${allSkills.map(s => `<option value="${s.name}" ${s.name === task.required_skill ? 'selected' : ''}>${s.name}</option>`).join('')}
                </select>
            </div>
            <div class="modal-field">
                <label>Status</label>
                <select id="edit-status">
                    <option value="unassigned" ${task.status === 'unassigned' ? 'selected' : ''}>Unassigned</option>
                    <option value="assigned" ${task.status === 'assigned' ? 'selected' : ''}>Assigned</option>
                    <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>Completed</option>
                </select>
            </div>
        `;
    } else {
        editBtn.textContent = 'Edit';
        editBtn.onclick = toggleEditMode;
        cancelBtn.style.display = 'none';

        // Show Mark Complete button for assigned tasks
        if (task.task_type !== 'project' && task.status === 'assigned') {
            const completeBtn = document.createElement('button');
            completeBtn.id = 'modal-complete-btn';
            completeBtn.className = 'btn btn-success';
            completeBtn.textContent = 'Mark Complete';
            completeBtn.onclick = () => completeTask(task.id);
            document.getElementById('modal-footer').insertBefore(completeBtn, editBtn);
        }

        let subtasksHtml = '';
        if (task.task_type === 'project' && task.subtasks) {
            subtasksHtml = `
                <div class="modal-section">
                    <h4>Sub-tasks (${task.subtasks.length})</h4>
                    <div class="progress-bar" style="margin: 10px 0;">
                        <div class="progress-fill" style="width: ${task.progress?.progress || 0}%"></div>
                    </div>
                    <div class="subtask-list">
                        ${task.subtasks.map(st => `
                            <div class="subtask-item ${st.status}">
                                <span>${st.title}</span>
                                <span class="status-badge ${st.status}">${st.status}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        body.innerHTML = `
            <div class="modal-meta">
                <div class="modal-meta-item">
                    <span class="modal-meta-label">Status</span>
                    <span class="status-badge ${task.status}">${task.status}</span>
                </div>
                <div class="modal-meta-item">
                    <span class="modal-meta-label">Required Skill</span>
                    <span class="tag">${task.required_skill}</span>
                </div>
                ${assignedUser ? `
                    <div class="modal-meta-item">
                        <span class="modal-meta-label">Assigned To</span>
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <div class="user-avatar small" style="background-image: url('${assignedUser.avatar_url || ''}'); background-size: cover;">
                                ${assignedUser.avatar_url ? '' : assignedUser.name.charAt(0)}
                            </div>
                            <span>${assignedUser.name}</span>
                        </div>
                    </div>
                ` : '<div class="modal-meta-item"><span class="modal-meta-label">Assigned To</span><span style="color: var(--text-muted);">Unassigned</span></div>'}
            </div>
            <div class="modal-section">
                <h4>Description</h4>
                <p>${task.description ? escapeHtml(task.description).replace(/\n/g, '<br>') : '<em style="color: var(--text-muted);">No description provided.</em>'}</p>
            </div>
            <div class="modal-section">
                <h4>Specifications</h4>
                <p>${task.specifications ? escapeHtml(task.specifications).replace(/\n/g, '<br>') : '<em style="color: var(--text-muted);">No specifications provided.</em>'}</p>
            </div>
            ${subtasksHtml}
        `;
    }
}

function toggleEditMode() {
    isEditMode = !isEditMode;
    renderModal();
}

async function saveTaskEdit() {
    if (!currentModalTask) return;

    const updates = {
        title: document.getElementById('edit-title').value.trim(),
        description: document.getElementById('edit-description').value.trim(),
        specifications: document.getElementById('edit-specifications').value.trim(),
        required_skill: document.getElementById('edit-skill').value,
        status: document.getElementById('edit-status').value
    };

    try {
        await fetch(`${TASK_SERVICE_URL}/tasks/${currentModalTask.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });

        isEditMode = false;
        await loadTasks();
        await openTaskModal(currentModalTask.id);
        updateStats();
    } catch (err) {
        alert("Failed to update task");
    }
}

async function completeTask(taskId) {
    try {
        const response = await fetch(`${TASK_SERVICE_URL}/tasks/${taskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'completed' })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown server error' }));
            console.error('completeTask failed:', response.status, errorData);
            alert(`Failed to mark task as complete: ${errorData.error || response.statusText}`);
            return;
        }

        await loadTasks();
        if (document.getElementById('project-section').style.display !== 'none') {
            await loadProjects();
        }
        updateStats();

        // Refresh modal if it's open for this task
        if (currentModalTask && currentModalTask.id === taskId) {
            await openTaskModal(taskId);
        }
    } catch (err) {
        alert("Failed to mark task as complete");
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// --- INTEGRATION POINT ---
async function autoAssign(taskId) {
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = "Matching Services...";
    btn.disabled = true;

    try {
        const response = await fetch(`${TASK_SERVICE_URL}/tasks/${taskId}/auto-assign`, {
            method: 'PUT'
        });
        const result = await response.json();

        if (response.ok) {
            alert(result.message);
            await loadDashboardData();
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

// --- DELETE LOGIC ---
async function deleteUser(id) {
    if (!confirm("Are you sure you want to remove this team member?")) return;
    try {
        await fetch(`${USER_SERVICE_URL}/users/${id}`, { method: 'DELETE' });
        loadDashboardData();
    } catch (err) {
        alert("Failed to delete user");
    }
}

async function deleteTask(id) {
    if (!confirm("Are you sure you want to delete this task?")) return;
    try {
        await fetch(`${TASK_SERVICE_URL}/tasks/${id}`, { method: 'DELETE' });
        loadDashboardData();
        if (document.getElementById('project-section').style.display !== 'none') {
            loadProjects();
        }
    } catch (err) {
        alert("Failed to delete task");
    }
}
