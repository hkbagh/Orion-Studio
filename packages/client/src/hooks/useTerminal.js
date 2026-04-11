import { useRef, useEffect, useCallback, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

/**
 * Custom hook to manage a terminal instance and its WebSocket connection.
 */
export default function useTerminal(workspaceId = 'local') {
  const terminalRef = useRef(null);
  const fitAddonRef = useRef(null);
  const wsRef = useRef(null);
  const containerRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  const initTerminal = useCallback((container) => {
    if (terminalRef.current || !container) return;
    containerRef.current = container;

    const terminal = new Terminal({
      theme: {
        background: '#09080d',
        foreground: '#e2e8f0',
        cursor: '#c084fc',
        cursorAccent: '#09080d',
        selectionBackground: 'rgba(192, 132, 252, 0.3)',
        black: '#1a1924',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#8b5cf6',
        magenta: '#d8b4fe',
        cyan: '#e879f9',
        white: '#e2e8f0',
        brightBlack: '#64748b',
        brightRed: '#fca5a5',
        brightGreen: '#6ee7b7',
        brightYellow: '#fcd34d',
        brightBlue: '#a78bfa',
        brightMagenta: '#e9d5ff',
        brightCyan: '#f5d0fe',
        brightWhite: '#f8fafc',
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
    fitAddonRef.current = fitAddon;
    terminalRef.current = terminal;

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
      } catch (e) {
        // Ignore fit errors during rapid resize
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/terminal?workspaceId=${workspaceId}`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      terminalRef.current?.writeln('\x1b[32m● Connected to workspace terminal\x1b[0m\r\n');
      
      // Send terminal dimensions
      if (terminalRef.current) {
        ws.send(JSON.stringify({
          type: 'resize',
          cols: terminalRef.current.cols,
          rows: terminalRef.current.rows,
        }));
      }
    };

    ws.onmessage = (event) => {
      if (terminalRef.current) {
        terminalRef.current.write(event.data);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      terminalRef.current?.writeln('\r\n\x1b[31m● Disconnected from terminal\x1b[0m');
    };

    ws.onerror = (error) => {
      console.error('[Terminal WS Error]:', error);
      setIsConnected(false);
    };

    // Send user input to WebSocket
    terminalRef.current?.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });

    // Handle terminal resize
    terminalRef.current?.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    });
  }, [workspaceId]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setIsConnected(false);
  }, []);

  const fitTerminal = useCallback(() => {
    try {
      fitAddonRef.current?.fit();
    } catch (e) {
      // Ignore
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close();
      terminalRef.current?.dispose();
    };
  }, []);

  return {
    terminalRef,
    containerRef,
    isConnected,
    initTerminal,
    connect,
    disconnect,
    fitTerminal,
  };
}
