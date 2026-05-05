import { Router } from 'express';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { writeFile, readFile, mkdir, rm, copyFile } from 'fs/promises';
import { existsSync, mkdirSync, createReadStream } from 'fs';
import { join, dirname, basename } from 'path';
import { execSync, spawn } from 'child_process';
import { tmpdir } from 'os';
import config from '../config/index.js';
import AgentOrchestrator from '../agent/orchestrator.js';
import { createWorkspace } from '../db/database.js';
import {
  LANGUAGES,
  classifyFile,
  getOutputPath,
  stripCodeFences,
  buildTranslationMessages,
  walkDirectory,
  detectEntryPoint,
  generateRunCommand,
} from '../services/translationService.js';

const router = Router();

// One orchestrator instance — loadProviders() reads fresh keys from DB each call
const orchestrator = new AgentOrchestrator();

// ── In-memory job store ──
// jobId → { tempDir, rootDir, files, sourceLang, status, workspaceId }
const jobs = new Map();

function scheduleCleanup(jobId, delayMs = 60 * 60 * 1000) {
  setTimeout(async () => {
    const job = jobs.get(jobId);
    if (job) {
      jobs.delete(jobId);
      await rm(job.tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }, delayMs);
}

function sendSSE(res, event, data) {
  // Always use generic 'message' event to avoid EventSource named-event conflicts.
  // The event type is embedded in the JSON payload.
  res.write(`data: ${JSON.stringify({ _event: event, ...data })}\n\n`);
}

// ──────────────────────────────────────────────────────────────────
// POST /api/translate/upload
// Accepts raw ZIP body, extracts it, classifies files, returns manifest.
// ──────────────────────────────────────────────────────────────────
router.post(
  '/translate/upload',
  express.raw({ type: '*/*', limit: '100mb' }),
  async (req, res, next) => {
    try {
      const sourceLang = (req.headers['x-source-lang'] || 'java').toLowerCase();

      if (!LANGUAGES[sourceLang]) {
        return res.status(400).json({ error: `Unsupported source language: ${sourceLang}` });
      }

      const zipBuffer = req.body;
      if (!zipBuffer || zipBuffer.length === 0) {
        return res.status(400).json({ error: 'No file data received.' });
      }

      const jobId = uuidv4().substring(0, 8);
      const tempDir     = join(tmpdir(), `orion-translate-${jobId}`);
      const zipPath     = join(tempDir, 'upload.zip');
      const extractedDir = join(tempDir, 'extracted');

      await mkdir(tempDir, { recursive: true });
      await writeFile(zipPath, zipBuffer);

      // Extract
      try {
        execSync(`unzip -o "${zipPath}" -d "${extractedDir}"`, {
          timeout: 30_000,
          stdio: 'pipe',
        });
      } catch (err) {
        await rm(tempDir, { recursive: true, force: true }).catch(() => {});
        return res.status(400).json({
          error: 'Failed to extract ZIP. Make sure it is a valid .zip archive.',
        });
      }

      // Strip single top-level directory (common with GitHub/exported zips)
      let rootDir = extractedDir;
      try {
        const { readdir: rd } = await import('fs/promises');
        const topEntries = await rd(extractedDir, { withFileTypes: true });
        const topDirs  = topEntries.filter(e => e.isDirectory());
        const topFiles = topEntries.filter(e => !e.isDirectory());
        if (topDirs.length === 1 && topFiles.length === 0) {
          rootDir = join(extractedDir, topDirs[0].name);
        }
      } catch {}

      // Security: validate no zip-slip paths escape the temp dir
      // (unzip on Linux already handles this, but verify anyway)
      const rawFiles = await walkDirectory(rootDir, rootDir);
      const safeFiles = rawFiles.filter(f => {
        const resolved = join(rootDir, f.relPath);
        return resolved.startsWith(rootDir);
      });

      const files = safeFiles.map(f => {
        const { action, reason } = classifyFile(f.relPath, f.sizeBytes, sourceLang);
        return {
          path:      f.relPath,
          fullPath:  f.fullPath,
          sizeBytes: f.sizeBytes,
          action,
          reason,
        };
      });

      jobs.set(jobId, {
        tempDir,
        rootDir,
        files,
        sourceLang,
        status: 'ready',
        workspaceId: null,
      });

      scheduleCleanup(jobId);

      res.json({
        jobId,
        totalFiles:  files.length,
        toTranslate: files.filter(f => f.action === 'translate' || f.action === 'build_file').length,
        toCopy:      files.filter(f => f.action === 'copy').length,
        files: files.map(({ path, sizeBytes, action, reason }) => ({
          path,
          sizeBytes,
          action,
          reason,
        })),
      });
    } catch (err) {
      next(err);
    }
  }
);

// ──────────────────────────────────────────────────────────────────
// GET /api/translate/:jobId/stream?sourceLang=&targetLang=
// SSE stream: runs the AI translation file-by-file and emits progress.
// ──────────────────────────────────────────────────────────────────
router.get('/translate/:jobId/stream', async (req, res) => {
  const { jobId } = req.params;
  const { sourceLang, targetLang } = req.query;

  const job = jobs.get(jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found or expired.' });
  }

  if (job.status === 'translating') {
    return res.status(409).json({ error: 'Translation already in progress for this job.' });
  }

  if (!targetLang || !LANGUAGES[targetLang]) {
    return res.status(400).json({ error: `Unsupported target language: ${targetLang}` });
  }

  if (sourceLang === targetLang) {
    return res.status(400).json({ error: 'Source and target language must be different.' });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable Nginx buffering
  res.flushHeaders();

  job.status = 'translating';

  try {
    // Load AI provider from stored keys
    orchestrator.loadProviders();
    let provider;
    try {
      provider = orchestrator.getProvider();
    } catch (err) {
      console.error('[Translate] No AI provider:', err.message);
      sendSSE(res, 'fatal', {
        error: 'No AI provider configured. Add your API key in the IDE → AI Settings (⚙️).',
      });
      res.end();
      job.status = 'ready';
      return;
    }

    // Create workspace directory
    const workspaceId = `t-${uuidv4().substring(0, 8)}`;
    const outputDir   = join(config.workspacesDir, workspaceId);
    mkdirSync(outputDir, { recursive: true });

    const { files } = job;
    const totalFiles = files.length;
    const outputPaths = [];
    let translated = 0, copied = 0, errors = 0;
    const startTime = Date.now();

    sendSSE(res, 'start', {
      jobId,
      totalFiles,
      toTranslate: files.filter(f => f.action === 'translate' || f.action === 'build_file').length,
      toCopy:      files.filter(f => f.action === 'copy').length,
      sourceLang,
      targetLang,
    });

    for (let i = 0; i < files.length; i++) {
      const file  = files[i];
      const index = i + 1;

      sendSSE(res, 'file_start', {
        path:   file.path,
        index,
        total:  totalFiles,
        action: file.action,
      });

      // ── Copy unchanged ──
      if (file.action === 'copy') {
        const destPath = join(outputDir, file.path);
        await mkdir(dirname(destPath), { recursive: true });
        try {
          await copyFile(file.fullPath, destPath);
          outputPaths.push(file.path);
          copied++;
          sendSSE(res, 'file_skipped', {
            path:   file.path,
            action: 'copy',
            reason: file.reason,
            index,
            total:  totalFiles,
          });
        } catch (err) {
          errors++;
          sendSSE(res, 'file_error', { path: file.path, error: err.message, index, total: totalFiles });
        }
        continue;
      }

      // ── AI translate (source code or build file) ──
      const fileStart = Date.now();
      try {
        const sourceCode = await readFile(file.fullPath, 'utf-8');
        const messages   = buildTranslationMessages(
          sourceLang,
          targetLang,
          sourceCode,
          file.path,
          file.action === 'build_file',
        );

        const response = await provider.chat(messages, [], {
          model:       orchestrator.activeModel,
          maxTokens:   8192,
          temperature: 0.15, // low temp for deterministic translation
        });

        const translatedCode  = stripCodeFences(response.content);
        const outputRelPath   = getOutputPath(file.path, sourceLang, targetLang, file.action);
        const destPath        = join(outputDir, outputRelPath);

        await mkdir(dirname(destPath), { recursive: true });
        await writeFile(destPath, translatedCode, 'utf-8');

        outputPaths.push(outputRelPath);
        translated++;

        sendSSE(res, 'file_done', {
          path:         outputRelPath,
          originalPath: file.path,
          action:       file.action,
          index,
          total:        totalFiles,
          durationMs:   Date.now() - fileStart,
        });
      } catch (err) {
        console.error(`[Translate] Error translating ${file.path}:`, err.message);
        errors++;
        sendSSE(res, 'file_error', {
          path:  file.path,
          error: err.message,
          index,
          total: totalFiles,
        });
      }
    }

    // ── Finalise ──
    const entryPoint = detectEntryPoint(outputPaths, targetLang);
    const runCommand = generateRunCommand(entryPoint, targetLang);

    // Register as a real workspace so the IDE can open it
    try {
      createWorkspace(
        workspaceId,
        `Translated to ${LANGUAGES[targetLang]?.label || targetLang}`,
        'orion-workspace',
        outputDir,
      );
    } catch {
      // Ignore duplicate key if somehow already registered
    }

    job.workspaceId = workspaceId;
    job.status      = 'done';

    sendSSE(res, 'done', {
      workspaceId,
      entryPoint,
      runCommand,
      targetLang,
      totalDurationMs: Date.now() - startTime,
      translated,
      copied,
      errors,
    });
  } catch (err) {
    console.error('[Translate] Stream error:', err);
    sendSSE(res, 'fatal', { error: err.message });
    job.status = 'ready';
  }

  res.end();
});

// ──────────────────────────────────────────────────────────────────
// GET /api/translate/:workspaceId/run-stream?lang=python
// SSE stream: executes the translated project and streams stdout/stderr.
// ──────────────────────────────────────────────────────────────────
router.get('/translate/:workspaceId/run-stream', async (req, res) => {
  const { workspaceId } = req.params;
  const workspacePath   = join(config.workspacesDir, workspaceId);

  if (!existsSync(workspacePath)) {
    return res.status(404).json({ error: 'Workspace not found.' });
  }

  // Auto-detect language from workspace files if not supplied
  const files      = await walkDirectory(workspacePath, workspacePath);
  const filePaths  = files.map(f => f.relPath);
  let targetLang   = (req.query.lang || '').toLowerCase();

  if (!targetLang || !LANGUAGES[targetLang]) {
    if (filePaths.some(p => p.endsWith('.py')))   targetLang = 'python';
    else if (filePaths.some(p => p.endsWith('.js'))) targetLang = 'javascript';
    else if (filePaths.some(p => p.endsWith('.java'))) targetLang = 'java';
    else if (filePaths.some(p => p.endsWith('.cpp')))  targetLang = 'cpp';
  }

  const entryPoint = detectEntryPoint(filePaths, targetLang);
  const runCommand = generateRunCommand(entryPoint, targetLang);

  if (!runCommand) {
    return res.status(400).json({
      error: 'Could not determine how to run this project. No recognisable entry point found.',
    });
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  sendSSE(res, 'start', { command: runCommand, workspaceId });

  const proc = spawn('bash', ['-c', runCommand], {
    cwd: workspacePath,
    env: { ...process.env },
  });

  const killTimeout = setTimeout(() => {
    proc.kill('SIGKILL');
    sendSSE(res, 'stderr', { data: '\n[Process killed after 60s timeout]\n' });
  }, 60_000);

  proc.stdout.on('data', (chunk) => {
    sendSSE(res, 'stdout', { data: chunk.toString() });
  });

  proc.stderr.on('data', (chunk) => {
    sendSSE(res, 'stderr', { data: chunk.toString() });
  });

  proc.on('close', (code) => {
    clearTimeout(killTimeout);
    sendSSE(res, 'exit', { code });
    res.end();
  });

  proc.on('error', (err) => {
    clearTimeout(killTimeout);
    sendSSE(res, 'fatal', { error: err.message });
    res.end();
  });

  // Client disconnected → kill the process
  req.on('close', () => {
    clearTimeout(killTimeout);
    proc.kill('SIGTERM');
  });
});

// ──────────────────────────────────────────────────────────────────
// GET /api/translate/:workspaceId/download
// Zips the translated workspace directory and streams it as a download.
// ──────────────────────────────────────────────────────────────────
router.get('/translate/:workspaceId/download', async (req, res) => {
  const { workspaceId } = req.params;
  const workspacePath = join(config.workspacesDir, workspaceId);

  if (!existsSync(workspacePath)) {
    return res.status(404).json({ error: 'Workspace not found.' });
  }

  // Check workspace isn't empty
  const wsFiles = await walkDirectory(workspacePath, workspacePath);
  if (wsFiles.length === 0) {
    return res.status(400).json({ error: 'Workspace is empty — nothing to download.' });
  }

  const zipName = `translated-${workspaceId}.zip`;
  const zipPath = join(tmpdir(), zipName);

  try {
    // Remove stale zip if exists from a previous download
    await rm(zipPath, { force: true }).catch(() => {});

    // Create ZIP from workspace directory
    execSync(`cd "${workspacePath}" && find . -type f ! -path '*/.*' | zip "${zipPath}" -@`, {
      timeout: 30_000,
      stdio: 'pipe',
    });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

    const stream = createReadStream(zipPath);
    stream.pipe(res);

    stream.on('end', () => {
      rm(zipPath, { force: true }).catch(() => {});
    });

    stream.on('error', (err) => {
      console.error('[Translate] Download stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to stream ZIP.' });
      }
      rm(zipPath, { force: true }).catch(() => {});
    });
  } catch (err) {
    console.error('[Translate] ZIP creation failed:', err.message);
    res.status(500).json({ error: 'Failed to create ZIP archive.' });
  }
});

export default router;
