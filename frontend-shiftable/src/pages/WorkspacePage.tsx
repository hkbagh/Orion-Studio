import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Play, Sparkles, ChevronRight, Loader2, Save,
  FileCode2, FolderTree, TerminalSquare, Settings
} from 'lucide-react';
import WorkspaceFileTree from '../components/WorkspaceFileTree';
import CodeEditor, { getMonacoLanguage } from '../components/CodeEditor';
import WebSocketTerminal from '../components/WebSocketTerminal';
import { getWorkspaceTree, getWorkspaceFile, saveWorkspaceFile, deleteWorkspacePath } from '../services/api';
import type { WorkspaceNode } from '../types';

export default function WorkspacePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [tree, setTree] = useState<WorkspaceNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [fileContent, setFileContent] = useState<string>('');
  const [modified, setModified] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'editor' | 'terminal'>('editor');
  const [showSidebar, setShowSidebar] = useState(true);
  
  const contentRef = useRef(fileContent);

  useEffect(() => { contentRef.current = fileContent; }, [fileContent]);

  const loadTree = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await getWorkspaceTree(sessionId);
      if (res.success) setTree(res.tree);
    } catch (err) { console.error('Failed to load tree:', err); }
  }, [sessionId]);

  useEffect(() => { loadTree(); }, [loadTree]);

  const handleFileSelect = async (path: string) => {
    if (!sessionId) return;
    if (modified && selectedFile) {
      await handleSave();
    }
    try {
      const res = await getWorkspaceFile(sessionId, path);
      if (res.success) {
        setSelectedFile(path);
        setFileContent(res.content);
        setModified(false);
      }
    } catch (err) { console.error('Failed to load file:', err); }
  };

  const handleSave = async () => {
    if (!sessionId || !selectedFile) return;
    setSaving(true);
    try {
      await saveWorkspaceFile(sessionId, selectedFile, contentRef.current);
      setModified(false);
    } catch (err) { console.error('Failed to save:', err); }
    finally { setSaving(false); }
  };

  const handleDeletePath = async (path: string) => {
    if (!sessionId) return;
    if (!confirm(`Delete "${path}"?`)) return;
    try {
      const res = await deleteWorkspacePath(sessionId, path);
      if (res.success) {
        if (selectedFile === path || selectedFile.startsWith(path + '/')) {
          setSelectedFile('');
          setFileContent('');
        }
        loadTree();
      }
    } catch (err) { console.error('Delete failed:', err); }
  };

  const getRunPayload = () => {
    if (!selectedFile || !fileContent) return null;
    const ext = selectedFile.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
      py: 'python', js: 'javascript', ts: 'typescript', cpp: 'cpp', c: 'c',
      java: 'java', go: 'go', rs: 'rust', cs: 'csharp', kt: 'kotlin',
      rb: 'ruby', php: 'php', swift: 'swift', dart: 'dart', r: 'r', sql: 'sql',
    };
    return { code: contentRef.current, language: langMap[ext] || 'javascript' };
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [sessionId, selectedFile]);

  const fileName = selectedFile.split('/').pop() || '';
  const currentLangName = selectedFile ? getMonacoLanguage(selectedFile) : '';

  return (
    <div className="flex h-screen w-full bg-black text-[#ededed] overflow-hidden font-sans">
      
      {/* Sidebar Navigation */}
      <div className="w-14 shrink-0 flex flex-col items-center py-4 bg-zinc-950 border-r border-white/[0.04]">
        <button onClick={() => navigate('/')} className="mb-8 p-2 rounded-md hover:bg-white/[0.05] transition-colors">
          <Sparkles size={20} className="text-white" />
        </button>
        <button className="p-2.5 rounded-md hover:bg-white/[0.05] bg-white/[0.08] text-white transition-colors mb-2">
          <FolderTree size={18} />
        </button>
        <div className="flex-1" />
        <button className="p-2.5 rounded-md hover:bg-white/[0.05] text-zinc-500 hover:text-zinc-300 transition-colors">
          <Settings size={18} />
        </button>
      </div>

      {/* Explorer Pane */}
      {showSidebar && (
        <div className="w-64 shrink-0 bg-zinc-950/50 border-r border-white/[0.04] flex flex-col">
          <div className="h-14 flex flex-col justify-center px-4 shrink-0 border-b border-transparent">
            <span className="text-xs font-semibold tracking-wide text-zinc-300">EXPLORER</span>
          </div>
          <div className="flex-1 overflow-y-auto mt-2">
            <WorkspaceFileTree
              tree={tree}
              onFileSelect={handleFileSelect}
              selectedFile={selectedFile}
              onDeletePath={handleDeletePath}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-black relative">
        {/* Header Bar */}
        <header className="h-14 shrink-0 border-b border-white/[0.04] px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowSidebar(!showSidebar)} className="p-1 rounded hover:bg-white/[0.05] text-zinc-500">
              <TerminalSquare size={16} />
            </button>
            <div className="h-4 w-px bg-white/[0.1] mx-1" />
            <div className="flex items-center text-xs font-medium text-zinc-400 gap-1.5">
              <span>{sessionId}</span>
              {selectedFile && (
                <>
                  <ChevronRight size={14} className="text-zinc-600" />
                  <span className="text-zinc-200">{fileName} {modified && <span className="text-blue-400 ml-1">●</span>}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
               onClick={handleSave} 
               disabled={!modified || saving}
               className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                 modified ? 'bg-white text-black hover:bg-zinc-200' : 'bg-transparent text-zinc-500 cursor-not-allowed'
               }`}
             >
               {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
               Save
             </button>
             <button
               onClick={() => document.querySelector<HTMLButtonElement>('[title="Run code (Ctrl+Enter)"]')?.click()}
               disabled={!selectedFile}
               className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-white/[0.08] hover:bg-zinc-800 text-xs font-medium rounded-md transition-all text-white disabled:opacity-50"
             >
               <Play size={12} />
               Run
             </button>
          </div>
        </header>

        {/* Editor Area */}
        <div className="flex-1 min-h-0 flex flex-col relative">
           {selectedFile ? (
             <div className="flex-1 min-h-0 relative">
               <CodeEditor
                 content={fileContent}
                 language={currentLangName}
                 onChange={(val) => { setFileContent(val || ''); setModified(true); }}
               />
             </div>
           ) : (
             <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 gap-3">
               <FileCode2 size={48} className="opacity-20" />
               <p className="text-sm font-medium">Select a file to start editing</p>
             </div>
           )}

           {/* Minimial Terminal Drawer */}
           <div className={`absolute bottom-0 left-0 right-0 border-t border-white/[0.08] bg-zinc-950/95 backdrop-blur-xl transition-all duration-300 flex flex-col shadow-2xl ${activeTab === 'terminal' ? 'h-72' : 'h-10'}`}>
             <div className="h-10 shrink-0 flex items-center px-4 justify-between cursor-pointer" onClick={() => setActiveTab(activeTab === 'terminal' ? 'editor' : 'terminal')}>
                <span className="text-xs font-semibold tracking-wide flex items-center gap-2">
                  <TerminalSquare size={14} className={activeTab === 'terminal' ? 'text-blue-400' : 'text-zinc-500'} />
                  TERMINAL
                </span>
                <ChevronRight size={14} className={`text-zinc-500 transition-transform ${activeTab === 'terminal' ? 'rotate-90' : ''}`} />
             </div>
             {activeTab === 'terminal' && (
               <div className="flex-1 min-h-0">
                  <WebSocketTerminal
                    initialCode={fileContent}
                    language={currentLangName}
                    onRunRequest={getRunPayload}
                  />
               </div>
             )}
           </div>
        </div>
      </div>
    </div>
  );
}
