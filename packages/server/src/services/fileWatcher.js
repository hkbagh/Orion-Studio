import { watch } from 'chokidar';
import { join, relative } from 'path';
import config from '../config/index.js';

/**
 * File Watcher Service — watches workspace for file changes
 * and pushes notifications over WebSocket to keep the IDE in sync.
 */
export default class FileWatcher {
  constructor() {
    this.watchers = new Map(); // workspaceId → watcher instance
    this.subscribers = new Map(); // workspaceId → Set<ws>
  }

  /**
   * Start watching a workspace directory
   */
  watch(workspaceId) {
    if (this.watchers.has(workspaceId)) return;

    const workspacePath = join(
      config.workspacesDir,
      workspaceId === 'local' ? 'default' : workspaceId
    );

    const watcher = watch(workspacePath, {
      ignored: [
        /(^|[\/\\])\../, // hidden files
        '**/node_modules/**',
        '**/__pycache__/**',
        '**/dist/**',
        '**/build/**',
        '**/.git/**',
      ],
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100,
      },
    });

    watcher.on('add', (filePath) => {
      this._notify(workspaceId, {
        type: 'file_added',
        path: relative(workspacePath, filePath),
        timestamp: Date.now(),
      });
    });

    watcher.on('change', (filePath) => {
      this._notify(workspaceId, {
        type: 'file_changed',
        path: relative(workspacePath, filePath),
        timestamp: Date.now(),
      });
    });

    watcher.on('unlink', (filePath) => {
      this._notify(workspaceId, {
        type: 'file_deleted',
        path: relative(workspacePath, filePath),
        timestamp: Date.now(),
      });
    });

    watcher.on('addDir', (dirPath) => {
      this._notify(workspaceId, {
        type: 'dir_added',
        path: relative(workspacePath, dirPath),
        timestamp: Date.now(),
      });
    });

    watcher.on('unlinkDir', (dirPath) => {
      this._notify(workspaceId, {
        type: 'dir_deleted',
        path: relative(workspacePath, dirPath),
        timestamp: Date.now(),
      });
    });

    this.watchers.set(workspaceId, watcher);
    console.log(`[FileWatcher] Watching workspace: ${workspaceId}`);
  }

  /**
   * Subscribe a WebSocket to file change events
   */
  subscribe(workspaceId, ws) {
    if (!this.subscribers.has(workspaceId)) {
      this.subscribers.set(workspaceId, new Set());
    }
    this.subscribers.get(workspaceId).add(ws);

    // Start watching if not already
    this.watch(workspaceId);

    // Cleanup on disconnect
    ws.on('close', () => {
      this.unsubscribe(workspaceId, ws);
    });
  }

  /**
   * Unsubscribe a WebSocket
   */
  unsubscribe(workspaceId, ws) {
    const subs = this.subscribers.get(workspaceId);
    if (subs) {
      subs.delete(ws);
      // If no more subscribers, stop watching
      if (subs.size === 0) {
        this.unwatch(workspaceId);
      }
    }
  }

  /**
   * Stop watching a workspace
   */
  async unwatch(workspaceId) {
    const watcher = this.watchers.get(workspaceId);
    if (watcher) {
      await watcher.close();
      this.watchers.delete(workspaceId);
      this.subscribers.delete(workspaceId);
      console.log(`[FileWatcher] Stopped watching: ${workspaceId}`);
    }
  }

  /**
   * Notify all subscribers of a file event
   */
  _notify(workspaceId, event) {
    const subs = this.subscribers.get(workspaceId);
    if (!subs) return;

    const message = JSON.stringify({ type: 'fileWatch', ...event });
    for (const ws of subs) {
      if (ws.readyState === 1) { // WebSocket.OPEN
        ws.send(message);
      }
    }
  }

  /**
   * Stop all watchers
   */
  async cleanup() {
    for (const [id, watcher] of this.watchers) {
      await watcher.close();
    }
    this.watchers.clear();
    this.subscribers.clear();
    console.log('[FileWatcher] All watchers stopped');
  }
}
