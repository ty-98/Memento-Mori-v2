import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

import { STOIC_QUOTES } from '../data/stoicQuotes';

export function StoicQuotes({ textColor }: { textColor?: string }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    // Change quote every day (using date to determine index)
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 1000 / 60 / 60 / 24);
    setIndex(dayOfYear % STOIC_QUOTES.length);
  }, []);

  const quote = STOIC_QUOTES[index];

  return (
    <div className="w-full max-w-2xl mx-auto text-center px-4">
      <div className="w-8 h-px mx-auto mb-5 opacity-15" style={{ backgroundColor: 'currentColor' }} />
      <h3 className="text-[8px] tracking-[0.3em] uppercase mb-3 font-medium opacity-40">Daily Stoic</h3>
      <div className="font-serif text-xs md:text-sm opacity-70 leading-relaxed max-w-xl mx-auto mb-1.5 whitespace-pre-wrap">
        「{quote.jaQuote}」
      </div>
      <div className="text-[9px] tracking-widest uppercase mt-3 opacity-35 font-sans">
        — {quote.author}
      </div>
    </div>
  );
}
