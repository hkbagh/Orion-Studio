import { Router } from 'express';
import { execSync } from 'child_process';
import { join } from 'path';
import config from '../config/index.js';

const router = Router();

/**
 * POST /api/workspaces/:id/search
 * Search across files in a workspace
 */
router.post('/workspaces/:id/search', (req, res, next) => {
  try {
    const workspaceId = req.params.id;
    const { query, path = '.', regex = false, caseSensitive = false, maxResults = 50 } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'query is required' });
    }

    const workspacePath = join(
      config.workspacesDir,
      workspaceId === 'local' ? 'default' : workspaceId
    );
    const searchDir = join(workspacePath, path);

    // Build grep command
    const flags = [
      '-rn',                              // recursive + line numbers
      regex ? '' : '-F',                   // fixed string or regex
      caseSensitive ? '' : '-i',           // case sensitivity
      '--include="*"',                     // all files
      '--exclude-dir=node_modules',
      '--exclude-dir=.git',
      '--exclude-dir=dist',
      '--exclude-dir=build',
      '--exclude-dir=__pycache__',
      `--color=never`,
    ].filter(Boolean).join(' ');

    const escapedQuery = query.replace(/"/g, '\\"');
    const cmd = `grep ${flags} "${escapedQuery}" "${searchDir}" 2>/dev/null | head -${maxResults * 3}`;

    let output = '';
    try {
      output = execSync(cmd, { encoding: 'utf-8', timeout: 10000 }).trim();
    } catch (err) {
      // grep returns exit code 1 if no matches
      if (err.status === 1) {
        return res.json({ results: [], total: 0, query });
      }
      output = err.stdout?.trim() || '';
    }

    if (!output) {
      return res.json({ results: [], total: 0, query });
    }

    // Parse grep output into structured results
    const lines = output.split('\n');
    const fileResults = {};

    for (const line of lines) {
      // Format: /full/path/file.js:linenum:content
      const firstColon = line.indexOf(':');
      if (firstColon === -1) continue;

      const filePath = line.substring(0, firstColon);
      const rest = line.substring(firstColon + 1);
      const secondColon = rest.indexOf(':');
      if (secondColon === -1) continue;

      const lineNum = parseInt(rest.substring(0, secondColon));
      const content = rest.substring(secondColon + 1);

      const relPath = filePath.replace(workspacePath + '/', '');

      if (!fileResults[relPath]) {
        fileResults[relPath] = { file: relPath, matches: [] };
      }

      if (fileResults[relPath].matches.length < 5) { // Max 5 matches per file
        fileResults[relPath].matches.push({
          line: lineNum,
          content: content.trim().substring(0, 200),
        });
      }
    }

    const results = Object.values(fileResults).slice(0, maxResults);
    const total = Object.keys(fileResults).length;

    res.json({ results, total, query });
  } catch (err) {
    next(err);
  }
});

export default router;
