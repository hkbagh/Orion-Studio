import { useRef, useCallback, useState } from 'react';
import Editor from '@monaco-editor/react';
import useEditorStore from '../../store/editorStore';
import InlineAIWidget from './InlineAIWidget';
import DiffOverlay from './DiffOverlay';
import './Editor.css';

export default function MonacoEditor({ fileSystem }) {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const activeFile = useEditorStore(s => s.getActiveFile());
  const updateFileContent = useEditorStore(s => s.updateFileContent);
  const pendingDiffs = useEditorStore(s => s.pendingDiffs);
  const [inlineAI, setInlineAI] = useState(null); // { selectedText, position }

  // Check if the active file has a pending AI diff
  const activeDiff = activeFile ? pendingDiffs[activeFile.path] : null;

  const handleEditorMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Custom theme
    monaco.editor.defineTheme('orion-space', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '5c6370', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'c678dd' },
        { token: 'string', foreground: '98c379' },
        { token: 'number', foreground: 'd19a66' },
        { token: 'type', foreground: 'e06c75' },
        { token: 'function', foreground: '61afef' },
        { token: 'variable', foreground: 'e06c75' },
        { token: 'constant', foreground: 'd19a66' },
        { token: 'operator', foreground: 'c678dd' },
        { token: 'tag', foreground: 'e06c75' },
        { token: 'attribute.name', foreground: 'd19a66' },
        { token: 'attribute.value', foreground: '98c379' },
      ],
      colors: {
        'editor.background': '#0a0a0a',
        'editor.foreground': '#d4d4d8',
        'editor.lineHighlightBackground': '#ffffff06',
        'editorLineNumber.foreground': '#52525b',
        'editorLineNumber.activeForeground': '#a1a1aa',
        'editor.selectionBackground': '#3b82f633',
        'editor.inactiveSelectionBackground': '#3b82f61a',
        'editorIndentGuide.background': '#27272a',
        'editorIndentGuide.activeBackground': '#3f3f46',
        'editorCursor.foreground': '#3b82f6',
        'editorWhitespace.foreground': '#27272a',
        'editor.findMatchBackground': '#3b82f644',
        'editor.findMatchHighlightBackground': '#3b82f622',
        'editorBracketMatch.background': '#3b82f633',
        'editorBracketMatch.border': '#3b82f6',
        'editorGutter.background': '#0a0a0a',
        'scrollbar.shadow': '#00000000',
        'editorOverviewRuler.border': '#00000000',
        'minimap.background': '#0a0a0a',
      },
    });

    monaco.editor.setTheme('orion-space');

    // ── Ctrl+S: Save file ──
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      const file = useEditorStore.getState().getActiveFile();
      if (file && fileSystem) {
        fileSystem.saveFile(file.path, file.content);
        useEditorStore.getState().markClean(file.id);
      }
    });

    // ── Ctrl+K: Inline AI Edit ──
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
      const selection = editor.getSelection();
      const selectedText = editor.getModel().getValueInRange(selection);

      if (!selectedText.trim()) {
        // If no selection, select the current line
        const lineNumber = selection.startLineNumber;
        const lineContent = editor.getModel().getLineContent(lineNumber);
        const fullLineRange = new monaco.Range(lineNumber, 1, lineNumber, lineContent.length + 1);
        editor.setSelection(fullLineRange);
        openInlineAI(editor, lineContent, fullLineRange);
      } else {
        openInlineAI(editor, selectedText, selection);
      }
    });

    // Focus editor
    editor.focus();
  }, [fileSystem]);

  const openInlineAI = (editor, text, selection) => {
    // Get position below the selection
    const coords = editor.getScrolledVisiblePosition({
      lineNumber: selection.endLineNumber,
      column: 1,
    });

    setInlineAI({
      selectedText: text,
      selection,
      position: {
        top: (coords?.top || 100) + 30,
        left: Math.max(coords?.left || 60, 60),
      },
    });
  };

  const handleInlineAccept = useCallback((newCode) => {
    if (!inlineAI || !editorRef.current) return;

    const editor = editorRef.current;
    const model = editor.getModel();

    // Replace the selected range with the AI-generated code
    editor.executeEdits('inline-ai', [{
      range: inlineAI.selection,
      text: newCode,
    }]);

    // Update the store
    const updatedContent = model.getValue();
    const file = useEditorStore.getState().getActiveFile();
    if (file) {
      updateFileContent(file.id, updatedContent);
    }

    setInlineAI(null);
    editor.focus();
  }, [inlineAI, updateFileContent]);

  const handleInlineReject = useCallback(() => {
    setInlineAI(null);
    editorRef.current?.focus();
  }, []);

  const handleChange = useCallback((value) => {
    if (activeFile) {
      updateFileContent(activeFile.id, value || '');
    }
  }, [activeFile, updateFileContent]);

  if (!activeFile) {
    return null;
  }

  // If there's a pending diff, show the diff overlay instead
  if (activeDiff) {
    return (
      <div className="monaco-container" style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <DiffOverlay
          filePath={activeFile.path}
          language={activeFile.language}
          diff={activeDiff}
        />
      </div>
    );
  }

  return (
    <div className="monaco-container" style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Editor
        key={activeFile.id}
        height="100%"
        language={activeFile.language}
        value={activeFile.content}
        onChange={handleChange}
        onMount={handleEditorMount}
        theme="orion-space"
        options={{
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
          fontLigatures: true,
          lineHeight: 22,
          letterSpacing: 0.3,
          minimap: { enabled: true, scale: 1 },
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          renderLineHighlight: 'line',
          bracketPairColorization: { enabled: true },
          guides: {
            bracketPairs: true,
            indentation: true,
          },
          padding: { top: 8 },
          suggest: {
            showIcons: true,
            preview: true,
          },
          wordWrap: 'off',
          tabSize: 2,
          insertSpaces: true,
          formatOnPaste: true,
          autoClosingBrackets: 'always',
          autoClosingQuotes: 'always',
          automaticLayout: true,
          stickyScroll: { enabled: true },
        }}
      />

      {/* Inline AI Edit Widget */}
      {inlineAI && (
        <InlineAIWidget
          selectedText={inlineAI.selectedText}
          filePath={activeFile.path}
          position={inlineAI.position}
          onAccept={handleInlineAccept}
          onReject={handleInlineReject}
        />
      )}
    </div>
  );
}
