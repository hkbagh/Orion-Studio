import { useRef, useEffect, useCallback, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

/**
 * Custom hook to manage a terminal instance and its WebSocket connection.
 *
 * Designed to be StrictMode-safe: uses a module-level singleton for the
 * terminal + WebSocket so double-mount/unmount cycles don't destroy state.
 */

// Module-level singletons — survive React re-mounts
let _terminal = null;
let _fitAddon = null;
let _ws = null;
let _container = null;
let _listenersAttached = false;

export default function useTerminal(workspaceId = 'local') {
  const [isConnected, setIsConnected] = useState(false);
  const mountedRef = useRef(true);

  const fitTerminal = useCallback(() => {
    try { _fitAddon?.fit(); } catch {}
  }, []);

  const initTerminal = useCallback((container) => {
    // If already initialized into THIS container, skip
    if (_terminal && _container === container) {
      fitTerminal();
      return;
    }

    // If initialized into a different container, dispose first
    if (_terminal) {
      _terminal.dispose();
      _terminal = null;
      _fitAddon = null;
      _listenersAttached = false;
    }

    _container = container;

    const terminal = new Terminal({
      theme: {
        background: '#000000',
        foreground: '#e4e4e7',
        cursor: '#3b82f6',
        cursorAccent: '#000000',
        selectionBackground: 'rgba(59, 130, 246, 0.3)',
        black: '#18181b',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#a78bfa',
        cyan: '#22d3ee',
        white: '#e4e4e7',
        brightBlack: '#71717a',
        brightRed: '#fca5a5',
        brightGreen: '#6ee7b7',
        brightYellow: '#fcd34d',
        brightBlue: '#60a5fa',
        brightMagenta: '#c4b5fd',
        brightCyan: '#67e8f9',
        brightWhite: '#fafafa',
      },
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      fontSize: 13,
      lineHeight: 1.4,
      letterSpacing: 0.3,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 5000,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());

    terminal.open(container);
    fitAddon.fit();

    _fitAddon = fitAddon;
    _terminal = terminal;

    // Auto-fit on container resize
    const ro = new ResizeObserver(() => {
      try { fitAddon.fit(); } catch {}
    });
    ro.observe(container);
  }, [fitTerminal]);

  const connect = useCallback(() => {
    // Already connected
    if (_ws?.readyState === WebSocket.OPEN) {
      setIsConnected(true);
      return;
    }
    // Close stale socket
    if (_ws) {
      _ws.onclose = null; // prevent triggering setIsConnected(false)
      _ws.close();
      _ws = null;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/terminal?workspaceId=${workspaceId}`;

    const ws = new WebSocket(wsUrl);
    _ws = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setIsConnected(true);
      _terminal?.writeln('\x1b[32m● Connected to workspace terminal\x1b[0m\r\n');

      if (_terminal) {
        ws.send(JSON.stringify({
          type: 'resize',
          cols: _terminal.cols,
          rows: _terminal.rows,
        }));
      }
    };

    ws.onmessage = (event) => {
      _terminal?.write(event.data);
    };

    ws.onclose = () => {
      if (mountedRef.current) setIsConnected(false);
    };

    ws.onerror = () => {
      if (mountedRef.current) setIsConnected(false);
    };

    // Attach input/resize listeners once per terminal instance
    if (!_listenersAttached && _terminal) {
      _listenersAttached = true;

      _terminal.onData((data) => {
        if (_ws?.readyState === WebSocket.OPEN) {
          _ws.send(JSON.stringify({ type: 'input', data }));
        }
      });

      _terminal.onResize(({ cols, rows }) => {
        if (_ws?.readyState === WebSocket.OPEN) {
          _ws.send(JSON.stringify({ type: 'resize', cols, rows }));
        }
      });
    }
  }, [workspaceId]);

  const disconnect = useCallback(() => {
    if (_ws) {
      _ws.onclose = null;
      _ws.close();
      _ws = null;
    }
    setIsConnected(false);
  }, []);

  const sendInput = useCallback((data) => {
    if (_ws?.readyState === WebSocket.OPEN) {
      _ws.send(JSON.stringify({ type: 'input', data }));
    }
  }, []);

  // Track mount state — don't setState after unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Do NOT destroy terminal/ws on unmount — StrictMode will re-mount
    };
  }, []);

  return {
    isConnected,
    initTerminal,
    connect,
    disconnect,
    fitTerminal,
    sendInput,
  };
}
