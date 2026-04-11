import { Router } from 'express';
import dockerService from '../services/dockerService.js';

const router = Router();

// Active port forwards: Map<token, { containerId, port, targetUrl }>
const activeForwards = new Map();

/**
 * GET /api/workspaces/:id/ports
 * List exposed ports from the workspace container
 */
router.get('/workspaces/:id/ports', async (req, res, next) => {
  try {
    const workspaceId = req.params.id;
    const status = await dockerService.getStatus(workspaceId);

    if (status.status !== 'running') {
      return res.json({ ports: [] });
    }

    const container = await dockerService.docker.getContainer(status.containerId);
    const inspect = await container.inspect();

    // Get exposed ports and their mappings
    const ports = [];
    const portBindings = inspect.HostConfig?.PortBindings || {};
    const exposedPorts = inspect.Config?.ExposedPorts || {};

    for (const [containerPort, bindings] of Object.entries(portBindings)) {
      const port = parseInt(containerPort);
      const hostPort = bindings?.[0]?.HostPort;
      ports.push({
        container: port,
        host: hostPort ? parseInt(hostPort) : null,
        protocol: containerPort.includes('/udp') ? 'udp' : 'tcp',
      });
    }

    // Check for commonly used ports by scanning inside the container
    const commonPorts = [3000, 3001, 5000, 5173, 8000, 8080, 8888];
    for (const port of commonPorts) {
      try {
        const result = await dockerService.exec(container, `ss -tlnp | grep :${port}`, { tty: true });
        if (result.stdout?.trim()) {
          ports.push({
            container: port,
            host: null,
            protocol: 'tcp',
            detected: true,
          });
        }
      } catch {}
    }

    res.json({ ports });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/workspaces/:id/ports/:port/forward
 * Start forwarding a port — creates a proxy to the container
 */
router.post('/workspaces/:id/ports/:port/forward', async (req, res, next) => {
  try {
    const { id: workspaceId } = req.params;
    const containerPort = parseInt(req.params.port);
    const status = await dockerService.getStatus(workspaceId);

    if (status.status !== 'running') {
      return res.status(400).json({ error: 'Container is not running' });
    }

    const container = await dockerService.docker.getContainer(status.containerId);
    const inspect = await container.inspect();

    // Get the container's IP on the Docker bridge network
    const networks = inspect.NetworkSettings?.Networks || {};
    let containerIp = null;
    for (const net of Object.values(networks)) {
      if (net.IPAddress) {
        containerIp = net.IPAddress;
        break;
      }
    }

    if (!containerIp) {
      return res.status(500).json({ error: 'Cannot determine container IP' });
    }

    const targetUrl = `http://${containerIp}:${containerPort}`;
    const token = `${workspaceId}-${containerPort}`;

    activeForwards.set(token, { containerId: status.containerId, port: containerPort, targetUrl });

    res.json({
      forwarded: true,
      url: `/proxy/${token}/`,
      port: containerPort,
      target: targetUrl,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/workspaces/:id/ports/:port/forward
 * Stop forwarding a port
 */
router.delete('/workspaces/:id/ports/:port/forward', (req, res) => {
  const { id: workspaceId } = req.params;
  const token = `${workspaceId}-${req.params.port}`;
  activeForwards.delete(token);
  res.json({ forwarded: false });
});

/**
 * Export the proxy handler for use in the main server.
 * Handles /proxy/:token/* requests by forwarding to the container.
 */
export function proxyHandler(req, res, next) {
  // Extract token from URL: /proxy/workspace-port/rest-of-path
  const match = req.url.match(/^\/proxy\/([^\/]+)(\/.*)?$/);
  if (!match) return next();

  const token = match[1];
  const forward = activeForwards.get(token);

  if (!forward) {
    return res.status(404).json({ error: 'Port forward not found' });
  }

  // Simple proxy using fetch
  const targetPath = match[2] || '/';
  const targetUrl = `${forward.targetUrl}${targetPath}`;

  fetch(targetUrl, {
    method: req.method,
    headers: {
      ...req.headers,
      host: new URL(forward.targetUrl).host,
    },
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : req,
  })
    .then(async (proxyRes) => {
      res.status(proxyRes.status);
      for (const [key, value] of proxyRes.headers.entries()) {
        if (!['transfer-encoding', 'content-encoding'].includes(key.toLowerCase())) {
          res.setHeader(key, value);
        }
      }
      const body = await proxyRes.arrayBuffer();
      res.send(Buffer.from(body));
    })
    .catch((err) => {
      res.status(502).json({ error: `Proxy error: ${err.message}` });
    });
}

export default router;
