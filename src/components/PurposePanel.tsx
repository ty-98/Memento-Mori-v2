import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Flame, Loader2, Sparkles, Pencil, RefreshCw, HelpCircle, X } from 'lucide-react';
import { UserData } from '../App';

interface CapitalScores {
  human: number;
  social: number;
  financial: number;
}

interface PurposePanelProps {
  userData: UserData;
  onUpdateUserData: (data: Partial<UserData>) => void;
  onNavigateToAdvisor?: () => void;
}

const CAPITAL_INFO: Record<keyof CapitalScores, { label: string; desc: string; scale: string[] }> = {
  human: {
    label: '人的資本',
    desc: '知識・スキル・経験の蓄積。仕事や活動で発揮できる自分自身の能力。',
    scale: [
      '1 — ほぼスキルがない・専門性なし',
      '2 — 基礎的なスキルがある程度ある',
      '3 — 特定の分野で一人前として通用する',
      '4 — 専門性が高く、市場価値が高い',
      '5 — 希少な専門性・高い影響力がある',
    ],
  },
  social: {
    label: '社会資本',
    desc: '信用・ネットワーク・人間関係。「あの人なら」と頼まれる評判や繋がり。',
    scale: [
      '1 — 人脈がほぼない・孤立気味',
      '2 — 身近なコミュニティに少し繋がりがある',
      '3 — 業界・コミュニティ内で顔が知られている',
      '4 — 広い信頼・ネットワークがある',
      '5 — 強力な評判と影響力のあるネットワーク',
    ],
  },
  financial: {
    label: '金融資本',
    desc: '現金・資産・収入の安定性。経済的な余裕と将来への備え。',
    scale: [
      '1 — 貯蓄ほぼなし・収入が不安定',
      '2 — 日々の生活は何とかなる程度',
      '3 — 生活費6ヶ月分程度の余裕がある',
      '4 — 投資・資産形成が進んでいる',
      '5 — 経済的に十分な安定・自由がある',
    ],
  },
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

export function PurposePanel({ userData, onUpdateUserData, onNavigateToAdvisor }: PurposePanelProps) {
  const purpose = userData.purpose ?? '';
  const [editingPurpose, setEditingPurpose] = useState(false);
  const [draftPurpose, setDraftPurpose] = useState(purpose);
  const [scores, setScores] = useState<CapitalScores>(
    userData.capitalScores ?? { human: 3, social: 3, financial: 3 }
  );
  const [openTooltip, setOpenTooltip] = useState<keyof CapitalScores | null>(null);
  const [gapAnalysis, setGapAnalysis] = useState('');
  const [gapLoading, setGapLoading] = useState(false);
  const [scoreSaved, setScoreSaved] = useState(false);
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

  const handleSaveScores = () => {
    onUpdateUserData({ capitalScores: scores } as any);
    setScoreSaved(true);
    setTimeout(() => setScoreSaved(false), 2000);
  };

  const handleGapAnalysis = async () => {
    setGapLoading(true);
    setError('');
    try {
      const now = new Date();
      const birth = new Date(userData.birthDate);
      const age = Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
      const remaining = userData.expectedLifespan - age;

      const prompt = `あなたはライフストラテジストです。以下の情報をもとに、パーパスと現状の資本スコアのギャップを分析し、次に取るべきアクションを簡潔に提言してください。

年齢: ${age}歳、残り推定: ${remaining}年
パーパス: 「${purpose}」
資本スコア（1〜5）:
- 人的資本（知識・スキル・経験）: ${scores.human}/5
- 社会資本（信用・ネットワーク・関係）: ${scores.social}/5
- 金融資本（現金・資産・収入安定性）: ${scores.financial}/5

【出力ルール】
- 3〜4文の分析と提言
- 残り時間を踏まえた優先度の視点を含める
- 前置き・挨拶なしで分析内容のみ返す`;

      const result = await callAI(prompt);
      setGapAnalysis(result.trim());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGapLoading(false);
    }
  };

  // パーパス未設定
  if (!purpose && !editingPurpose) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
        <div className="border border-current/15 rounded-xl p-5 space-y-3 text-center">
          <Flame size={20} className="mx-auto opacity-40" />
          <p className="text-sm opacity-50">パーパスがまだ設定されていません</p>
          <p className="text-xs opacity-30 leading-relaxed">AIアドバイザーとの対話を通じて、あなたのパーパスを言語化できます。</p>
          <button
            onClick={onNavigateToAdvisor}
            className="w-full bg-zinc-100 text-zinc-950 font-medium rounded-lg px-4 py-2.5 hover:bg-white transition-colors text-sm flex items-center justify-center gap-2"
          >
            <Sparkles size={14} />
            AIアドバイザーで設定する
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

      {/* Purpose statement */}
      <div className="border border-current/15 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] tracking-[0.3em] uppercase opacity-40 flex items-center gap-1.5">
            <Flame size={10} />My Purpose
          </p>
          <button
            onClick={() => { setDraftPurpose(purpose); setEditingPurpose(true); }}
            className="opacity-30 hover:opacity-70 transition-opacity"
          >
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
              <button
                onClick={() => { onUpdateUserData({ purpose: draftPurpose.trim() } as any); setEditingPurpose(false); }}
                disabled={!draftPurpose.trim()}
                className="px-3 py-1.5 bg-zinc-100 text-zinc-950 text-xs rounded-lg font-medium disabled:opacity-30"
              >
                保存
              </button>
              <button
                onClick={() => setEditingPurpose(false)}
                className="px-3 py-1.5 border border-current/20 text-xs rounded-lg opacity-50 hover:opacity-100"
              >
                キャンセル
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm leading-relaxed opacity-80">{purpose}</p>
        )}
        <button
          onClick={onNavigateToAdvisor}
          className="text-[10px] opacity-30 hover:opacity-60 transition-opacity flex items-center gap-1"
        >
          <RefreshCw size={9} /> AIアドバイザーで対話して更新
        </button>
      </div>

      {/* Capital scores */}
      <div className="border border-current/10 rounded-xl p-5 space-y-5">
        <p className="text-[10px] tracking-[0.3em] uppercase opacity-40">現在の資本スコア</p>

        {(Object.keys(CAPITAL_INFO) as (keyof CapitalScores)[]).map(key => {
          const info = CAPITAL_INFO[key];
          const isOpen = openTooltip === key;
          return (
            <div key={key} className="space-y-2">
              {/* Label row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium opacity-80">{info.label}</span>
                  <button
                    onClick={() => setOpenTooltip(isOpen ? null : key)}
                    className="opacity-30 hover:opacity-70 transition-opacity"
                    aria-label={`${info.label}の説明`}
                  >
                    {isOpen ? <X size={11} /> : <HelpCircle size={11} />}
                  </button>
                </div>
                <DotScore value={scores[key]} />
              </div>

              {/* Tooltip */}
              {isOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-current/5 border border-current/10 rounded-lg p-3 space-y-2"
                >
                  <p className="text-xs opacity-60 leading-relaxed">{info.desc}</p>
                  <div className="space-y-0.5">
                    {info.scale.map((s, i) => (
                      <p key={i} className={`text-[11px] leading-relaxed ${i + 1 === scores[key] ? 'opacity-90 font-medium' : 'opacity-35'}`}>
                        {s}
                      </p>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Score buttons */}
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => setScores(s => ({ ...s, [key]: n }))}
                    className={`flex-1 h-7 rounded text-xs font-medium transition-all ${
                      scores[key] === n
                        ? 'bg-current/70 text-[#050505]'
                        : 'bg-current/8 opacity-35 hover:opacity-70'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        <button
          onClick={handleSaveScores}
          className="w-full border border-current/20 text-xs rounded-lg py-2 opacity-50 hover:opacity-100 transition-opacity"
        >
          {scoreSaved ? '✓ 保存しました' : 'スコアを保存'}
        </button>
      </div>

      {/* Gap analysis */}
      <div className="border border-current/10 rounded-xl p-5 space-y-4">
        <p className="text-[10px] tracking-[0.3em] uppercase opacity-40 flex items-center gap-1.5">
          <Sparkles size={10} />AI ギャップ分析
        </p>
        {gapAnalysis ? (
          <p className="text-sm leading-relaxed opacity-70">{gapAnalysis}</p>
        ) : (
          <p className="text-xs opacity-30 leading-relaxed">
            パーパスと資本スコアをもとに、AIが現状とのギャップと次のアクションを分析します。
          </p>
        )}
        {error && (
          <p className="text-red-400 text-xs bg-red-400/10 p-3 rounded-lg border border-red-400/20">{error}</p>
        )}
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
