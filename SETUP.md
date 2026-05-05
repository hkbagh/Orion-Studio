# Orion Studio — Quick Start Guide

A browser-based Cloud IDE with AI-powered coding, built-in terminal, and code translation.

---

## Prerequisites

| Tool | Version | Required For |
|------|---------|-------------|
| **Node.js** | v20+ | Backend + Frontend |
| **npm** | v9+ | Package management |
| **Docker** | v24+ | Terminal containers |
| **Docker Compose** | v2+ | Production deployment |

### Install Prerequisites

```bash
# Node.js (via nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20

# Docker (Ubuntu/Debian)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in for group changes to take effect
```

---

## Getting Started (Development)

### 1. Clone & Install

```bash
git clone <your-repo-url> "Orion Studio"
cd "Orion Studio"
npm install
```

### 2. Build the Workspace Docker Image

The terminal runs inside a Docker container with Python, Java, Node.js, GCC, Go, and Ruby pre-installed.

```bash
docker build -t orion-workspace ./docker/workspace/
```

This only needs to be done **once** (or after updating the Dockerfile).

### 3. Start the Dev Server

```bash
npm run dev
```

This starts both:
- **Frontend** (Vite) → http://localhost:5173
- **Backend** (Node.js) → http://localhost:3001

### 4. Open the IDE

Navigate to **http://localhost:5173/ide** in your browser.

---

## Project Structure

```
Orion Studio/
├── packages/
│   ├── client/          # React frontend (Vite)
│   │   └── src/
│   │       ├── components/  # UI components (Editor, Terminal, Sidebar, etc.)
│   │       ├── hooks/       # Custom React hooks (useTerminal, useFileWatcher)
│   │       ├── pages/       # Landing, IDE, Translate pages
│   │       └── store/       # Zustand state stores
│   └── server/          # Node.js backend (Express)
│       └── src/
│           ├── agent/       # AI agent system (OpenRouter, Gemini providers)
│           ├── routes/      # API routes (files, translate, settings)
│           ├── services/    # Docker service, file watcher
│           └── db/          # SQLite database
├── docker/
│   └── workspace/       # Dockerfile for terminal containers
├── workspaces/          # User workspace files
├── data/                # SQLite database file
├── nginx/               # Nginx config (production)
└── docker-compose.yml   # Production Docker Compose
```

---

## Features

### Code Editor
- Monaco Editor with syntax highlighting for 20+ languages
- File explorer with create, rename, delete operations
- Multi-tab editing with dirty state tracking
- Breadcrumb navigation

### Built-in Terminal
- Full interactive terminal powered by xterm.js
- Runs inside a Docker container with development tools
- **Run button** auto-detects file type and executes code

#### Supported Languages (via Run button)

| Language | Command | Extension |
|----------|---------|-----------|
| Python | `python3 file.py` | `.py` |
| JavaScript | `node file.js` | `.js` |
| TypeScript | `npx ts-node file.ts` | `.ts` |
| Java | `javac File.java && java File` | `.java` |
| C | `gcc -o program file.c && ./program` | `.c` |
| C++ | `g++ -o program file.cpp && ./program` | `.cpp` |
| Go | `go run file.go` | `.go` |
| Ruby | `ruby file.rb` | `.rb` |
| Rust | `rustc file.rs -o program && ./program` | `.rs` |
| Shell | `bash file.sh` | `.sh` |

### AI Assistant
- Chat panel with AI coding assistance
- Supports OpenRouter and Google Gemini providers
- Configure API keys in the Settings panel

### Code Translation
- Upload a ZIP of source code
- AI translates between programming languages
- Download translated project as ZIP
- Access at: **http://localhost:5173/translate**

---

## Production Deployment (Docker Compose)

```bash
# Build and start all services
docker compose up -d --build

# Access at http://localhost:8080
```

This runs:
- **Nginx** frontend on port 8080 (serves built React app)
- **Node.js** backend on port 3001

---

## Configuration

### AI Provider Keys

1. Open the IDE at `/ide`
2. Click the **Settings** gear icon in the activity bar (bottom-left)
3. Enter your API key:
   - **OpenRouter**: Get a key at [openrouter.ai](https://openrouter.ai)
   - **Gemini**: Get a key at [aistudio.google.com](https://aistudio.google.com)

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Backend server port |
| `HOST` | `0.0.0.0` | Backend bind address |
| `WORKSPACES_DIR` | `./workspaces` | Workspace storage path |
| `DB_PATH` | `./data/orion.db` | SQLite database path |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Save current file |
| `Ctrl+B` | Toggle sidebar |
| `` Ctrl+` `` | Toggle terminal |
| `Ctrl+Shift+I` | Open AI assistant |

---

## Troubleshooting

### Port 3001 already in use
```bash
# Find and kill the process
kill -9 $(lsof -t -i:3001)
# Or stop Docker containers
docker compose down
```

### Terminal shows "command not found"
The workspace Docker image needs to be built:
```bash
docker build -t orion-workspace ./docker/workspace/
```
Then restart the dev server and refresh the browser.

### Terminal not connecting
Check that Docker is running:
```bash
docker info
```

### HMR errors after editing terminal code
Do a hard refresh in the browser: `Ctrl+Shift+R`
