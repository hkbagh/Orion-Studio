import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Sparkles, FileCode2, Search, GitBranch, Settings, X, ChevronDown, Terminal } from 'lucide-react';
import CodeEditor from '../components/CodeEditor';
import WebSocketTerminal from '../components/WebSocketTerminal';
import AICopilotSidebar from '../components/AICopilotSidebar';

const LANGUAGES = [
  { id: 'python', name: 'Python', ext: '.py', badge: '🐍' },
  { id: 'javascript', name: 'JavaScript', ext: '.js', badge: '📜' },
  { id: 'typescript', name: 'TypeScript', ext: '.ts', badge: '🔷' },
  { id: 'c', name: 'C', ext: '.c', badge: '⚡' },
  { id: 'cpp', name: 'C++', ext: '.cpp', badge: '⚡' },
  { id: 'java', name: 'Java', ext: '.java', badge: '☕' },
  { id: 'go', name: 'Go', ext: '.go', badge: '🐹' },
  { id: 'rust', name: 'Rust', ext: '.rs', badge: '🦀' },
  { id: 'csharp', name: 'C#', ext: '.cs', badge: '🟣' },
  { id: 'kotlin', name: 'Kotlin', ext: '.kt', badge: '🟠' },
  { id: 'swift', name: 'Swift', ext: '.swift', badge: '🍎' },
  { id: 'dart', name: 'Dart', ext: '.dart', badge: '🎯' },
  { id: 'php', name: 'PHP', ext: '.php', badge: '🐘' },
  { id: 'ruby', name: 'Ruby', ext: '.rb', badge: '💎' },
  { id: 'r', name: 'R', ext: '.r', badge: '📊' },
  { id: 'sql', name: 'SQL', ext: '.sql', badge: '🗃️' },
];

const DEFAULT_CODE: Record<string, string> = {
  python: `# Python 3\nprint("Hello, Orion Studio! 🚀")`,
  javascript: `// JavaScript (Node.js)\nconsole.log("Hello, Orion Studio! 🚀");`,
  typescript: `// TypeScript\nconst greeting: string = "Hello, Orion Studio! 🚀";\nconsole.log(greeting);`,
  c: `// C (GCC)\n#include <stdio.h>\n\nint main() {\n    printf("Hello, Orion Studio! 🚀\\n");\n    return 0;\n}`,
  cpp: `// C++ (G++)\n#include <iostream>\n\nint main() {\n    std::cout << "Hello, Orion Studio! 🚀" << std::endl;\n    return 0;\n}`,
  java: `// Java\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, Orion Studio! 🚀");\n    }\n}`,
  go: `// Go\npackage main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, Orion Studio! 🚀")\n}`,
  rust: `// Rust\nfn main() {\n    println!("Hello, Orion Studio! 🚀");\n}`,
  csharp: `// C#\nusing System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine("Hello, Orion Studio! 🚀");\n    }\n}`,
  kotlin: `// Kotlin\nfun main() {\n    println("Hello, Orion Studio! 🚀")\n}`,
  swift: `// Swift\nprint("Hello, Orion Studio! 🚀")`,
  dart: `// Dart\nvoid main() {\n  print("Hello, Orion Studio! 🚀");\n}`,
  php: `<?php\n// PHP\necho "Hello, Orion Studio! 🚀\\n";\n?>`,
  ruby: `# Ruby\nputs "Hello, Orion Studio! 🚀"`,
  r: `# R\ncat("Hello, Orion Studio! 🚀\\n")`,
  sql: `-- SQL\nSELECT 'Hello, Orion Studio! 🚀' AS greeting;`,
};

export default function CompilerPage() {
  const navigate = useNavigate();
  const [selectedLang, setSelectedLang] = useState('python');
  const [code, setCode] = useState(DEFAULT_CODE.python);
  const [showCopilot, setShowCopilot] = useState(false);
  const [terminalOutput] = useState('');
  const [activeActivity, setActiveActivity] = useState<'explorer'|'search'|'source'|'ai'>('explorer');
  const codeRef = useRef(code);

  const currentLang = LANGUAGES.find(l => l.id === selectedLang) || LANGUAGES[0];
  const fileName = `main${currentLang.ext}`;

  const handleLangChange = (langId: string) => {
    const newCode = DEFAULT_CODE[langId] || `// ${langId}\n`;
    setSelectedLang(langId);
    setCode(newCode);
    codeRef.current = newCode;
  };

  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  const getRunPayload = useCallback(() => {
    return { code: codeRef.current, language: selectedLang };
  }, [selectedLang]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-black text-zinc-300 font-sans">
      {/* ── Title Bar ── */}
      <div className="h-10 bg-black border-b border-white/[0.04] flex items-center justify-between px-4 select-none shrink-0">
        <div className="flex items-center gap-6 h-full">
          <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate('/')}>
             <div className="w-5 h-5 rounded flex items-center justify-center bg-white text-black">
                 <Terminal size={12} className="fill-black" />
             </div>
             <span className="text-sm font-semibold text-white tracking-tight">Compiler</span>
          </div>
          
          <div className="flex items-center gap-4 text-[12px] font-medium text-zinc-400 h-full">
            <span className="cursor-pointer hover:text-white transition-colors">File</span>
            <span className="cursor-pointer hover:text-white transition-colors">Edit</span>
            <span className="cursor-pointer hover:text-white transition-colors">View</span>
            <span className="cursor-pointer hover:text-white transition-colors">Run</span>
          </div>
        </div>
        
        <div className="text-[12px] text-zinc-500 absolute left-1/2 -translate-x-1/2 pointer-events-none font-medium">
          {fileName}
        </div>
      </div>

      {/* ── Main Layout ── */}
      <div className="flex-1 flex overflow-hidden min-h-0 bg-zinc-950">
        
        {/* ── Activity Bar ── */}
        <div className="w-[50px] bg-black border-r border-white/[0.04] flex flex-col items-center py-4 gap-6 shrink-0">
          <div className={`cursor-pointer text-zinc-500 hover:text-white transition-colors ${activeActivity === 'explorer' ? 'text-white' : ''}`} onClick={() => setActiveActivity('explorer')}>
            <FileCode2 size={20} strokeWidth={1.5} />
          </div>
          <div className={`cursor-pointer text-zinc-500 hover:text-white transition-colors ${activeActivity === 'search' ? 'text-white' : ''}`} onClick={() => setActiveActivity('search')}>
            <Search size={20} strokeWidth={1.5} />
          </div>
          <div className={`cursor-pointer text-zinc-500 hover:text-white transition-colors ${activeActivity === 'ai' ? 'text-white' : ''}`} onClick={() => { setActiveActivity('ai'); setShowCopilot(!showCopilot); }}>
            <Sparkles size={20} strokeWidth={1.5} />
          </div>
          <div className="flex-1" />
          <div className="cursor-pointer text-zinc-500 hover:text-white transition-colors mb-4">
            <Settings size={20} strokeWidth={1.5} />
          </div>
        </div>

        {/* ── Primary Sidebar (Explorer) ── */}
        <div className="w-[240px] bg-black border-r border-white/[0.04] shrink-0 flex flex-col">
          <div className="text-[10px] font-semibold tracking-widest text-zinc-500 px-4 h-10 flex items-center border-b border-white/[0.04]">
            {activeActivity === 'explorer' ? 'EXPLORER' : 
             activeActivity === 'search' ? 'SEARCH' : 
             activeActivity === 'source' ? 'SOURCE CONTROL' : 'ORION AI'}
          </div>
          
          {activeActivity === 'explorer' && (
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold text-zinc-400 mt-2">
                <ChevronDown size={14} />
                <span>LANGUAGES</span>
              </div>
              
              <div className="flex flex-col mt-1 px-2 space-y-0.5">
                {LANGUAGES.map(lang => (
                  <div
                    key={lang.id}
                    onClick={() => handleLangChange(lang.id)}
                    className={`flex items-center gap-3 px-3 py-1.5 rounded-md select-none cursor-pointer text-[13px] transition-colors ${
                      selectedLang === lang.id ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                    }`}
                  >
                    <span>{lang.badge}</span>
                    <span>{lang.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Editor Group & Terminal ── */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0a0a0a]">
          {/* Tab Bar */}
          <div className="flex bg-black border-b border-white/[0.04] shrink-0 overflow-x-auto h-10">
            <div className="flex items-center gap-2 px-4 bg-zinc-900 border-t border-blue-500 text-white text-[13px] shrink-0">
              <span>{currentLang.badge}</span>
              <span>{fileName}</span>
              <X size={14} className="ml-2 hover:bg-white/10 rounded p-0.5 cursor-pointer opacity-70 hover:opacity-100" />
            </div>
          </div>
          
          <div className="flex-1 flex min-h-0">
            {/* Editor Area */}
            <div className="flex-1 flex flex-col min-h-0 relative border-r border-white/[0.04]">
              <div className="flex-1 min-h-0">
                <CodeEditor
                  content={code}
                  language={selectedLang === 'csharp' ? 'csharp' : selectedLang}
                  onChange={(val) => { setCode(val || ''); codeRef.current = val || ''; }}
                />
              </div>
              
              {/* Floating Run Button */}
              <div className="absolute top-4 right-6 z-10">
                <button
                  onClick={() => document.querySelector<HTMLButtonElement>('[title="Run code (Ctrl+Enter)"]')?.click()}
                  className="flex items-center gap-2 px-4 py-1.5 bg-white hover:bg-zinc-200 text-black rounded-full shadow-lg text-[12px] font-semibold transition-colors"
                >
                  <Play size={12} className="fill-black" />
                  Run Code
                </button>
              </div>
            </div>

            {/* Terminal Panel (Right Split) */}
            <div className="w-[40%] flex flex-col min-h-0 bg-black relative z-20">
              <WebSocketTerminal
                initialCode={code}
                language={selectedLang}
                onRunRequest={getRunPayload}
              />
            </div>
          </div>
        </div>

        {/* ── AI Copilot Sidebar (Optional) ── */}
        {showCopilot && (
          <div className="w-[320px] shrink-0 border-l border-white/[0.04] bg-black flex flex-col relative z-30">
            <div className="h-10 border-b border-white/[0.04] flex items-center justify-between px-4 shrink-0">
              <span className="text-[11px] font-semibold uppercase text-zinc-300">Orion AI Agent</span>
              <button onClick={() => setShowCopilot(false)} className="p-1 hover:bg-white/10 rounded-md text-zinc-400 hover:text-white transition-colors">
                <X size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <AICopilotSidebar
                activeFilePath={fileName}
                activeFileContent={code}
                terminalOutput={terminalOutput}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Status Bar ── */}
      <div className="h-6 bg-black border-t border-white/[0.04] flex items-center justify-between px-4 text-[11px] text-zinc-500 select-none shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors">
            <GitBranch size={10} /> main
          </div>
          <div className="cursor-pointer hover:text-white transition-colors">
            Connected to Engine
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="cursor-pointer hover:text-white transition-colors">UTF-8</div>
          <div className="cursor-pointer hover:text-white transition-colors">{currentLang.name}</div>
          <div className="flex items-center gap-1 cursor-pointer hover:text-white transition-colors text-blue-400">
            <Sparkles size={10} /> Orion AI Ready
          </div>
        </div>
      </div>
    </div>
  );
}
