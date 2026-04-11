import { memo } from 'react';
import { ChevronRight } from 'lucide-react';
import { getFileIcon } from '../../utils/languageMap';

const FileNode = memo(function FileNode({ 
  node, 
  depth, 
  isExpanded, 
  isSelected, 
  onSelect, 
  onToggle, 
  onContextMenu, 
  expandedDirs, 
  selectedPath 
}) {
  const isDir = node.type === 'directory';
  const icon = getFileIcon(node.name, isDir);
  const expanded = expandedDirs.has(node.path);

  const handleClick = (e) => {
    e.stopPropagation();
    onSelect(node);
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, node);
  };

  return (
    <div>
      <div
        className={`file-node ${selectedPath === node.path ? 'selected' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        role="treeitem"
        aria-expanded={isDir ? expanded : undefined}
      >
        {/* Chevron for directories */}
        {isDir ? (
          <span className={`file-node-chevron ${expanded ? 'expanded' : ''}`}>
            <ChevronRight size={14} />
          </span>
        ) : (
          <span className="file-node-chevron placeholder" />
        )}

        {/* File icon */}
        <span className="file-node-icon">{icon}</span>

        {/* File name */}
        <span className="file-node-name">{node.name}</span>
      </div>

      {/* Children (if directory is expanded) */}
      {isDir && expanded && node.children && (
        <div className="file-node-children">
          {sortNodes(node.children).map(child => (
            <FileNode
              key={child.path}
              node={child}
              depth={depth + 1}
              expandedDirs={expandedDirs}
              selectedPath={selectedPath}
              onSelect={onSelect}
              onToggle={onToggle}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
});

// Sort: directories first, then alphabetical
function sortNodes(nodes) {
  return [...nodes].sort((a, b) => {
    if (a.type === 'directory' && b.type !== 'directory') return -1;
    if (a.type !== 'directory' && b.type === 'directory') return 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

export default FileNode;
