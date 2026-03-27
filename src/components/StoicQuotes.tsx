import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const STOIC_QUOTES = [
  { quote: "It is not death that a man should fear, but he should fear never beginning to live.", author: "Marcus Aurelius" },
  { quote: "We are more often frightened than hurt; and we suffer more from imagination than from reality.", author: "Seneca" },
  { quote: "How long are you going to wait before you demand the best for yourself?", author: "Epictetus" },
  { quote: "You could leave life right now. Let that determine what you do and say and think.", author: "Marcus Aurelius" },
  { quote: "Life is very short and anxious for those who forget the past, neglect the present, and fear the future.", author: "Seneca" },
  { quote: "Don't explain your philosophy. Embody it.", author: "Epictetus" },
  { quote: "Waste no more time arguing about what a good man should be. Be one.", author: "Marcus Aurelius" },
  { quote: "Sometimes even to live is an act of courage.", author: "Seneca" },
];

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
      <div className="italic font-serif text-sm md:text-base opacity-80 leading-relaxed max-w-xl mx-auto">
        "{quote.quote}"
      </div>
      <div className="text-[10px] tracking-widest uppercase mt-4 opacity-50 font-sans">
        — {quote.author}
      </div>
    </motion.div>
  );
}
