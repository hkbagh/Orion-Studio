import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import config from './config/index.js';
import errorHandler from './middleware/errorHandler.js';
import filesRouter from './routes/files.js';
import workspaceRouter from './routes/workspace.js';
import aiRouter from './routes/ai.js';
import searchRouter from './routes/search.js';
import authRouter from './routes/auth.js';
import portsRouter, { proxyHandler } from './routes/ports.js';
import translateRouter from './routes/translate.js';
import collaborationRouter from './routes/collaboration.js';
import setupTerminalHandler from './ws/terminalHandler.js';
import setupCollaborationHandler from './ws/collaborationHandler.js';
import dockerService from './services/dockerService.js';
import FileWatcher from './services/fileWatcher.js';
import { getDatabase } from './db/database.js';

const app = express();
const server = createServer(app);

// ── Middleware ──
app.use(cors({
  origin: config.corsOrigins,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// ── Health Check ──
app.get('/api/health', async (req, res) => {
  const dockerAvailable = await dockerService.isAvailable();
  res.json({
    status: 'ok',
    service: 'orion-studio',
    docker: dockerAvailable ? 'connected' : 'unavailable',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ── Routes ──
app.use('/api', filesRouter);
app.use('/api', workspaceRouter);
app.use('/api', aiRouter);
app.use('/api', searchRouter);
app.use('/api', authRouter);
app.use('/api', portsRouter);
app.use('/api', translateRouter);
app.use('/api', collaborationRouter);
app.use(proxyHandler);

// ── Initialize Database ──
getDatabase();

// ── WebSocket Server ──
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  
  if (url.pathname.startsWith('/ws')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Setup terminal WebSocket handler
setupTerminalHandler(wss);
setupCollaborationHandler(wss);

// Setup file watcher
const fileWatcher = new FileWatcher();

// Handle file watcher WebSocket subscriptions
wss.on('connection', (ws, request) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname === '/ws/watch') {
    const workspaceId = url.searchParams.get('workspaceId') || 'local';
    fileWatcher.subscribe(workspaceId, ws);
  }
});

// ── Error Handler (must be last) ──
app.use(errorHandler);

// ── Start Server ──
server.listen(config.port, config.host, async () => {
  const dockerAvailable = await dockerService.isAvailable();
  console.log('');
  console.log('  ✦ Orion Studio Server');
  console.log(`  ├─ HTTP:    http://localhost:${config.port}`);
  console.log(`  ├─ WS:      ws://localhost:${config.port}/ws`);
  console.log(`  ├─ Files:   ${config.workspacesDir}`);
  console.log(`  ├─ Docker:  ${dockerAvailable ? '✅ Connected' : '⚠️  Not available (using local shell fallback)'}`);
  console.log(`  └─ Env:     ${config.nodeEnv}`);
  console.log('');
});

// ── Graceful Shutdown ──
process.on('SIGTERM', async () => {
  console.log('[Server] Shutting down...');
  await dockerService.cleanup();
  server.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Server] Shutting down...');
  await dockerService.cleanup();
  server.close();
  process.exit(0);
});

export default server;
