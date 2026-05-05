import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Brain, ShieldCheck, Code2, Download, Cpu, Layers, CheckCircle2, AlertCircle, RotateCw } from 'lucide-react';
import type { UploadResponse, ProjectConversionResponse, AIIntelligence } from '../types';
import { downloadConvertedProject, getLanguages } from '../services/api';

interface ConversionPanelProps {
  result: UploadResponse;
}

export default function ConversionPanel({ result }: ConversionPanelProps) {
  const navigate = useNavigate();
  const [targetLang, setTargetLang] = useState<string>('');
  const [convertingProject, setConvertingProject] = useState(false);
  const [projectResult, setProjectResult] = useState<ProjectConversionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number; file: string; intelligence?: AIIntelligence } | null>(null);
  const [commonTargets, setCommonTargets] = useState<string[]>([]);

  useEffect(() => {
    async function initData() {
      try {
        const m = await getLanguages();
        const allowed = m[result.primary_language] || ['Python', 'TypeScript', 'Go', 'Rust', 'Java'];
        setCommonTargets(allowed);
        if (allowed.length > 0) setTargetLang(allowed[0]);
      } catch (err) { console.error(err); }
    }
    initData();
  }, [result]);

  const handleConvertProject = async () => {
    setConvertingProject(true);
    setError(null);
    setProjectResult(null);
    setProgress({ current: 0, total: 0, file: 'Initializing...' });

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8100';
      const response = await fetch(`${apiUrl}/api/convert-project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: result.session_id,
          source_lang: result.primary_language,
          target_lang: targetLang
        })
      });

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Stream unreachable");

      const decoder = new TextDecoder();
      let buffer = '';
      // Local accumulator — avoids stale React state closure bug
      const localFileResults: any[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim().startsWith('data: ')) {
            const data = JSON.parse(line.trim().slice(6));
            if (data.status === 'start') {
              setProgress(p => ({ ...p!, total: data.total_files }));
              localFileResults.length = 0;
            } else if (data.status === 'processing') {
              localFileResults.push(data.info || {});
              setProgress({ current: data.index, total: data.total, file: data.file, intelligence: data.intelligence });
            } else if (data.status === 'complete') {
              const finalResult = { ...data.result, converted_files: localFileResults.map(f => ({
                path: f.path, status: f.status, error: f.error, intelligence: f.intelligence,
                provider: f.provider, conversion_ms: f.conversion_ms
              }))};
              setProjectResult(finalResult);
              setProgress(null);
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message);
      setProgress(null);
    } finally {
      setConvertingProject(false);
    }
  };

  return (
    <div className="mt-12 space-y-8 pb-24 max-w-5xl mx-auto">
      {/* Dashboard */}
      <div className="p-8 rounded-[2rem] bg-zinc-950 border border-white/[0.04] shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-[0.03]"><Layers size={180} className="text-white" /></div>
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-12 items-center">
          <div className="md:col-span-4 space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[11px] font-bold tracking-widest text-blue-400 uppercase">
              <Brain size={14} /> Migration Ready
            </div>
            <h2 className="text-4xl font-bold tracking-tight leading-tight">Source <br /><span className="text-blue-500 font-normal">Analysis</span></h2>
            <p className="text-sm text-zinc-500 pt-2 leading-relaxed max-w-[250px]">Your project has been parsed and is ready for automated translation to a new stack.</p>
          </div>
          <div className="md:col-span-8 grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Files', val: result.file_count, icon: <Layers size={18}/> },
              { label: 'Language', val: result.primary_language, icon: <Code2 size={18}/>, color: 'text-blue-400' },
              { label: 'Integrity', val: '98%', icon: <ShieldCheck size={18}/>, color: 'text-green-400' },
              { label: 'Engine', val: 'Polyglot', icon: <Cpu size={18}/> }
            ].map((stat, i) => (
              <div key={i} className="p-6 rounded-[1.5rem] bg-black border border-white/[0.04] space-y-3 hover:border-white/[0.08] transition-colors shadow-sm">
                <div className="text-zinc-500 mb-2">{stat.icon}</div>
                <div className={`text-2xl font-bold tracking-tight ${stat.color || 'text-zinc-100'}`}>{stat.val}</div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Progress */}
      {progress && (
        <div className="p-8 rounded-[2rem] bg-zinc-950 border border-blue-500/30">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center animate-pulse shadow-lg shadow-blue-500/20">
                <Zap className="text-white fill-white" size={24} />
              </div>
              <div>
                <h4 className="text-sm font-bold uppercase tracking-wider text-zinc-300">Converting</h4>
                <div className="text-xs font-mono text-zinc-500 truncate max-w-[250px]">{progress.file}</div>
              </div>
            </div>
            <div className="text-3xl font-medium text-blue-400 font-mono">
              {progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}%
            </div>
          </div>
          <div className="h-2 bg-black rounded-full overflow-hidden border border-white/[0.04]">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Controller */}
      <div className="p-8 rounded-[2rem] bg-zinc-950 border border-white/[0.04] space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider pl-1">Target Language</div>
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="w-full h-14 px-5 bg-black border border-white/[0.08] rounded-xl font-medium text-zinc-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none appearance-none cursor-pointer hover:border-zinc-700 transition-all"
            >
              {commonTargets.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <button
          onClick={handleConvertProject}
          disabled={convertingProject}
          className="w-full h-14 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold uppercase tracking-wider text-sm flex items-center justify-center gap-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/10"
        >
          {convertingProject ? (
            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          ) : (
            <Zap size={18} className="fill-white" />
          )}
          {convertingProject ? 'Migrating...' : 'Start AI Migration'}
        </button>

        {error && <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
      </div>

      {/* Results */}
      {projectResult && (
        <div className="p-8 rounded-[2rem] bg-zinc-950 border border-white/[0.04] relative overflow-hidden">
          <div className={`absolute inset-0 bg-gradient-to-br ${projectResult.failed_count === 0 ? 'from-green-500/5' : 'from-amber-500/5'} to-transparent`} />
          <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
            <div className="flex items-center gap-6">
              <div className={`w-16 h-16 rounded-xl ${projectResult.failed_count === 0 ? 'bg-green-500/10 border-green-500/20' : 'bg-amber-500/10 border-amber-500/20'} border flex items-center justify-center`}>
                {projectResult.failed_count === 0 ? <CheckCircle2 size={32} className="text-green-500" /> : <AlertCircle size={32} className="text-amber-500" />}
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold uppercase tracking-tight text-zinc-200">
                  {projectResult.failed_count === 0 ? 'Migration Complete' : 'Review Required'}
                </h3>
                <div className="flex gap-2">
                  <span className="px-2.5 py-1 bg-black border border-white/[0.04] rounded text-[10px] font-bold font-mono">
                    <span className="text-green-400">PASSED:</span> {projectResult.success_count}
                  </span>
                  {projectResult.failed_count > 0 && (
                    <span className="px-2.5 py-1 bg-black border border-white/[0.04] rounded text-[10px] font-bold font-mono">
                      <span className="text-red-400">FAILED:</span> {projectResult.failed_count}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap justify-center">
              <button
                onClick={() => navigate(`/workspace/${result.session_id}`)}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold uppercase text-xs tracking-wider transition-colors shadow-lg shadow-blue-500/10"
              >
                Open IDE 💻
              </button>
              <button
                onClick={() => downloadConvertedProject(result.session_id)}
                className="px-5 py-3 bg-black hover:bg-zinc-900 text-zinc-300 border border-white/[0.08] hover:border-white/[0.1] hover:text-white rounded-xl font-bold uppercase text-xs tracking-wider flex items-center gap-2 transition-colors"
              >
                <Download size={14} /> ZIP
              </button>
              {projectResult.failed_count > 0 && (
                <button
                  onClick={handleConvertProject}
                  disabled={convertingProject}
                  className="px-5 py-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 hover:border-amber-500/30 rounded-xl font-bold uppercase text-xs tracking-wider flex items-center gap-2 transition-colors"
                >
                  <RotateCw size={14} className={convertingProject ? 'animate-spin' : ''} /> Retry
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
