import FileService from '../../services/fileService.js';
import config from '../../config/index.js';
import { join } from 'path';
import { execSync, spawn } from 'child_process';

/**
 * Get FileService for a workspace
 */
function getFs(workspaceId) {
  const path = join(config.workspacesDir, workspaceId === 'local' ? 'default' : workspaceId);
  return new FileService(path);
}

// ── Blocked commands for safety ──
const BLOCKED_PATTERNS = [
  /^sudo\s+rm/i,
  /rm\s+(-rf|-fr)\s+\//,
  /mkfs\b/,
  /dd\s+if=/,
  /shutdown/i,
  /reboot/i,
  /:(){ :\|:& };:/,
  />\s*\/dev\/sd/,
  /chmod\s+777\s+\//,
];

// ── Tool Implementations ──

async function readFile({ path }, workspaceId) {
  const fs = getFs(workspaceId);
  const result = await fs.readFile(path);
  const lines = result.content.split('\n');
  return {
    content: result.content,
    path: result.path,
    lines: lines.length,
    size: result.size,
  };
}

async function writeFile({ path, content }, workspaceId) {
  const fs = getFs(workspaceId);
  await fs.writeFile(path, content);
  return { success: true, path, bytes: content.length };
}

async function editFile({ path, target, replacement }, workspaceId) {
  const fs = getFs(workspaceId);
  const file = await fs.readFile(path);

  if (!file.content.includes(target)) {
    return {
      success: false,
      error: `Target content not found in ${path}. The file may have changed.`,
      hint: 'Try reading the file again to get current content.',
    };
  }

  const newContent = file.content.replace(target, replacement);
  await fs.writeFile(path, newContent);

  return {
    success: true,
    path,
    linesChanged: replacement.split('\n').length,
  };
}

async function listDirectory({ path = '.' }, workspaceId) {
  const fs = getFs(workspaceId);
  const tree = await fs.getFileTree(
    fs.resolvePath(path),
    fs.resolvePath('.')
  );
  return formatTree(tree, 0);
}

function formatTree(node, depth) {
  let result = '';
  const indent = '  '.repeat(depth);
  const icon = node.type === 'directory' ? '📁' : '📄';
  result += `${indent}${icon} ${node.name}`;
  if (node.size) result += ` (${formatSize(node.size)})`;
  result += '\n';

  if (node.children) {
    for (const child of node.children.sort((a, b) => {
      if (a.type === 'directory' && b.type !== 'directory') return -1;
      if (a.type !== 'directory' && b.type === 'directory') return 1;
      return a.name.localeCompare(b.name);
    })) {
      result += formatTree(child, depth + 1);
    }
  }
  return result;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

async function searchFiles({ query, path = '.', regex = false }, workspaceId) {
  const workspacePath = join(config.workspacesDir, workspaceId === 'local' ? 'default' : workspaceId);
  const searchDir = join(workspacePath, path);

  try {
    const flags = regex ? '' : '-F';
    const cmd = `grep -rn ${flags} --include='*' --exclude-dir=node_modules --exclude-dir=.git -l "${query.replace(/"/g, '\\"')}" "${searchDir}" 2>/dev/null | head -20`;
    const output = execSync(cmd, { encoding: 'utf-8', timeout: 10000 }).trim();

    if (!output) return { matches: [], message: 'No matches found.' };

    // Get line-level matches for each file (limit to keep context small)
    const files = output.split('\n').slice(0, 10);
    const matches = [];

    for (const file of files) {
      try {
        const relPath = file.replace(workspacePath + '/', '');
        const lineCmd = `grep -n ${flags} "${query.replace(/"/g, '\\"')}" "${file}" 2>/dev/null | head -5`;
        const lineOutput = execSync(lineCmd, { encoding: 'utf-8', timeout: 5000 }).trim();

        const lineMatches = lineOutput.split('\n').map(line => {
          const colonIdx = line.indexOf(':');
          return {
            line: parseInt(line.substring(0, colonIdx)),
            content: line.substring(colonIdx + 1).trim(),
          };
        });

        matches.push({ file: relPath, matches: lineMatches });
      } catch {}
    }

    return { matches, totalFiles: files.length };
  } catch (err) {
    return { matches: [], message: 'Search failed or no matches found.' };
  }
}

async function runCommand({ command, timeout = 30 }, workspaceId) {
  // Safety check
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(command)) {
      return {
        success: false,
        error: `Blocked: This command matches a restricted pattern for safety.`,
        command,
      };
    }
  }

  const workspacePath = join(config.workspacesDir, workspaceId === 'local' ? 'default' : workspaceId);

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    const timeoutMs = timeout * 1000;

    const proc = spawn('bash', ['-c', command], {
      cwd: workspacePath,
      env: { ...process.env, HOME: process.env.HOME },
      timeout: timeoutMs,
    });

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      resolve({
        success: false,
        stdout: stdout.substring(0, 5000),
        stderr: 'Command timed out',
        exitCode: -1,
        command,
      });
    }, timeoutMs);

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        success: code === 0,
        stdout: stdout.substring(0, 5000),
        stderr: stderr.substring(0, 2000),
        exitCode: code,
        command,
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        success: false,
        stdout: '',
        stderr: err.message,
        exitCode: -1,
        command,
      });
    });
  });
}

async function getDiagnostics({ path = '.' }, workspaceId) {
  // Try running common linters/type checkers
  const result = await runCommand({ command: 'npx --no-install tsc --noEmit 2>&1 | head -30 || echo "No TypeScript configured"', timeout: 15 }, workspaceId);
  return {
    diagnostics: result.stdout,
    exitCode: result.exitCode,
  };
}

// ── Tool Definitions (OpenAI function calling format) ──

export const toolDefinitions = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the contents of a file from the workspace. Use this to understand existing code before making changes.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path from workspace root (e.g., "src/index.js")' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Create a new file or completely overwrite an existing file. Use for creating new files. For modifying existing files, prefer edit_file.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path for the file' },
          content: { type: 'string', description: 'Complete file content to write' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit_file',
      description: 'Edit a file by replacing a specific section of text. The target must be an exact substring of the current file content. Always read the file first before editing.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path of the file to edit' },
          target: { type: 'string', description: 'Exact text to find and replace (must match current file content exactly)' },
          replacement: { type: 'string', description: 'New text to replace the target with' },
        },
        required: ['path', 'target', 'replacement'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_directory',
      description: 'List all files and directories in the workspace, showing the project structure.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative directory path (default: workspace root)', default: '.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_files',
      description: 'Search for a text pattern across all files in the workspace. Returns matching files and lines.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query string' },
          path: { type: 'string', description: 'Directory to search in (default: workspace root)', default: '.' },
          regex: { type: 'boolean', description: 'Treat query as regex pattern', default: false },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_command',
      description: 'Execute a shell command in the workspace directory. Use for running scripts, installing packages, running tests, etc.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Shell command to execute' },
          timeout: { type: 'number', description: 'Timeout in seconds (default: 30)', default: 30 },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_diagnostics',
      description: 'Get lint/type-check errors from the project. Useful for finding bugs after making changes.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to check', default: '.' },
        },
      },
    },
  },
];

// ── Tool Executor ──

const toolImplementations = {
  read_file: readFile,
  write_file: writeFile,
  edit_file: editFile,
  list_directory: listDirectory,
  search_files: searchFiles,
  run_command: runCommand,
  get_diagnostics: getDiagnostics,
};

export async function executeTool(name, args, workspaceId) {
  const impl = toolImplementations[name];
  if (!impl) {
    return { error: `Unknown tool: ${name}` };
  }

  const startTime = Date.now();
  try {
    const result = await impl(args, workspaceId);
    return {
      ...result,
      _duration_ms: Date.now() - startTime,
    };
  } catch (err) {
    return {
      error: err.message,
      _duration_ms: Date.now() - startTime,
    };
  }
}
