import { ChevronRight, FileCode } from 'lucide-react';
import { getFileIcon } from '../../utils/languageMap';

/**
 * Breadcrumbs — shows the file path as clickable segments above the editor.
 */
export default function Breadcrumbs({ filePath }) {
  if (!filePath) return null;

  const segments = filePath.split('/').filter(Boolean);
  const fileName = segments[segments.length - 1];

  return (
    <div className="breadcrumbs">
      <span className="breadcrumb-segment breadcrumb-root">
        <FileCode size={12} />
        workspace
      </span>
      {segments.map((segment, i) => (
        <span key={i} className="breadcrumb-group">
          <ChevronRight size={10} className="breadcrumb-separator" />
          <span
            className={`breadcrumb-segment ${i === segments.length - 1 ? 'breadcrumb-active' : ''}`}
          >
            {i === segments.length - 1 ? getFileIcon(segment) + ' ' : ''}
            {segment}
          </span>
        </span>
      ))}
    </div>
  );
}
