# Orion Studio — Technical Documentation

> **Audience:** Developers contributing to, extending, or self-hosting Orion Studio.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Frontend](#2-frontend)
   - 2.1 [Routing & Pages](#21-routing--pages)
   - 2.2 [State Management](#22-state-management)
   - 2.3 [Component Tree](#23-component-tree)
   - 2.4 [Editor Integration](#24-editor-integration)
   - 2.5 [Terminal Integration](#25-terminal-integration)
3. [Backend](#3-backend)
   - 3.1 [Server Entrypoint](#31-server-entrypoint)
   - 3.2 [HTTP Routes](#32-http-routes)
   - 3.3 [WebSocket Handlers](#33-websocket-handlers)
   - 3.4 [Database Schema](#34-database-schema)
   - 3.5 [Docker Service](#35-docker-service)
   - 3.6 [File Service](#36-file-service)
   - 3.7 [File Watcher](#37-file-watcher)
4. [AI Agent System](#4-ai-agent-system)
   - 4.1 [Orchestrator](#41-orchestrator)
   - 4.2 [Providers](#42-providers)
   - 4.3 [Tool Definitions](#43-tool-definitions)
   - 4.4 [System Prompt](#44-system-prompt)
5. [Code Translation Engine](#5-code-translation-engine)
   - 5.1 [Upload & Classification](#51-upload--classification)
   - 5.2 [SSE Translation Stream](#52-sse-translation-stream)
   - 5.3 [Translation Service Utilities](#53-translation-service-utilities)
   - 5.4 [Run Stream](#54-run-stream)
   - 5.5 [SSE Event Reference](#55-sse-event-reference)
6. [Infrastructure](#6-infrastructure)
   - 6.1 [Docker Compose](#61-docker-compose)
   - 6.2 [Nginx Configuration](#62-nginx-configuration)
   - 6.3 [Workspace Container Lifecycle](#63-workspace-container-lifecycle)
7. [Authentication](#7-authentication)
8. [Data Flow Diagrams](#8-data-flow-diagrams)
9. [Adding a New Feature](#9-adding-a-new-feature)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Architecture Overview

```
Browser
  │
  ├── HTTP  ──► Nginx :8080 ──► React (static, /usr/share/nginx/html)
  │                │
  ├── /api/* ──────┤──► Express :3001
  │                │         │
  └── /ws/*  ──────┘         ├── SQLite  (data/orion.db)
                             ├── Docker  (/var/run/docker.sock)
                             └── FS      (workspaces/)
```

**Key design decisions:**

- **Single-origin**: Nginx proxies both `/api/` and `/ws/` to the backend, so the frontend only ever talks to port 8080. No CORS complexity in production.
- **No message broker**: WebSocket connections are held directly in the Node.js process. A single instance is assumed.
- **Volume-backed workspaces**: Files written by the backend land on the host via a bind mount, so they survive container restarts.
- **Ephemeral AI jobs**: Translation jobs are stored in-memory with a 1-hour TTL. They don't survive server restart, which is acceptable since the output workspace is persisted to disk.

---

## 2. Frontend

### 2.1 Routing & Pages

File: `packages/client/src/main.jsx`

```
/           → LandingPage     (packages/client/src/pages/LandingPage.jsx)
/ide        → App             (packages/client/src/App.jsx)
/translate  → TranslatePage   (packages/client/src/pages/TranslatePage.jsx)
*           → redirect to /
```

The router is `BrowserRouter` (HTML5 history API). Nginx is configured with `try_files $uri $uri/ /index.html` so deep links work on refresh.

### 2.2 State Management

Three Zustand stores — all in `packages/client/src/store/`:

#### `workspaceStore.js`
```
workspaceId       string   — active workspace ID ('local' = default)
workspaceName     string
sidebarVisible    boolean
sidebarWidth      number   — px, resizable via SplitPane
activeSidebarPanel string  — 'files' | 'search' | 'ai'
terminalVisible   boolean
terminalHeight    number   — px

Actions: toggleSidebar, setSidebarWidth, setActiveSidebarPanel,
         toggleTerminal, setTerminalHeight, setWorkspace(workspace)
```

`setWorkspace({ id, name, path })` is called by `TranslatePage` before navigating to `/ide` so the IDE opens the translated workspace.

#### `editorStore.js`
```
openFiles         File[]     — tab list
activeFileIndex   number
pendingDiffs      { [path]: diff }  — AI-proposed changes

Actions: openFile, closeFile, updateFileContent, markFileSaved,
         setActiveFile, setPendingDiff, clearPendingDiff
```

#### `aiStore.js`
```
messages          Message[]
isStreaming       boolean
streamContent     string
activeProvider    string
activeModel       string
configuredProviders string[]

Actions: addMessage, setMessages, setStreaming, appendStreamContent,
         resetStreamContent, setConfig
```

### 2.3 Component Tree

```
App (reads workspaceId from store)
└── WorkspaceLayout
    ├── ActivityBar            — icon rail (files / search / ai)
    ├── Sidebar
    │   ├── FileTree           — recursive FileNode components
    │   │   └── ContextMenu    — right-click menu
    │   ├── SearchPanel        — grep across workspace
    │   └── AIChat             — conversation UI + settings
    ├── SplitPane (vertical)
    │   ├── [Editor area]
    │   │   ├── EditorTabs
    │   │   ├── Breadcrumbs
    │   │   ├── MonacoEditor
    │   │   │   ├── InlineAIWidget   — Ctrl+K overlay
    │   │   │   └── DiffOverlay      — accept/reject AI changes
    │   │   └── EmptyState
    │   └── TerminalPanel      — xterm.js instance
    └── StatusBar
```

### 2.4 Editor Integration

File: `packages/client/src/components/Editor/MonacoEditor.jsx`

The Monaco instance is created by `@monaco-editor/react`. On mount, a custom theme `orion-space` is defined with the following palette:

| Token | Color |
|---|---|
| background | `#09080d` |
| keyword | `#c678dd` |
| string | `#98c379` |
| function | `#61afef` |
| number | `#d19a66` |
| cursor | `#c084fc` |

**Inline AI (Ctrl+K):**
1. User selects text and presses `Ctrl+K`.
2. `InlineAIWidget` renders at the selection position.
3. User types an instruction and submits.
4. A non-streaming `POST /api/ai/chat` call is made with the selected code as context.
5. The response is shown in `DiffOverlay` (accept writes to file, reject dismisses).

**Auto-save:** `Ctrl+S` calls `fileSystem.saveFile(path, content)` which hits `PUT /api/workspaces/:id/file/*path`.

### 2.5 Terminal Integration

File: `packages/client/src/components/Terminal/TerminalPanel.jsx`
Hook: `packages/client/src/hooks/useTerminal.js`

1. On mount, `useTerminal` opens a WebSocket to `ws://host/ws/terminal?workspaceId=<id>`.
2. The backend (`ws/terminalHandler.js`) either finds an existing Docker exec session or creates a new one.
3. `xterm.js` renders input/output. The `FitAddon` resizes the PTY on every terminal container resize.
4. Resize events are sent as JSON: `{ type: 'resize', cols, rows }`.
5. Input is sent as JSON: `{ type: 'input', data: '<keystrokes>' }`.

---

## 3. Backend

### 3.1 Server Entrypoint

File: `packages/server/src/index.js`

```
Express app
  apply middleware: cors, express.json (10mb)
  register routes: /api/files, /api/workspaces, /api/ai,
                   /api/search, /api/auth, /api/ports, /api/translate

HTTP server (wraps Express)
  upgrade handler → WebSocketServer (noServer mode)
    /ws/terminal  → setupTerminalHandler(wss)
    /ws/watch     → FileWatcher.subscribe(workspaceId, ws)

On SIGTERM/SIGINT:
  dockerService.cleanup()  → stop all active containers
  server.close()
```

### 3.2 HTTP Routes

#### `routes/files.js` — File CRUD

All routes are scoped to a workspace. `getFileService(workspaceId)` resolves the path:
- `local` → `workspacesDir/default`
- anything else → `workspacesDir/<id>`

```
GET    /api/workspaces/:id/files              → FileService.getFileTree()
GET    /api/workspaces/:id/file/{*path}       → FileService.readFile(path)
POST   /api/workspaces/:id/file/{*path}       → FileService.createFile / createDirectory
PUT    /api/workspaces/:id/file/{*path}       → FileService.writeFile(path, content)
DELETE /api/workspaces/:id/file/{*path}       → FileService.deleteFile(path)
PATCH  /api/workspaces/:id/file/{*path}       → FileService.renameFile(path, newPath)
```

#### `routes/workspace.js` — Workspace Lifecycle

```
GET    /api/workspaces         → DB listWorkspaces()
POST   /api/workspaces         → create dir + DB record, start Docker container
GET    /api/workspaces/:id     → DB getWorkspaceById()
DELETE /api/workspaces/:id     → stop container + remove dir + DB delete
```

#### `routes/ai.js` — AI Chat

```
POST /api/ai/chat              → AgentOrchestrator.run() → SSE stream
GET  /api/ai/config            → orchestrator.getConfig()
PUT  /api/ai/config            → orchestrator.setModel(provider, model)
POST /api/ai/keys              → orchestrator.setApiKey(provider, key)
GET  /api/ai/models            → orchestrator.listModels()
```

The SSE stream format:
```
event: status         data: { message: "Thinking..." }
event: text_delta     data: { content: "..." }
event: tool_call      data: { tool, args, id }
event: tool_executing data: { tool, args, id }
event: tool_result    data: { tool, result, id, duration_ms }
event: done           data: { content: "full response" }
event: error          data: { error: "message" }
```

#### `routes/translate.js` — Code Translation

See [Section 5](#5-code-translation-engine) for full detail.

#### `routes/search.js` — Full-text Search

Runs `grep -rn` inside the workspace directory. Returns up to 10 matching files with up to 5 line matches each.

#### `routes/auth.js` — Authentication

```
POST /api/auth/setup    → create first admin (blocked if users exist)
POST /api/auth/login    → bcrypt verify → return JWT
POST /api/auth/logout   → client clears token (stateless)
GET  /api/auth/me       → decode JWT → return user info
```

#### `routes/ports.js` — Port Forwarding

Proxies requests to `http://localhost:<port>` inside the workspace container network, making it accessible via the host browser.

### 3.3 WebSocket Handlers

#### Terminal (`ws/terminalHandler.js`)

```
Connection:
  parse workspaceId from URL query
  dockerService.getOrCreateContainer(workspaceId)
  dockerService.createTerminalSession(container) → { exec, stream }
  pipe stream.data → ws.send()

Message handler (ws → container):
  { type: 'input',  data }    → stream.write(data)
  { type: 'resize', cols, rows } → exec.resize(cols, rows)

Disconnect:
  stream.end()
  sessions.delete(ws)
```

**Fallback:** If Docker is unavailable, a local `bash` process is spawned directly on the host, with the workspace directory as `cwd`.

#### File Watcher (`services/fileWatcher.js`)

Uses `chokidar` to watch the workspace root. On file events, broadcasts to all subscribed WebSocket clients:

```json
{ "type": "file_added",   "path": "src/index.js" }
{ "type": "file_deleted", "path": "src/index.js" }
{ "type": "dir_added",    "path": "src/lib" }
{ "type": "dir_deleted",  "path": "src/lib" }
```

The `App.jsx` hook `useFileWatcher` calls `fileSystem.fetchFileTree()` on structural changes.

### 3.4 Database Schema

File: `packages/server/src/db/schema.sql`

```sql
workspaces (
  id TEXT PRIMARY KEY,           -- 8-char UUID prefix (e.g. "a1b2c3d4")
  name TEXT NOT NULL,
  image TEXT DEFAULT 'orion-workspace',
  status TEXT DEFAULT 'stopped', -- 'stopped' | 'running'
  container_id TEXT,
  path TEXT NOT NULL,            -- absolute path on host
  created_at TEXT,
  last_accessed_at TEXT
)

conversations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT,
  title TEXT,
  messages TEXT DEFAULT '[]',    -- JSON array
  model TEXT,
  created_at TEXT,
  updated_at TEXT
)

settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL            -- JSON-encoded value
)
-- Used for: openrouter_api_key, gemini_api_key, active_provider, active_model

users (
  id TEXT PRIMARY KEY,           -- 12-char UUID prefix
  username TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,   -- bcrypt, 12 rounds
  role TEXT DEFAULT 'user',      -- 'user' | 'admin'
  created_at TEXT,
  last_login_at TEXT
)
```

`getSetting(key)` / `setSetting(key, value)` use `JSON.parse` / `JSON.stringify` so any value type can be stored.

### 3.5 Docker Service

File: `packages/server/src/services/dockerService.js`

**Container cache:** An in-memory `Map<workspaceId, { containerId }>` avoids recreating containers on every terminal open.

**`getOrCreateContainer(workspaceId)`:**
1. Check cache → inspect container → if running, return it; if stopped, start it.
2. If not in cache → `createContainer(workspaceId)`.

**`createContainer(workspaceId)`:**
- Image: `orion-workspace` (custom), falls back to `ubuntu:22.04`.
- Bind mount: `WORKSPACES_HOST_PATH/<workspaceId>:/workspace`.
- Entry: `bash -c "tail -f /dev/null"` (keeps container alive).
- Network: `orion-network` (same as backend).

**`createTerminalSession(container)`:**
- `container.exec({ Cmd: ['/bin/bash'], AttachStdin, AttachStdout, AttachStderr, Tty: true })`.
- Returns `{ exec, stream }`.

**`cleanup()`:** Called on SIGTERM/SIGINT — stops all tracked containers.

### 3.6 File Service

File: `packages/server/src/services/fileService.js`

All paths are validated against the workspace root using `path.resolve` to prevent directory traversal:

```js
resolvePath(relativePath) {
  const resolved = resolve(this.rootPath, relativePath);
  if (!resolved.startsWith(this.rootPath)) throw new Error('Path traversal detected');
  return resolved;
}
```

**`getFileTree(dir, base)`:** Recursive directory walk. Skips `node_modules`, `.git`, and hidden dirs. Returns a tree of `{ name, type, path, size?, children? }` nodes.

### 3.7 File Watcher

File: `packages/server/src/services/fileWatcher.js`

`subscribe(workspaceId, ws)` starts a `chokidar.watch()` on the workspace directory (if not already watching). On disconnect, if no subscribers remain, the watcher is closed.

---

## 4. AI Agent System

### 4.1 Orchestrator

File: `packages/server/src/agent/orchestrator.js`

The agentic loop runs inside a `while (round < MAX_TOOL_ROUNDS)` (max 15):

```
1. Build system prompt + workspace context
2. Append user message to history
3. Call provider.streamChat(messages, toolDefinitions, options)
4. Stream text tokens → emit 'text_delta' SSE events
5. Accumulate tool_calls from stream
6. If no tool calls → emit 'done', return
7. For each tool call:
   a. Emit 'tool_call' SSE
   b. executeTool(name, args, workspaceId) → result
   c. Emit 'tool_result' SSE
   d. Append tool result to messages
8. Loop to step 3
```

**Provider loading:** `loadProviders()` reads API keys from SQLite on every `run()` call so key changes take effect immediately without restarting.

### 4.2 Providers

Both providers implement the same interface from `BaseProvider`:

```js
chat(messages, tools, options)         → { content, toolCalls, usage }
streamChat(messages, tools, options)   → async generator of chunks
listModels()                           → [{ id, name, provider, contextLength }]
```

**OpenRouter** (`providers/openrouter.js`):
- Base URL: `https://openrouter.ai/api/v1`
- Uses OpenAI-compatible chat completions API
- Sends `HTTP-Referer: https://orion-studio.local` and `X-Title: Orion Studio`

**Gemini** (`providers/gemini.js`):
- Base URL: `https://generativelanguage.googleapis.com/v1beta/openai`
- Uses Google's OpenAI-compatible endpoint

Both providers handle streaming tool-calls by incrementally building tool call objects from delta chunks, emitting them when `finish_reason === 'tool_calls'` or `[DONE]` is received.

### 4.3 Tool Definitions

File: `packages/server/src/agent/tools/index.js`

| Tool | Key Args | Safety |
|---|---|---|
| `read_file` | `path` | Path resolved inside workspace |
| `write_file` | `path`, `content` | Path resolved inside workspace |
| `edit_file` | `path`, `target`, `replacement` | Exact string match required |
| `list_directory` | `path?` | — |
| `search_files` | `query`, `path?`, `regex?` | `grep` with `--exclude-dir=node_modules` |
| `run_command` | `command`, `timeout?` | BLOCKED_PATTERNS check |
| `get_diagnostics` | `path?` | Runs `tsc --noEmit` |

`run_command` uses `spawn('bash', ['-c', command], { cwd: workspacePath })` with a configurable timeout (default 30s).

**BLOCKED_PATTERNS:**
```js
/^sudo\s+rm/i
/rm\s+(-rf|-fr)\s+\//
/mkfs\b/
/dd\s+if=/
/shutdown/i
/reboot/i
/:(){ :\|:& };:/      // fork bomb
/>\s*\/dev\/sd/
/chmod\s+777\s+\//
```

### 4.4 System Prompt

File: `packages/server/src/agent/context/systemPrompt.js`

The system prompt includes:
- Role definition (expert AI coding assistant)
- Current workspace context (from `buildWorkspaceContext`):
  - Directory tree (top 2 levels)
  - Recently modified files
- Tool usage instructions
- Safety guidelines

`buildWorkspaceContext(workspaceId)` in `context/contextManager.js` reads the file tree and injects it as structured text into the system prompt.

---

## 5. Code Translation Engine

### 5.1 Upload & Classification

**Endpoint:** `POST /api/translate/upload`

**Middleware:** `express.raw({ type: '*/*', limit: '100mb' })` applied per-route (not globally, to avoid conflicting with `express.json()`).

**Request:**
```
Headers:
  Content-Type: application/octet-stream
  X-Source-Lang: java | python | javascript | cpp

Body: raw ZIP binary
```

**Server flow:**
```
1. Generate jobId (8-char UUID)
2. Write ZIP to tmpdir/orion-translate-{jobId}/upload.zip
3. execSync('unzip -o <zip> -d <extracted>')
4. Detect single top-level dir (GitHub-export strip)
5. walkDirectory(rootDir) → [{ fullPath, relPath, sizeBytes }]
6. classifyFile(relPath, sizeBytes, sourceLang) for each file
7. Store job in Map<jobId, job>
8. Schedule cleanup (1h TTL)
9. Return manifest JSON
```

**Classification rules (in priority order):**

| Check | Action |
|---|---|
| Extension in `BINARY_EXTENSIONS` | `copy` (reason: `binary`) |
| `sizeBytes > 81920` (80 KB) | `copy` (reason: `too_large`) |
| Basename in `BUILD_FILE_NAMES[sourceLang]` | `build_file` |
| Extension in `SOURCE_EXTENSIONS[sourceLang]` | `translate` |
| Anything else | `copy` (reason: `not_source`) |

**Response:**
```json
{
  "jobId": "a1b2c3d4",
  "totalFiles": 42,
  "toTranslate": 18,
  "toCopy": 24,
  "files": [
    { "path": "src/Main.java", "sizeBytes": 2048, "action": "translate" },
    { "path": "assets/logo.png", "sizeBytes": 8192, "action": "copy", "reason": "binary" }
  ]
}
```

### 5.2 SSE Translation Stream

**Endpoint:** `GET /api/translate/:jobId/stream?sourceLang=java&targetLang=python`

**Important:** Uses `EventSource` (GET), not a POST with body. The source language is stored in the job from the upload step; `sourceLang` in the query is used for validation only.

**Nginx consideration:** `proxy_buffering off` and `X-Accel-Buffering: no` response header ensure events are not held in any buffer.

**Per-file translation flow:**
```
For each file in job.files:
  1. emit file_start
  2. If action === 'copy':
       copyFile(src, dest)
       emit file_skipped
  3. If action === 'translate' | 'build_file':
       readFile(src)
       buildTranslationMessages(...)
       provider.chat(messages, [], { temperature: 0.15, maxTokens: 8192 })
       stripCodeFences(response.content)
       getOutputPath(relPath, sourceLang, targetLang, action)
       mkdir(dirname(dest), { recursive: true })
       writeFile(dest, translatedCode)
       emit file_done
  4. On any error: emit file_error (does not abort remaining files)
```

After all files:
```
detectEntryPoint(outputPaths, targetLang)
generateRunCommand(entryPoint, targetLang)
createWorkspace(workspaceId, name, 'orion-workspace', outputDir)
emit done
```

### 5.3 Translation Service Utilities

File: `packages/server/src/services/translationService.js`

**`buildTranslationMessages(sourceLang, targetLang, code, filePath, isBuildFile)`**

Returns a two-message array `[system, user]`.

Source code system prompt emphasis:
- Output ONLY code, no markdown fences
- Idiomatic patterns (not literal translation)
- Map stdlib to target equivalents
- Preserve all comments
- Include necessary imports only

Build file system prompt emphasis:
- Map dependencies to target ecosystem equivalents
- Generate minimal valid config
- Known output formats per target (requirements.txt, package.json, pom.xml, CMakeLists.txt)

**`stripCodeFences(content)`**

Handles three cases:
1. Full fence: ` ```lang\n...\n``` ` → extracts inner content
2. Partial fence (no closing): strips opening ` ```lang ` line
3. No fences: returns content unchanged

**`getOutputPath(relPath, sourceLang, targetLang, action)`**

Build file names (action === `'build_file'`):

| Source | Python | JavaScript | C++ | Java |
|---|---|---|---|---|
| `pom.xml` | `requirements.txt` | `package.json` | `CMakeLists.txt` | — |
| `build.gradle` | `requirements.txt` | `package.json` | `CMakeLists.txt` | — |
| `requirements.txt` | — | `package.json` | `CMakeLists.txt` | `pom.xml` |
| `package.json` | `requirements.txt` | — | `CMakeLists.txt` | `pom.xml` |
| `CMakeLists.txt` | `requirements.txt` | `package.json` | — | `pom.xml` |

Source extensions swapped for translation files (action === `'translate'`):

| Source ext | Python | JavaScript | C++ | Java |
|---|---|---|---|---|
| `.java` | `.py` | `.js` | `.cpp` | — |
| `.py` | — | `.js` | `.cpp` | `.java` |
| `.js` `.ts` `.jsx` `.tsx` | `.py` | — | `.cpp` | `.java` |
| `.cpp` `.c` `.h` `.hpp` | `.py` | `.js` | — | `.java` |

**`detectEntryPoint(outputPaths, targetLang)`**

Searches `outputPaths` for these candidates in order:

| Language | Candidates |
|---|---|
| Python | `main.py`, `app.py`, `run.py`, `src/main.py`, `src/app.py` |
| JavaScript | `index.js`, `main.js`, `app.js`, `src/index.js`, `src/main.js` |
| Java | `Main.java`, `App.java`, `Application.java`, `src/Main.java` |
| C++ | `main.cpp`, `Main.cpp`, `src/main.cpp` |

Falls back to the first file with the target extension.

**`generateRunCommand(entryPoint, targetLang)`**

| Language | Command |
|---|---|
| Python | `python3 "<entryPoint>"` |
| JavaScript | `node "<entryPoint>"` |
| Java | `javac $(find . -name "*.java" \| tr '\n' ' ') && java <ClassName>` |
| C++ | `g++ -o program -std=c++17 $(find . -name "*.cpp" \| tr '\n' ' ') && ./program` |

### 5.4 Run Stream

**Endpoint:** `GET /api/translate/:workspaceId/run-stream?lang=python`

The language is auto-detected from file extensions if not provided. Runs `bash -c <runCommand>` in the workspace directory with a 60-second kill timeout. `req.on('close')` sends `SIGTERM` on browser disconnect.

### 5.5 SSE Event Reference

**Translation stream events:**

| Event | Payload |
|---|---|
| `start` | `{ jobId, totalFiles, toTranslate, toCopy, sourceLang, targetLang }` |
| `file_start` | `{ path, index, total, action }` |
| `file_done` | `{ path, originalPath, action, index, total, durationMs }` |
| `file_skipped` | `{ path, action: 'copy', reason, index, total }` |
| `file_error` | `{ path, error, index, total }` |
| `done` | `{ workspaceId, entryPoint, runCommand, targetLang, totalDurationMs, translated, copied, errors }` |
| `error` | `{ error }` — fatal, stream ends |

**Run stream events:**

| Event | Payload |
|---|---|
| `start` | `{ command, workspaceId }` |
| `stdout` | `{ data: string }` |
| `stderr` | `{ data: string }` |
| `exit` | `{ code: number }` |
| `error` | `{ error: string }` |

---

## 6. Infrastructure

### 6.1 Docker Compose

```yaml
services:
  frontend:
    build: packages/client          # Multi-stage: npm build → nginx:alpine
    ports: ["8080:80", "8443:443"]
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro

  backend:
    build: packages/server          # node:20-alpine, runs src/index.js
    ports: ["3001:3001"]
    volumes:
      - ./workspaces:/app/workspaces
      - ./data:/app/data
      - /var/run/docker.sock:/var/run/docker.sock
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '1.0'
```

Both services share `orion-network` (bridge driver).

### 6.2 Nginx Configuration

File: `nginx/nginx.conf`

Critical settings:

```nginx
# SSE streaming: disable buffering
proxy_buffering off;
proxy_cache off;
proxy_read_timeout 300s;   # 5 min for long AI calls

# WebSocket upgrade
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_read_timeout 3600s;  # 1 hour for terminal sessions

# SPA fallback
location / {
  try_files $uri $uri/ /index.html;
}
```

### 6.3 Workspace Container Lifecycle

```
User opens terminal
        ↓
terminalHandler checks activeContainers Map
        ↓
    [hit] container running?  → YES → createTerminalSession
                                NO  → container.start() → session
        ↓
    [miss] createContainer()
            image = 'orion-workspace'
            fallback if not found = 'ubuntu:22.04'
            bind mount: WORKSPACES_HOST_PATH/<id> → /workspace
            cmd: ["tail", "-f", "/dev/null"]
                ↓
            createTerminalSession(container)
                ↓
            container.exec({ Cmd: ['/bin/bash'], Tty: true })
                ↓
            exec.start({ hijack: true, stdin: true })
                ↓
            return { exec, stream }
```

---

## 7. Authentication

### JWT Flow

```
1. POST /api/auth/login
   - getUserByUsername(username)
   - bcrypt.compare(password, user.password_hash)
   - jwt.sign({ id, username, role }, JWT_SECRET, { expiresIn: '7d' })
   - return { token, user }

2. Client stores token (localStorage or memory)

3. Protected request:
   Authorization: Bearer <token>

4. requireAuth middleware:
   jwt.verify(token, JWT_SECRET)
   → req.user = { id, username, role }
```

### Dev Mode

`process.env.DEV_MODE === 'true'` makes `requireAuth` a no-op. All routes behave as if authenticated as an admin.

---

## 8. Data Flow Diagrams

### AI Chat Request

```
User types message
    │
    ▼
AIChat.jsx
  fetch POST /api/ai/chat (SSE)
    │
    ▼
routes/ai.js
  AgentOrchestrator.run(message, history, workspaceId, onEvent)
    │
    ▼
  orchestrator.loadProviders()          ← reads keys from SQLite
  buildSystemPrompt(workspaceContext)   ← reads file tree
    │
    ▼
  LOOP (max 15 rounds):
    provider.streamChat(messages, tools)
      │ text_delta → onEvent → SSE → AIChat (appends to streamContent)
      │ tool_call  → onEvent → SSE → AIChat (shows tool badge)
      │
      └── executeTool(name, args)
            → onEvent (tool_result) → SSE
            → append tool message
    │
    ▼
  done → onEvent → SSE → AIChat (saves to messages store)
```

### Code Translation Request

```
User drops ZIP + selects languages + clicks "Start Translation"
    │
    ▼
TranslatePage.jsx
  fetch POST /api/translate/upload (raw body)
    │
    ▼
  routes/translate.js
    unzip → walk → classify → store job → return manifest
    │
    ▼
  Display file list (pending)
  EventSource GET /api/translate/:jobId/stream
    │
    ▼
  routes/translate.js (SSE handler)
    For each file:
      provider.chat(translationMessages)
      write to workspaces/<workspaceId>/
      → SSE events (file_start, file_done, file_skipped, file_error)
    createWorkspace() in SQLite
    → SSE 'done' event
    │
    ▼
  TranslatePage phase = 'done'
  User clicks "Open in IDE"
    workspaceStore.setWorkspace({ id: workspaceId, ... })
    navigate('/ide')
    │
    ▼
  App.jsx reads workspaceId from store
  useFileSystem(workspaceId) fetches file tree from /api/workspaces/:id/files
```

---

## 9. Adding a New Feature

### New API Route

1. Create `packages/server/src/routes/myfeature.js`
2. Export a `Router` default
3. Import and register in `packages/server/src/index.js`:
   ```js
   import myRouter from './routes/myfeature.js';
   app.use('/api', myRouter);
   ```

### New AI Tool

1. Add a tool definition to `toolDefinitions` array in `packages/server/src/agent/tools/index.js`
2. Add the implementation function
3. Register in `toolImplementations` map

### New Frontend Page

1. Create `packages/client/src/pages/MyPage.jsx` + `MyPage.css`
2. Add a route in `packages/client/src/main.jsx`:
   ```jsx
   <Route path="/my-page" element={<MyPage />} />
   ```
3. Link from `LandingPage.jsx` or the IDE sidebar

### New Zustand Store

1. Create `packages/client/src/store/myStore.js` using `create()` from Zustand
2. Import `useMyStore` in components that need it
3. Keep stores small and focused on a single domain

---

## 10. Troubleshooting

### Terminal shows "Docker not available"

The backend is falling back to a local shell. Check:
- `/var/run/docker.sock` is mounted in the backend container (`docker-compose.yml`)
- The Docker daemon is running on the host: `systemctl status docker`
- The backend container has permission to access the socket: the node process runs as the user owning the socket, or the socket has group `docker` permissions

### AI responses don't stream

- Check that Nginx has `proxy_buffering off` for `/api/` — it's already in `nginx/nginx.conf`
- Check the `X-Accel-Buffering: no` header is being set on SSE responses (it is, in `routes/ai.js`)
- Ensure the client is connecting to port 8080 (through Nginx), not 3001 directly

### Translation fails with "No AI provider configured"

1. Open the IDE: `http://localhost:8080/ide`
2. Open the AI sidebar (left rail → robot icon)
3. Click ⚙️ Settings
4. Enter your OpenRouter or Gemini API key
5. The key is stored in SQLite and will be used for all subsequent requests including translation

### ZIP extraction fails

- Confirm `unzip` is installed in the backend container. The `node:20-alpine` base image does not include it by default. Add to `packages/server/Dockerfile`:
  ```dockerfile
  RUN apk add --no-cache unzip
  ```
  Then rebuild: `docker compose build backend`

### `unzip` not available in development (local run)

Install on Ubuntu/Debian: `sudo apt install unzip`
Install on macOS: `brew install unzip` (or it's pre-installed)

### File tree not refreshing after external changes

- The file watcher uses `chokidar`. In Docker, inotify events may not propagate across bind mounts on some configurations.
- Workaround: click the refresh icon in the file explorer, or use the search panel to trigger a fresh listing.

### Port forwarding not working

- Check the container's internal port is actually listening: `docker exec -it <container_id> ss -tlnp`
- Verify the port was forwarded in `routes/ports.js` before trying to access it

### `better-sqlite3` build error

`better-sqlite3` uses a native Node.js addon. If you see build errors:
- Ensure `node_modules` was installed inside the Docker build context (it is — `npm ci` runs in the Dockerfile)
- Do not copy a host `node_modules` into the container; always `npm ci` inside Docker

---


