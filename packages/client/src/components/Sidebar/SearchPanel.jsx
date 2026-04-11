import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, CaseSensitive, Regex } from 'lucide-react';
import useEditorStore from '../../store/editorStore';
import api from '../../services/api';
import { getLanguageFromFilename } from '../../utils/languageMap';
import { getFileIcon } from '../../utils/languageMap';
import './SearchPanel.css';

export default function SearchPanel() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [regex, setRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const openFile = useEditorStore(s => s.openFile);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const doSearch = useCallback(async (q) => {
    if (!q.trim()) {
      setResults(null);
      setTotal(0);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/workspaces/local/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, regex, caseSensitive }),
      });
      const data = await response.json();
      setResults(data.results);
      setTotal(data.total);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  }, [regex, caseSensitive]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);

    // Debounce search
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      doSearch(query);
    }
  };

  const handleClickMatch = async (filePath, lineNumber) => {
    try {
      const result = await fetch(`/api/workspaces/local/file/${filePath}`).then(r => r.json());
      const language = getLanguageFromFilename(filePath.split('/').pop());
      openFile({
        path: filePath,
        name: filePath.split('/').pop(),
        content: result.content,
        language,
      });
    } catch (err) {
      console.error('Failed to open file:', err);
    }
  };

  const highlightMatch = (text, query) => {
    if (!query) return text;
    try {
      const escaped = regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const flags = caseSensitive ? 'g' : 'gi';
      const re = new RegExp(`(${escaped})`, flags);
      const parts = text.split(re);
      return parts.map((part, i) =>
        re.test(part) ? <span key={i} className="search-highlight">{part}</span> : part
      );
    } catch {
      return text;
    }
  };

  return (
    <div className="search-panel">
      <div className="search-input-area">
        <div className="search-input-wrapper">
          <Search size={14} className="search-input-icon" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search across files..."
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div className="search-options">
          <button
            className={`search-option-btn ${caseSensitive ? 'active' : ''}`}
            onClick={() => { setCaseSensitive(!caseSensitive); if (query) doSearch(query); }}
            title="Case Sensitive"
          >
            Aa
          </button>
          <button
            className={`search-option-btn ${regex ? 'active' : ''}`}
            onClick={() => { setRegex(!regex); if (query) doSearch(query); }}
            title="Regular Expression"
          >
            .*
          </button>
        </div>
      </div>

      <div className="search-results">
        {loading && (
          <div className="search-loading">
            <span className="animate-spin" style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid var(--text-tertiary)', borderTopColor: 'transparent', borderRadius: '50%' }} />
            Searching...
          </div>
        )}

        {!loading && results === null && (
          <div className="search-empty">
            <Search size={20} />
            <span>Type to search across workspace files</span>
          </div>
        )}

        {!loading && results && results.length === 0 && (
          <div className="search-empty">
            <span>No results found for "{query}"</span>
          </div>
        )}

        {!loading && results && results.length > 0 && (
          <>
            <div className="search-results-header">
              {total} file{total !== 1 ? 's' : ''} with matches
            </div>
            {results.map((fileResult, i) => (
              <div key={i} className="search-result-file">
                <div className="search-result-file-header" onClick={() => handleClickMatch(fileResult.file)}>
                  <span>{getFileIcon(fileResult.file.split('/').pop())}</span>
                  <span className="search-result-file-name">{fileResult.file}</span>
                  <span className="search-result-file-count">{fileResult.matches.length}</span>
                </div>
                {fileResult.matches.map((match, j) => (
                  <div
                    key={j}
                    className="search-result-match"
                    onClick={() => handleClickMatch(fileResult.file, match.line)}
                  >
                    <span className="search-result-line-num">{match.line}</span>
                    <span className="search-result-content">
                      {highlightMatch(match.content, query)}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
