import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Trash2, Send } from 'lucide-react';

export interface Memo {
  id: string;
  text: string;
  createdAt: string;
}

interface MemoSheetProps {
  memos: Memo[];
  onAdd: (text: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  bgColor?: string;
  textColor?: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'たった今';
  if (diffMin < 60) return `${diffMin}分前`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}時間前`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}日前`;
  return d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
}

export function MemoSheet({ memos, onAdd, onDelete, onClose, bgColor = '#050505', textColor = '#fafafa' }: MemoSheetProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setInput('');
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="rounded-t-2xl flex flex-col max-h-[85vh]"
          style={{ backgroundColor: bgColor, color: textColor, borderTop: '1px solid rgba(255,255,255,0.08)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ヘッダー */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
            <span className="text-[10px] tracking-[0.3em] uppercase font-medium opacity-50">Quick Memo</span>
            <button onClick={onClose} className="opacity-40 hover:opacity-80 transition-opacity p-1">
              <X size={16} />
            </button>
          </div>

          {/* 入力エリア */}
          <div className="px-4 pb-3 shrink-0">
            <div
              className="flex items-end gap-2 rounded-xl px-3 py-2"
              style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="思いついたことをメモ..."
                rows={2}
                className="flex-1 bg-transparent resize-none outline-none text-sm leading-relaxed placeholder:opacity-30"
                style={{ color: textColor }}
              />
              <button
                onClick={handleSubmit}
                disabled={!input.trim()}
                className="shrink-0 mb-0.5 opacity-60 hover:opacity-100 disabled:opacity-20 transition-opacity"
              >
                <Send size={16} />
              </button>
            </div>
            <p className="text-[10px] opacity-25 mt-1.5 ml-1">⌘+Enter で保存</p>
          </div>

          {/* メモ一覧 */}
          <div className="overflow-y-auto flex-1 px-4 pb-6 space-y-2">
            {memos.length === 0 ? (
              <p className="text-xs opacity-25 text-center py-6">まだメモがありません</p>
            ) : (
              [...memos].reverse().map((memo) => (
                <motion.div
                  key={memo.id}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="group flex items-start gap-3 rounded-xl px-3 py-3"
                  style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words opacity-85">{memo.text}</p>
                    <p className="text-[10px] opacity-30 mt-1">{formatDate(memo.createdAt)}</p>
                  </div>
                  <button
                    onClick={() => onDelete(memo.id)}
                    className="shrink-0 opacity-0 group-hover:opacity-40 hover:!opacity-80 transition-opacity pt-0.5"
                  >
                    <Trash2 size={13} />
                  </button>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </motion.div>
  );
}
