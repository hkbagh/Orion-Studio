import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Bot, User, Terminal, Loader2, ShieldCheck, Wrench } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { copilotAssist } from '../services/api';
import type { CopilotResponse } from '../types';

interface AICopilotSidebarProps {
  activeFilePath: string;
  activeFileContent: string;
  terminalOutput: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  provider?: string;
  actions?: string[];
  fixCommand?: string | null;
}

export default function AICopilotSidebar({ activeFilePath, activeFileContent, terminalOutput }: AICopilotSidebarProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'AI Copilot connected. I can see your active file and terminal output in real-time. Ask me anything about your code.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const query = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: query }]);
    setLoading(true);

    try {
      const res: CopilotResponse = await copilotAssist({
        file_path: activeFilePath,
        active_file_content: activeFileContent,
        terminal_output: terminalOutput,
        user_query: query,
      });

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.answer,
        provider: res.provider_used,
        actions: res.suggested_actions,
        fixCommand: res.terminal_fix_command,
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '❌ Failed to reach AI service. Check your API keys and connection.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestNext = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res: CopilotResponse = await copilotAssist({
        file_path: activeFilePath,
        active_file_content: activeFileContent,
        terminal_output: terminalOutput,
        user_query: 'Analyze this code and suggest the next logical step to improve, debug, or extend it.',
      });
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.answer,
        provider: res.provider_used,
        actions: res.suggested_actions,
        fixCommand: res.terminal_fix_command,
      }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ Agent disconnected.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/[0.04] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} className="text-blue-400" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-300">
            Copilot
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-0.5">
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          <span className="text-[9px] font-medium text-green-500">Connected</span>
        </div>
      </div>

      {/* Context Info */}
      <div className="px-4 py-2 border-b border-white/[0.04] bg-black/40 flex justify-between">
        <span className="text-[9px] font-semibold text-zinc-600 uppercase tracking-wider">Context</span>
        <span className="text-[9px] font-mono text-zinc-500 truncate max-w-[150px]">{activeFilePath || 'None'}</span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} max-w-[95%]`}>
                <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-1 ${
                  msg.role === 'user'
                    ? 'bg-blue-500/10 text-blue-400'
                    : 'bg-zinc-800 text-zinc-300'
                }`}>
                  {msg.role === 'user' ? <User size={12} /> : <Bot size={12} />}
                </div>

                <div className={`rounded-xl px-4 py-3 text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-500/10 border border-blue-500/20 text-blue-50'
                    : 'bg-black border border-white/[0.08] text-zinc-300'
                }`}>
                  <div className="whitespace-pre-wrap">{msg.content}</div>

                  {msg.provider && (
                    <div className="mt-3 text-[9px] font-bold uppercase text-zinc-600 tracking-wider">
                      Powered by {msg.provider}
                    </div>
                  )}
                </div>
              </div>

              {msg.fixCommand && (
                <motion.div
                  className="mt-2 w-full p-3 rounded-lg bg-blue-500/5 border border-blue-500/10 space-y-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className="flex items-center gap-2 text-[10px] font-semibold text-blue-400">
                    <Terminal size={12} /> Fix Command
                  </div>
                  <div className="text-[11px] font-mono bg-black p-2.5 rounded border border-white/[0.04] text-green-400">
                    $ {msg.fixCommand}
                  </div>
                </motion.div>
              )}

              {msg.actions && msg.actions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5 ml-8">
                  {msg.actions.map((action, j) => (
                    <button
                      key={j}
                      onClick={() => setInput(action)}
                      className="text-[10px] font-medium px-2 py-1 bg-white/[0.04] border border-white/[0.04] rounded hover:bg-white/[0.1] text-zinc-400 transition-colors"
                    >
                      <Wrench size={10} className="inline mr-1" />
                      {action}
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-blue-400/80 text-xs font-medium bg-blue-500/10 px-3 py-2 rounded-lg border border-blue-500/10 w-fit"
          >
            <Loader2 size={12} className="animate-spin" />
            Thinking...
          </motion.div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-white/[0.04] bg-zinc-950">
        <div className="flex justify-start mb-2">
          <button
            onClick={handleSuggestNext}
            disabled={loading}
            className="text-[10px] font-semibold flex items-center text-zinc-500 hover:text-zinc-300 transition-colors px-1 disabled:opacity-40"
          >
            <Sparkles size={12} className="mr-1" />
            Suggest Next
          </button>
        </div>

        <div className="relative">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask Copilot..."
            className="w-full bg-black border border-white/[0.08] rounded-xl px-4 py-3 pr-10 text-xs focus:outline-none focus:border-zinc-500 min-h-[60px] resize-none transition-colors placeholder:text-zinc-600 text-zinc-300"
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="absolute right-3 bottom-3 p-1.5 bg-white text-black rounded hover:bg-zinc-200 disabled:opacity-30 transition-colors"
          >
            <Send size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

