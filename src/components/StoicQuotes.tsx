import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const STOIC_QUOTES = [
  { 
    quote: "It is not death that a man should fear, but he should fear never beginning to live.", 
    jaQuote: "人が恐れるべきは死ではなく、真に生き始めることのない人生である。",
    author: "Marcus Aurelius" 
  },
  { 
    quote: "We are more often frightened than hurt; and we suffer more from imagination than from reality.", 
    jaQuote: "我々は傷つくことよりも、恐れることの方が多い。現実よりも想像によって苦しむのだ。",
    author: "Seneca" 
  },
  { 
    quote: "How long are you going to wait before you demand the best for yourself?", 
    jaQuote: "自分自身に最高を求めるのを、いつまで待ち続けるつもりなのか？",
    author: "Epictetus" 
  },
  { 
    quote: "You could leave life right now. Let that determine what you do and say and think.", 
    jaQuote: "あなたは今この瞬間にも人生を終えるかもしれない。そのことを、あなたのすべての行動、言葉、思考の基準としなさい。",
    author: "Marcus Aurelius" 
  },
  { 
    quote: "Life is very short and anxious for those who forget the past, neglect the present, and fear the future.", 
    jaQuote: "過去を忘れ、現在をおろそかにし、未来を恐れる者にとって、人生は非常に短く、不安なものである。",
    author: "Seneca" 
  },
  { 
    quote: "Don't explain your philosophy. Embody it.", 
    jaQuote: "自分の哲学を説明するな。それを体現しなさい。",
    author: "Epictetus" 
  },
  { 
    quote: "Waste no more time arguing about what a good man should be. Be one.", 
    jaQuote: "善い人間とはどうあるべきかについて、これ以上議論して時間を無駄にするな。ただ、そうなりなさい。",
    author: "Marcus Aurelius" 
  },
  { 
    quote: "Sometimes even to live is an act of courage.", 
    jaQuote: "時には、生きること自体が勇気ある行動である。",
    author: "Seneca" 
  },
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
