import { X } from 'lucide-react';
import useEditorStore from '../../store/editorStore';
import { getFileIcon } from '../../utils/languageMap';
import './Editor.css';

export default function EditorTabs() {
  const openFiles = useEditorStore(s => s.openFiles);
  const activeFileId = useEditorStore(s => s.activeFileId);
  const setActiveFile = useEditorStore(s => s.setActiveFile);
  const closeFile = useEditorStore(s => s.closeFile);

  const handleClose = (e, fileId) => {
    e.stopPropagation();
    closeFile(fileId);
  };

  return (
    <div className="editor-tabs">
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
  );
}
