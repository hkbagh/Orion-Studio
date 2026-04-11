import FileService from '../../services/fileService.js';
import config from '../../config/index.js';
import { join } from 'path';

/**
 * Build workspace context for the system prompt.
 * Provides the AI with an overview of the project structure.
 */
export async function buildWorkspaceContext(workspaceId, contextFiles = []) {
  const workspacePath = join(config.workspacesDir, workspaceId === 'local' ? 'default' : workspaceId);
  const fs = new FileService(workspacePath);

  let context = '';

  // 1. Project structure (top 3 levels)
  try {
    const tree = await fs.getFileTree();
    context += '### Project Structure\n```\n';
    context += formatTreeCompact(tree, 0, 3);
    context += '```\n\n';
  } catch {
    context += '### Project Structure\nUnable to read project structure.\n\n';
  }

  // 2. Key files detection
  const keyFiles = ['package.json', 'tsconfig.json', 'requirements.txt', 'Cargo.toml', 'go.mod', 'Makefile'];
  for (const keyFile of keyFiles) {
    try {
      if (fs.exists(keyFile)) {
        const content = await fs.readFile(keyFile);
        context += `### ${keyFile}\n\`\`\`json\n${content.content.substring(0, 500)}\n\`\`\`\n\n`;
        break; // Only include the first found
      }
    } catch {}
  }

  // 3. Context files (user's @-references)
  for (const filePath of contextFiles) {
    try {
      const file = await fs.readFile(filePath);
      const maxLen = 3000;
      const truncated = file.content.length > maxLen;
      context += `### @${filePath}\n\`\`\`\n${file.content.substring(0, maxLen)}${truncated ? '\n... (truncated)' : ''}\n\`\`\`\n\n`;
    } catch {
      context += `### @${filePath}\nFile not found.\n\n`;
    }
  }

  return context;
}

function formatTreeCompact(node, depth, maxDepth) {
  if (depth >= maxDepth) return '';
  let result = '';
  const indent = '  '.repeat(depth);
  const icon = node.type === 'directory' ? '📁' : '📄';

  if (depth > 0) {
    result += `${indent}${icon} ${node.name}\n`;
  }

  if (node.children && depth < maxDepth) {
    const sorted = [...node.children].sort((a, b) => {
      if (a.type === 'directory' && b.type !== 'directory') return -1;
      if (a.type !== 'directory' && b.type === 'directory') return 1;
      return a.name.localeCompare(b.name);
    });
    for (const child of sorted) {
      result += formatTreeCompact(child, depth + 1, maxDepth);
    }
  }

  return result;
}
