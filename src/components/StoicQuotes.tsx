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
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.8, duration: 1 }}
      className="w-full max-w-2xl mx-auto mt-12 mb-8 text-center px-4"
    >
      <div className="w-12 h-[1px] mx-auto mb-8 opacity-20" style={{ backgroundColor: 'currentColor' }} />
      <h3 className="text-[10px] tracking-[0.3em] uppercase mb-4 font-medium opacity-60">Daily Stoic</h3>
      
      <div className="font-serif text-sm md:text-base opacity-90 leading-relaxed max-w-xl mx-auto mb-3 whitespace-pre-wrap">
        「{quote.jaQuote}」
      </div>
      
      <div className="italic font-serif text-xs md:text-sm opacity-60 leading-relaxed max-w-xl mx-auto">
        "{quote.quote}"
      </div>

      <div className="text-[10px] tracking-widest uppercase mt-5 opacity-50 font-sans">
        — {quote.author}
      </div>
    </motion.div>
  );
}
