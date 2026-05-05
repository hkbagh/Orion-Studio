import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Code2, Cpu, Shield, Sparkles, Terminal } from 'lucide-react';
import FileUploader from '../components/FileUploader';
import ConversionPanel from '../components/ConversionPanel';
import StarBackground from '../components/StarBackground';

export default function HomePage() {
  const navigate = useNavigate();
  const [uploadResult, setUploadResult] = useState<any | null>(null);

  return (
    <div className="h-screen w-full overflow-y-auto bg-black text-[#ededed] relative">
      <StarBackground />
      {/* Refined Navigation */}
      <nav className="sticky top-0 z-50 bg-black/60 backdrop-blur-xl border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-md bg-white text-black flex items-center justify-center">
              <Sparkles size={14} className="fill-black" />
            </div>
            <span className="text-sm font-semibold tracking-tight">Orion Studio</span>
            <span className="text-[10px] font-medium text-zinc-400 bg-white/[0.1] px-1.5 py-0.5 rounded-sm uppercase tracking-wide">Beta</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/compiler')}
              className="px-4 py-1.5 text-xs font-medium text-zinc-400 hover:text-white transition-colors flex items-center gap-2 rounded-md hover:bg-white/[0.05]"
            >
              <Terminal size={12} /> Compiler
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <AnimatePresence mode="wait">
        {!uploadResult ? (
          <motion.div
            key="hero"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full min-h-[calc(100vh-56px)] flex items-center justify-center relative overflow-hidden py-24"
          >
            {/* Warm amber tint at bottom — fades to transparent above middle */}
            <div className="absolute inset-0 z-0 pointer-events-none" style={{
              background: 'linear-gradient(to top, rgba(180,110,25,0.12) 0%, rgba(140,80,20,0.06) 20%, rgba(80,40,10,0.02) 40%, transparent 55%)'
            }} />

            <div className="relative z-10 w-full max-w-5xl mx-auto px-6 text-center space-y-24">
              {/* Hero Header */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="max-w-3xl mx-auto"
              >
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.05] text-[11px] text-zinc-300 mb-6 backdrop-blur-md">
                  <Sparkles size={12} /> The New Standard in Code Migration
                </div>
                <h1 className="text-5xl md:text-7xl font-semibold tracking-tighter leading-tight mb-5">
                  Migrate Code.<br />
                  <span className="text-zinc-500">Without Compromise.</span>
                </h1>
                <p className="text-sm md:text-base text-zinc-400 max-w-2xl mx-auto mb-10 font-normal">
                  Drop your legacy code, select a modern stack, and experience highly accurate AI translations, run sandbox evaluations, and preview in real-time.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-4">
                  <button
                    onClick={() => document.getElementById('upload')?.scrollIntoView({ behavior: 'smooth' })}
                    className="px-6 py-2.5 bg-white text-black rounded-full font-medium text-sm hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                  >
                    Start Migration <ArrowRight size={14} />
                  </button>
                  <button
                    onClick={() => navigate('/compiler')}
                    className="px-6 py-2.5 bg-zinc-900 border border-white/[0.08] text-white rounded-full font-medium text-sm hover:bg-zinc-800 transition-all flex items-center gap-2"
                  >
                    <Terminal size={14} /> Try Compiler
                  </button>
                </div>
              </motion.div>

              {/* Upload Section */}
              <motion.div
                id="upload"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
              >
                <FileUploader onUploadSuccess={setUploadResult} />
              </motion.div>

              {/* Feature Highlights */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2, ease: 'easeOut' }}
                className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-10"
              >
                {[
                  {
                    icon: <Code2 size={16} />,
                    title: 'Multi-Model Intelligence',
                    desc: 'Utilizing GPT-4, Claude 3, and Gemini simultaneously for consensus-based code translation.'
                  },
                  {
                    icon: <Cpu size={16} />,
                    title: 'Native Execution',
                    desc: 'Secure sandboxes execute translated code instantly across 17+ embedded language runtimes.'
                  },
                  {
                    icon: <Shield size={16} />,
                    title: 'Zero Tolerance Errors',
                    desc: 'Pre-flight static analysis, semantic validations, and runtime error tracing standard.'
                  }
                ].map((card, i) => (
                  <div key={i} className="text-left p-8 rounded-2xl bg-zinc-900/30 border border-white/[0.04] hover:bg-zinc-900/50 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-black border border-white/[0.04] flex items-center justify-center text-white mb-6">
                      {card.icon}
                    </div>
                    <h3 className="text-base font-medium tracking-tight mb-2">{card.title}</h3>
                    <p className="text-sm text-zinc-500 leading-relaxed">{card.desc}</p>
                  </div>
                ))}
              </motion.div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full px-6 py-12"
          >
            <ConversionPanel result={uploadResult} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
