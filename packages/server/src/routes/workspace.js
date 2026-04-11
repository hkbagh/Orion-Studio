import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';
import config from '../config/index.js';
import dockerService from '../services/dockerService.js';
import {
  createWorkspace,
  getWorkspaceById,
  listWorkspaces,
  updateWorkspaceStatus,
  deleteWorkspace,
  touchWorkspace,
} from '../db/database.js';

const router = Router();

/**
 * GET /api/workspaces
 * List all workspaces
 */
router.get('/workspaces', (req, res, next) => {
  try {
    // Ensure default workspace exists
    ensureDefaultWorkspace();
    const workspaces = listWorkspaces();
    res.json(workspaces);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/workspaces
 * Create a new workspace
 */
router.post('/workspaces', async (req, res, next) => {
  try {
    const { name, image = 'orion-workspace' } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const id = uuidv4().substring(0, 8);
    const workspacePath = join(config.workspacesDir, id);

    // Create workspace directory
    if (!existsSync(workspacePath)) {
      mkdirSync(workspacePath, { recursive: true });
    }

    // Save to database
    const workspace = createWorkspace(id, name, image, workspacePath);
    res.status(201).json(workspace);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/workspaces/:id
 * Get workspace details + status
 */
router.get('/workspaces/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Handle the special 'local' workspace
    if (id === 'local') {
      ensureDefaultWorkspace();
    }

    const workspace = getWorkspaceById(id === 'local' ? 'default' : id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Get live Docker status
    const dockerStatus = await dockerService.getStatus(workspace.id);
    workspace.dockerStatus = dockerStatus.status;

    touchWorkspace(workspace.id);
    res.json(workspace);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/workspaces/:id
 * Delete a workspace (stops container, removes DB entry)
 */
router.delete('/workspaces/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Don't allow deleting the default workspace
    if (id === 'local' || id === 'default') {
      return res.status(400).json({ error: 'Cannot delete the default workspace' });
    }

    // Stop and remove container
    await dockerService.removeContainer(id);

    // Delete from DB
    deleteWorkspace(id);

    res.json({ deleted: true, id });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/workspaces/:id/start
 * Start workspace container
 */
router.post('/workspaces/:id/start', async (req, res, next) => {
  try {
    const { id } = req.params;
    const workspace = getWorkspaceById(id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const container = await dockerService.getOrCreateContainer(id);
    const inspect = await container.inspect();
    updateWorkspaceStatus(id, 'running', inspect.Id);

    res.json({ status: 'running', containerId: inspect.Id });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/workspaces/:id/stop
 * Stop workspace container
 */
router.post('/workspaces/:id/stop', async (req, res, next) => {
  try {
    const { id } = req.params;
    await dockerService.stopContainer(id);
    updateWorkspaceStatus(id, 'stopped', null);
    res.json({ status: 'stopped' });
  } catch (err) {
    next(err);
  }
});

/**
 * Ensure the default workspace exists in the DB
 */
function ensureDefaultWorkspace() {
  const existing = getWorkspaceById('default');
  if (!existing) {
    const defaultPath = join(config.workspacesDir, 'default');
    if (!existsSync(defaultPath)) {
      mkdirSync(defaultPath, { recursive: true });
    }
    createWorkspace('default', 'Local Workspace', 'orion-workspace', defaultPath);
  }
}

export default router;
