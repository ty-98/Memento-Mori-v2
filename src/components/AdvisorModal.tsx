import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Compass, Sparkles, Loader2 } from 'lucide-react';
import { BucketItem, UserData } from '../App';

type Step = 'topic' | 'questioning' | 'answering' | 'analyzing' | 'proposals';

interface Proposal {
  type: 'bucketList' | 'decadeGoal' | 'notes' | 'quote';
  value: string;
  decade?: number;
  reason: string;
  applied: boolean;
  skipped: boolean;
}

interface AdvisorModalProps {
  isOpen: boolean;
  onClose: () => void;
  userData: UserData;
  onUpdateUserData: (data: Partial<UserData>) => void;
}

const SESSION_LIMIT = 3;
const STORAGE_KEY = 'advisor_sessions';

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getDailySessions(): number {
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

function incrementSessions(): number {
  const count = getDailySessions() + 1;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: getTodayKey(), count }));
  return count;
}

function buildContext(userData: UserData): string {
  const now = new Date();
  const birth = new Date(userData.birthDate);
  const age = Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
  const remaining = userData.expectedLifespan - age;
  const goals = userData.decadeGoals
    ? Object.entries(userData.decadeGoals).map(([d, g]) => `${d}代: ${g}`).join('、')
    : 'なし';
  const bucket = userData.bucketList?.filter(i => !i.completed).slice(0, 5).map(i => i.text).join('、') || 'なし';
  return `名前: ${userData.name} / 年齢: ${age}歳 / 残り推定: ${remaining}年 / 座右の銘: "${userData.quote}" / 10年目標: ${goals} / バケツリスト: ${bucket} / 大切にしていること: ${userData.notes || 'なし'}`;
}

const THEMES = [
  { label: '仕事・キャリア', emoji: '💼' },
  { label: '時間の使い方', emoji: '⏳' },
  { label: 'やりたいこと', emoji: '✨' },
  { label: '人間関係', emoji: '🤝' },
  { label: '自分の在り方', emoji: '🧭' },
];

export function AdvisorModal({ isOpen, onClose, userData, onUpdateUserData }: AdvisorModalProps) {
  const [step, setStep] = useState<Step>('topic');
  const [topic, setTopic] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [insight, setInsight] = useState('');
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionCount, setSessionCount] = useState(() => getDailySessions());

  const remaining = SESSION_LIMIT - sessionCount;

  const callGemini = async (prompt: string): Promise<string> => {
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
    return data.text ?? '';
  };

  const handleTopicSubmit = async () => {
    const t = topic.trim();
    if (!t) return;
    if (remaining <= 0) {
      setError('本日のご利用上限（3回）に達しました。また明日お話ししましょう。');
      return;
    }

    setLoading(true);
    setError('');
    setStep('questioning');

    try {
      const ctx = buildContext(userData);
      const prompt = `あなたは洗練されたライフコンサルタントです。フレンドリーで知的、フォーマルすぎない語り口でお願いします。

ユーザー情報: ${ctx}
相談テーマ: 「${t}」

このユーザーの状況を踏まえた上で、テーマについて本質的な洞察を引き出す「1つの深い質問」を日本語で生成してください。
- このユーザーの具体的な状況に即した質問にすること
- 答えることで自分の優先事項や価値観を再発見できる問いにすること
- 2〜3文程度、問いかけのみを返すこと（前置き・解説は不要）`;

      const q = await callGemini(prompt);
      setQuestion(q.trim());
      setStep('answering');
    } catch (e: any) {
      setError(e.message);
      setStep('topic');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSubmit = async () => {
    const a = answer.trim();
    if (!a) return;

    setLoading(true);
    setError('');
    setStep('analyzing');

    try {
      const ctx = buildContext(userData);
      const birth = new Date(userData.birthDate);
      const age = Math.floor((new Date().getTime() - birth.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
      const currentDecade = Math.floor(age / 10) * 10;

      const prompt = `あなたは洗練されたライフコンサルタントです。

ユーザー情報: ${ctx}
現在の年代: ${currentDecade}代

【会話】
コンサルタントの質問: ${question}
ユーザーの答え: ${a}

この会話を分析し、以下のJSON形式のみで応答してください（コードブロック・説明文は不要）。

{
  "insight": "会話から読み取れる洞察を2〜3文で（ユーザーに語りかける口調で）",
  "proposals": [
    {
      "type": "bucketList" または "decadeGoal" または "notes" または "quote",
      "value": "提案するテキスト",
      "decade": ${currentDecade},
      "reason": "なぜこれを提案するか15文字以内で"
    }
  ]
}

proposals は最大3件、本当に意味のある提案のみ。
type の説明:
- bucketList: 死ぬまでにやりたいこととして追加すべきもの
- decadeGoal: この年代の目標として設定すべきもの（decade フィールド必須）
- notes: 大切にしていること・Important Things として記録すべき気づき
- quote: 座右の銘として採用すべき言葉（確信がある場合のみ）`;

      const raw = await callGemini(prompt);
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('回答の解析に失敗しました。もう一度お試しください。');

      const result = JSON.parse(jsonMatch[0]);
      setInsight(result.insight ?? '');
      setProposals((result.proposals ?? []).map((p: any) => ({ ...p, applied: false, skipped: false })));

      const newCount = incrementSessions();
      setSessionCount(newCount);
      setStep('proposals');
    } catch (e: any) {
      setError(e.message);
      setStep('answering');
    } finally {
      setLoading(false);
    }
  };

  const applyProposal = (index: number) => {
    const p = proposals[index];
    if (p.type === 'bucketList') {
      const newItem: BucketItem = {
        id: crypto.randomUUID(),
        text: p.value,
        completed: false,
        createdAt: new Date().toISOString(),
      };
      onUpdateUserData({ bucketList: [...(userData.bucketList ?? []), newItem] });
    } else if (p.type === 'decadeGoal' && p.decade !== undefined) {
      onUpdateUserData({ decadeGoals: { ...(userData.decadeGoals ?? {}), [p.decade]: p.value } });
    } else if (p.type === 'notes') {
      const existing = userData.notes ? userData.notes + '\n\n' : '';
      onUpdateUserData({ notes: existing + p.value });
    } else if (p.type === 'quote') {
      onUpdateUserData({ quote: p.value });
    }
    setProposals(prev => prev.map((item, i) => i === index ? { ...item, applied: true } : item));
  };

  const skipProposal = (index: number) => {
    setProposals(prev => prev.map((item, i) => i === index ? { ...item, skipped: true } : item));
  };

  const proposalLabel = (p: Proposal) => {
    if (p.type === 'bucketList') return 'Bucket List';
    if (p.type === 'decadeGoal') return `${p.decade}代の目標`;
    if (p.type === 'notes') return 'Important Things';
    if (p.type === 'quote') return '座右の銘';
    return '';
  };

  const handleClose = () => {
    setStep('topic');
    setTopic('');
    setQuestion('');
    setAnswer('');
    setInsight('');
    setProposals([]);
    setError('');
    onClose();
  };

  const handleReset = () => {
    setStep('topic');
    setTopic('');
    setQuestion('');
    setAnswer('');
    setInsight('');
    setProposals([]);
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
        onClick={handleClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-[#0a0a0a] border border-zinc-800 rounded-2xl shadow-2xl p-6 md:p-8"
          onClick={(e) => e.stopPropagation()}
          style={{ color: userData.textColor || '#fafafa' }}
        >
          <button onClick={handleClose} className="absolute top-4 right-4 p-2 opacity-60 hover:opacity-100 hover:bg-zinc-900 rounded-full transition-all">
            <X size={20} />
          </button>

          <div className="flex items-center gap-3 mb-1">
            <Compass className="opacity-80" size={22} />
            <h2 className="text-xl font-light tracking-wide">Life Advisor</h2>
          </div>
          <p className="text-zinc-600 text-xs mb-6">本日残り {remaining}/{SESSION_LIMIT} セッション</p>

          {/* TOPIC */}
          {step === 'topic' && (
            <div className="space-y-5">
              <p className="text-sm opacity-80 leading-relaxed">今日は何について話しましょうか？</p>
              <div className="flex flex-wrap gap-2">
                {THEMES.map(t => (
                  <button
                    key={t.label}
                    onClick={() => setTopic(t.label)}
                    className={`px-3 py-1.5 rounded-full text-xs border transition-all ${
                      topic === t.label
                        ? 'border-zinc-400 bg-zinc-800 opacity-100'
                        : 'border-zinc-800 opacity-50 hover:opacity-100'
                    }`}
                  >
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTopicSubmit()}
                placeholder="または自由に入力..."
                maxLength={100}
                className="w-full bg-[#050505] border border-zinc-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-zinc-600 transition-colors placeholder:text-zinc-600"
              />
              {error && <p className="text-red-400 text-sm bg-red-400/10 p-3 rounded-lg border border-red-400/20">{error}</p>}
              <button
                onClick={handleTopicSubmit}
                disabled={!topic.trim() || remaining <= 0}
                className="w-full bg-zinc-100 text-zinc-950 font-medium rounded-lg px-4 py-3 hover:bg-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Sparkles size={15} />
                話してみる
              </button>
            </div>
          )}

          {/* LOADING QUESTION */}
          {step === 'questioning' && (
            <div className="py-16 flex flex-col items-center text-center space-y-4">
              <Loader2 size={28} className="animate-spin opacity-50" />
              <p className="text-zinc-500 text-sm tracking-wide">あなたの人生を読み込んでいます...</p>
            </div>
          )}

          {/* ANSWERING */}
          {step === 'answering' && (
            <div className="space-y-5">
              <div className="border-l-2 border-zinc-700 pl-4">
                <p className="text-sm leading-relaxed opacity-90 whitespace-pre-wrap">{question}</p>
              </div>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="思ったことを素直に..."
                rows={6}
                maxLength={1000}
                className="w-full bg-[#050505] border border-zinc-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-zinc-600 transition-colors placeholder:text-zinc-600 resize-none leading-relaxed"
                autoFocus
              />
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-600">{answer.length}/1000</span>
              </div>
              {error && <p className="text-red-400 text-sm bg-red-400/10 p-3 rounded-lg border border-red-400/20">{error}</p>}
              <button
                onClick={handleAnswerSubmit}
                disabled={!answer.trim()}
                className="w-full bg-zinc-100 text-zinc-950 font-medium rounded-lg px-4 py-3 hover:bg-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                答える
              </button>
            </div>
          )}

          {/* ANALYZING */}
          {step === 'analyzing' && (
            <div className="py-16 flex flex-col items-center text-center space-y-4">
              <Loader2 size={28} className="animate-spin opacity-50" />
              <p className="text-zinc-500 text-sm tracking-wide">あなたの答えを整理しています...</p>
            </div>
          )}

          {/* PROPOSALS */}
          {step === 'proposals' && (
            <div className="space-y-5 animate-in fade-in duration-700">
              {insight && (
                <div className="bg-zinc-900/60 rounded-xl p-4 border border-zinc-800">
                  <p className="text-sm leading-relaxed opacity-90">{insight}</p>
                </div>
              )}

              {proposals.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest">あなたの人生データへの提案</p>
                  {proposals.map((p, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: p.applied || p.skipped ? 0.3 : 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="border border-zinc-800 rounded-xl p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">{proposalLabel(p)}</p>
                          <p className="text-sm leading-relaxed opacity-90 mb-1">{p.value}</p>
                          <p className="text-xs text-zinc-600">{p.reason}</p>
                        </div>
                        {!p.applied && !p.skipped && (
                          <div className="flex gap-2 shrink-0 pt-1">
                            <button
                              onClick={() => applyProposal(i)}
                              className="px-3 py-1.5 bg-zinc-100 text-zinc-950 text-xs rounded-lg hover:bg-white transition-colors font-medium"
                            >
                              追加
                            </button>
                            <button
                              onClick={() => skipProposal(i)}
                              className="px-3 py-1.5 border border-zinc-800 text-xs rounded-lg hover:bg-zinc-900 transition-colors opacity-50 hover:opacity-100"
                            >
                              スキップ
                            </button>
                          </div>
                        )}
                        {p.applied && <span className="text-[10px] text-zinc-500 shrink-0 pt-1">✓ 追加済み</span>}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              <button
                onClick={handleReset}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors uppercase tracking-widest"
              >
                ← 別のテーマで話す
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
