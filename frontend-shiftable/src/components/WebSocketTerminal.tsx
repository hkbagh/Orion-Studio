import { useRef, useEffect, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { X, RotateCw, Maximize2, Minimize2 } from 'lucide-react';
import { useWebSocket } from '../hooks/useWebSocket';

interface WebSocketTerminalProps {
  initialCode?: string;
  language?: string;
  onRunRequest?: () => { code: string; language: string } | null;
}

export default function WebSocketTerminal({ initialCode, language, onRunRequest }: WebSocketTerminalProps) {
  const {
    isConnected, isRunning, output,
    compileInfo, execMetrics, exitCode,
    errorExplanation, error, compileError,
    runCode, sendStdin, killProcess, clearOutput
  } = useWebSocket();

  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [stdinInput, setStdinInput] = useState('');
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output, error, errorExplanation, compileError]);

  useEffect(() => {
    if (isRunning && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isRunning]);

  const handleRun = () => {
    if (!isConnected || isRunning) return;
    if (onRunRequest) {
      const req = onRunRequest();
      if (req && req.code && req.language) {
        runCode(req.code, req.language);
      }
    } else if (initialCode && language) {
      runCode(initialCode, language);
    }
  };

  const handleStdinSubmit = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      sendStdin(stdinInput);
      setStdinInput('');
    }
  };

  const handleTerminalClick = () => {
    if (isRunning && inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className={`flex flex-col h-full min-h-0 bg-zinc-950 ${isMaximized ? 'fixed inset-0 z-50' : ''}`}>
      <div className="flex items-center h-9 bg-zinc-950 px-2 shrink-0 select-none border-b border-white/[0.04]">
        <div className="flex items-center h-full space-x-1">
          <button className="px-3 h-full text-xs font-medium text-white border-b-2 border-white hover:text-white transition-colors">
            Terminal
          </button>
          <button className="px-3 h-full text-xs font-medium text-zinc-500 border-b-2 border-transparent hover:text-zinc-300 transition-colors">
            Output
          </button>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-1.5 px-2">
          {compileInfo && (
            <span className="text-[11px] font-mono text-zinc-500 mr-2">
              Compile: {compileInfo.compileTimeMs.toFixed(0)}ms
              {compileInfo.fromCache && <span className="text-yellow-500 ml-1">(cached)</span>}
            </span>
          )}
          {execMetrics && (
            <span className="text-[11px] font-mono text-zinc-500 mr-2">
              Run: {execMetrics.executeTimeMs.toFixed(0)}ms · {Math.round(execMetrics.memoryKB / 1024)}MB
            </span>
          )}
          {exitCode !== null && (
            <span className={`text-[11px] font-mono mr-2 ${exitCode === 0 ? 'text-green-500' : 'text-red-500'}`}>
              Exit: {exitCode}
            </span>
          )}

          <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
            title={isConnected ? 'Connected' : 'Disconnected'} />

          <button onClick={clearOutput} className="p-1 hover:bg-white/[0.1] rounded transition-colors" title="Clear">
            <RotateCw size={14} className="text-zinc-400" />
          </button>
          <button onClick={() => setIsMaximized(!isMaximized)} className="p-1 hover:bg-white/[0.1] rounded transition-colors">
            {isMaximized ? <Minimize2 size={14} className="text-zinc-400" /> : <Maximize2 size={14} className="text-zinc-400" />}
          </button>
          {isMaximized && (
            <button onClick={() => setIsMaximized(false)} className="p-1 hover:bg-white/[0.1] rounded transition-colors">
              <X size={14} className="text-zinc-400" />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center h-8 bg-zinc-950/50 px-2 shrink-0 select-none border-b border-white/[0.04]">
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          {isRunning ? (
            <button
              onClick={killProcess}
              className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-md text-[11px] font-medium transition-colors border border-red-500/20"
            >
              Kill
            </button>
          ) : (
            <button
              onClick={handleRun}
              disabled={!isConnected}
              className="px-3 py-1 bg-green-500/10 hover:bg-green-500/20 text-green-500 rounded-md text-[11px] font-medium transition-colors border border-green-500/20 disabled:opacity-50"
            >
              Run Code
            </button>
          )}
        </div>
      </div>

      <div
        ref={outputRef}
        className="flex-1 overflow-y-auto p-4 font-mono text-sm leading-relaxed custom-scrollbar cursor-text bg-black"
        onClick={handleTerminalClick}
      >
        {output.length === 0 && !error && !compileError && (
          <div className="text-zinc-500 text-sm">
            Ready to execute.
          </div>
        )}

        {compileError && (
          <div className="mb-2 animate-fade-in">
            <div className="text-red-500 text-xs font-bold uppercase mb-1">✖ Compilation Error</div>
            <pre className="text-red-500 whitespace-pre-wrap text-sm opacity-90">{compileError}</pre>
          </div>
        )}

        {output.map((line, i) => (
          <div key={i} className="whitespace-pre-wrap" style={{
            color: line.type === 'stdin'
              ? '#38bdf8'
              : line.type === 'stderr'
              ? '#ef4444'
              : '#d4d4d8'
          }}>
            {line.type === 'stdin' ? (
              <><span className="text-green-500">❯ </span>{line.text}</>
            ) : (
              line.text
            )}
          </div>
        ))}

        {error && (
          <div className="text-red-500 mt-2 whitespace-pre-wrap font-medium">{error}</div>
        )}

        {errorExplanation && (
          <div className="mt-2 pl-3 border-l-2 border-yellow-500 text-yellow-500/90 text-xs bg-yellow-500/5 py-2">
            💡 {errorExplanation}
          </div>
        )}

        {isRunning && (
          <div className="flex items-center mt-2">
            <span className="text-green-500 select-none mr-2">❯</span>
            <input
              ref={inputRef}
              type="text"
              value={stdinInput}
              onChange={e => setStdinInput(e.target.value)}
              onKeyDown={handleStdinSubmit}
              placeholder=""
              className="flex-1 bg-transparent text-sm font-mono text-cyan-400 outline-none"
              autoFocus
              spellCheck={false}
              autoComplete="off"
            />
          </div>
        )}

        {isRunning && (
          <div className="flex items-center gap-2 mt-2 opacity-50">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-zinc-500">Running... await logic.</span>
          </div>
        )}

        {!isRunning && exitCode !== null && (
          <div className="mt-4 text-zinc-500 text-xs">
            <span className={`font-mono ${exitCode === 0 ? 'text-zinc-500' : 'text-red-500'}`}>
              → Process exited with code {exitCode}
            </span>
          </div>
        )}
      </div>

      {!isConnected && (
        <div className="px-4 py-2 bg-yellow-500/20 border-t border-yellow-500/30 text-yellow-500 text-xs font-semibold flex items-center justify-between shrink-0">
          <span>Engine Disconnected</span>
          <button onClick={() => window.location.reload()} className="hover:underline">
            Reconnect
          </button>
        </div>
      )}
    </div>
  );
}

