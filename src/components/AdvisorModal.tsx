import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Brain, Loader2, RotateCcw } from 'lucide-react';
import { UserData } from '../App';

interface AdvisorModalProps {
  isOpen: boolean;
  onClose: () => void;
  userData: UserData;
}

const DAILY_LIMIT = 10;
const STORAGE_KEY = 'advisor_usage';

function getTodayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function getDailyUsage(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const data = JSON.parse(raw);
    if (data.date !== getTodayKey()) return 0;
    return data.count ?? 0;
  } catch {
    return 0;
  }
}

function incrementDailyUsage(): number {
  const count = getDailyUsage() + 1;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: getTodayKey(), count }));
  return count;
}

function buildPrompt(userData: UserData, question: string): string {
  const now = new Date();
  const birth = new Date(userData.birthDate);
  const ageYears = Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
  const remainingYears = userData.expectedLifespan - ageYears;

  const decadeGoalsText = userData.decadeGoals
    ? Object.entries(userData.decadeGoals)
        .map(([decade, goal]) => `  ${decade}代: ${goal}`)
        .join('\n')
    : '未設定';

  const bucketListText = userData.bucketList && userData.bucketList.length > 0
    ? userData.bucketList
        .filter(i => !i.completed)
        .slice(0, 10)
        .map(i => `  - ${i.text}`)
        .join('\n')
    : '未設定';

  return `あなたは人生の意思決定を支援するLife Intelligenceアドバイザーです。
以下のユーザー情報を踏まえた上で、ユーザーの問いに対して深く、率直に答えてください。

【ユーザー情報】
- 名前: ${userData.name}
- 現在の年齢: ${ageYears}歳
- 残り推定年数: 約${remainingYears}年
- 座右の銘: ${userData.quote}
- 人生のメモ: ${userData.notes || '未設定'}
- 10年ごとの目標:
${decadeGoalsText}
- バケツリスト（未達成）:
${bucketListText}

【ユーザーの問い】
${question}

【回答の方針】
- 残り時間の有限性を意識した視点で答えること
- 一般論ではなく、このユーザーの状況・価値観に即した内容にすること
- 400〜600文字程度、日本語で回答すること
- 背中を押すだけでなく、正直なトレードオフも伝えること`;
}

export function AdvisorModal({ isOpen, onClose, userData }: AdvisorModalProps) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [usageCount, setUsageCount] = useState(() => getDailyUsage());

  const remaining = DAILY_LIMIT - usageCount;

  const handleAsk = async () => {
    const q = question.trim();
    if (!q) return;
    if (remaining <= 0) {
      setError('本日の利用上限（10回）に達しました。明日またご利用ください。');
      return;
    }

    setLoading(true);
    setError('');
    setAnswer('');

    try {
      const prompt = buildPrompt(userData, q);
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'AIの応答に失敗しました');
      }

      const data = await res.json();
      setAnswer(data.text ?? '');
      const newCount = incrementDailyUsage();
      setUsageCount(newCount);
    } catch (e: any) {
      setError(e.message || 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setAnswer('');
    setQuestion('');
    setError('');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-[#0a0a0a] border border-zinc-800 rounded-2xl shadow-2xl p-6 md:p-8"
          onClick={(e) => e.stopPropagation()}
          style={{ color: userData.textColor || '#fafafa' }}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 opacity-60 hover:opacity-100 hover:bg-zinc-900 rounded-full transition-all"
          >
            <X size={20} />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <Brain className="opacity-80" size={24} />
            <h2 className="text-xl font-light tracking-wide">Life Advisor</h2>
          </div>
          <p className="text-zinc-500 text-xs mb-6 leading-relaxed">
            あなたの残り時間・目標・価値観を踏まえて、人生の意思決定を一緒に考えます。
          </p>

          {!answer && !loading && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wider">
                  今、どんな問いと向き合っていますか？
                </label>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="例：転職すべきか迷っています。今の仕事は安定しているが、やりがいが感じられない..."
                  rows={5}
                  maxLength={1000}
                  className="w-full bg-[#050505] border border-zinc-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-zinc-600 transition-colors placeholder:text-zinc-600 resize-none leading-relaxed"
                />
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-zinc-600">{question.length}/1000</span>
                  <span className="text-xs text-zinc-600">本日残り {remaining}/{DAILY_LIMIT} 回</span>
                </div>
              </div>

              {error && (
                <div className="text-red-400 text-sm bg-red-400/10 p-4 rounded-lg border border-red-400/20">
                  {error}
                </div>
              )}

              <button
                onClick={handleAsk}
                disabled={!question.trim() || remaining <= 0}
                className="w-full bg-zinc-100 text-zinc-950 font-medium rounded-lg px-4 py-3 hover:bg-white transition-colors flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Brain size={18} />
                <span>問いかける</span>
              </button>
            </div>
          )}

          {loading && (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-4">
              <Loader2 size={32} className="animate-spin opacity-60" />
              <p className="text-zinc-400 tracking-wide text-sm">あなたの人生を読み込んでいます...</p>
            </div>
          )}

          {answer && !loading && (
            <div className="space-y-6 animate-in fade-in duration-700">
              <div className="border-b border-zinc-800 pb-4">
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">あなたの問い</p>
                <p className="text-sm opacity-80 leading-relaxed">{question}</p>
              </div>

              <div
                className="text-sm md:text-base leading-loose font-light opacity-90 whitespace-pre-wrap"
              >
                {answer}
              </div>

              <div className="pt-4 border-t border-zinc-800 flex items-center justify-between">
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 text-xs text-zinc-500 uppercase tracking-widest hover:text-zinc-300 transition-colors"
                >
                  <RotateCcw size={12} />
                  別の問いを立てる
                </button>
                <span className="text-xs text-zinc-600">本日残り {DAILY_LIMIT - usageCount}/{DAILY_LIMIT} 回</span>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
