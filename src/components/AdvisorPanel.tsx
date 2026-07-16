import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Compass, Sparkles, Loader2, ListChecks, Heart, Home, Quote, Flame, ChevronDown, ChevronUp } from 'lucide-react';
import { BucketItem, UserData } from '../App';

// ─── Adviser (general) types ───────────────────────────────────────────────
type Step = 'topic' | 'questioning' | 'answering' | 'analyzing' | 'proposals';

interface Proposal {
  type: 'bucketList' | 'decadeGoal' | 'notes' | 'quote';
  value: string;
  decade?: number;
  reason: string;
  applied: boolean;
  skipped: boolean;
}

// ─── Purpose dialogue types ─────────────────────────────────────────────────
type PurposeStep = 'collapsed' | 'intro' | 'answering' | 'synthesizing' | 'confirming';

const PURPOSE_QUESTIONS = [
  '時間を忘れて没頭できることは何ですか？\nそれはなぜだと思いますか？',
  '人生の終わりに、どんな人でありたいですか？\n誰かにどんな影響を残したいですか？',
  'もし失敗が絶対にない世界なら、何に挑戦したいですか？\nまた、人生で絶対に後悔したくないことは何ですか？',
];

// ─── Props ──────────────────────────────────────────────────────────────────
interface AdvisorPanelProps {
  userData: UserData;
  onUpdateUserData: (data: Partial<UserData>) => void;
  onNavigateToPurpose?: () => void;
}

// ─── Session management ─────────────────────────────────────────────────────
const SESSION_LIMIT = 5;
const STORAGE_KEY = 'advisor_sessions';

function getTodayKey() { return new Date().toISOString().slice(0, 10); }
function getDailySessions(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const data = JSON.parse(raw);
    return data.date !== getTodayKey() ? 0 : (data.count ?? 0);
  } catch { return 0; }
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
  const purposePart = userData.purpose ? `パーパス: 「${userData.purpose}」 / ` : '';
  return `${purposePart}名前: ${userData.name} / 年齢: ${age}歳 / 残り推定: ${remaining}年 / 座右の銘: "${userData.quote}" / 10年目標: ${goals} / バケツリスト: ${bucket} / 大切にしていること: ${userData.notes || 'なし'}`;
}

const THEMES = [
  { label: '仕事・キャリア', emoji: '💼' },
  { label: '時間の使い方', emoji: '⏳' },
  { label: 'やりたいこと', emoji: '✨' },
  { label: '人間関係', emoji: '🤝' },
  { label: '自分の在り方', emoji: '🧭' },
];

// ─── Purpose dialogue sub-component ─────────────────────────────────────────
function PurposeDialogue({
  userData,
  onUpdateUserData,
  onNavigateToPurpose,
  initiallyExpanded,
}: {
  userData: UserData;
  onUpdateUserData: (data: Partial<UserData>) => void;
  onNavigateToPurpose?: () => void;
  initiallyExpanded: boolean;
}) {
  const hasPurpose = !!userData.purpose;
  const [purposeStep, setPurposeStep] = useState<PurposeStep>(
    initiallyExpanded && !hasPurpose ? 'intro' : 'collapsed'
  );
  const [currentRound, setCurrentRound] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [draftPurpose, setDraftPurpose] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const callAI = async (prompt: string): Promise<string> => {
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

  const handleStartDialogue = () => {
    setCurrentRound(0);
    setAnswers([]);
    setCurrentAnswer('');
    setError('');
    setPurposeStep('answering');
  };

  const handleAnswerSubmit = async () => {
    const a = currentAnswer.trim();
    if (!a) return;
    const newAnswers = [...answers, a];
    setAnswers(newAnswers);
    setCurrentAnswer('');

    if (currentRound < PURPOSE_QUESTIONS.length - 1) {
      setCurrentRound(r => r + 1);
      return;
    }

    setLoading(true);
    setError('');
    setPurposeStep('synthesizing');
    try {
      const now = new Date();
      const birth = new Date(userData.birthDate);
      const age = Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
      const remaining = userData.expectedLifespan - age;
      const qaPairs = PURPOSE_QUESTIONS.map((q, i) => `Q: ${q}\nA: ${newAnswers[i]}`).join('\n\n');
      const prompt = `あなたはライフコーチです。以下のユーザーの3つの回答をもとに、その人の「パーパス（なんのために生きるか）」を1〜2文で言語化してください。

ユーザー情報: ${age}歳、残り推定${remaining}年

${qaPairs}

【出力ルール】
- 「〜のために、〜することで、〜する」のような自然な形式で
- 大げさすぎず、その人らしい言葉で
- 日本語で2文以内、パーパス文のみを返す（前置き・説明不要）`;
      const result = await callAI(prompt);
      setDraftPurpose(result.trim());
      setPurposeStep('confirming');
    } catch (e: any) {
      setError(e.message);
      setPurposeStep('answering');
      setCurrentRound(PURPOSE_QUESTIONS.length - 1);
      setAnswers(newAnswers.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    const p = draftPurpose.trim();
    if (!p) return;
    onUpdateUserData({ purpose: p } as any);
    setPurposeStep('collapsed');
    onNavigateToPurpose?.();
  };

  // ── Collapsed banner ──
  if (purposeStep === 'collapsed') {
    return (
      <div className="border border-current/15 rounded-xl overflow-hidden mb-6">
        <button
          onClick={() => setPurposeStep('intro')}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Flame size={13} className="opacity-50" />
            <span className="text-xs opacity-60 font-medium">
              {hasPurpose
                ? `${userData.purpose!.slice(0, 42)}${userData.purpose!.length > 42 ? '…' : ''}`
                : 'パーパスを設定する'}
            </span>
          </div>
          <ChevronDown size={13} className="opacity-30" />
        </button>
      </div>
    );
  }

  // ── Expanded ──
  return (
    <div className="border border-current/15 rounded-xl p-5 space-y-4 mb-6">
      <div className="flex items-center justify-between">
        <p className="text-[10px] tracking-[0.3em] uppercase opacity-40 flex items-center gap-1.5">
          <Flame size={10} />Purpose
        </p>
        <button onClick={() => setPurposeStep('collapsed')} className="opacity-30 hover:opacity-70 transition-opacity">
          <ChevronUp size={13} />
        </button>
      </div>

      {/* intro */}
      {purposeStep === 'intro' && (
        <div className="space-y-4">
          {hasPurpose ? (
            <>
              <p className="text-sm leading-relaxed opacity-80">{userData.purpose}</p>
              <div className="flex gap-2">
                <button
                  onClick={handleStartDialogue}
                  className="flex-1 border border-current/20 text-xs rounded-lg py-2 opacity-60 hover:opacity-100 transition-opacity"
                >
                  対話して更新
                </button>
                <button
                  onClick={() => { setPurposeStep('collapsed'); onNavigateToPurpose?.(); }}
                  className="flex-1 border border-current/20 text-xs rounded-lg py-2 opacity-60 hover:opacity-100 transition-opacity"
                >
                  ダッシュボードへ →
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs opacity-50 leading-relaxed">
                「なんのために生きるか」を言語化します。3つの問いに答えると、AIがパーパスをまとめます。
              </p>
              <button
                onClick={handleStartDialogue}
                className="w-full bg-zinc-100 text-zinc-950 font-medium rounded-lg px-4 py-2.5 hover:bg-white transition-colors text-sm flex items-center justify-center gap-2"
              >
                <Sparkles size={14} /> はじめる
              </button>
            </>
          )}
        </div>
      )}

      {/* answering */}
      {purposeStep === 'answering' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-[10px] tracking-[0.2em] uppercase opacity-40">問い {currentRound + 1} / {PURPOSE_QUESTIONS.length}</span>
            <div className="flex-1 bg-current/10 rounded-full h-0.5">
              <div
                className="bg-current/40 h-0.5 rounded-full transition-all duration-500"
                style={{ width: `${((currentRound + 1) / PURPOSE_QUESTIONS.length) * 100}%` }}
              />
            </div>
          </div>
          <div className="border-l-2 border-current/30 pl-4">
            <p className="text-sm leading-relaxed opacity-90 whitespace-pre-wrap">{PURPOSE_QUESTIONS[currentRound]}</p>
          </div>
          <textarea
            value={currentAnswer}
            onChange={(e) => setCurrentAnswer(e.target.value)}
            placeholder="思ったことを素直に..."
            rows={4}
            maxLength={1000}
            className="w-full bg-black/20 border border-zinc-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-zinc-600 transition-colors placeholder:text-zinc-600 resize-none leading-relaxed"
            autoFocus
          />
          <div className="text-right text-xs opacity-30">{currentAnswer.length}/1000</div>
          {error && <p className="text-red-400 text-xs bg-red-400/10 p-3 rounded-lg border border-red-400/20">{error}</p>}
          <button
            onClick={handleAnswerSubmit}
            disabled={!currentAnswer.trim()}
            className="w-full bg-zinc-100 text-zinc-950 font-medium rounded-lg px-4 py-2.5 hover:bg-white transition-colors disabled:opacity-30 text-sm"
          >
            {currentRound < PURPOSE_QUESTIONS.length - 1 ? '次の問いへ →' : 'パーパスを生成する'}
          </button>
        </div>
      )}

      {/* synthesizing */}
      {purposeStep === 'synthesizing' && (
        <div className="py-8 flex flex-col items-center text-center space-y-3">
          <Loader2 size={22} className="animate-spin opacity-40" />
          <p className="text-xs opacity-40 tracking-wide">パーパスを生成しています...</p>
        </div>
      )}

      {/* confirming */}
      {purposeStep === 'confirming' && (
        <div className="space-y-4">
          <p className="text-[10px] tracking-[0.2em] uppercase opacity-40">生成されたパーパス</p>
          <textarea
            value={draftPurpose}
            onChange={(e) => setDraftPurpose(e.target.value)}
            rows={3}
            maxLength={500}
            className="w-full bg-transparent border border-current/20 rounded-lg px-3 py-2 text-sm leading-relaxed focus:outline-none resize-none"
          />
          <p className="text-[11px] opacity-30">このまま、または編集して確定してください。</p>
          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              disabled={!draftPurpose.trim()}
              className="flex-1 bg-zinc-100 text-zinc-950 text-sm font-medium rounded-lg py-2.5 hover:bg-white transition-colors disabled:opacity-30"
            >
              <Flame size={13} className="inline mr-1.5" />確定する
            </button>
            <button
              onClick={() => { setPurposeStep('answering'); setCurrentRound(0); setAnswers([]); }}
              className="px-4 border border-current/20 text-xs rounded-lg opacity-50 hover:opacity-100"
            >
              やり直す
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main AdvisorPanel ───────────────────────────────────────────────────────
export function AdvisorPanel({ userData, onUpdateUserData, onNavigateToPurpose }: AdvisorPanelProps) {
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
      setError('本日のご利用上限（5回）に達しました。また明日お話ししましょう。');
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
      const newItem: BucketItem = { id: crypto.randomUUID(), text: p.value, completed: false, createdAt: new Date().toISOString() };
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

  const proposalMeta = (p: Proposal): { icon: React.ReactNode; label: string; tab: string; buttonLabel: string } => {
    if (p.type === 'bucketList') return { icon: <ListChecks size={11} />, label: 'Bucket List', tab: 'BUCKET', buttonLabel: 'BUCKETに追加' };
    if (p.type === 'decadeGoal') return { icon: <Home size={11} />, label: `${p.decade}代の目標`, tab: 'HOME', buttonLabel: `${p.decade}代の目標に設定` };
    if (p.type === 'notes') return { icon: <Heart size={11} />, label: 'Important Things', tab: 'LIFE', buttonLabel: 'LIFEに追加' };
    if (p.type === 'quote') return { icon: <Quote size={11} />, label: '座右の銘', tab: 'HOME', buttonLabel: '座右の銘に設定' };
    return { icon: null, label: '', tab: '', buttonLabel: '追加' };
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

  return (
    <div className="space-y-5">
      {/* Purpose section at top */}
      <PurposeDialogue
        userData={userData}
        onUpdateUserData={onUpdateUserData}
        onNavigateToPurpose={onNavigateToPurpose}
        initiallyExpanded={!userData.purpose}
      />

      {/* Session counter + label */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] tracking-[0.2em] uppercase opacity-30 flex items-center gap-1.5">
          <Compass size={10} />Life Advisor
        </p>
        <p className="text-zinc-600 text-xs">本日残り {remaining}/{SESSION_LIMIT} セッション</p>
      </div>

      {/* TOPIC */}
      {step === 'topic' && (
        <div className="space-y-4">
          <p className="text-sm opacity-75 leading-relaxed">今日は何について話しましょうか？</p>
          <div className="flex flex-wrap gap-2">
            {THEMES.map(t => (
              <button
                key={t.label}
                onClick={() => setTopic(t.label)}
                className={`px-3 py-1.5 rounded-full text-xs border transition-all ${
                  topic === t.label ? 'border-zinc-400 bg-zinc-800 opacity-100' : 'border-zinc-800 opacity-50 hover:opacity-100'
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
            className="w-full bg-black/20 border border-zinc-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-zinc-600 transition-colors placeholder:text-zinc-600"
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
        <div className="space-y-4">
          <div className="border-l-2 border-zinc-700 pl-4">
            <p className="text-sm leading-relaxed opacity-90 whitespace-pre-wrap">{question}</p>
          </div>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="思ったことを素直に..."
            rows={6}
            maxLength={1000}
            className="w-full bg-black/20 border border-zinc-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-zinc-600 transition-colors placeholder:text-zinc-600 resize-none leading-relaxed"
            autoFocus
          />
          <div className="text-right text-xs text-zinc-600">{answer.length}/1000</div>
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
        <div className="space-y-5">
          {insight && (
            <div className="bg-white/5 rounded-xl p-4 border border-zinc-800">
              <p className="text-sm leading-relaxed opacity-90">{insight}</p>
            </div>
          )}
          {proposals.length > 0 && (
            <div className="space-y-3">
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">あなたの人生データへの提案</p>
              {proposals.map((p, i) => {
                const meta = proposalMeta(p);
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: p.applied || p.skipped ? 0.3 : 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="border border-zinc-800 rounded-xl overflow-hidden"
                  >
                    <div className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900/60 border-b border-zinc-800">
                      <span className="text-zinc-400">{meta.icon}</span>
                      <span className="text-[10px] text-zinc-400 tracking-wider uppercase">{meta.label}</span>
                      <span className="text-[10px] text-zinc-600 ml-1">→ {meta.tab}タブ</span>
                    </div>
                    <div className="p-4">
                      <p className="text-sm leading-relaxed opacity-90 mb-1">{p.value}</p>
                      <p className="text-xs text-zinc-600 mb-3">{p.reason}</p>
                      {!p.applied && !p.skipped && (
                        <div className="flex gap-2">
                          <button onClick={() => applyProposal(i)} className="px-3 py-1.5 bg-zinc-100 text-zinc-950 text-xs rounded-lg hover:bg-white transition-colors font-medium">
                            {meta.buttonLabel}
                          </button>
                          <button onClick={() => skipProposal(i)} className="px-3 py-1.5 border border-zinc-800 text-xs rounded-lg hover:bg-zinc-900 transition-colors opacity-50 hover:opacity-100">
                            スキップ
                          </button>
                        </div>
                      )}
                      {p.applied && <span className="text-[10px] text-zinc-500">✓ 追加済み</span>}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
          <button onClick={handleReset} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors uppercase tracking-widest">
            ← 別のテーマで話す
          </button>
        </div>
      )}
    </div>
  );
}
