import { readFile, writeFile, mkdir, rm, rename, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname, relative, basename, extname } from 'path';
import { readdir } from 'fs/promises';

/**
 * FileService — handles all file system operations within a workspace directory.
 * All paths are sandboxed within the workspace root to prevent directory traversal.
 */
export default class FileService {
  constructor(workspaceRoot) {
    this.root = workspaceRoot;
  }

  /**
   * Resolve a relative path and ensure it stays within the workspace root.
   */
  resolvePath(relativePath) {
    // Decode if URL-encoded
    const decoded = decodeURIComponent(relativePath || '');
    // Remove leading slashes
    const clean = decoded.replace(/^\/+/, '');
    const full = join(this.root, clean);
    
    // Security: prevent directory traversal
    if (!full.startsWith(this.root)) {
      const err = new Error('Path traversal detected');
      err.status = 403;
      throw err;
    }
    
    return full;
  }

  /**
   * Build a recursive file tree from the workspace root
   */
  async getFileTree(dirPath = this.root, relativeTo = this.root) {
    const entries = await readdir(dirPath, { withFileTypes: true });
    const children = [];

    for (const entry of entries) {
      // Skip hidden files/dirs and node_modules
      if (entry.name.startsWith('.') && entry.name !== '.env') continue;
      if (entry.name === 'node_modules') continue;
      if (entry.name === '__pycache__') continue;

      const fullPath = join(dirPath, entry.name);
      const relPath = relative(relativeTo, fullPath);

      if (entry.isDirectory()) {
        const subChildren = await this.getFileTree(fullPath, relativeTo);
        children.push({
          name: entry.name,
          path: relPath,
          type: 'directory',
          children: subChildren.children || [],
        });
      } else {
        const fileStat = await stat(fullPath);
        children.push({
          name: entry.name,
          path: relPath,
          type: 'file',
          size: fileStat.size,
          extension: extname(entry.name),
        });
      }
    }

    return {
      name: basename(dirPath),
      path: relative(relativeTo, dirPath) || '.',
      type: 'directory',
      children,
    };
  }

  /**
   * Read file content
   */
  async readFile(relativePath) {
    const fullPath = this.resolvePath(relativePath);
    const content = await readFile(fullPath, 'utf-8');
    const fileStat = await stat(fullPath);
    
    return {
      content,
      path: relativePath,
      name: basename(fullPath),
      size: fileStat.size,
      lastModified: fileStat.mtime.toISOString(),
    };
  }

  /**
   * Write/create a file
   */
  async writeFile(relativePath, content = '') {
    const fullPath = this.resolvePath(relativePath);
    
    // Ensure parent directories exist
    const dir = dirname(fullPath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    
    await writeFile(fullPath, content, 'utf-8');
    
    return {
      path: relativePath,
      name: basename(fullPath),
      created: !existsSync(fullPath),
    };
  }

  /**
   * Create a directory
   */
  async createDirectory(relativePath) {
    const fullPath = this.resolvePath(relativePath);
    await mkdir(fullPath, { recursive: true });
    
    return {
      path: relativePath,
      name: basename(fullPath),
      type: 'directory',
    };
  }

  /**
   * Delete a file or directory
   */
  async delete(relativePath) {
    const fullPath = this.resolvePath(relativePath);
    const fileStat = await stat(fullPath);
    
    await rm(fullPath, { recursive: fileStat.isDirectory(), force: true });
    
    return { path: relativePath, deleted: true };
  }

  /**
   * Rename/move a file or directory
   */
  async rename(oldRelativePath, newRelativePath) {
    const oldFull = this.resolvePath(oldRelativePath);
    const newFull = this.resolvePath(newRelativePath);
    
    // Ensure new parent directory exists
    const newDir = dirname(newFull);
    if (!existsSync(newDir)) {
      await mkdir(newDir, { recursive: true });
    }
    
    await rename(oldFull, newFull);
    
    return {
      oldPath: oldRelativePath,
      newPath: newRelativePath,
    };
  }

  /**
   * Check if a path exists
   */
  exists(relativePath) {
    const fullPath = this.resolvePath(relativePath);
    return existsSync(fullPath);
  }
}
