import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, Loader2, Sparkles, Check } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';
import { generateContent } from '../gemini';
import { UserData } from '../App';

interface ReflectModalProps {
  isOpen: boolean;
  onClose: () => void;
  userData: UserData;
}

export function ReflectModal({ isOpen, onClose, userData }: ReflectModalProps) {
  const [year, setYear] = useState<string>(new Date().getFullYear().toString());
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [summary, setSummary] = useState('');
  const [error, setError] = useState('');

  const fetchCalendarEventsAndReflect = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      setError('');
      setSummary('');
      try {
        setLoadingMessage('カレンダーの予定を取得中...');
        const timeMin = new Date(`${year}-01-01T00:00:00Z`).toISOString();
        const timeMax = new Date(`${year}-12-31T23:59:59Z`).toISOString();

        const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=500`, {
          headers: {
            Authorization: `Bearer ${tokenResponse.access_token}`
          }
        });

        if (!response.ok) {
          throw new Error('カレンダーデータの取得に失敗しました');
        }

        const data = await response.json();
        const events = data.items || [];
        
        // Exclude completely private/empty title events or format them
        const eventSummaries = events.map((e: any) => {
          const start = e.start?.dateTime || e.start?.date;
          return `- ${start ? new Date(start).toLocaleDateString() : '不明な日時'}: ${e.summary || '(タイトルなし)'}`;
        });

        if (eventSummaries.length === 0) {
          setError(`${year}年の予定が見つかりませんでした。`);
          setLoading(false);
          return;
        }

        setLoadingMessage('予定を元に振り返りを生成中...');

        const currentAge = new Date().getFullYear() - new Date(userData.birthDate).getFullYear();
        const currentDecade = Math.floor(currentAge / 10) * 10;
        const decadeGoal = userData.decadeGoals?.[currentDecade] || '未設定';

        const prompt = `あなたは「Memento Mori（死を想え）」をテーマにした人生の残り時間を意識するアプリケーションのAIアシスタントです。
ユーザーのカレンダーの予定データを元に、ユーザーが設定した「座右の銘」「人生で大切なこと」「現在の年代の目標」と照らし合わせて、指定された1年間がどのような年だったか（あるいはどのような年になっているか）を振り返り、優しくも心に響くサマリーを作成してください。

【ユーザー情報】
- 名前: ${userData.name}
- 年齢: 約${currentAge}歳
- 座右の銘: ${userData.quote}
- 人生で大切なこと: ${userData.notes || '特になし'}
- ${currentDecade}代の目標: ${decadeGoal}

【${year}年のカレンダーの予定（一部抜粋）】
${eventSummaries.slice(0, 100).join('\\n')} // 長すぎる場合は一部のみ

【出力形式】
- ユーザーに直接語りかけるトーン（例：「${userData.name}さん、${year}年は...」）で書いてください。
- 予定の中で特徴的な傾向があれば触れ、それが「座右の銘」や「目標」にどう結びついているか（または離れているか）を考察してください。
- 最後に、限られた人生の時間をより良く生きるための前向きなメッセージを添えてください。
- 全体で400〜600文字程度にまとめてください。
- Markdown形式で出力し、強調したい箇所は**太字**で装飾してください。`;

        const geminiRes = await generateContent(prompt);
        if (geminiRes.error) {
          throw new Error('振り返りの生成に失敗しました: ' + geminiRes.error);
        }

        setSummary(geminiRes.text);
      } catch (err: any) {
        setError(err.message || '予期せぬエラーが発生しました');
      } finally {
        setLoading(false);
      }
    },
    onError: (errorResponse) => {
      console.error(errorResponse);
      setError('Googleアカウントの認証に失敗しました');
    },
    scope: 'https://www.googleapis.com/auth/calendar.readonly',
  });

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

          <div className="flex items-center gap-3 mb-6">
            <Calendar className="opacity-80" size={24} />
            <h2 className="text-xl font-light tracking-wide">Calendar Reflection</h2>
          </div>

          {!summary && !loading && (
            <div className="space-y-6">
              <p className="text-zinc-400 text-sm leading-relaxed">
                Googleカレンダーの予定と、あなたが設定した座右の銘・目標を掛け合わせて、AIが指定した1年間の振り返りを生成します。
              </p>

              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wider">振り返る年</label>
                <input 
                  type="number" 
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full bg-[#050505] border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 focus:outline-none focus:border-zinc-600 transition-colors font-mono text-base"
                />
              </div>

              {error && (
                <div className="text-red-400 text-sm bg-red-400/10 p-4 rounded-lg border border-red-400/20">
                  {error}
                </div>
              )}

              <button 
                onClick={() => fetchCalendarEventsAndReflect()}
                className="w-full bg-zinc-100 text-zinc-950 font-medium rounded-lg px-4 py-3 hover:bg-white transition-colors flex items-center justify-center gap-2"
              >
                <Sparkles size={18} />
                <span>Googleカレンダーから振り返りを生成する</span>
              </button>
            </div>
          )}

          {loading && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <Loader2 size={32} className="animate-spin opacity-60" />
              <p className="text-zinc-400 tracking-wide">{loadingMessage}</p>
            </div>
          )}

          {summary && !loading && (
            <div className="space-y-6 animate-in fade-in duration-700">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                <span className="font-mono text-xl tracking-widest">{year}</span>
                <span className="text-xs tracking-[0.2em] uppercase opacity-50">Reflection Summary</span>
              </div>
              <div 
                className="prose prose-invert prose-zinc max-w-none text-sm md:text-base leading-loose font-light opacity-90"
                dangerouslySetInnerHTML={{ __html: summary.replace(/\\*\\*(.*?)\\*\\*/g, '<strong class="font-medium opacity-100 text-white">$1</strong>').replace(/\\n/g, '<br/>') }}
              />
              <div className="pt-6 border-t border-zinc-800">
                <button 
                  onClick={() => setSummary('')}
                  className="text-xs text-zinc-500 uppercase tracking-widest hover:text-zinc-300 transition-colors"
                >
                  ← もう一度生成する
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
