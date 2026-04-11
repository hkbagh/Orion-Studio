import { useEffect, useRef, useCallback } from 'react';
import { Terminal as TerminalIcon, Plus, X, RotateCcw } from 'lucide-react';
import useTerminal from '../../hooks/useTerminal';
import useWorkspaceStore from '../../store/workspaceStore';
import './Terminal.css';

export default function TerminalPanel() {
  const toggleTerminal = useWorkspaceStore(s => s.toggleTerminal);
  const termContainerRef = useRef(null);
  const { isConnected, initTerminal, connect, disconnect, fitTerminal } = useTerminal('local');
  const initialized = useRef(false);

  useEffect(() => {
    if (termContainerRef.current && !initialized.current) {
      initialized.current = true;
      initTerminal(termContainerRef.current);
      // Auto-connect after a small delay to let terminal render
      setTimeout(() => connect(), 200);
    }
  }, [initTerminal, connect]);

  // Refit on visibility changes
  useEffect(() => {
    const timer = setTimeout(() => fitTerminal(), 100);
    return () => clearTimeout(timer);
  }, [fitTerminal]);

  const handleReconnect = useCallback(() => {
    disconnect();
    setTimeout(() => connect(), 300);
  }, [disconnect, connect]);

  return (
    <div className="terminal-panel">
      <div className="terminal-header">
        <div className="terminal-tabs">
          <div className={`terminal-tab active`}>
            <TerminalIcon size={12} />
            <span>Terminal</span>
            <span className={`terminal-status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
          </div>
        </div>
        <div className="terminal-actions">
          <button className="terminal-action-btn" title="Reconnect" onClick={handleReconnect}>
            <RotateCcw size={14} />
          </button>
          <button className="terminal-action-btn" title="New Terminal">
            <Plus size={14} />
          </button>
          <button className="terminal-action-btn" title="Close Panel" onClick={toggleTerminal}>
            <X size={14} />
          </button>
        </div>
      </div>
      <div className="terminal-body" ref={termContainerRef} />
    </div>
  );
}
