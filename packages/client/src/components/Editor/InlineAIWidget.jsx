import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Check, X } from 'lucide-react';
import './InlineAI.css';

/**
 * InlineAIWidget — appears when user presses Ctrl+K with selected code.
 * Sends the selected code to the AI for editing and shows a diff preview.
 */
export default function InlineAIWidget({ selectedText, filePath, position, onAccept, onReject }) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Use the AI chat endpoint with a special inline-edit instruction
      const instruction = `Edit the following code according to the user's instruction. Return ONLY the edited code, nothing else — no explanation, no markdown fences, no backticks. Just the pure code.

File: ${filePath}

Selected code:
\`\`\`
${selectedText}
\`\`\`

Instruction: ${prompt}`;

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: instruction,
          workspaceId: 'local',
        }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let editedCode = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                editedCode += data.content;
              }
            } catch {}
          }
        }
      }

      // Clean up — remove any markdown code fences the model might have added
      let cleaned = editedCode.trim();
      if (cleaned.startsWith('```')) {
        const firstNewline = cleaned.indexOf('\n');
        cleaned = cleaned.substring(firstNewline + 1);
      }
      if (cleaned.endsWith('```')) {
        cleaned = cleaned.substring(0, cleaned.lastIndexOf('```'));
      }
      cleaned = cleaned.trim();

      setResult(cleaned);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      onReject();
    }
  };

  // Compute simple diff lines for preview
  const diffLines = result ? computeDiff(selectedText, result) : [];

  return (
    <div className="inline-ai-widget" style={{ top: position?.top, left: position?.left }}>
      <div className="inline-ai-header">
        <Sparkles size={12} />
        <span>Inline AI Edit</span>
      </div>

      <div className="inline-ai-input-row">
        <input
          ref={inputRef}
          className="inline-ai-input"
          placeholder="Describe the edit (e.g., 'add error handling')..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
        <button
          className="inline-ai-submit"
          onClick={handleSubmit}
          disabled={!prompt.trim() || loading}
        >
          <Send size={12} />
        </button>
      </div>

      {loading && (
        <div className="inline-ai-loading">
          <div className="inline-ai-loading-spinner" />
          Generating edit...
        </div>
      )}

      {error && (
        <div className="inline-ai-loading" style={{ color: 'var(--status-error)' }}>
          ⚠️ {error}
        </div>
      )}

      {result && (
        <>
          <div className="inline-ai-preview">
            {diffLines.map((line, i) => (
              <div
                key={i}
                className={
                  line.type === 'add' ? 'inline-ai-diff-add' :
                  line.type === 'remove' ? 'inline-ai-diff-remove' : ''
                }
              >
                <span style={{ opacity: 0.5, marginRight: '8px' }}>
                  {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
                </span>
                {line.content}
              </div>
            ))}
          </div>

          <div className="inline-ai-actions">
            <button className="inline-ai-btn inline-ai-btn-reject" onClick={onReject}>
              <X size={12} style={{ marginRight: 4 }} /> Reject
            </button>
            <button className="inline-ai-btn inline-ai-btn-accept" onClick={() => onAccept(result)}>
              <Check size={12} style={{ marginRight: 4 }} /> Accept
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Simple line-level diff for preview
 */
function computeDiff(original, edited) {
  const origLines = original.split('\n');
  const editLines = edited.split('\n');
  const diff = [];

  const maxLen = Math.max(origLines.length, editLines.length);

  for (let i = 0; i < maxLen; i++) {
    const orig = origLines[i];
    const edit = editLines[i];

    if (orig === undefined) {
      diff.push({ type: 'add', content: edit });
    } else if (edit === undefined) {
      diff.push({ type: 'remove', content: orig });
    } else if (orig !== edit) {
      diff.push({ type: 'remove', content: orig });
      diff.push({ type: 'add', content: edit });
    } else {
      diff.push({ type: 'same', content: orig });
    }
  }

  return diff;
}
