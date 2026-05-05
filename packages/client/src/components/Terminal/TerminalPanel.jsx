import { useEffect, useRef, useCallback } from 'react';
import { Terminal as TerminalIcon, Plus, X, RotateCcw } from 'lucide-react';
import useTerminal from '../../hooks/useTerminal';
import useWorkspaceStore from '../../store/workspaceStore';
import './Terminal.css';

export default function TerminalPanel() {
  const toggleTerminal = useWorkspaceStore(s => s.toggleTerminal);
  const pendingCommand = useWorkspaceStore(s => s.pendingCommand);
  const setPendingCommand = useWorkspaceStore(s => s.setPendingCommand);
  const termContainerRef = useRef(null);
  const { isConnected, initTerminal, connect, disconnect, fitTerminal, sendInput } = useTerminal('local');
  const initialized = useRef(false);

  // Initialize terminal + auto-connect (once)
  useEffect(() => {
    if (termContainerRef.current && !initialized.current) {
      initialized.current = true;
      initTerminal(termContainerRef.current);
      setTimeout(() => connect(), 200);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Watch for pending run commands
  useEffect(() => {
    if (pendingCommand && isConnected) {
      sendInput(pendingCommand + '\n');
      setPendingCommand(null);
    }
  }, [pendingCommand, isConnected, sendInput, setPendingCommand]);

  // Refit terminal on mount
  useEffect(() => {
    const timer = setTimeout(() => fitTerminal(), 150);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
