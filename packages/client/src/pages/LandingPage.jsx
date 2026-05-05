import { useNavigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { ArrowRight, Code2, Cpu, Shield, Sparkles, Terminal } from 'lucide-react';
import './LandingPage.css';

const FEATURES = [
  {
    icon: <Code2 size={16} />,
    title: 'Agentic AI Coding',
    desc: 'Autonomous AI agent that reads, writes, and edits code across your entire workspace with tool-use capabilities.'
  },
  {
    icon: <Cpu size={16} />,
    title: 'Docker Workspaces',
    desc: 'Every workspace runs in an isolated Docker container with a full terminal, file system, and runtime environment.'
  },
  {
    icon: <Shield size={16} />,
    title: 'Code Translation',
    desc: 'AI-powered cross-language translation engine supporting Java, Python, JavaScript, and C++ with build file mapping.'
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);

  // Star background canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = canvas.width = window.innerWidth;
    let h = canvas.height = window.innerHeight;

    const stars = [];
    for (let i = 0; i < 180; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.5,
        a: Math.random() * 0.7 + 0.7,
        baseVy: Math.random() * 0.1,
      });
    }

    let scrollVelocity = 0;

    const onWheel = (e) => {
      scrollVelocity += e.deltaY * 0.04;
    };
    window.addEventListener('wheel', onWheel, { passive: true });

    const onResize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    let animationId;
    const render = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(0, 0, w, h);
      scrollVelocity *= 0.95;

      stars.forEach(s => {
        s.y -= scrollVelocity;
        s.y += s.baseVy;
        if (s.y > h) s.y -= h;
        if (s.y < 0) s.y += h;

        ctx.beginPath();
        ctx.fillStyle = `rgba(255, 255, 255, ${s.a})`;
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();

        if (Math.abs(scrollVelocity) > 1) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(255, 255, 255, ${s.a * 0.4})`;
          ctx.lineWidth = s.r;
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(s.x, s.y + scrollVelocity * 1.5);
          ctx.stroke();
        }
      });

      animationId = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <div className="landing">
      <canvas ref={canvasRef} className="landing-canvas" />

      {/* Warm amber bottom glow */}
      <div className="landing-warm-glow" />

      {/* Navigation */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-nav-brand">
            <div className="landing-nav-logo">
              <Sparkles size={14} />
            </div>
            <span className="landing-nav-title">Orion Studio</span>
            <span className="landing-nav-badge">Beta</span>
          </div>
          <div className="landing-nav-links">
            <button className="landing-nav-link" onClick={() => navigate('/translate')}>
              <Code2 size={12} /> Translate
            </button>
            <button className="landing-nav-link" onClick={() => navigate('/ide')}>
              <Terminal size={12} /> IDE
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="landing-hero">
        <div className="landing-hero-inner">
          {/* Pill badge */}
          <div className="landing-hero-pill">
            <Sparkles size={12} />
            Browser-Based Cloud IDE with AI
          </div>

          {/* Headline */}
          <h1 className="landing-hero-title">
            Write Code.<br />
            <span className="landing-hero-title-muted">Ship Faster.</span>
          </h1>

          <p className="landing-hero-subtitle">
            A fully featured IDE with an agentic AI assistant, isolated Docker workspaces,
            Monaco editor, and live terminal — all in your browser.
          </p>

          {/* CTA */}
          <div className="landing-hero-cta">
            <button className="landing-btn-primary" onClick={() => navigate('/ide')}>
              Launch Studio <ArrowRight size={14} />
            </button>
            <button className="landing-btn-secondary" onClick={() => navigate('/translate')}>
              <Code2 size={14} /> Translate Code
            </button>
          </div>
        </div>

        {/* Feature cards */}
        <div className="landing-features">
          {FEATURES.map((card, i) => (
            <div key={i} className="landing-feature-card">
              <div className="landing-feature-icon">
                {card.icon}
              </div>
              <h3 className="landing-feature-title">{card.title}</h3>
              <p className="landing-feature-desc">{card.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="landing-footer">
        <span className="landing-footer-item">
          <Sparkles size={10} /> Orion Studio
        </span>
        <div className="landing-footer-sep" />
        <span className="landing-footer-item">React · Monaco · Docker</span>
        <div className="landing-footer-sep" />
        <span className="landing-footer-item">MIT License</span>
      </div>
    </div>
  );
}
