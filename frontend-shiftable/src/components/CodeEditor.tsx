import Editor from '@monaco-editor/react';

interface CodeEditorProps {
  content: string;
  language?: string;
  onChange?: (value: string | undefined) => void;
  readOnly?: boolean;
}

const LANG_MAP: Record<string, string> = {
  py: 'python', js: 'javascript', ts: 'typescript', tsx: 'typescript',
  jsx: 'javascript', java: 'java', go: 'go', rs: 'rust', cpp: 'cpp',
  c: 'c', cs: 'csharp', kt: 'kotlin', rb: 'ruby', php: 'php',
  swift: 'swift', sql: 'sql', json: 'json', yaml: 'yaml', yml: 'yaml',
  md: 'markdown', html: 'html', css: 'css', sh: 'shell', xml: 'xml',
  toml: 'ini', dart: 'dart',
};

export function getMonacoLanguage(filepath: string): string {
  const ext = filepath.split('.').pop()?.toLowerCase() || '';
  return LANG_MAP[ext] || 'plaintext';
}

export default function CodeEditor({ content, language, onChange, readOnly = false }: CodeEditorProps) {
  return (
    <Editor
      height="100%"
      language={language || 'plaintext'}
      value={content}
      onChange={onChange}
      theme="vs-dark"
      options={{
        readOnly,
        fontSize: 14,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        lineNumbers: 'on',
        renderLineHighlight: 'all',
        cursorSmoothCaretAnimation: 'on',
        smoothScrolling: true,
        padding: { top: 16, bottom: 16 },
        bracketPairColorization: { enabled: true },
        guides: { indentation: true, bracketPairs: true },
        suggest: { showWords: true },
      }}
    />
  );
}
