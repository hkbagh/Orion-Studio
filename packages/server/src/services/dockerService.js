import Docker from 'dockerode';
import config from '../config/index.js';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// Active containers cache: workspaceId → containerInfo
const activeContainers = new Map();

/**
 * Docker Service — manages workspace container lifecycle
 */
const dockerService = {
  docker,

  /**
   * Get or create a container for a workspace
   */
  async getOrCreateContainer(workspaceId) {
    // Check cache first
    if (activeContainers.has(workspaceId)) {
      const info = activeContainers.get(workspaceId);
      try {
        const container = docker.getContainer(info.containerId);
        const inspect = await container.inspect();
        if (inspect.State.Running) {
          return container;
        }
        // Container exists but stopped — start it
        await container.start();
        return container;
      } catch (err) {
        // Container was removed, clear cache
        activeContainers.delete(workspaceId);
      }
    }

    // Create a new container
    return await this.createContainer(workspaceId);
  },

  /**
   * Create a new workspace container
   */
  async createContainer(workspaceId, imageTag = 'orion-workspace') {
    const workspaceIdStr = workspaceId === 'local' ? 'default' : workspaceId;
    const workspacePath = `${config.workspacesHostPath}/${workspaceIdStr}`;
    
    // Check if image exists, if not use ubuntu:22.04
    let image = imageTag;
    try {
      await docker.getImage(imageTag).inspect();
    } catch {
      image = 'ubuntu:22.04';
      // Try to pull if not available
      try {
        await docker.getImage(image).inspect();
      } catch {
        console.log(`[Docker] Pulling image: ${image}...`);
        await new Promise((resolve, reject) => {
          docker.pull(image, (err, stream) => {
            if (err) return reject(err);
            docker.modem.followProgress(stream, (err) => {
              if (err) return reject(err);
              resolve();
            });
          });
        });
      }
    }

    const container = await docker.createContainer({
      Image: image,
      name: `orion-${workspaceId}-${Date.now()}`,
      Cmd: ['/bin/bash'],
      Tty: true,
      OpenStdin: true,
      StdinOnce: false,
      WorkingDir: '/workspace',
      HostConfig: {
        Binds: [`${workspacePath}:/workspace`],
        Memory: 512 * 1024 * 1024, // 512MB
        NanoCpus: 500000000,        // 0.5 CPU
        AutoRemove: false,
      },
      Labels: {
        'orion.workspace': workspaceId,
        'orion.managed': 'true',
      },
    });

    await container.start();
    
    const inspect = await container.inspect();
    activeContainers.set(workspaceId, {
      containerId: inspect.Id,
      name: inspect.Name,
      startedAt: new Date(),
    });

    console.log(`[Docker] Container started: ${inspect.Id.substring(0, 12)} for workspace: ${workspaceId}`);
    return container;
  },

  /**
   * Execute a command inside a container
   */
  async exec(container, cmd, options = {}) {
    const exec = await container.exec({
      Cmd: Array.isArray(cmd) ? cmd : ['bash', '-c', cmd],
      AttachStdout: true,
      AttachStderr: true,
      AttachStdin: options.interactive || false,
      Tty: options.tty || false,
    });

    const stream = await exec.start({
      hijack: options.interactive || false,
      stdin: options.interactive || false,
      Tty: options.tty || false,
    });

    if (options.interactive) {
      return { exec, stream };
    }

    // Collect output for non-interactive commands
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      if (options.tty) {
        // TTY mode: stream is raw
        stream.on('data', (chunk) => { stdout += chunk.toString(); });
      } else {
        // Non-TTY: Docker multiplexes stdout/stderr with 8-byte headers
        docker.modem.demuxStream(stream, 
          { write: (chunk) => { stdout += chunk.toString(); } },
          { write: (chunk) => { stderr += chunk.toString(); } }
        );
      }

      stream.on('end', async () => {
        const inspect = await exec.inspect();
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: inspect.ExitCode,
        });
      });

      stream.on('error', reject);
    });
  },

  /**
   * Create an interactive exec session (for terminal)
   */
  async createTerminalSession(container, cols = 80, rows = 24) {
    const exec = await container.exec({
      Cmd: ['/bin/bash'],
      AttachStdout: true,
      AttachStderr: true,
      AttachStdin: true,
      Tty: true,
      Env: [
        'TERM=xterm-256color',
        `COLUMNS=${cols}`,
        `LINES=${rows}`,
      ],
    });

    const stream = await exec.start({
      hijack: true,
      stdin: true,
      Tty: true,
    });

    return { exec, stream };
  },

  /**
   * Resize a terminal session
   */
  async resizeTerminal(exec, cols, rows) {
    try {
      await exec.resize({ h: rows, w: cols });
    } catch (err) {
      // Ignore resize errors (terminal might have exited)
    }
  },

  /**
   * Stop a workspace container
   */
  async stopContainer(workspaceId) {
    const info = activeContainers.get(workspaceId);
    if (!info) return;

    try {
      const container = docker.getContainer(info.containerId);
      await container.stop({ t: 5 });
      console.log(`[Docker] Container stopped: ${info.containerId.substring(0, 12)}`);
    } catch (err) {
      console.error(`[Docker] Failed to stop container:`, err.message);
    } finally {
      activeContainers.delete(workspaceId);
    }
  },

  /**
   * Remove a workspace container
   */
  async removeContainer(workspaceId) {
    const info = activeContainers.get(workspaceId);
    if (!info) return;

    try {
      const container = docker.getContainer(info.containerId);
      await container.stop({ t: 2 }).catch(() => {});
      await container.remove({ force: true });
      console.log(`[Docker] Container removed: ${info.containerId.substring(0, 12)}`);
    } catch (err) {
      console.error(`[Docker] Failed to remove container:`, err.message);
    } finally {
      activeContainers.delete(workspaceId);
    }
  },

  /**
   * Get status of a workspace container
   */
  async getStatus(workspaceId) {
    const info = activeContainers.get(workspaceId);
    if (!info) return { status: 'stopped' };

    try {
      const container = docker.getContainer(info.containerId);
      const inspect = await container.inspect();
      return {
        status: inspect.State.Running ? 'running' : 'stopped',
        containerId: info.containerId,
        startedAt: inspect.State.StartedAt,
      };
    } catch {
      activeContainers.delete(workspaceId);
      return { status: 'stopped' };
    }
  },

  /**
   * Check if Docker is available
   */
  async isAvailable() {
    try {
      await docker.ping();
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Clean up all Orion containers
   */
  async cleanup() {
    const containers = await docker.listContainers({
      all: true,
      filters: { label: ['orion.managed=true'] },
    });

    for (const c of containers) {
      try {
        const container = docker.getContainer(c.Id);
        await container.stop({ t: 2 }).catch(() => {});
        await container.remove({ force: true });
      } catch (err) {
        // Ignore cleanup errors
      }
    }

    activeContainers.clear();
    console.log(`[Docker] Cleaned up ${containers.length} containers`);
  },
};

export default dockerService;
