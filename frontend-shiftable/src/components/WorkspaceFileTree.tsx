import { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, File as FileIcon } from 'lucide-react';
import type { WorkspaceNode } from '../types';

interface WorkspaceFileTreeProps {
  tree: WorkspaceNode[];
  onFileSelect: (path: string) => void;
  selectedFile?: string;
  onDeletePath?: (path: string) => void;
}

function TreeNode({ node, level, onFileSelect, selectedFile, onDeletePath }: {
  node: WorkspaceNode; level: number;
  onFileSelect: (path: string) => void;
  selectedFile?: string;
  onDeletePath?: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(level < 2);
  const isFolder = node.type === 'directory';
  const isSelected = selectedFile === node.path;

  const getFileIcon = (name: string) => {
    // Keep emoji or use feather icons
    const ext = name.split('.').pop()?.toLowerCase();
    const iconMap: Record<string, string> = {
      py: '🐍', js: '📜', ts: '🔷', tsx: '⚛️', jsx: '⚛️',
      java: '☕', go: '🐹', rs: '🦀', cpp: '⚡', c: '⚡',
      cs: '🟣', kt: '🟠', rb: '💎', php: '🐘', swift: '🍎',
      sql: '🗃️', json: '📋', yaml: '📋', yml: '📋', md: '📝',
      html: '🌐', css: '🎨', sh: '⚙️', xml: '📄', toml: '⚙️',
    };
    if (iconMap[ext || '']) { return <span className="text-[14px] leading-none">{iconMap[ext || '']}</span>; }
    return <FileIcon size={14} className="text-zinc-500" />;
  };

  return (
    <div>
      <div
        className={`group flex items-center gap-1.5 cursor-pointer text-[13px] transition-all leading-6 select-none rounded-md mx-2 px-1 ${
          isSelected 
            ? 'bg-white/[0.08] text-white font-medium shadow-sm' 
            : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
        }`}
        style={{ paddingLeft: `${level * 12 + 4}px` }}
        onClick={() => {
          if (isFolder) setExpanded(!expanded);
          else onFileSelect(node.path);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          if (onDeletePath) {
            if (confirm(`Delete ${node.name}?`)) onDeletePath(node.path);
          }
        }}
      >
        <div className="w-4 h-4 flex items-center justify-center shrink-0">
          {isFolder ? (
            expanded ? <ChevronDown size={14} className="text-zinc-500" /> : <ChevronRight size={14} className="text-zinc-500" />
          ) : <div className="w-4" />}
        </div>
        
        <div className="w-4 h-4 flex items-center justify-center shrink-0">
          {isFolder ? (
            <Folder size={14} className="text-blue-400" />
          ) : (
            getFileIcon(node.name)
          )}
        </div>
        
        <span className="truncate flex-1 font-sans mt-px">{node.name}</span>
      </div>
      
      {isFolder && expanded && node.children?.map((child) => (
        <TreeNode
          key={child.path}
          node={child}
          level={level + 1}
          onFileSelect={onFileSelect}
          selectedFile={selectedFile}
          onDeletePath={onDeletePath}
        />
      ))}
    </div>
  );
}

export default function WorkspaceFileTree({ tree, onFileSelect, selectedFile, onDeletePath }: WorkspaceFileTreeProps) {
  return (
    <div className="h-full flex flex-col font-sans">
      <div className="flex-1 overflow-y-auto py-2">
        {tree.map(node => (
          <TreeNode
            key={node.path}
            node={node}
            level={0}
            onFileSelect={onFileSelect}
            selectedFile={selectedFile}
            onDeletePath={onDeletePath}
          />
        ))}
        {tree.length === 0 && (
          <div className="px-5 py-3 text-sm text-zinc-600 italic">
            Workspace is empty
          </div>
        )}
      </div>
    </div>
  );
}
