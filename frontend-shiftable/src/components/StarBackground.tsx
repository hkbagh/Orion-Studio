import { useEffect, useRef } from 'react';

export default function StarBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = canvas.width = window.innerWidth;
    let h = canvas.height = window.innerHeight;

    const stars: { x: number, y: number, r: number, a: number, baseA: number, baseVy: number, twinkleSpeed: number, twinklePhase: number }[] = [];
    for (let i = 0; i < 200; i++) {
      const baseAlpha = 0.3 + Math.random() * 0.7; // bright floor at 0.3, max ~1.0
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 3.1, // brightness boosted by 40% (was 1.5)
        a: baseAlpha,
        baseA: baseAlpha,
        baseVy: Math.random() * 0.5, // very slow base movement
        twinkleSpeed: 0.02 + Math.random() * 0.04, // twinkling speed variation
        twinklePhase: Math.random() * Math.PI * 2 // random phase offset
      });
    }

    let scrollVelocity = 0;

    // Instead of using window.scrollY (which might be 0 if the body is explicitly h-screen overflow-hidden)
    // We can listen to the React element that handles scroll or the window wheel event.
    // If HomePage uses a div with custom-scrollbar overflow-y-auto, we should listen to that element or just wheel event.

    const onWheel = (e: WheelEvent) => {
      scrollVelocity += e.deltaY * 0.05; // sensitive multiplier
    };

    window.addEventListener('wheel', onWheel, { passive: true });

    // Also support touch devices
    let lastTouchY = 0;
    const onTouchStart = (e: TouchEvent) => {
      lastTouchY = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      const touchY = e.touches[0].clientY;
      scrollVelocity += (lastTouchY - touchY) * 0.05;
      lastTouchY = touchY;
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });

    window.addEventListener('resize', () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    });

    let animationId: number;
    let frame = 0;

    const render = () => {
      frame++;
      // slower fade so stars stay brighter on screen
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.fillRect(0, 0, w, h);

      scrollVelocity *= 0.95; // dampening to slow it down smoothly

      stars.forEach(s => {
        s.y -= scrollVelocity; // moving stars based on scroll
        s.y += s.baseVy;

        if (s.y > h) s.y -= h;
        if (s.y < 0) s.y += h;

        // Twinkling: oscillate alpha by 40% around base value
        const twinkle = Math.sin(frame * s.twinkleSpeed + s.twinklePhase);
        s.a = Math.max(0, Math.min(1, s.baseA + twinkle * 0.4 * s.baseA));

        const extraStretch = Math.abs(scrollVelocity) * 2;

        // soft glow bloom around each star
        ctx.shadowBlur = s.r * 6;
        ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';

        ctx.beginPath();
        ctx.fillStyle = `rgba(255, 255, 255, ${s.a})`;
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();

        // reset shadow so trails don't double-blur
        ctx.shadowBlur = 0;

        if (extraStretch > 1) {
          // broader, brighter shooting-star trails
          ctx.beginPath();
          ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(1, s.a * 0.9)})`;
          ctx.lineWidth = s.r * 2.5;
          ctx.lineCap = 'round';
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(s.x, s.y + scrollVelocity * 2.5);
          ctx.stroke();
        }
      });

      animationId = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 z-0 pointer-events-none" />;
}
