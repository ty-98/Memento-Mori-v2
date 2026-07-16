import React, { useState } from 'react';
import { Plus, Circle, CheckCircle2, Trash2 } from 'lucide-react';
import { BucketItem } from '../App';

interface BucketListPanelProps {
  items: BucketItem[];
  onChange: (items: BucketItem[]) => void;
}

export function BucketListPanel({ items, onChange }: BucketListPanelProps) {
  const [inputText, setInputText] = useState('');

  const handleAdd = () => {
    const text = inputText.trim().slice(0, 200);
    if (!text) return;
    const newItem: BucketItem = {
      id: crypto.randomUUID(),
      text,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    onChange([newItem, ...items]);
    setInputText('');
  };

  const handleToggle = (id: string) => {
    onChange(items.map((item) => item.id === id ? { ...item, completed: !item.completed } : item));
  };

  const handleDelete = (id: string) => {
    onChange(items.filter((item) => item.id !== id));
  };

  const sortedItems = [
    ...items.filter((i) => !i.completed).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    ...items.filter((i) => i.completed).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="死ぬまでにやりたいこと..."
          maxLength={200}
          className="flex-1 bg-black/20 border border-zinc-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-zinc-600 transition-colors placeholder:text-zinc-600"
        />
        <button
          onClick={handleAdd}
          className="bg-zinc-100 text-zinc-950 rounded-lg px-4 py-3 hover:bg-white transition-colors flex items-center shrink-0"
        >
          <Plus size={18} />
        </button>
      </div>

      {sortedItems.length > 0 && (
        <>
          <div className="h-px bg-zinc-800/60 my-2" />
          <div className="space-y-1">
            {sortedItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 group p-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <button
                  onClick={() => handleToggle(item.id)}
                  className={`shrink-0 transition-opacity ${item.completed ? 'opacity-30 text-zinc-500' : 'opacity-50 hover:opacity-100'}`}
                >
                  {item.completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                </button>
                <span className={`flex-1 text-sm font-light leading-relaxed transition-all ${
                  item.completed ? 'line-through opacity-30 text-zinc-500' : 'opacity-90'
                }`}>
                  {item.text}
                </span>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="opacity-20 hover:opacity-100 hover:text-red-400 transition-all shrink-0 md:opacity-0 md:group-hover:opacity-30"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {items.length === 0 && (
        <p className="text-center text-zinc-600 text-sm py-10">
          まだ何もありません。やりたいことを追加してみましょう。
        </p>
      )}
    </div>
  );
}
