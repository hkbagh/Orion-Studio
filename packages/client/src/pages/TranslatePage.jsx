import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useWorkspaceStore from '../store/workspaceStore';
import './TranslatePage.css';

const LANGUAGES = {
  java:       { label: 'Java',       icon: '☕' },
  python:     { label: 'Python',     icon: '🐍' },
  javascript: { label: 'JavaScript', icon: '⚡' },
  cpp:        { label: 'C++',        icon: '⚙️' },
};

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Sub-components ─────────────────────────────────────────────

function UploadPhase({
  zipFile, sourceLang, targetLang, isUploading, isDragging, error,
  fileInputRef, onDrop, onDragOver, onDragLeave, onFileChange,
  onSourceLangChange, onTargetLangChange, onSwap, onSubmit,
}) {
  return (
    <div className="upload-panel">
      <div className="upload-title">
        <h2>Translate Your Project</h2>
        <p>
          Upload a ZIP of your source code. The AI will intelligently convert each file
          to the target language, preserving logic and context.
          Media, text, and config files are carried over unchanged.
        </p>
      </div>

      {/* Drop zone */}
      <div
        className={`drop-zone ${isDragging ? 'dragging' : ''}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          style={{ display: 'none' }}
          onChange={onFileChange}
        />
        <div className="drop-zone-icon">📦</div>
        <div className="drop-zone-title">
          {zipFile ? 'File selected' : 'Drop your ZIP here'}
        </div>
        {zipFile ? (
          <div className="drop-zone-file-name">
            📁 {zipFile.name} &nbsp;·&nbsp; {formatBytes(zipFile.size)}
          </div>
        ) : (
          <>
            <div className="drop-zone-sub">Supports .zip archives up to 100 MB</div>
            <button className="drop-zone-browse" onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}>
              Browse files
            </button>
          </>
        )}
      </div>

      {/* Language selectors */}
      <div className="lang-row">
        <div className="lang-group">
          <div className="lang-label">Source Language</div>
          <select
            className="lang-select"
            value={sourceLang}
            onChange={e => onSourceLangChange(e.target.value)}
          >
            {Object.entries(LANGUAGES).map(([key, { label, icon }]) => (
              <option key={key} value={key}>{icon}  {label}</option>
            ))}
          </select>
        </div>

        <button className="lang-swap-btn" onClick={onSwap} title="Swap languages">
          ⇄
        </button>

        <div className="lang-group">
          <div className="lang-label">Target Language</div>
          <select
            className="lang-select"
            value={targetLang}
            onChange={e => onTargetLangChange(e.target.value)}
          >
            {Object.entries(LANGUAGES).map(([key, { label, icon }]) => (
              <option key={key} value={key}>{icon}  {label}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="upload-error">
          <span>⚠</span> {error}
        </div>
      )}

      <button
        className="translate-submit-btn"
        onClick={onSubmit}
        disabled={isUploading || !zipFile}
      >
        {isUploading ? (
          <><div className="spinner" /> Uploading &amp; analysing…</>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12M8 11l4 4 4-4" />
              <path d="M3 17v2a2 2 0 002 2h14a2 2 0 002-2v-2" />
            </svg>
            Start Translation
          </>
        )}
      </button>
    </div>
  );
}

function ProgressPhase({ manifest, fileStatuses, progress, sourceLang, targetLang }) {
  const total     = manifest.totalFiles;
  const pct       = total > 0 ? Math.round((progress / total) * 100) : 0;
  const srcLabel  = LANGUAGES[sourceLang]?.label || sourceLang;
  const tgtLabel  = LANGUAGES[targetLang]?.label || targetLang;

  return (
    <div className="progress-panel">
      <div className="progress-header">
        <div className="progress-title-row">
          <div className="progress-title">Translating…</div>
          <div className="progress-counter">{progress} / {total}</div>
        </div>
        <div className="progress-lang-badge">
          <strong>{srcLabel}</strong>
          <span>→</span>
          <strong>{tgtLabel}</strong>
          &nbsp;·&nbsp; {manifest.toTranslate} files to translate, {manifest.toCopy} to copy
        </div>
        <div className="progress-bar-track">
          <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="file-list">
        {manifest.files.map((file) => {
          const st = fileStatuses[file.path] || { status: 'pending' };
          const icons = { pending: '○', translating: '◌', done: '✓', copied: '→', error: '✕' };

          return (
            <div key={file.path} className="file-item">
              <div className={`file-status-icon ${st.status}`}>
                {icons[st.status] || '○'}
              </div>
              <div className="file-info">
                <div className="file-path" title={file.path}>
                  {st.status === 'done' && st.outputPath ? st.outputPath : file.path}
                </div>
                {st.status === 'done' && st.durationMs && (
                  <div className="file-meta">{formatDuration(st.durationMs)}</div>
                )}
                {st.status === 'error' && (
                  <div className="file-meta error" title={st.error}>
                    {st.error?.slice(0, 80) || 'Translation failed'}
                  </div>
                )}
                {st.status === 'pending' && (
                  <div className="file-meta">{formatBytes(file.sizeBytes)}</div>
                )}
              </div>
              <span className={`file-action-badge ${file.action}`}>
                {file.action === 'build_file' ? 'config' : file.action}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DonePhase({ result, targetLang, runOutput, isRunning, outputRef, onOpenIDE, onRun, onDownload }) {
  const tgtLabel = LANGUAGES[targetLang]?.label || targetLang;

  return (
    <div className="done-panel">
      <div className="done-header">
        <div className="done-checkmark">✓</div>
        <div className="done-title">Translation Complete</div>
        <div className="done-subtitle">
          Your project has been converted to {tgtLabel}. Download the ZIP or open it in the IDE.
        </div>
      </div>

      {/* Stats */}
      <div className="done-stats">
        <div className="stat-card">
          <div className="stat-value">{result.translated}</div>
          <div className="stat-label">Files Translated</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{result.copied}</div>
          <div className="stat-label">Files Copied</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatDuration(result.totalDurationMs)}</div>
          <div className="stat-label">Total Time</div>
        </div>
      </div>

      {/* Run command preview */}
      {result.runCommand && (
        <div className="run-command-box">
          <span className="run-command-label">Run</span>
          <span className="run-command-text">$ {result.runCommand}</span>
        </div>
      )}

      {/* Actions */}
      <div className="done-actions">
        <button className="done-btn-download" onClick={onDownload}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12M8 11l4 4 4-4" />
            <path d="M3 17v2a2 2 0 002 2h14a2 2 0 002-2v-2" />
          </svg>
          Download ZIP
        </button>

        <button className="done-btn-primary" onClick={onOpenIDE}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8M12 17v4" />
          </svg>
          Open in IDE
        </button>

        {result.runCommand && (
          <button className="done-btn-run" onClick={onRun} disabled={isRunning}>
            {isRunning ? (
              <><div className="spinner" style={{ borderTopColor: 'var(--status-success)', borderColor: 'rgba(16,185,129,0.3)' }} /> Running…</>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Run Project
              </>
            )}
          </button>
        )}
      </div>

      {/* Run output */}
      {(runOutput || isRunning) && (
        <div className="run-terminal">
          <div className="run-terminal-header">
            {isRunning && <div className="run-terminal-dot" />}
            <span>{isRunning ? 'Running…' : 'Output'}</span>
          </div>
          <div className="run-terminal-output" ref={outputRef}>
            {runOutput || ''}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────

export default function TranslatePage() {
  const navigate    = useNavigate();
  const setWorkspace = useWorkspaceStore(s => s.setWorkspace);

  const [phase,       setPhase]       = useState('upload');
  const [zipFile,     setZipFile]     = useState(null);
  const [sourceLang,  setSourceLang]  = useState('java');
  const [targetLang,  setTargetLang]  = useState('python');
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging,  setIsDragging]  = useState(false);
  const [error,       setError]       = useState(null);
  const [jobManifest, setJobManifest] = useState(null);
  const [fileStatuses,setFileStatuses]= useState({});
  const [progress,    setProgress]    = useState(0);
  const [result,      setResult]      = useState(null);
  const [runOutput,   setRunOutput]   = useState('');
  const [isRunning,   setIsRunning]   = useState(false);

  const fileInputRef = useRef(null);
  const esRef        = useRef(null);
  const runEsRef     = useRef(null);
  const outputRef    = useRef(null);

  // Auto-scroll terminal output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [runOutput]);

  // Cleanup SSE connections on unmount
  useEffect(() => {
    return () => {
      esRef.current?.close();
      runEsRef.current?.close();
    };
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith('.zip')) {
      setZipFile(file);
      setError(null);
    } else {
      setError('Please drop a .zip file.');
    }
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) { setZipFile(file); setError(null); }
  };

  const handleSwap = () => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
  };

  const startTranslation = async () => {
    if (!zipFile) { setError('Please select a ZIP file.'); return; }
    if (sourceLang === targetLang) { setError('Source and target language must be different.'); return; }

    setIsUploading(true);
    setError(null);

    try {
      // ── Phase 1: Upload & scan ──
      const uploadRes = await fetch('/api/translate/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Source-Lang': sourceLang,
        },
        body: zipFile,
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        throw new Error(err.error || 'Upload failed.');
      }

      const manifest = await uploadRes.json();
      setJobManifest(manifest);

      // Seed all files as 'pending'
      const initial = {};
      manifest.files.forEach(f => { initial[f.path] = { status: 'pending' }; });
      setFileStatuses(initial);
      setProgress(0);
      setPhase('progress');

      // ── Phase 2: Stream translation via SSE ──
      const es = new EventSource(
        `/api/translate/${manifest.jobId}/stream?sourceLang=${sourceLang}&targetLang=${targetLang}`
      );
      esRef.current = es;

      // Track whether we've handled a terminal event (done/fatal).
      // EventSource always fires onerror when the connection closes,
      // even after a graceful server-side res.end().
      let completed = false;

      // Use generic onmessage handler — backend sends all events as generic
      // 'message' with the event type in _event field of JSON payload.
      es.onmessage = (e) => {
        let data;
        try {
          data = JSON.parse(e.data);
        } catch {
          return;
        }

        const event = data._event;

        switch (event) {
          case 'file_start':
            setFileStatuses(prev => ({
              ...prev,
              [data.path]: { ...prev[data.path], status: 'translating' },
            }));
            break;

          case 'file_done':
            setProgress(data.index);
            setFileStatuses(prev => ({
              ...prev,
              [data.originalPath]: {
                status:     'done',
                outputPath: data.path,
                durationMs: data.durationMs,
              },
            }));
            break;

          case 'file_skipped':
            setProgress(data.index);
            setFileStatuses(prev => ({
              ...prev,
              [data.path]: { status: 'copied' },
            }));
            break;

          case 'file_error':
            setProgress(data.index);
            setFileStatuses(prev => ({
              ...prev,
              [data.path]: { status: 'error', error: data.error },
            }));
            break;

          case 'done':
            completed = true;
            es.close();
            esRef.current = null;
            setResult(data);
            setPhase('done');
            break;

          case 'fatal':
            completed = true;
            es.close();
            esRef.current = null;
            setError(data.error || 'Translation failed.');
            setPhase('upload');
            break;

          default:
            break;
        }
      };

      es.onerror = () => {
        if (completed) return; // Server closed after done/fatal — ignore
        es.close();
        esRef.current = null;
        setError('Connection to translation server lost.');
        setPhase('upload');
      };

    } catch (err) {
      setError(err.message);
      setPhase('upload');
    } finally {
      setIsUploading(false);
    }
  };

  const openInIDE = () => {
    if (!result) return;
    setWorkspace({
      id:   result.workspaceId,
      name: `Translated (${LANGUAGES[targetLang]?.label || targetLang})`,
      path: '',
    });
    navigate('/ide');
  };

  const downloadZip = () => {
    if (!result?.workspaceId) return;
    // Trigger a browser download via hidden link
    const link = document.createElement('a');
    link.href = `/api/translate/${result.workspaceId}/download`;
    link.download = `translated-${result.workspaceId}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const runProject = () => {
    if (!result?.workspaceId || isRunning) return;

    setIsRunning(true);
    setRunOutput('');

    const es = new EventSource(
      `/api/translate/${result.workspaceId}/run-stream?lang=${result.targetLang || targetLang}`
    );
    runEsRef.current = es;

    // Run stream also uses sendSSE → generic messages with _event field
    es.onmessage = (e) => {
      let data;
      try {
        data = JSON.parse(e.data);
      } catch {
        return;
      }

      const event = data._event;

      switch (event) {
        case 'start':
          setRunOutput(`$ ${data.command}\n`);
          break;

        case 'stdout':
          setRunOutput(prev => prev + data.data);
          break;

        case 'stderr':
          setRunOutput(prev => prev + data.data);
          break;

        case 'exit':
          es.close();
          runEsRef.current = null;
          setRunOutput(prev => `${prev}\n[Process exited with code ${data.code}]\n`);
          setIsRunning(false);
          break;

        case 'fatal':
          es.close();
          runEsRef.current = null;
          setRunOutput(prev => `${prev}\n[Error: ${data.error || 'Run failed.'}]\n`);
          setIsRunning(false);
          break;

        default:
          break;
      }
    };

    es.onerror = () => {
      es.close();
      runEsRef.current = null;
      setRunOutput(prev => `${prev}\n[Connection lost]\n`);
      setIsRunning(false);
    };
  };

  const reset = () => {
    esRef.current?.close();
    runEsRef.current?.close();
    setPhase('upload');
    setZipFile(null);
    setJobManifest(null);
    setFileStatuses({});
    setProgress(0);
    setResult(null);
    setRunOutput('');
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="translate-page">
      <div className="translate-stars" />
      <div className="translate-glow translate-glow-1" />
      <div className="translate-glow translate-glow-2" />

      <header className="translate-header">
        <button className="translate-back" onClick={() => navigate('/')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Back
        </button>
        <div className="translate-header-title">
          <span className="translate-header-icon">✦</span>
          Code Translator
        </div>
        {phase !== 'upload' && (
          <button className="translate-reset" onClick={reset}>New Translation</button>
        )}
      </header>

      <main className="translate-main">
        {phase === 'upload' && (
          <UploadPhase
            zipFile={zipFile}
            sourceLang={sourceLang}
            targetLang={targetLang}
            isUploading={isUploading}
            isDragging={isDragging}
            error={error}
            fileInputRef={fileInputRef}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onFileChange={handleFileChange}
            onSourceLangChange={setSourceLang}
            onTargetLangChange={setTargetLang}
            onSwap={handleSwap}
            onSubmit={startTranslation}
          />
        )}

        {phase === 'progress' && jobManifest && (
          <ProgressPhase
            manifest={jobManifest}
            fileStatuses={fileStatuses}
            progress={progress}
            sourceLang={sourceLang}
            targetLang={targetLang}
          />
        )}

        {phase === 'done' && result && (
          <DonePhase
            result={result}
            targetLang={targetLang}
            runOutput={runOutput}
            isRunning={isRunning}
            outputRef={outputRef}
            onOpenIDE={openInIDE}
            onRun={runProject}
            onDownload={downloadZip}
          />
        )}
      </main>
    </div>
  );
}
