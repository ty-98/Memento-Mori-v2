import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Flame, Loader2, Sparkles, Pencil, RefreshCw } from 'lucide-react';
import { UserData } from '../App';

type Step = 'onboarding' | 'questioning' | 'answering' | 'synthesizing' | 'confirming' | 'dashboard';

interface CapitalScores {
  human: number;
  social: number;
  financial: number;
}

interface PurposePanelProps {
  userData: UserData;
  onUpdateUserData: (data: Partial<UserData>) => void;
}

const QUESTIONS = [
  '時間を忘れて没頭できることは何ですか？\nそれはなぜだと思いますか？',
  '人生の終わりに、どんな人でありたいですか？\n誰かにどんな影響を残したいですか？',
  'もし失敗が絶対にない世界なら、何に挑戦したいですか？\nまた、人生で絶対に後悔したくないことは何ですか？',
];

const CAPITAL_LABELS: Record<keyof CapitalScores, string> = {
  human: '人的資本',
  social: '社会資本',
  financial: '金融資本',
};

const CAPITAL_DESC: Record<keyof CapitalScores, string> = {
  human: '知識・スキル・経験',
  social: '信用・ネットワーク・関係',
  financial: '現金・資産・収入安定性',
};

function DotScore({ value }: { value: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={`w-2 h-2 rounded-full ${i <= value ? 'bg-current opacity-80' : 'bg-current opacity-15'}`} />
      ))}
    </span>
  );
}

export function PurposePanel({ userData, onUpdateUserData }: PurposePanelProps) {
  const hasPurpose = !!(userData as any).purpose;
  const [step, setStep] = useState<Step>(hasPurpose ? 'dashboard' : 'onboarding');
  const [currentRound, setCurrentRound] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [draftPurpose, setDraftPurpose] = useState((userData as any).purpose ?? '');
  const [editingPurpose, setEditingPurpose] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scores, setScores] = useState<CapitalScores>(
    (userData as any).capitalScores ?? { human: 3, social: 3, financial: 3 }
  );
  const [gapAnalysis, setGapAnalysis] = useState('');
  const [gapLoading, setGapLoading] = useState(false);
  const [scoreSaved, setScoreSaved] = useState(false);

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

  const buildContext = () => {
    const now = new Date();
    const birth = new Date(userData.birthDate);
    const age = Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
    const remaining = userData.expectedLifespan - age;
    return { age, remaining };
  };

  const handleStartDialogue = () => {
    setCurrentRound(0);
    setAnswers([]);
    setCurrentAnswer('');
    setError('');
    setStep('answering');
  };

  const handleAnswerSubmit = async () => {
    const a = currentAnswer.trim();
    if (!a) return;

    const newAnswers = [...answers, a];
    setAnswers(newAnswers);
    setCurrentAnswer('');

    if (currentRound < QUESTIONS.length - 1) {
      setCurrentRound(r => r + 1);
      return;
    }

    // All 3 questions answered → synthesize
    setLoading(true);
    setError('');
    setStep('synthesizing');

    try {
      const { age, remaining } = buildContext();
      const qaPairs = QUESTIONS.map((q, i) => `Q: ${q}\nA: ${newAnswers[i]}`).join('\n\n');

      const prompt = `あなたはライフコーチです。以下のユーザーの3つの回答をもとに、その人の「パーパス（なんのために生きるか）」を1〜2文で言語化してください。

ユーザー情報: ${age}歳、残り推定${remaining}年

${qaPairs}

【出力ルール】
- 「〜のために、〜することで、〜する」や「〜を通じて、〜に貢献する」のような形式が自然
- 大げさすぎず、具体的すぎず、その人らしい言葉で
- 日本語で2文以内、パーパス文のみを返す（前置き・説明不要）`;

      const result = await callAI(prompt);
      setDraftPurpose(result.trim());
      setStep('confirming');
    } catch (e: any) {
      setError(e.message);
      setStep('answering');
      setCurrentRound(QUESTIONS.length - 1);
      setAnswers(newAnswers.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPurpose = () => {
    const p = draftPurpose.trim();
    if (!p) return;
    onUpdateUserData({ purpose: p } as any);
    setStep('dashboard');
  };

  const handleSaveScores = () => {
    onUpdateUserData({ capitalScores: scores } as any);
    setScoreSaved(true);
    setTimeout(() => setScoreSaved(false), 2000);
  };

  const handleGapAnalysis = async () => {
    setGapLoading(true);
    setError('');
    try {
      const { age, remaining } = buildContext();
      const purpose = (userData as any).purpose || draftPurpose;
      const prompt = `あなたはライフストラテジストです。以下の情報をもとに、パーパスと現状の資本スコアのギャップを分析し、次に取るべきアクションを提言してください。

年齢: ${age}歳、残り推定: ${remaining}年
パーパス: 「${purpose}」
資本スコア（1〜5）:
- 人的資本（知識・スキル・経験）: ${scores.human}/5
- 社会資本（信用・ネットワーク・関係）: ${scores.social}/5
- 金融資本（現金・資産・収入安定性）: ${scores.financial}/5

【出力ルール】
- 3〜4文のシンプルな分析と提言
- 残り時間の文脈を意識した優先度の視点を含める
- 前置きや挨拶なしで、分析内容のみを返す`;
      const result = await callAI(prompt);
      setGapAnalysis(result.trim());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGapLoading(false);
    }
  };

  // ── ONBOARDING ──
  if (step === 'onboarding') {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
        {/* App philosophy */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 opacity-40">
            <div className="flex-1 h-px bg-current" />
            <span className="text-[9px] tracking-[0.3em] uppercase">Memento Mori</span>
            <div className="flex-1 h-px bg-current" />
          </div>
          <p className="text-sm leading-relaxed opacity-75">
            死を忘れるな——ラテン語でそういう意味です。
          </p>
          <p className="text-sm leading-relaxed opacity-60">
            人生には残された時間があります。いつかこの命がなくなることを忘れず、
            「どう生きたいか」「何を大切にするか」を考え続けることで、
            本当に重要なことに時間と意識を向けられるようになります。
          </p>
          <p className="text-sm leading-relaxed opacity-60">
            このアプリは、あなたの残り時間を可視化しながら、
            人生の意思決定・行動を支えるためのプラットフォームです。
            壮大なことは何もありません。ただ、自分の人生を自分で考えるための場所です。
          </p>
        </div>

        {/* Purpose explanation */}
        <div className="border-t border-current/10 pt-6 space-y-4">
          <p className="text-[10px] tracking-[0.3em] uppercase opacity-40">Purpose とは</p>
          <p className="text-sm leading-relaxed opacity-75">
            「なんのために生きるか」という問いへの、今のあなたなりの答えです。
          </p>
          <p className="text-sm leading-relaxed opacity-60">
            パーパスは人生の羅針盤になります。時間をどこに使うか、何を選ぶか——
            迷ったときに立ち戻れる基準があるだけで、意思決定の質が変わります。
            完璧でなくていい。変わってもいい。まず言葉にすることが出発点です。
          </p>
        </div>

        <button
          onClick={handleStartDialogue}
          className="w-full bg-zinc-100 text-zinc-950 font-medium rounded-lg px-4 py-3 hover:bg-white transition-colors flex items-center justify-center gap-2"
        >
          <Flame size={15} />
          パーパスを言語化する
        </button>
      </motion.div>
    );
  }

  // ── ANSWERING ──
  if (step === 'answering') {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
        <div className="flex items-center gap-3">
          <span className="text-[10px] tracking-[0.3em] uppercase opacity-40">問い {currentRound + 1} / {QUESTIONS.length}</span>
          <div className="flex-1 bg-current/10 rounded-full h-0.5">
            <div
              className="bg-current/40 h-0.5 rounded-full transition-all duration-500"
              style={{ width: `${((currentRound) / QUESTIONS.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="border-l-2 border-current/30 pl-4">
          <p className="text-sm leading-relaxed opacity-90 whitespace-pre-wrap">{QUESTIONS[currentRound]}</p>
        </div>

        <textarea
          value={currentAnswer}
          onChange={(e) => setCurrentAnswer(e.target.value)}
          placeholder="思ったことを素直に..."
          rows={5}
          maxLength={1000}
          className="w-full bg-black/20 border border-zinc-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-zinc-600 transition-colors placeholder:text-zinc-600 resize-none leading-relaxed"
          autoFocus
        />
        <div className="text-right text-xs opacity-30">{currentAnswer.length}/1000</div>

        {error && <p className="text-red-400 text-sm bg-red-400/10 p-3 rounded-lg border border-red-400/20">{error}</p>}

        <button
          onClick={handleAnswerSubmit}
          disabled={!currentAnswer.trim()}
          className="w-full bg-zinc-100 text-zinc-950 font-medium rounded-lg px-4 py-3 hover:bg-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {currentRound < QUESTIONS.length - 1 ? '次の問いへ →' : 'パーパスを生成する'}
        </button>

        <button onClick={() => setStep(hasPurpose ? 'dashboard' : 'onboarding')} className="text-xs opacity-30 hover:opacity-60 transition-opacity uppercase tracking-widest">
          ← 戻る
        </button>
      </motion.div>
    );
  }

  // ── SYNTHESIZING ──
  if (step === 'synthesizing') {
    return (
      <div className="py-20 flex flex-col items-center text-center space-y-4">
        <Loader2 size={28} className="animate-spin opacity-50" />
        <p className="text-sm opacity-40 tracking-wide">あなたの言葉からパーパスを生成しています...</p>
      </div>
    );
  }

  // ── CONFIRMING ──
  if (step === 'confirming') {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
        <p className="text-[10px] tracking-[0.3em] uppercase opacity-40">生成されたパーパス</p>
        <div className="border border-current/20 rounded-xl p-5 bg-white/5">
          <textarea
            value={draftPurpose}
            onChange={(e) => setDraftPurpose(e.target.value)}
            rows={4}
            maxLength={500}
            className="w-full bg-transparent text-sm leading-relaxed focus:outline-none resize-none"
          />
        </div>
        <p className="text-xs opacity-40">このままでも、編集しても構いません。後からいつでも変更できます。</p>
        <button
          onClick={handleConfirmPurpose}
          disabled={!draftPurpose.trim()}
          className="w-full bg-zinc-100 text-zinc-950 font-medium rounded-lg px-4 py-3 hover:bg-white transition-colors disabled:opacity-30"
        >
          <Flame size={14} className="inline mr-2" />
          これがわたしのパーパス
        </button>
        <button onClick={() => { setStep('answering'); setCurrentRound(0); setAnswers([]); }} className="text-xs opacity-30 hover:opacity-60 transition-opacity uppercase tracking-widest">
          ← 最初からやり直す
        </button>
      </motion.div>
    );
  }

  // ── DASHBOARD ──
  const purpose = (userData as any).purpose || draftPurpose;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

      {/* Purpose statement */}
      <div className="border border-current/20 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] tracking-[0.3em] uppercase opacity-40 flex items-center gap-1.5"><Flame size={10} />My Purpose</p>
          <button onClick={() => { setDraftPurpose(purpose); setEditingPurpose(true); }} className="opacity-30 hover:opacity-70 transition-opacity">
            <Pencil size={12} />
          </button>
        </div>
        {editingPurpose ? (
          <div className="space-y-3">
            <textarea
              value={draftPurpose}
              onChange={(e) => setDraftPurpose(e.target.value)}
              rows={4}
              maxLength={500}
              className="w-full bg-transparent border border-current/20 rounded-lg px-3 py-2 text-sm leading-relaxed focus:outline-none resize-none"
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => { onUpdateUserData({ purpose: draftPurpose.trim() } as any); setEditingPurpose(false); }} disabled={!draftPurpose.trim()} className="px-3 py-1.5 bg-zinc-100 text-zinc-950 text-xs rounded-lg font-medium disabled:opacity-30">保存</button>
              <button onClick={() => setEditingPurpose(false)} className="px-3 py-1.5 border border-current/20 text-xs rounded-lg opacity-50 hover:opacity-100">キャンセル</button>
            </div>
          </div>
        ) : (
          <p className="text-sm leading-relaxed opacity-90">{purpose}</p>
        )}
        <button onClick={() => handleStartDialogue()} className="text-[10px] opacity-30 hover:opacity-60 transition-opacity flex items-center gap-1">
          <RefreshCw size={9} /> 対話から再設定
        </button>
      </div>

      {/* Capital scores */}
      <div className="border border-current/10 rounded-xl p-5 space-y-4">
        <p className="text-[10px] tracking-[0.3em] uppercase opacity-40">現在の資本スコア</p>
        {(Object.keys(CAPITAL_LABELS) as (keyof CapitalScores)[]).map(key => (
          <div key={key} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-medium opacity-80">{CAPITAL_LABELS[key]}</span>
                <span className="text-[10px] opacity-30 ml-2">{CAPITAL_DESC[key]}</span>
              </div>
              <DotScore value={scores[key]} />
            </div>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setScores(s => ({ ...s, [key]: n }))}
                  className={`flex-1 h-7 rounded text-xs font-medium transition-all ${scores[key] === n ? 'bg-current/80 text-[#050505]' : 'bg-current/10 opacity-40 hover:opacity-70'}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        ))}
        <button
          onClick={handleSaveScores}
          className="w-full mt-2 border border-current/20 text-xs rounded-lg py-2 opacity-60 hover:opacity-100 transition-opacity"
        >
          {scoreSaved ? '✓ 保存しました' : 'スコアを保存'}
        </button>
      </div>

      {/* Gap analysis */}
      <div className="border border-current/10 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] tracking-[0.3em] uppercase opacity-40 flex items-center gap-1.5"><Sparkles size={10} />AI ギャップ分析</p>
        </div>
        {gapAnalysis ? (
          <p className="text-sm leading-relaxed opacity-75">{gapAnalysis}</p>
        ) : (
          <p className="text-xs opacity-30">パーパスと資本スコアをもとに、AIが現状とのギャップを分析します。</p>
        )}
        {error && <p className="text-red-400 text-xs bg-red-400/10 p-3 rounded-lg border border-red-400/20">{error}</p>}
        <button
          onClick={handleGapAnalysis}
          disabled={gapLoading}
          className="w-full bg-zinc-100 text-zinc-950 font-medium rounded-lg px-4 py-2.5 hover:bg-white transition-colors disabled:opacity-30 text-sm flex items-center justify-center gap-2"
        >
          {gapLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {gapAnalysis ? '分析を更新' : '分析する'}
        </button>
      </div>

    </motion.div>
  );
}
