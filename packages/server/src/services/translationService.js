import { join, extname, basename, dirname, relative } from 'path';
import { readdir, stat } from 'fs/promises';

// ── Language Definitions ──

export const LANGUAGES = {
  java:       { label: 'Java',       ext: '.java', icon: '☕' },
  python:     { label: 'Python',     ext: '.py',   icon: '🐍' },
  javascript: { label: 'JavaScript', ext: '.js',   icon: '⚡' },
  cpp:        { label: 'C++',        ext: '.cpp',  icon: '⚙️' },
};

const SOURCE_EXTENSIONS = {
  java:       new Set(['.java']),
  python:     new Set(['.py']),
  javascript: new Set(['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs']),
  cpp:        new Set(['.cpp', '.c', '.cc', '.cxx', '.h', '.hpp', '.hxx']),
};

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.svg',
  '.mp3', '.mp4', '.wav', '.ogg', '.avi', '.mov', '.webm', '.flac',
  '.zip', '.tar', '.gz', '.jar', '.war', '.class', '.pyc', '.pyo',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.exe', '.dll', '.so', '.dylib', '.bin', '.wasm',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.db', '.sqlite', '.sqlite3',
]);

const BUILD_FILE_NAMES = {
  java:       new Set(['pom.xml', 'build.gradle', 'build.gradle.kts', 'settings.gradle']),
  python:     new Set(['requirements.txt', 'setup.py', 'setup.cfg', 'pyproject.toml', 'Pipfile']),
  javascript: new Set(['package.json', 'tsconfig.json', 'webpack.config.js', 'vite.config.js', 'vite.config.ts']),
  cpp:        new Set(['CMakeLists.txt', 'Makefile', 'makefile']),
};

const BUILD_FILE_OUTPUT_NAMES = {
  'pom.xml':           { python: 'requirements.txt', javascript: 'package.json',      cpp: 'CMakeLists.txt' },
  'build.gradle':      { python: 'requirements.txt', javascript: 'package.json',      cpp: 'CMakeLists.txt' },
  'build.gradle.kts':  { python: 'requirements.txt', javascript: 'package.json',      cpp: 'CMakeLists.txt' },
  'requirements.txt':  { java:   'pom.xml',           javascript: 'package.json',      cpp: 'CMakeLists.txt' },
  'setup.py':          { java:   'pom.xml',           javascript: 'package.json',      cpp: 'CMakeLists.txt' },
  'pyproject.toml':    { java:   'pom.xml',           javascript: 'package.json',      cpp: 'CMakeLists.txt' },
  'package.json':      { java:   'pom.xml',           python:     'requirements.txt',  cpp: 'CMakeLists.txt' },
  'CMakeLists.txt':    { java:   'pom.xml',           python:     'requirements.txt',  javascript: 'package.json' },
  'Makefile':          { java:   'pom.xml',           python:     'requirements.txt',  javascript: 'package.json' },
  'makefile':          { java:   'pom.xml',           python:     'requirements.txt',  javascript: 'package.json' },
};

const SKIP_DIRS = new Set([
  'node_modules', '__pycache__', '.git', 'target', 'build', 'dist',
  '.gradle', '.mvn', 'bin', 'obj', '.next', '.nuxt', 'vendor',
  '.idea', '.vscode', 'out', '.cache',
]);

const MAX_FILE_SIZE = 80 * 1024; // 80 KB

/**
 * Classify a single file — determines what to do with it during translation.
 * Returns: { action: 'translate' | 'copy' | 'build_file', reason?: string }
 */
export function classifyFile(relPath, sizeBytes, sourceLang) {
  const ext = extname(relPath).toLowerCase();
  const name = basename(relPath);

  // Binary / media → copy as-is
  if (BINARY_EXTENSIONS.has(ext)) {
    return { action: 'copy', reason: 'binary' };
  }

  // Over 80 KB → copy to avoid exceeding LLM context
  if (sizeBytes > MAX_FILE_SIZE) {
    return { action: 'copy', reason: 'too_large' };
  }

  // Build / config file for this source language → AI translate with specialised prompt
  if (BUILD_FILE_NAMES[sourceLang]?.has(name)) {
    return { action: 'build_file' };
  }

  // Source code for this language → AI translate
  if (SOURCE_EXTENSIONS[sourceLang]?.has(ext)) {
    return { action: 'translate' };
  }

  // Everything else (txt, md, yaml, json, html, css …) → copy unchanged
  return { action: 'copy', reason: 'not_source' };
}

/**
 * Derive the output path for a file after translation.
 * Source-language extensions are swapped; build files get canonical target names.
 */
export function getOutputPath(relPath, sourceLang, targetLang, action) {
  const name = basename(relPath);
  const dir  = dirname(relPath) === '.' ? '' : dirname(relPath);

  if (action === 'build_file') {
    const targetName = (BUILD_FILE_OUTPUT_NAMES[name] || {})[targetLang];
    if (targetName) return dir ? `${dir}/${targetName}` : targetName;
    return relPath;
  }

  if (action === 'translate') {
    const targetExt = LANGUAGES[targetLang]?.ext;
    if (!targetExt) return relPath;

    // Find and remove the source extension (case-insensitive)
    const srcExts = [...(SOURCE_EXTENSIONS[sourceLang] || [])];
    for (const srcExt of srcExts) {
      if (relPath.toLowerCase().endsWith(srcExt)) {
        const stem    = name.slice(0, name.length - srcExt.length);
        const newName = stem + targetExt;
        return dir ? `${dir}/${newName}` : newName;
      }
    }
  }

  return relPath;
}

/**
 * Strip AI-generated markdown code fences from translation output.
 * Models sometimes wrap responses in ```lang ... ``` blocks despite instructions.
 */
export function stripCodeFences(content) {
  const trimmed = content.trim();
  // Full fence: ```lang\n...\n```
  const fullFence = trimmed.match(/^```[\w]*\n([\s\S]*?)\n?```\s*$/);
  if (fullFence) return fullFence[1];
  // Partial fence (no closing)
  if (trimmed.startsWith('```')) {
    return trimmed.replace(/^```[\w]*\n?/, '');
  }
  return content;
}

/**
 * Build the AI chat messages for translating a source file or build config.
 */
export function buildTranslationMessages(sourceLang, targetLang, sourceCode, filePath, isBuildFile = false) {
  const src = LANGUAGES[sourceLang]?.label || sourceLang;
  const tgt = LANGUAGES[targetLang]?.label || targetLang;

  const systemPrompt = isBuildFile
    ? `You are a build-system translator. Convert a ${src} project build/config file to the ${tgt} equivalent.
Rules:
- Output ONLY the translated config file content. No markdown fences, no commentary.
- Map dependencies to their ${tgt} package ecosystem equivalents where known; omit unknown ones with a comment.
- Generate a minimal, valid, runnable config for ${tgt}'s standard build tool.
- For requirements.txt: one package per line, no pinned versions unless critical.
- For package.json: include "scripts": { "start": "node index.js", "test": "echo \\"No tests\\"" }.
- For pom.xml: use standard Maven project structure, Java 17, group-id "com.example".
- For CMakeLists.txt: use cmake_minimum_required(VERSION 3.16) and add_executable.`

    : `You are a precise code translator. Translate ${src} source code to idiomatic ${tgt}.
Rules:
- Output ONLY the translated code. No markdown code fences, no explanations, no preamble.
- Preserve ALL logical behavior and functionality exactly.
- Use idiomatic ${tgt} patterns and the standard library — not a literal line-by-line copy.
- Map data structures to native ${tgt} types (e.g., Java ArrayList → Python list, HashMap → dict).
- Map standard-library calls (e.g., System.out.println → print, std::cout → print).
- Convert OOP constructs to ${tgt} equivalents (Java interfaces → Python ABCs / Protocols).
- Translate comments to ${tgt} comment syntax; preserve their content.
- Include all necessary imports at the top; omit unused ones.
- Do not introduce libraries that were not implicitly or explicitly used in the original.`;

  return [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `Translate this ${src} file to ${tgt}.\nFile: ${filePath}\n\n${sourceCode}`,
    },
  ];
}

/**
 * Recursively walk a directory tree, skipping known junk and hidden dirs.
 * Returns an array of { fullPath, relPath, sizeBytes }.
 */
export async function walkDirectory(dir, baseDir = dir) {
  const results = [];

  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      results.push(...await walkDirectory(fullPath, baseDir));
    } else {
      // Skip most hidden files, except .env
      if (entry.name.startsWith('.') && !entry.name.endsWith('.env')) continue;

      const relPath = relative(baseDir, fullPath).replace(/\\/g, '/');
      let sizeBytes = 0;
      try {
        const s = await stat(fullPath);
        sizeBytes = s.size;
      } catch {}

      results.push({ fullPath, relPath, sizeBytes });
    }
  }

  return results;
}

/**
 * Detect the most likely entry-point file in the translated output.
 */
export function detectEntryPoint(outputPaths, targetLang) {
  const norm = outputPaths.map(p => p.replace(/\\/g, '/'));

  const candidates = {
    python:     ['main.py', 'app.py', 'run.py', 'src/main.py', 'src/app.py'],
    javascript: ['index.js', 'main.js', 'app.js', 'src/index.js', 'src/main.js'],
    java:       ['Main.java', 'App.java', 'Application.java', 'src/Main.java'],
    cpp:        ['main.cpp', 'Main.cpp', 'src/main.cpp'],
  };

  for (const c of (candidates[targetLang] || [])) {
    const match = norm.find(p => p === c || p.endsWith('/' + c));
    if (match) return match;
  }

  // Fallback: first file with the target extension
  const ext = LANGUAGES[targetLang]?.ext;
  return norm.find(p => ext && p.endsWith(ext)) || null;
}

/**
 * Generate the shell command to run the translated project from its workspace root.
 */
export function generateRunCommand(entryPoint, targetLang) {
  if (!entryPoint) return null;

  switch (targetLang) {
    case 'python':
      return `python3 "${entryPoint}"`;

    case 'javascript':
      return `node "${entryPoint}"`;

    case 'java': {
      const className = basename(entryPoint, '.java');
      return `javac $(find . -name "*.java" | tr '\\n' ' ') && java ${className}`;
    }

    case 'cpp':
      return `g++ -o program -std=c++17 $(find . -name "*.cpp" | tr '\\n' ' ') && ./program`;

    default:
      return null;
  }
}
