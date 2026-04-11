import { URL } from 'url';
import dockerService from '../services/dockerService.js';

// Active terminal sessions: ws → { exec, stream, container }
const sessions = new Map();

/**
 * Handle WebSocket connections for terminal sessions.
 * Each WebSocket connection gets its own Docker exec session.
 */
export default function setupTerminalHandler(wss) {
  wss.on('connection', async (ws, request) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    
    // Only handle terminal connections
    if (!url.pathname.startsWith('/ws/terminal')) return;

    const workspaceId = url.searchParams.get('workspaceId') || 'local';
    console.log(`[Terminal] New connection for workspace: ${workspaceId}`);

    let session = null;

    try {
      // Check if Docker is available
      const dockerAvailable = await dockerService.isAvailable();
      
      if (!dockerAvailable) {
        // Fallback: run local shell if Docker is not available
        console.log('[Terminal] Docker not available, falling back to local shell');
        await setupLocalShell(ws, workspaceId);
        return;
      }

      // Get or create container
      const container = await dockerService.getOrCreateContainer(workspaceId);

      // Create interactive terminal session  
      session = await dockerService.createTerminalSession(container);
      sessions.set(ws, { ...session, container });

      // Pipe Docker exec output → WebSocket
      session.stream.on('data', (chunk) => {
        if (ws.readyState === 1) { // WebSocket.OPEN
          ws.send(chunk.toString());
        }
      });

      session.stream.on('end', () => {
        console.log(`[Terminal] Stream ended for workspace: ${workspaceId}`);
        if (ws.readyState === 1) {
          ws.send('\r\n\x1b[31mTerminal session ended.\x1b[0m\r\n');
        }
        ws.close();
      });

      // Handle WebSocket messages (user input + resize)
      ws.on('message', async (data) => {
        try {
          const msg = JSON.parse(data.toString());

          if (msg.type === 'input' && session?.stream?.writable) {
            session.stream.write(msg.data);
          }

          if (msg.type === 'resize' && session?.exec) {
            await dockerService.resizeTerminal(session.exec, msg.cols, msg.rows);
          }
        } catch (err) {
          // If JSON parse fails, treat as raw input
          if (session?.stream?.writable) {
            session.stream.write(data.toString());
          }
        }
      });

    } catch (err) {
      console.error(`[Terminal] Failed to setup:`, err.message);
      if (ws.readyState === 1) {
        ws.send(`\x1b[31mFailed to start terminal: ${err.message}\x1b[0m\r\n`);
        ws.send(`\x1b[33mFalling back to local shell...\x1b[0m\r\n`);
      }
      // Fallback to local shell
      await setupLocalShell(ws, workspaceId);
      return;
    }

    // Cleanup on disconnect
    ws.on('close', () => {
      console.log(`[Terminal] Connection closed for workspace: ${workspaceId}`);
      const s = sessions.get(ws);
      if (s?.stream) {
        try { s.stream.end(); } catch {}
      }
      sessions.delete(ws);
    });

    ws.on('error', (err) => {
      console.error(`[Terminal] WebSocket error:`, err.message);
    });
  });
}

/**
 * Fallback: Run a local shell process (no Docker required)
 * This allows the terminal to work even without Docker installed.
 */
async function setupLocalShell(ws, workspaceId) {
  const { spawn } = await import('child_process');
  const { join } = await import('path');
  const config = (await import('../config/index.js')).default;

  const workspacePath = join(config.workspacesDir, workspaceId === 'local' ? 'default' : workspaceId);

  const shell = spawn('bash', [], {
    cwd: workspacePath,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      HOME: process.env.HOME,
      PATH: process.env.PATH,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // Pipe shell output → WebSocket
  shell.stdout.on('data', (data) => {
    if (ws.readyState === 1) ws.send(data.toString());
  });
  shell.stderr.on('data', (data) => {
    if (ws.readyState === 1) ws.send(data.toString());
  });

  shell.on('exit', (code) => {
    if (ws.readyState === 1) {
      ws.send(`\r\n\x1b[33mShell exited with code ${code}\x1b[0m\r\n`);
    }
    ws.close();
  });

  // Handle WebSocket messages
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'input') {
        shell.stdin.write(msg.data);
      }
      // resize is not supported for child_process easily
    } catch {
      shell.stdin.write(data.toString());
    }
  });

  ws.on('close', () => {
    shell.kill('SIGTERM');
  });

  ws.on('error', () => {
    shell.kill('SIGTERM');
  });
}
