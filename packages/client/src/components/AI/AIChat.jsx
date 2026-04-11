import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, Send, Plus, Settings, Trash2, Terminal, FileCode, Search, Wrench } from 'lucide-react';
import useAIStore from '../../store/aiStore';
import useEditorStore from '../../store/editorStore';
import './AIChat.css';

const SUGGESTIONS = [
  'Explain the project structure',
  'Find and fix any bugs in the code',
  'Add a new API endpoint',
  'Write tests for the main module',
];

const TOOL_ICONS = {
  read_file: '📖',
  write_file: '✍️',
  edit_file: '✏️',
  list_directory: '📁',
  search_files: '🔍',
  run_command: '▶️',
  get_diagnostics: '🔬',
};

export default function AIChat({ fileSystem }) {
  const {
    messages, isStreaming, streamContent,
    activeProvider, activeModel, configuredProviders,
    addMessage, setMessages, setStreaming, appendStreamContent, resetStreamContent,
    setConfig,
  } = useAIStore();

  const [availableModels, setAvailableModels] = useState([]);

  const [input, setInput] = useState('');
  const [toolEvents, setToolEvents] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamContent, toolEvents]);

  // Load AI config on mount
  useEffect(() => {
    fetch('/api/ai/config')
      .then(r => r.json())
      .then(config => setConfig(config))
      .catch(() => {});
      
    fetch('/api/ai/models')
      .then(r => r.json())
      .then(data => {
        if (data.models) setAvailableModels(data.models);
      })
      .catch(() => {});
  }, [setConfig, showSettings]);

  const handleSend = useCallback(async (messageText) => {
    const text = messageText || input.trim();
    if (!text || isStreaming) return;

    setInput('');
    addMessage({ role: 'user', content: text });
    setStreaming(true);
    resetStreamContent();
    setToolEvents([]);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          conversationId,
          workspaceId: 'local',
        }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            const eventType = line.slice(7).trim();
            // Next line should be data:
            continue;
          }
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            try {
              const data = JSON.parse(dataStr);
              // Determine event type from most recent event line
              handleSSEData(data, assistantContent, (content) => {
                assistantContent = content;
              });
            } catch {}
          }
        }
      }

      // Finalize assistant message
      if (assistantContent) {
        addMessage({ role: 'assistant', content: assistantContent, toolEvents: [...toolEvents] });
      }
    } catch (err) {
      addMessage({ role: 'assistant', content: `Error: ${err.message}` });
    } finally {
      setStreaming(false);
      resetStreamContent();
    }
  }, [input, isStreaming, conversationId, addMessage, setStreaming, resetStreamContent, appendStreamContent, toolEvents]);

  const handleSSEData = useCallback((data, currentContent, setContent) => {
    if (data.content !== undefined) {
      // text_delta
      appendStreamContent(data.content);
      setContent(currentContent + data.content);
    }
    if (data.tool) {
      // tool_call or tool_executing
      setToolEvents(prev => [...prev, {
        type: data.result !== undefined ? 'result' : 'call',
        tool: data.tool,
        args: data.args,
        result: data.result,
        id: data.id,
        duration_ms: data.duration_ms,
      }]);

      // If a file was written/edited successfully, trigger the inline diff view
      if ((data.tool === 'write_file' || data.tool === 'edit_file') && data.result?.success && fileSystem) {
        const path = data.result.path || data.args?.path;
        if (path) {
          // Find the active/current content in the editor to use as original
          const editorStore = useEditorStore.getState();
          const existingFile = editorStore.openFiles.find(f => f.path === path);
          const originalContent = existingFile ? existingFile.content : '';

          // Fetch the newly modified file from the backend and set the diff
          fetch(`/api/workspaces/local/file/${path}`)
            .then(res => res.json())
            .then(fileData => {
              if (fileData && fileData.content !== undefined) {
                // Ensure the file is open so the user can see the diff
                if (!existingFile) {
                  editorStore.openFile({ path, name: path.split('/').pop(), content: originalContent });
                } else {
                  editorStore.setActiveFile(existingFile.id);
                }
                // Set the pending diff!
                editorStore.setPendingDiff(path, originalContent, fileData.content);
              }
            })
            .catch(err => console.error("Failed to load edited file for diff:", err));
        }
      }
    }
    if (data.conversationId) {
      setConversationId(data.conversationId);
    }
    if (data.error) {
      appendStreamContent(`\n\n⚠️ ${data.error}`);
    }
  }, [appendStreamContent]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setConversationId(null);
    setToolEvents([]);
    resetStreamContent();
    setInput('');
  };

  const handleModelChange = async (e) => {
    const model = e.target.value;
    const provider = availableModels.find(m => m.id === model)?.provider || 'openrouter';
    
    try {
      await fetch('/api/ai/model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, model }),
      });
      const config = await fetch('/api/ai/config').then(r => r.json());
      setConfig(config);
    } catch {}
  };

  if (showSettings) {
    return <AISettings onBack={() => setShowSettings(false)} />;
  }

  const hasMessages = messages.length > 0 || isStreaming;

  return (
    <div className="ai-chat-panel">
      {/* Header */}
      <div className="ai-chat-header">
        <div className="ai-chat-header-left">
          <div className="ai-chat-header-icon">
            <Bot size={14} />
          </div>
          <span className="ai-chat-header-title">Orion AI</span>
          {activeModel && availableModels.length > 0 ? (
            <select 
              className="ai-chat-model-badge ai-model-select" 
              value={activeModel} 
              onChange={handleModelChange}
              title={activeModel}
            >
              {availableModels.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          ) : activeModel ? (
            <span className="ai-chat-model-badge" title={activeModel}>
              {activeModel.split('/').pop()}
            </span>
          ) : null}
        </div>
        <div className="ai-chat-header-actions">
          <button className="ai-chat-action-btn" onClick={handleNewChat} title="New Chat">
            <Plus size={14} />
          </button>
          <button className="ai-chat-action-btn" onClick={() => setShowSettings(true)} title="Settings">
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="ai-chat-messages">
        {!hasMessages ? (
          <div className="ai-chat-empty">
            <div className="ai-chat-empty-icon">✦</div>
            <div className="ai-chat-empty-title">Orion AI</div>
            <div className="ai-chat-empty-subtitle">
              I can read, write, and edit files in your workspace.<br />
              Ask me to build features, fix bugs, or explain code.
            </div>
            {configuredProviders.length === 0 && (
              <button 
                className="ai-suggestion-btn" 
                onClick={() => setShowSettings(true)}
                style={{ borderColor: 'var(--status-warning)', color: 'var(--status-warning)' }}
              >
                ⚠️ Set up API keys to get started →
              </button>
            )}
            <div className="ai-chat-empty-suggestions">
              {SUGGESTIONS.map((s, i) => (
                <button key={i} className="ai-suggestion-btn" onClick={() => handleSend(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} />
            ))}

            {/* Streaming content */}
            {isStreaming && streamContent && (
              <div className="ai-message">
                <div className="ai-message-avatar assistant">
                  <Bot size={12} />
                </div>
                <div className="ai-message-content">
                  <div className="ai-message-role assistant">Orion</div>
                  <div className="ai-message-text">
                    {streamContent}
                    <span className="ai-streaming-indicator">
                      <span className="ai-streaming-dot" />
                      <span className="ai-streaming-dot" />
                      <span className="ai-streaming-dot" />
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Tool events during streaming */}
            {isStreaming && toolEvents.length > 0 && (
              <div style={{ paddingLeft: '32px' }}>
                {toolEvents.map((evt, i) => (
                  <ToolCallDisplay key={i} event={evt} />
                ))}
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="ai-chat-input-area">
        <div className="ai-chat-input-wrapper">
          <textarea
            ref={inputRef}
            className="ai-chat-input"
            placeholder={configuredProviders.length > 0 ? "Ask Orion anything..." : "Set up API keys first..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isStreaming || configuredProviders.length === 0}
          />
          <button
            className="ai-chat-send-btn"
            onClick={() => handleSend()}
            disabled={!input.trim() || isStreaming || configuredProviders.length === 0}
          >
            <Send size={14} />
          </button>
        </div>
        <div className="ai-chat-input-hint">
          Shift+Enter for new line • Ctrl+Shift+I to toggle
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  return (
    <div className="ai-message">
      <div className={`ai-message-avatar ${message.role}`}>
        {isUser ? '👤' : <Bot size={12} />}
      </div>
      <div className="ai-message-content">
        <div className={`ai-message-role ${message.role}`}>
          {isUser ? 'You' : 'Orion'}
        </div>
        <div className="ai-message-text">
          <FormattedContent content={message.content} />
        </div>

        {/* Tool events attached to this message */}
        {message.toolEvents?.map((evt, i) => (
          <ToolCallDisplay key={i} event={evt} />
        ))}
      </div>
    </div>
  );
}

function ToolCallDisplay({ event }) {
  const icon = TOOL_ICONS[event.tool] || '🔧';
  return (
    <div className="ai-tool-call">
      <div className="ai-tool-call-header">
        <span className="ai-tool-call-icon">{icon}</span>
        <span className="ai-tool-call-name">{event.tool}</span>
        {event.duration_ms && (
          <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xxs)' }}>
            {event.duration_ms}ms
          </span>
        )}
      </div>
      {event.args && (
        <div className="ai-tool-call-args">
          {typeof event.args === 'string' ? event.args : JSON.stringify(event.args, null, 2)}
        </div>
      )}
      {event.result && (
        <div className={`ai-tool-call-result ${event.result.error ? 'error' : ''}`}>
          {formatToolResult(event.result)}
        </div>
      )}
    </div>
  );
}

function formatToolResult(result) {
  if (result.error) return `❌ ${result.error}`;
  if (result.content) return result.content.substring(0, 300) + (result.content.length > 300 ? '...' : '');
  if (result.stdout) return result.stdout.substring(0, 300);
  if (result.success !== undefined) return result.success ? '✅ Success' : '❌ Failed';
  return JSON.stringify(result, null, 2).substring(0, 300);
}

function FormattedContent({ content }) {
  if (!content) return null;

  // Simple markdown-ish rendering: code blocks, inline code, bold
  const parts = content.split(/(```[\s\S]*?```|`[^`]+`)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const inner = part.slice(3, -3);
          const newlineIdx = inner.indexOf('\n');
          const lang = newlineIdx > 0 ? inner.slice(0, newlineIdx).trim() : '';
          const code = newlineIdx > 0 ? inner.slice(newlineIdx + 1) : inner;
          return <pre key={i}><code>{code}</code></pre>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return <code key={i}>{part.slice(1, -1)}</code>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ── Settings Panel ──

function AISettings({ onBack }) {
  const [openrouterKey, setOpenrouterKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [status, setStatus] = useState('');
  const setConfig = useAIStore(s => s.setConfig);

  useEffect(() => {
    fetch('/api/ai/keys')
      .then(r => r.json())
      .then(keys => {
        if (keys.openrouter) setOpenrouterKey(keys.openrouter);
        if (keys.gemini) setGeminiKey(keys.gemini);
      })
      .catch(() => {});
  }, []);

  const saveKey = async (provider, key) => {
    if (!key || key.startsWith('••••')) return;
    try {
      const res = await fetch('/api/ai/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey: key }),
      });
      const data = await res.json();
      setStatus(`✅ ${provider} key saved!`);
      // Refresh config
      const config = await fetch('/api/ai/config').then(r => r.json());
      setConfig(config);
      setTimeout(() => setStatus(''), 3000);
    } catch (err) {
      setStatus(`❌ Failed: ${err.message}`);
    }
  };

  return (
    <div className="ai-chat-panel">
      <div className="ai-chat-header">
        <div className="ai-chat-header-left">
          <button className="ai-chat-action-btn" onClick={onBack} title="Back">
            ←
          </button>
          <span className="ai-chat-header-title">AI Settings</span>
        </div>
      </div>
      <div className="ai-settings">
        <div className="ai-settings-section">
          <label className="ai-settings-label">OpenRouter API Key</label>
          <div className="ai-settings-input-group">
            <input
              type="password"
              placeholder="sk-or-..."
              value={openrouterKey}
              onChange={e => setOpenrouterKey(e.target.value)}
            />
            <button className="ai-settings-save-btn" onClick={() => saveKey('openrouter', openrouterKey)}>
              Save
            </button>
          </div>
        </div>

        <div className="ai-settings-section">
          <label className="ai-settings-label">Gemini API Key</label>
          <div className="ai-settings-input-group">
            <input
              type="password"
              placeholder="AI..."
              value={geminiKey}
              onChange={e => setGeminiKey(e.target.value)}
            />
            <button className="ai-settings-save-btn" onClick={() => saveKey('gemini', geminiKey)}>
              Save
            </button>
          </div>
        </div>

        {status && <div className="ai-settings-status">{status}</div>}

        <div className="ai-settings-section">
          <label className="ai-settings-label">About</label>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
            Orion AI uses your API keys to connect to AI models. Keys are stored locally and never sent to third parties.
            <br /><br />
            <strong>OpenRouter</strong> — Access Claude, GPT-4, Llama, and 200+ models through a single API.
            <br />
            <strong>Gemini</strong> — Direct access to Google's Gemini models.
          </p>
        </div>
      </div>
    </div>
  );
}
