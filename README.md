# Company Tasker — Task Management System

**Systems Integration Architecture (SIA) — Final Project**

A microservices-based Task Management System that demonstrates service decomposition, API Gateway routing, database-per-service patterns, and cross-service integration via RESTful APIs.

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [Project Structure](#project-structure)
4. [Technology Stack](#technology-stack)
5. [Database Schema](#database-schema)
6. [Service Specifications](#service-specifications)
7. [Integration Points](#integration-points)
8. [Setup & Installation](#setup--installation)
9. [Deployment](#deployment)
10. [Environment Configuration](#environment-configuration)

---

## Project Overview

**Company Tasker** is a web-based dashboard for managing team tasks and projects. It allows administrators to:

- Register team members with multiple skills.
- Define available skill categories.
- Create standalone tasks or group them into projects.
- Automatically assign tasks to the most suitable team member based on skill requirements and current workload.
- Track completion rates, team velocity, and project progress in real time.

The system is built on a **microservices architecture** with a single shared database, an API Gateway for request routing, and a vanilla JavaScript frontend dashboard.

---

## System Architecture

The application follows a simplified microservices pattern with an **API Gateway** as the single entry point.

```
┌─────────────────┐
│   Browser /     │
│    Client       │
└────────┬────────┘
         │ HTTP
         ▼
┌─────────────────────────────┐
│      API Gateway            │
│       Port 20201            │
│  ┌─────────────────────┐    │
│  │ Serves main/ (UI)   │    │
│  │ /user_service/*     │───▶│──┐
│  │ /task_service/*     │───▶│──┼──┐
│  └─────────────────────┘    │  │  │
└─────────────────────────────┘  │  │
                                 │  │
         ┌───────────────────────┘  │
         │                          │
         ▼                          ▼
┌─────────────────┐      ┌─────────────────┐
│  User Service   │      │  Task Service   │
│   Port 3001     │      │   Port 3002     │
└────────┬────────┘      └────────┬────────┘
         │                        │
         └──────────┬─────────────┘
                    │
                    ▼
         ┌─────────────────┐
         │   MySQL Server  │
         │ (Shared Schema) │
         └─────────────────┘
```

### Design Rationale
- **API Gateway (`gateway/`)**: Centralizes routing, CORS handling, and static file serving. Clients call one origin; the gateway proxies to internal services.
- **User Service (`user_service/`)**: Owns team member data, skills, and user-skill associations.
- **Task Service (`task_service/`)**: Owns task/project data, status management, and the auto-assignment algorithm.
- **Shared Database**: Both services connect to a single MySQL instance to enable transactional consistency across service boundaries (e.g., updating `active_tasks` when a task is assigned).

---

## Project Structure

```
SIA-FINAL/
├── .env                          # Environment variables (DB credentials)
├── .gitignore
├── package.json                  # Root dependencies
├── gateway/
│   └── server.js                 # Express API Gateway (port 20201)
├── user_service/
│   └── server.js                 # User & Skills microservice (port 3001)
├── task_service/
│   └── server.js                 # Task & Project microservice (port 3002)
└── main/
    ├── index.html                # Dashboard UI
    ├── app.js                    # Frontend logic & API consumers
    └── style.css                 # Dashboard styling
```

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript |
| **Gateway** | Node.js, Express, `http-proxy-middleware` |
| **Microservices** | Node.js, Express, `mysql2/promise` |
| **Database** | MySQL 8.0+ |
| **Process Manager** | PM2 |
| **Version Control** | Git |

### Key Dependencies
- `express` — HTTP server framework
- `mysql2` — MySQL client with Promise support
- `cors` — Cross-Origin Resource Sharing
- `dotenv` — Environment variable management
- `http-proxy-middleware` — Reverse proxy for gateway routing

---

## Database Schema

The shared MySQL database uses the following tables:

### `users`
| Column | Type | Description |
|--------|------|-------------|
| `id` | INT PK AI | User identifier |
| `name` | VARCHAR | Full name |
| `skill` | VARCHAR | Primary skill (legacy) |
| `avatar_url` | VARCHAR | Profile image URL |
| `active_tasks` | INT | Current workload count |

### `skills`
| Column | Type | Description |
|--------|------|-------------|
| `id` | INT PK AI | Skill identifier |
| `name` | VARCHAR | Skill name (unique) |

### `user_skills`
| Column | Type | Description |
|--------|------|-------------|
| `user_id` | INT FK | References `users(id)` |
| `skill_id` | INT FK | References `skills(id)` |

### `tasks`
| Column | Type | Description |
|--------|------|-------------|
| `id` | INT PK AI | Task identifier |
| `title` | VARCHAR | Task title |
| `description` | TEXT | Short description |
| `specifications` | TEXT | Detailed requirements |
| `required_skill` | VARCHAR | Skill needed for assignment |
| `task_type` | ENUM | `'task'` or `'project'` |
| `parent_id` | INT FK | References `tasks(id)` for sub-tasks |
| `assigned_user_id` | INT FK | References `users(id)` |
| `assigned_user_name` | VARCHAR | Denormalized assignee name |
| `status` | ENUM | `'unassigned'`, `'assigned'`, `'completed'` |
| `progress_percent` | INT | Calculated project completion |
| `created_at` | TIMESTAMP | Auto-generated |

---

## Service Specifications

### 1. API Gateway
**File:** `gateway/server.js`  
**Port:** `20201`

| Route | Target |
|-------|--------|
| `/` | Serves `main/` (Frontend Dashboard) |
| `/user_service/*` | Proxies to `http://localhost:3001` |
| `/task_service/*` | Proxies to `http://localhost:3002` |

### 2. User Service
**File:** `user_service/server.js`  
**Port:** `3001`  
**Base Path:** `/api`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/skills` | List all skills |
| `POST` | `/skills` | Add a new skill |
| `GET` | `/users` | List all users with their skills |
| `POST` | `/users` | Register a new team member |
| `DELETE` | `/users/:id` | Remove a team member |
| `GET` | `/users/match/:skill` | Find the least-busy user with a given skill |

### 3. Task Service
**File:** `task_service/server.js`  
**Port:** `3002`  
**Base Path:** `/api`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/tasks` | List all tasks |
| `GET` | `/tasks/:id` | Get single task / project with subtasks |
| `POST` | `/tasks` | Create a task or project |
| `PUT` | `/tasks/:id` | Update task fields & status |
| `DELETE` | `/tasks/:id` | Delete task & adjust user workloads |
| `GET` | `/projects` | List all projects with progress |
| `PUT` | `/tasks/:id/auto-assign` | Auto-assign task to best-fit user |

---

## Integration Points

### Auto-Assignment Algorithm (`PUT /api/tasks/:id/auto-assign`)

The primary integration demonstration. The Task Service does **not** store user skills locally. Instead:

1. Queries its own `tasks` table for the task's `required_skill`.
2. Queries the shared database's `users`, `user_skills`, and `skills` tables to find qualified members.
3. Selects the user with the lowest `active_tasks` count.
4. Updates the task status to `assigned`, records the user, and increments `active_tasks`.

This simulates a real-world microservices integration where one service queries another's domain data through a shared data store.

### Status Transition Logic

When a task status changes, the Task Service automatically updates the assigned user's `active_tasks` count:

| Transition | `active_tasks` Action |
|------------|----------------------|
| `unassigned` -> `assigned` | `+1` |
| `assigned` -> `completed` | `-1` |
| `completed` -> `assigned` | `+1` |
| `assigned` -> `unassigned` | `-1` |

### Project Progress Calculation

For any task with `task_type = 'project'`, progress is dynamically calculated based on its sub-tasks:

```
progress = (completed_subtasks / total_subtasks) x 100
```

---

## Setup & Installation

### Prerequisites
- Node.js 18+
- MySQL 8.0+
- PM2 (`npm install -g pm2`)

### 1. Clone & Install
```bash
git clone <repository-url>
cd SIA-FINAL
npm install
```

### 2. Database Setup
Create a MySQL database and execute the schema (tables: `users`, `skills`, `user_skills`, `tasks`).

### 3. Environment Configuration
Create a `.env` file in the project root:

```env
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=your_db_name
```

Both services load this file via:
```js
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
```

### 4. Start Services
Using Node.js directly:
```bash
# Terminal 1
node gateway/server.js

# Terminal 2
node user_service/server.js

# Terminal 3
node task_service/server.js
```

Or using PM2 (recommended for production):
```bash
pm2 start gateway/server.js --name gateway
pm2 start user_service/server.js --name user_service
pm2 start task_service/server.js --name task_service
pm2 save
pm2 startup
```

### 5. Access
Open `http://localhost:20201` in your browser.

---

## Deployment

This system is deployed on the school server (`dcism.org`) using PM2 as the process manager.

### PM2 Process List
| App Name | Port | Path |
|----------|------|------|
| `gateway` | `20201` | `calc.dcism.org/gateway/server.js` |
| `user_service` | `3001` | `calc.dcism.org/user_service/server.js` |
| `task_service` | `3002` | `calc.dcism.org/task_service/server.js` |

### Useful Commands
```bash
# View logs
pm2 logs

# Restart all services
pm2 restart all

# Monitor processes
pm2 monit
```

> **Note:** If services show `ECONNREFUSED` on `10.16.10.10:3306`, verify that the database host in the service files matches the actual MySQL server location (e.g., `localhost` if MySQL is co-located with the Node.js apps).

---

## Environment Configuration

| Variable | Purpose |
|----------|---------|
| `DB_USER` | MySQL username |
| `DB_PASSWORD` | MySQL password |
| `DB_NAME` | Database name |

The database host is currently hardcoded in both services as `'dbadmin.dcism.org'` (or `localhost` depending on deployment context).

---

## Authors

**Course:** Systems Integration Architecture (SIA)  
**Institution:** University of San Carlos — DCISM  
**Project Type:** Final Academic Project
