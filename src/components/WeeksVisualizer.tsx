import React, { useEffect, useRef, useMemo } from 'react';
import { motion } from 'motion/react';

export function WeeksVisualizer({ birthDate, expectedLifespan, textColor = '#ffffff' }: { birthDate: string, expectedLifespan: number, textColor?: string }) {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { totalWeeks, elapsedWeeks } = useMemo(() => {
    const birth = new Date(birthDate);
    const now = new Date();
    const total = expectedLifespan * 52;
    const elapsed = Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24 * 7));
    return {
      totalWeeks: Math.max(0, total),
      elapsedWeeks: Math.max(0, Math.min(elapsed, Math.max(0, total)))
    };
  }, [birthDate, expectedLifespan]);

  useEffect(() => {
    if (!canvasRef.current || !canvasContainerRef.current || totalWeeks <= 0) return;
    
    // We will draw it manually to be perfectly responsive & performant
    const draw = () => {
      const canvas = canvasRef.current;
      const container = canvasContainerRef.current;
      if (!canvas || !container) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const cols = 52; // 1 year = 52 weeks
      const rows = Math.ceil(totalWeeks / cols);

      // Determine size based on container width
      const containerWidth = container.clientWidth;
      // We want to fit exactly 52 items horizontally.
      const maxColW = Math.max(2, Math.floor(containerWidth / cols));
      const size = Math.max(1, maxColW - 1); // 1px gap min
      const gap = Math.max(1, maxColW - size);

      const dpr = window.devicePixelRatio || 1;
      const exactWidth = cols * (size + gap) - gap;
      const exactHeight = rows * (size + gap) - gap;

      canvas.width = exactWidth * dpr;
      canvas.height = exactHeight * dpr;
      canvas.style.width = `${exactWidth}px`;
      canvas.style.height = `${exactHeight}px`;

      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, exactWidth, exactHeight);

      // We can do standard rects
      for (let i = 0; i < totalWeeks; i++) {
        const isElapsed = i < elapsedWeeks;
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = col * (size + gap);
        const y = row * (size + gap);

        if (isElapsed) {
          ctx.fillStyle = textColor;
          ctx.globalAlpha = 0.8;
        } else {
          ctx.fillStyle = textColor;
          ctx.globalAlpha = 0.15;
        }

        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(x, y, size, size, Math.min(2, size/2));
        } else {
            ctx.rect(x, y, size, size);
        }
        ctx.fill();
      }
    };

    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [totalWeeks, elapsedWeeks, textColor]);

  if (totalWeeks <= 0) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.5, duration: 1 }}
      className="w-full max-w-3xl mt-12 mb-8 px-4 flex flex-col items-center"
    >
      <div className="w-12 h-[1px] mx-auto mb-8 opacity-20" style={{ backgroundColor: 'currentColor' }} />
      <h3 className="text-[10px] tracking-[0.3em] uppercase mb-8 text-center font-medium opacity-60">
        Your Life in Weeks 
      </h3>
      <div className="text-xs uppercase tracking-widest opacity-50 mb-6 font-mono">
        {elapsedWeeks} / {totalWeeks} WEEKS
      </div>

      <div ref={canvasContainerRef} className="w-full flex justify-center">
        <canvas ref={canvasRef} className="max-w-full" style={{ imageRendering: 'pixelated' }} />
      </div>
      
      <div className="flex justify-between w-full max-w-xs mt-4 text-[9px] uppercase tracking-widest opacity-40">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: textColor, opacity: 0.8 }} />
          <span>Lived</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: textColor, opacity: 0.15 }} />
          <span>Remaining</span>
        </div>
      </div>
    </motion.div>
  );
}
