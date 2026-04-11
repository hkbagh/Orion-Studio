# 🌌 Orion Studio

Orion Studio is a fully featured, browser-based, AI-powered IDE with a hyper-modern "Space" theme. Designed for agentic coding and isolated development, Orion provides you with the power of a desktop VS Code environment orchestrated entirely within Docker containing built-in AI agents.

## ✨ Features

* **Agentic AI Assistant:** Built-in 7-tool agentic loop (`read`, `write`, `edit`, `list`, `search`, `run`, `diagnostics`) that writes code, navigates directories, and runs terminal commands for you autonomously.
* **Model Flexibility:** Seamless dropdown integration with OpenRouter's free tier and Google Gemini LLMs. Easily switch between `gemma-4`, `nemotron`, `qwen`, and other cutting-edge models. Supports SSE streaming for real-time text output.
* **Isolated Workspaces:** Runs development environments inside securely bound Docker containers, keeping your main machine clean.
* **Interactive Terminal:** Integrated WebSockets terminal powered by `xterm.js`, allowing you to run background processes and interactive commands interactively.
* **Monaco Editor Engine:** The exact same editor powering VS Code, customized with a deep-space aesthetic, inline AI editing capabilities (`Ctrl+K`), and automatic breadcrumbs.
* **Secure Access:** Built-in JWT authentication with encrypted persistent SQLite storage for managing users and protecting your API keys.
* **Smart Port Forwarding:** Automatically proxy internal Docker ports so you can view the web apps you build directly on your host machine.

## 🛠️ Tech Stack

* **Frontend:** React, Vite, Zustand (State Management), Monaco Editor, xterm.js
* **Backend:** Node.js, Express.js, SQLite (better-sqlite3), Dockerode
* **Infrastructure:** Docker, Docker Compose, Nginx (Reverse Proxy & Static serving)

## 🚀 Getting Started

### Prerequisites
* [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/install/)
* A terminal on a Linux/macOS host (or WSL2 on Windows)

### 1. Clone & Build
Clone the repository, then navigate to the project root to build and deploy the containers using Docker Compose.

```bash
git clone https://github.com/your-username/orion-studio.git
cd "orion-studio"

# Build the frontend, backend, and Nginx reverse proxy
docker compose up --build -d
```

### 2. Access the Studio
Once the containers are successfully running, Orion Studio will be served natively to your browser:

👉 **[http://localhost:8080](http://localhost:8080)**

### 3. AI Configuration
1. Open the Chat Panel on the left side of the IDE.
2. Click the ⚙️ Settings icon.
3. Enter your [OpenRouter API Key](https://openrouter.ai/) or Gemini Key.
4. Select one of the available AI models from the dropdown list.

*(All API keys are securely encrypted within the local SQLite container volume `data/orion.db` and never sent to our servers).*

## 🗂️ Project Architecture
```text
orion-studio/
├── docker-compose.yml       # Production Compose file
├── nginx/                   # Reverse proxy routing
├── packages/
│   ├── client/              # React/Vite IDE Frontend
│   └── server/              # Node.js/Express Backend
├── workspaces/              # User files (Volume-mapped to Docker)
└── workspace-images/        # Docker images for the isolated terminals
```

## 🔐 Authentication By-pass (Dev Mode)
If you wish to disable standard authentication routes for purely isolated local deployments, you can toggle `DEV_MODE=true` inside the backend `.env` file (or docker-compose environment variables), bypassing JWT validations.

## 🤝 Contributing
Contributions are always welcome. When developing features, note that the backend terminal processes invoke actions in the host's `/workspaces` path directly synced between the host node and the docker-orchestrated IDE workspace containers via absolute volume bounds.

## 📜 License
[MIT License](LICENSE)
