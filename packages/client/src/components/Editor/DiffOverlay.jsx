import { useCallback } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { Check, X, FileCode } from 'lucide-react';
import useEditorStore from '../../store/editorStore';
import './DiffOverlay.css';

/**
 * DiffOverlay — Shows a Monaco inline diff editor when the AI has
 * made changes to a file. Provides Accept / Reject buttons.
 */
export default function DiffOverlay({ filePath, language, diff }) {
  const acceptDiff = useEditorStore(s => s.acceptDiff);
  const rejectDiff = useEditorStore(s => s.rejectDiff);

  const handleAccept = useCallback(() => {
    acceptDiff(filePath);
  }, [filePath, acceptDiff]);

  const handleReject = useCallback(() => {
    rejectDiff(filePath);
  }, [filePath, rejectDiff]);

  const handleDiffEditorMount = useCallback((editor) => {
    // Apply the orion-space theme
    editor.updateOptions({
      readOnly: true,
      renderSideBySide: false, // inline diff mode
    });
  }, []);

  const fileName = filePath.split('/').pop();

  return (
    <div className="diff-overlay">
      {/* Diff toolbar */}
      <div className="diff-toolbar">
        <div className="diff-toolbar-left">
          <FileCode size={14} className="diff-toolbar-icon" />
          <span className="diff-toolbar-title">AI Changes — {fileName}</span>
          <span className="diff-toolbar-badge">Review Required</span>
        </div>
        <div className="diff-toolbar-actions">
          <button className="diff-btn diff-btn-reject" onClick={handleReject} title="Reject all changes">
            <X size={14} />
            <span>Reject</span>
          </button>
          <button className="diff-btn diff-btn-accept" onClick={handleAccept} title="Accept all changes">
            <Check size={14} />
            <span>Accept</span>
          </button>
        </div>
      </div>

      {/* Monaco Diff Editor */}
      <div className="diff-editor-container">
        <DiffEditor
          height="100%"
          language={language || 'plaintext'}
          original={diff.originalContent}
          modified={diff.newContent}
          onMount={handleDiffEditorMount}
          theme="orion-space"
          options={{
            readOnly: true,
            renderSideBySide: false,
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
            fontLigatures: true,
            lineHeight: 22,
            letterSpacing: 0.3,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            renderLineHighlight: 'none',
            padding: { top: 8 },
            automaticLayout: true,
            stickyScroll: { enabled: false },
            originalEditable: false,
            renderOverviewRuler: false,
            diffWordWrap: 'on',
          }}
        />
      </div>
    </div>
  );
}
