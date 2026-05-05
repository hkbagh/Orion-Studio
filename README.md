# ✦ Orion Studio

**A fully featured, browser-based AI-powered IDE with Docker-isolated workspaces, an agentic coding assistant, and an integrated code translation engine.**

Built with React, Monaco Editor, Node.js, and Docker — Orion Studio gives you a VS Code-grade development environment in any browser tab.

---

## ✨ Features at a Glance

| Feature | Description |
|---|---|
| **Monaco Editor** | The same engine powering VS Code — syntax highlighting, IntelliSense-style editing, custom `orion-space` dark theme |
| **Agentic AI Assistant** | 7-tool autonomous agent (`read`, `write`, `edit`, `list`, `search`, `run`, `diagnostics`) powered by OpenRouter or Gemini |
| **Code Translator** | Upload a ZIP of any project and AI-convert it between Java, Python, JavaScript, and C++ — preserving logic, structure, and context |
| **Docker Workspaces** | Each workspace runs in an isolated Docker container; your host machine stays clean |
| **Live Terminal** | WebSocket-backed xterm.js terminal with full interactivity, inside each workspace container |
| **Smart Port Forwarding** | Expose ports from inside a container directly to your host browser |
| **JWT Authentication** | Built-in user management with bcrypt-hashed passwords and JWT session tokens |
| **File Watcher** | Real-time file-tree refresh via WebSocket when files change on disk |
| **SSE Streaming** | AI responses and translation progress stream token-by-token in real time |

---

## 🖥️ Screenshots

```
Landing Page  →  /
IDE           →  /ide
Translator    →  /translate
```

---

## 🛠️ Tech Stack

### Frontend
- **React 19** + **Vite 8** — fast HMR dev server and optimised production build
- **Zustand** — lightweight global state (`editorStore`, `workspaceStore`, `aiStore`)
- **Monaco Editor** (`@monaco-editor/react`) — VS Code editor engine
- **xterm.js** (`@xterm/xterm`) — full-featured terminal emulator
- **react-router-dom v7** — client-side routing
- **lucide-react** — icon set

### Backend
- **Node.js 20** + **Express 5** — HTTP API and WebSocket server on a single port
- **better-sqlite3** — embedded SQLite for users, workspaces, conversations, and settings
- **ws** — WebSocket server (terminal sessions + file watcher)
- **Dockerode** — Node.js Docker API client for container lifecycle management
- **bcryptjs** + **jsonwebtoken** — authentication
- **uuid** — workspace and job ID generation
- **chokidar** — file-system watcher

### Infrastructure
- **Docker** + **Docker Compose** — service orchestration
- **Nginx** — reverse proxy, static asset serving, WebSocket upgrade, SSE passthrough

---

## 🚀 Getting Started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) (v2+)
- `unzip` installed on the host (`apt install unzip` on Ubuntu/Debian)
- A Linux, macOS, or WSL2 host

### 1 — Clone & Configure

```bash
git clone https://github.com/your-username/orion-studio.git
cd orion-studio
```

Edit `docker-compose.yml` and set `WORKSPACES_HOST_PATH` to the absolute path of the `workspaces/` directory on your machine:

```yaml
environment:
  - WORKSPACES_HOST_PATH=/absolute/path/to/orion-studio/workspaces
```

### 2 — Build & Start

```bash
docker compose up --build -d
```

This builds the React frontend, the Node.js backend, and starts Nginx as the reverse proxy.

### 3 — Open Orion Studio

👉 **http://localhost:8080**

### 4 — Configure AI

1. Click **Launch Studio** on the landing page.
2. Open the AI panel (left sidebar → robot icon, or `Ctrl+Shift+I`).
3. Click ⚙️ **Settings**.
4. Paste your [OpenRouter API key](https://openrouter.ai/) or [Google Gemini key](https://aistudio.google.com/).
5. Select a model from the dropdown.

> All API keys are encrypted and stored in the local SQLite database (`data/orion.db`). They are never sent to Orion servers.

---

## 🗂️ Project Structure

```
orion-studio/
├── docker-compose.yml          # Production service orchestration
├── nginx/
│   └── nginx.conf              # Reverse proxy, WS upgrade, SSE config
├── packages/
│   ├── client/                 # React + Vite frontend
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── LandingPage.jsx     # Entry page (/)
│   │   │   │   └── TranslatePage.jsx   # Code translator (/translate)
│   │   │   ├── components/
│   │   │   │   ├── AI/         # AIChat panel
│   │   │   │   ├── Editor/     # Monaco, tabs, breadcrumbs, inline AI
│   │   │   │   ├── FileExplorer/
│   │   │   │   ├── Layout/     # WorkspaceLayout, SplitPane
│   │   │   │   ├── Sidebar/    # ActivityBar, SearchPanel
│   │   │   │   ├── StatusBar/
│   │   │   │   └── Terminal/   # xterm.js panel
│   │   │   ├── hooks/          # useFileSystem, useTerminal, useFileWatcher
│   │   │   ├── store/          # Zustand stores
│   │   │   ├── services/       # api.js — HTTP client
│   │   │   └── utils/          # languageMap
│   │   └── Dockerfile
│   └── server/                 # Node.js + Express backend
│       ├── src/
│       │   ├── agent/
│       │   │   ├── orchestrator.js     # Agentic loop (up to 15 tool rounds)
│       │   │   ├── providers/          # OpenRouter, Gemini (OpenAI-compat)
│       │   │   ├── tools/              # 7 agent tools
│       │   │   └── context/            # System prompt builder
│       │   ├── routes/
│       │   │   ├── ai.js       # /api/ai/* — chat, config, models
│       │   │   ├── auth.js     # /api/auth/* — setup, login, token
│       │   │   ├── files.js    # /api/workspaces/:id/file/* — CRUD
│       │   │   ├── ports.js    # /api/ports — port forwarding
│       │   │   ├── search.js   # /api/search — full-text grep
│       │   │   ├── translate.js # /api/translate/* — ZIP upload + AI translate
│       │   │   └── workspace.js # /api/workspaces — lifecycle
│       │   ├── services/
│       │   │   ├── dockerService.js    # Container create/start/exec/cleanup
│       │   │   ├── fileService.js      # Safe file I/O scoped to workspace
│       │   │   ├── fileWatcher.js      # Chokidar → WebSocket broadcaster
│       │   │   └── translationService.js # File classification, AI prompts, run commands
│       │   ├── ws/
│       │   │   └── terminalHandler.js  # Docker exec → xterm WebSocket bridge
│       │   ├── db/
│       │   │   ├── database.js         # SQLite queries
│       │   │   └── schema.sql          # Table definitions
│       │   ├── middleware/
│       │   │   ├── auth.js             # JWT verify middleware
│       │   │   └── errorHandler.js
│       │   └── config/index.js
│       └── Dockerfile
├── workspace-images/           # Custom Docker images for workspace containers
├── workspaces/                 # User project files (volume-mounted)
│   └── default/                # Default local workspace
└── data/                       # SQLite DB volume (orion.db)
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+S` | Save current file |
| `Ctrl+B` | Toggle sidebar |
| `Ctrl+`` ` | Toggle terminal panel |
| `Ctrl+Shift+I` | Open AI assistant |
| `Ctrl+K` | Inline AI edit (inside editor) |

---

## 🤖 AI Agent Tools

The agentic loop supports up to **15 tool-use rounds** per conversation turn. Available tools:

| Tool | Description |
|---|---|
| `read_file` | Read any file in the workspace |
| `write_file` | Create or overwrite a file |
| `edit_file` | Replace an exact substring in a file |
| `list_directory` | Show the workspace file tree |
| `search_files` | Full-text search across all files |
| `run_command` | Execute a shell command (with safety block-list) |
| `get_diagnostics` | Run TypeScript type-checker |

### Safety Block-list (`run_command`)

The following patterns are blocked from execution:

```
sudo rm   |   rm -rf /   |   mkfs   |   dd if=
shutdown  |   reboot     |   fork bomb   |   > /dev/sd*
chmod 777 /
```

---

## 🔄 Code Translator

### Supported Languages

| Language | Source Extensions | Run Command |
|---|---|---|
| Java | `.java` | `javac *.java && java Main` |
| Python | `.py` | `python3 main.py` |
| JavaScript | `.js` `.ts` `.jsx` `.tsx` `.mjs` | `node index.js` |
| C++ | `.cpp` `.c` `.h` `.hpp` | `g++ -std=c++17 *.cpp && ./program` |

### What Gets Translated

- **Source files** — full AI conversion, preserving logic and context
- **Build configs** — `pom.xml` → `requirements.txt`, `package.json` → `pom.xml`, etc.
- **Media & binary files** — copied as-is (`.png`, `.jpg`, `.mp4`, `.pdf`, …)
- **Text/config files** — copied as-is (`.txt`, `.md`, `.yaml`, `.env`, …)
- **Files >80 KB** — copied as-is to avoid exceeding LLM context windows

### Translation Flow

```
1. Upload ZIP         → POST /api/translate/upload
                        Extracts, walks, classifies all files → returns manifest

2. SSE Translation    → GET /api/translate/:jobId/stream
                        File-by-file AI conversion, live progress events

3. Workspace Created  → workspaces/t-{id}/  (openable in IDE immediately)

4. Run Project        → GET /api/translate/:workspaceId/run-stream
                        Auto-detects entry point, streams stdout/stderr
```

---

## 🔐 Authentication

### First-time Setup

```bash
curl -X POST http://localhost:8080/api/auth/setup \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "yourpassword"}'
```

### Login

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "yourpassword"}'
```

Returns a JWT token to include as `Authorization: Bearer <token>` on subsequent requests.

### Dev Mode (bypass auth)

Set `DEV_MODE=true` in `docker-compose.yml` environment to skip JWT validation for local development.

---

## 🐳 Docker Details

### Services

| Service | Port | Description |
|---|---|---|
| `frontend` | `8080:80` | Nginx serving the built React app |
| `backend` | `3001:3001` | Node.js API + WebSocket server |

### Volumes

| Mount | Purpose |
|---|---|
| `./workspaces:/app/workspaces` | User project files |
| `./data:/app/data` | SQLite database |
| `/var/run/docker.sock` | Docker-in-Docker for workspace containers |

### Workspace Containers

When you open a terminal in the IDE, the backend either:
1. Connects to an existing workspace container (from cache), or
2. Creates a new container from the `orion-workspace` image (falls back to `ubuntu:22.04`)

The workspace directory is bind-mounted into the container so files are always in sync.

---

## 🔧 Development

### Local Dev (without Docker)

```bash
# Install all dependencies
npm install
cd packages/client && npm install
cd ../server && npm install

# Start both servers concurrently (from root)
npm run dev
```

- Frontend: **http://localhost:5173**
- Backend: **http://localhost:3001**

### Environment Variables (server)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | HTTP server port |
| `HOST` | `0.0.0.0` | Bind address |
| `WORKSPACES_DIR` | `../../workspaces` | Workspace files path (in-container) |
| `WORKSPACES_HOST_PATH` | same as above | Absolute host path (for Docker bind mounts) |
| `DB_PATH` | `../../data/orion.db` | SQLite database path |
| `NODE_ENV` | `development` | `production` disables verbose logging |
| `DEV_MODE` | — | Set to `true` to bypass JWT auth |

---

## 📡 API Reference

### Health
```
GET /api/health
```

### Workspaces
```
GET    /api/workspaces
POST   /api/workspaces           { name, image? }
GET    /api/workspaces/:id
DELETE /api/workspaces/:id
```

### Files
```
GET    /api/workspaces/:id/files
GET    /api/workspaces/:id/file/*path
POST   /api/workspaces/:id/file/*path   { content, isDirectory? }
PUT    /api/workspaces/:id/file/*path   { content }
DELETE /api/workspaces/:id/file/*path
PATCH  /api/workspaces/:id/file/*path   { newPath }
```

### AI
```
POST /api/ai/chat         { message, history?, workspaceId? }  → SSE
GET  /api/ai/config
PUT  /api/ai/config       { provider, model }
POST /api/ai/keys         { provider, apiKey }
GET  /api/ai/models
```

### Code Translation
```
POST /api/translate/upload                                → { jobId, files, totalFiles }
GET  /api/translate/:jobId/stream?sourceLang=&targetLang= → SSE
GET  /api/translate/:workspaceId/run-stream?lang=         → SSE
```

### Auth
```
POST /api/auth/setup     { username, password, email? }
POST /api/auth/login     { username, password }
POST /api/auth/logout
GET  /api/auth/me
```

### WebSockets
```
ws://host/ws/terminal?workspaceId=<id>   — interactive terminal
ws://host/ws/watch?workspaceId=<id>      — file-change events
```

---

## 📜 License

[MIT License](LICENSE) — © 2025 Harekrishna Bagh
