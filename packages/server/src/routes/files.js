import { Router } from 'express';
import FileService from '../services/fileService.js';
import config from '../config/index.js';
import { join } from 'path';

const router = Router();

/**
 * Get or create a FileService for a given workspace.
 * For Phase 1 (local mode), all workspaces map to the same directory.
 */
function getFileService(workspaceId) {
  // For local development, use a single workspace directory
  const workspacePath = join(config.workspacesDir, workspaceId === 'local' ? 'default' : workspaceId);
  return new FileService(workspacePath);
}

/**
 * Extract the wildcard path param from req.params.
 * Express 5 stores wildcard as req.params[0] or as an array.
 */
function getWildcardPath(req) {
  // Express 5 wildcard is in req.params.path which can be string or array
  const p = req.params.path;
  if (Array.isArray(p)) return p.join('/');
  return p || '';
}

/**
 * GET /api/workspaces/:id/files
 * List directory tree
 */
router.get('/workspaces/:id/files', async (req, res, next) => {
  try {
    const fs = getFileService(req.params.id);
    const tree = await fs.getFileTree();
    res.json(tree);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/workspaces/:id/file/*path
 * Read a file's content
 */
router.get('/workspaces/:id/file/{*path}', async (req, res, next) => {
  try {
    const fs = getFileService(req.params.id);
    const filePath = getWildcardPath(req);
    const result = await fs.readFile(filePath);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/workspaces/:id/file/*path
 * Create a file or directory
 */
router.post('/workspaces/:id/file/{*path}', async (req, res, next) => {
  try {
    const fs = getFileService(req.params.id);
    const filePath = getWildcardPath(req);
    const { content = '', isDirectory = false } = req.body;

    if (isDirectory) {
      const result = await fs.createDirectory(filePath);
      res.status(201).json(result);
    } else {
      const result = await fs.writeFile(filePath, content);
      res.status(201).json(result);
    }
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/workspaces/:id/file/*path
 * Update file content (save)
 */
router.put('/workspaces/:id/file/{*path}', async (req, res, next) => {
  try {
    const fs = getFileService(req.params.id);
    const filePath = getWildcardPath(req);
    const { content } = req.body;
    const result = await fs.writeFile(filePath, content);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/workspaces/:id/file/*path
 * Delete a file or directory
 */
router.delete('/workspaces/:id/file/{*path}', async (req, res, next) => {
  try {
    const fs = getFileService(req.params.id);
    const filePath = getWildcardPath(req);
    const result = await fs.delete(filePath);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/workspaces/:id/file/{*path}
 * Rename/move a file or directory
 */
router.patch('/workspaces/:id/file/{*path}', async (req, res, next) => {
  try {
    const fs = getFileService(req.params.id);
    const filePath = getWildcardPath(req);
    const { newPath } = req.body;
    
    if (!newPath) {
      return res.status(400).json({ error: 'newPath is required' });
    }
    
    const result = await fs.rename(filePath, newPath);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
