import React, { useMemo } from 'react';
import { motion } from 'motion/react';

export function TimeAllocation({ birthDate, expectedLifespan, textColor }: { birthDate: string, expectedLifespan: number, textColor?: string }) {
  const { elapsedYears, remainingYears } = useMemo(() => {
    const birth = new Date(birthDate);
    const now = new Date();
    const elapsedMs = now.getTime() - birth.getTime();
    const elapsedY = elapsedMs / (1000 * 60 * 60 * 24 * 365.25);
    const remainingY = Math.max(0, expectedLifespan - elapsedY);
    return { elapsedYears: elapsedY, remainingYears: remainingY };
  }, [birthDate, expectedLifespan]);

  // Assumptions based on average statistics:
  // Sleep: ~33% (8 hours/day)
  // Work/Chores/Maintenance: ~40% (10 hours/day)
  // Free Time: ~27% (6 hours/day)
  const RATIOS = { sleep: 0.33, work: 0.40, free: 0.27 };

  const remainingSleep = remainingYears * RATIOS.sleep;
  const remainingWork = remainingYears * RATIOS.work;
  const remainingFree = remainingYears * RATIOS.free;

  if (remainingYears <= 0) return null;

  return (
    <div className="w-full max-w-3xl px-4">
      <h3 className="text-[10px] tracking-[0.3em] uppercase mb-6 text-center font-medium opacity-50">
        Estimated Time Allocation ({remainingYears.toFixed(1)} years left)
      </h3>

      <div className="flex flex-col md:flex-row gap-6 justify-center items-center md:items-stretch">
        <AllocationCard 
          label="Sleep" 
          years={remainingSleep} 
          desc="8 hours a day" 
          opacity="opacity-30" 
          textColor={textColor} 
        />
        <AllocationCard 
          label="Work & Chores" 
          years={remainingWork} 
          desc="10 hours a day" 
          opacity="opacity-50" 
          textColor={textColor} 
        />
        <AllocationCard 
          label="Free Time" 
          years={remainingFree} 
          desc="6 hours a day" 
          opacity="opacity-90" 
          textColor={textColor} 
          isHighlighted 
        />
      </div>
    </div>
  );
}

function AllocationCard({ label, years, desc, opacity, textColor, isHighlighted }: { label: string, years: number, desc: string, opacity: string, textColor?: string, isHighlighted?: boolean }) {
  return (
    <div 
      className={`flex-1 p-5 rounded-xl border flex flex-col justify-between items-center text-center transition-all bg-black/10`}
      style={{
        borderColor: isHighlighted ? (textColor || 'currentColor') : 'transparent',
        boxShadow: isHighlighted ? `0 0 20px ${textColor || '#fff'}15` : ''
      }}
    >
      <div className={`text-[10px] tracking-[0.2em] uppercase mb-1 ${opacity}`}>{label}</div>
      <div className={`text-xs opacity-40 mb-3`}>{desc}</div>
      <div className={`font-mono text-2xl font-light`} style={isHighlighted ? { color: textColor } : {}}>
        {years.toFixed(1)} <span className="text-sm">yrs</span>
      </div>
    </div>
  );
}
