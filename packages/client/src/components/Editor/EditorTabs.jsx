import { X, Play } from 'lucide-react';
import useEditorStore from '../../store/editorStore';
import useWorkspaceStore from '../../store/workspaceStore';
import { getFileIcon } from '../../utils/languageMap';
import './Editor.css';

// Map file extensions to run commands
function getRunCommand(filePath) {
  if (!filePath) return null;
  const ext = filePath.split('.').pop()?.toLowerCase();
  const name = filePath.split('/').pop();
  switch (ext) {
    case 'py':   return `python3 "${name}"`;
    case 'js':
    case 'mjs':  return `node "${name}"`;
    case 'ts':   return `npx ts-node "${name}"`;
    case 'java': return `javac "${name}" && java "${name.replace('.java', '')}"`;
    case 'cpp':
    case 'cc':   return `g++ -o program "${name}" && ./program`;
    case 'c':    return `gcc -o program "${name}" && ./program`;
    case 'go':   return `go run "${name}"`;
    case 'rb':   return `ruby "${name}"`;
    case 'rs':   return `rustc "${name}" -o program && ./program`;
    case 'sh':   return `bash "${name}"`;
    case 'html': return `open "${name}" 2>/dev/null || xdg-open "${name}"`;
    default:     return null;
  }
}

export default function EditorTabs() {
  const openFiles = useEditorStore(s => s.openFiles);
  const activeFileId = useEditorStore(s => s.activeFileId);
  const setActiveFile = useEditorStore(s => s.setActiveFile);
  const closeFile = useEditorStore(s => s.closeFile);
  const activeFile = useEditorStore(s => s.getActiveFile());

  const setPendingCommand = useWorkspaceStore(s => s.setPendingCommand);
  const terminalVisible = useWorkspaceStore(s => s.terminalVisible);
  const toggleTerminal = useWorkspaceStore(s => s.toggleTerminal);

  const handleClose = (e, fileId) => {
    e.stopPropagation();
    closeFile(fileId);
  };

  const runCommand = getRunCommand(activeFile?.path);

  const handleRun = () => {
    if (!runCommand) return;
    // Ensure terminal is visible
    if (!terminalVisible) toggleTerminal();
    // Send the run command after a brief delay to let terminal open
    setTimeout(() => {
      setPendingCommand(runCommand);
    }, terminalVisible ? 0 : 300);
  };

  return (
    <div className="editor-tabs">
      <div className="editor-tabs-list">
        {openFiles.map(file => (
          <div
            key={file.id}
            className={`editor-tab ${file.id === activeFileId ? 'active' : ''}`}
            onClick={() => setActiveFile(file.id)}
            title={file.path}
          >
            <span className="editor-tab-icon">{getFileIcon(file.name)}</span>
            <span className="editor-tab-name">{file.name}</span>
            {file.isDirty && <span className="editor-tab-dirty" />}
            <button
              className="editor-tab-close"
              onClick={(e) => handleClose(e, file.id)}
              title="Close"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Run button — right side of tab bar */}
      {runCommand && (
        <button
          className="editor-run-btn"
          onClick={handleRun}
          title={`Run: ${runCommand}`}
        >
          <Play size={14} />
          <span>Run</span>
        </button>
      )}
    </div>
  );
}
