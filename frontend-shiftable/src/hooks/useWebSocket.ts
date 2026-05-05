import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const ENGINE_URL = import.meta.env.VITE_ENGINE_URL || 'http://localhost:3001';

// Maximum output lines to keep in memory (prevents unbounded RAM growth)
const MAX_OUTPUT_LINES = 5000;

interface ExecutionMetrics {
  executeTimeMs: number;
  memoryKB: number;
}

// Unified output line — preserves interleaved order of stdout/stderr/stdin
interface OutputLine {
  type: 'stdout' | 'stderr' | 'stdin';
  text: string;
  timestamp: number;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  isRunning: boolean;
  output: OutputLine[];
  compileInfo: { compileTimeMs: number; fromCache?: boolean } | null;
  execMetrics: ExecutionMetrics | null;
  exitCode: number | null;
  errorExplanation: string | null;
  error: string | null;
  compileError: string | null;
  runCode: (code: string, language: string, compilerFlags?: string) => void;
  sendStdin: (input: string) => void;
  killProcess: () => void;
  clearOutput: () => void;
}

// Helper: append to output array with bounded size
function appendOutput(prev: OutputLine[], line: OutputLine): OutputLine[] {
  const next = [...prev, line];
  // Drop oldest lines if exceeding limit to prevent memory leak
  if (next.length > MAX_OUTPUT_LINES) {
    return next.slice(next.length - MAX_OUTPUT_LINES);
  }
  return next;
}

export function useWebSocket(): UseWebSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  // Single unified output array preserving correct interleaved order
  const [output, setOutput] = useState<OutputLine[]>([]);
  const [compileInfo, setCompileInfo] = useState<{ compileTimeMs: number; fromCache?: boolean } | null>(null);
  const [execMetrics, setExecMetrics] = useState<ExecutionMetrics | null>(null);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [errorExplanation, setErrorExplanation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compileError, setCompileError] = useState<string | null>(null);

  useEffect(() => {
    const socket = io(ENGINE_URL, {
      // Prefer WebSocket for lower latency, fallback to polling
      transports: ['websocket', 'polling'],
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      timeout: 15000,
      // Force new connection on reconnect to avoid stale state
      forceNew: false,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      setError(null);
      console.log('[WS] Connected:', socket.id);
    });
    socket.on('disconnect', (reason) => {
      setIsConnected(false);
      console.log('[WS] Disconnected:', reason);
      // If engine-side disconnect, mark running as false
      if (reason === 'io server disconnect' || reason === 'transport close') {
        setIsRunning(false);
      }
    });
    socket.on('connect_error', (err: Error) => {
      setIsConnected(false);
      console.warn('[WebSocket] Connection error:', err.message);
    });

    // Unified output — stdout and stderr go into the SAME array
    // in the order they arrive, preserving the natural program output sequence
    socket.on('stdout', (data: string) => {
      setOutput(prev => appendOutput(prev, { type: 'stdout', text: data, timestamp: Date.now() }));
    });

    socket.on('stderr', (data: string) => {
      setOutput(prev => appendOutput(prev, { type: 'stderr', text: data, timestamp: Date.now() }));
    });

    socket.on('compile_success', (data: { compileTimeMs: number; fromCache?: boolean }) => {
      setCompileInfo(data);
    });

    socket.on('compile_error', (data: string) => {
      setCompileError(data);
      setIsRunning(false);
    });

    socket.on('execution_metrics', (data: ExecutionMetrics) => {
      setExecMetrics(data);
    });

    socket.on('process_exit', (code: number) => {
      setExitCode(code);
      setIsRunning(false);
    });

    socket.on('error_explanation', (data: string) => {
      setErrorExplanation(data);
    });

    // Socket.IO 'error' is used by the backend for app-level errors
    socket.on('error', (data: string | Error) => {
      const message = typeof data === 'string' ? data : data?.message || 'Unknown error';
      setError(message);
      setIsRunning(false);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const runCode = useCallback((code: string, language: string, compilerFlags?: string) => {
    console.log('[WS] runCode called', { hasSocket: !!socketRef.current, connected: socketRef.current?.connected, language, codeLen: code?.length });
    if (!socketRef.current) {
      console.error('[WS] No socket ref!');
      return;
    }
    // Reset all state for new run
    setOutput([]);
    setCompileInfo(null);
    setExecMetrics(null);
    setExitCode(null);
    setErrorExplanation(null);
    setError(null);
    setCompileError(null);
    setIsRunning(true);
    console.log('[WS] Emitting run_code event...');
    socketRef.current.emit('run_code', { code, language, compilerFlags });
    console.log('[WS] run_code emitted successfully');
  }, []);

  const sendStdin = useCallback((input: string) => {
    if (!socketRef.current) return;
    // Echo the input in the terminal output so user can see what they typed
    setOutput(prev => appendOutput(prev, { type: 'stdin' as const, text: input, timestamp: Date.now() }));
    socketRef.current.emit('stdin', input);
  }, []);

  const killProcess = useCallback(() => {
    socketRef.current?.emit('kill_process');
    setIsRunning(false);
  }, []);

  const clearOutput = useCallback(() => {
    setOutput([]);
    setCompileInfo(null);
    setExecMetrics(null);
    setExitCode(null);
    setErrorExplanation(null);
    setError(null);
    setCompileError(null);
  }, []);

  return {
    isConnected, isRunning, output,
    compileInfo, execMetrics, exitCode,
    errorExplanation, error, compileError,
    runCode, sendStdin, killProcess, clearOutput,
  };
}
