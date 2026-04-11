// Language mapping: file extension → Monaco language ID
const extensionMap = {
  // JavaScript / TypeScript
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',

  // Web
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.less': 'less',
  '.svg': 'xml',

  // Data
  '.json': 'json',
  '.json5': 'json',
  '.xml': 'xml',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'ini',
  '.csv': 'plaintext',

  // Config
  '.env': 'ini',
  '.ini': 'ini',
  '.conf': 'ini',
  '.cfg': 'ini',
  '.properties': 'ini',

  // Markdown / Docs
  '.md': 'markdown',
  '.mdx': 'markdown',
  '.txt': 'plaintext',
  '.log': 'plaintext',

  // Python
  '.py': 'python',
  '.pyw': 'python',
  '.pyi': 'python',

  // Go
  '.go': 'go',
  '.mod': 'go',

  // Rust
  '.rs': 'rust',

  // Java / JVM
  '.java': 'java',
  '.kt': 'kotlin',
  '.scala': 'scala',
  '.groovy': 'groovy',

  // C / C++
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.hpp': 'cpp',

  // Shell
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.fish': 'shell',

  // Docker
  '.dockerfile': 'dockerfile',

  // SQL
  '.sql': 'sql',

  // PHP
  '.php': 'php',

  // Ruby
  '.rb': 'ruby',

  // Lua
  '.lua': 'lua',

  // R
  '.r': 'r',
  '.R': 'r',

  // GraphQL
  '.graphql': 'graphql',
  '.gql': 'graphql',
};

// Special filename mappings 
const filenameMap = {
  'Dockerfile': 'dockerfile',
  'Makefile': 'makefile',
  'Jenkinsfile': 'groovy',
  '.gitignore': 'ini',
  '.dockerignore': 'ini',
  '.editorconfig': 'ini',
  '.npmrc': 'ini',
  '.eslintrc': 'json',
  '.prettierrc': 'json',
  'tsconfig.json': 'json',
  'package.json': 'json',
  'Cargo.toml': 'ini',
  'go.sum': 'plaintext',
};

export function getLanguageFromFilename(filename) {
  // Check exact filename first
  if (filenameMap[filename]) {
    return filenameMap[filename];
  }

  // Get extension
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return 'plaintext';

  const ext = filename.substring(lastDot).toLowerCase();
  return extensionMap[ext] || 'plaintext';
}

export function getFileIcon(filename, isDirectory = false) {
  if (isDirectory) return '📁';

  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();

  const iconMap = {
    '.js': '🟨', '.jsx': '⚛️', '.ts': '🔷', '.tsx': '⚛️',
    '.html': '🌐', '.css': '🎨', '.scss': '🎨',
    '.json': '📋', '.md': '📝', '.txt': '📄',
    '.py': '🐍', '.go': '🔵', '.rs': '🦀',
    '.java': '☕', '.rb': '💎', '.php': '🐘',
    '.sh': '🖥️', '.sql': '🗃️',
    '.yml': '⚙️', '.yaml': '⚙️', '.toml': '⚙️',
    '.env': '🔒', '.gitignore': '🚫',
    '.svg': '🖼️', '.png': '🖼️', '.jpg': '🖼️',
    '.dockerfile': '🐳',
  };

  if (filenameMap[filename]) {
    if (filename === 'Dockerfile') return '🐳';
    if (filename === 'Makefile') return '⚙️';
    if (filename.includes('package.json')) return '📦';
  }

  return iconMap[ext] || '📄';
}
