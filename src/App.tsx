import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Settings, LogOut, KeyRound, Copy, Check, Calendar, Share2, Sparkles } from 'lucide-react';
import { toPng } from 'html-to-image';
import { ReflectModal } from './components/ReflectModal';

export interface UserData {
  name: string;
  birthDate: string;
  expectedLifespan: number;
  quote: string;
  notes?: string;
  bgColor?: string;
  textColor?: string;
  decadeGoals?: Record<string, string>;
}

interface TimeLeft {
  years: number;
  months: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
}

const sanitizeUserData = (data: any): UserData => {
  const sanitizeString = (str: any, maxLength: number, defaultVal: string = '') => {
    if (typeof str !== 'string' && typeof str !== 'number') return defaultVal;
    return String(str).slice(0, maxLength);
  };

  const sanitizeColor = (color: any, defaultColor: string) => {
    if (typeof color !== 'string') return defaultColor;
    // Basic hex color validation or allow named colors, but restrict length to prevent huge injections
    if (color.length > 30) return defaultColor;
    // Prevent CSS injection via closing tags or quotes
    if (color.includes(';') || color.includes('"') || color.includes("'") || color.includes('}')) return defaultColor;
    return color;
  };

  const sanitizeDecadeGoals = (goals: any): Record<string, string> => {
    if (!goals || typeof goals !== 'object' || Array.isArray(goals)) return {};
    const safeGoals: Record<string, string> = {};
    for (const [key, value] of Object.entries(goals)) {
      if (typeof key === 'string' && (typeof value === 'string' || typeof value === 'number')) {
        if (!isNaN(Number(key))) {
          safeGoals[key] = String(value).slice(0, 500);
        }
      }
    }
    return safeGoals;
  };

  return {
    name: sanitizeString(data.name || data.n, 100, 'Anonymous'),
    birthDate: sanitizeString(data.birthDate || data.b, 20, '1990-01-01'),
    expectedLifespan: typeof (data.expectedLifespan || data.l) === 'number' ? (data.expectedLifespan || data.l) : 80,
    quote: sanitizeString(data.quote || data.q, 200, 'Memento Mori'),
    notes: sanitizeString(data.notes || data.m, 10000, ''),
    bgColor: sanitizeColor(data.bgColor || data.bg, '#050505'),
    textColor: sanitizeColor(data.textColor || data.tc, '#fafafa'),
    decadeGoals: sanitizeDecadeGoals(data.decadeGoals || data.dg)
  };
};

export default function App() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    const storedData = localStorage.getItem('life_countdown_data');
    if (storedData) {
      try {
        const parsed = JSON.parse(storedData);
        setUserData(sanitizeUserData(parsed));
      } catch (e) {
        console.error('Failed to parse stored data', e);
      }
    }
    setIsAuthLoading(false);
  }, []);

  const handleSave = (data: UserData) => {
    const sanitized = sanitizeUserData(data);
    setUserData(sanitized);
    setIsEditing(false);
    localStorage.setItem('life_countdown_data', JSON.stringify(sanitized));
  };

  const handleLogout = () => {
    setUserData(null);
    setIsEditing(false);
    localStorage.removeItem('life_countdown_data');
  };

  if (isAuthLoading) return <div className="min-h-screen bg-[#050505]" />;

  if (!userData && !isEditing) {
    return <WelcomeScreen onStart={() => setIsEditing(true)} onRestore={handleSave} />;
  }

  if (isEditing) {
    return <SetupForm initialData={userData} onSave={handleSave} onLogout={handleLogout} />;
  }

  const handleUpdateUserData = (newData: Partial<UserData>) => {
    if (userData) {
      const updated = { ...userData, ...newData };
      setUserData(updated);
      localStorage.setItem('life_countdown_data', JSON.stringify(updated));
    }
  };

  return <CountdownView userData={userData!} onEdit={() => setIsEditing(true)} onLogout={handleLogout} onUpdateUserData={handleUpdateUserData} />;
}

function WelcomeScreen({ onStart, onRestore }: { onStart: () => void, onRestore: (data: UserData) => void }) {
  const [isRestore, setIsRestore] = useState(false);
  const [backupCode, setBackupCode] = useState('');
  const [error, setError] = useState('');

  const handleRestore = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const payload = JSON.parse(decodeURIComponent(atob(backupCode)));
      if (payload.b && payload.l) {
        onRestore(sanitizeUserData(payload));
      } else {
        throw new Error('Invalid backup code format');
      }
    } catch (err) {
      setError('無効な復元キーです。正しいキーを入力してください。');
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-50 flex items-center justify-center p-4 font-sans selection:bg-zinc-800">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-[#0a0a0a] p-8 rounded-2xl shadow-2xl border border-zinc-800/50"
      >
        <h1 className="text-2xl font-light mb-2 tracking-tight">Memento Mori</h1>
        <p className="text-zinc-500 mb-8 text-sm">
          {isRestore ? '復元キーを入力してデータを復元します。' : 'あなたの人生の残り時間を計算します。'}
        </p>

        {isRestore ? (
          <form onSubmit={handleRestore} className="space-y-6">
            {error && <div className="text-red-500 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">{error}</div>}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wider">復元キー</label>
              <textarea
                required
                value={backupCode}
                onChange={(e) => setBackupCode(e.target.value)}
                placeholder="eyJuIjoi..."
                className="w-full bg-[#050505] border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 focus:outline-none focus:border-zinc-600 transition-colors font-mono text-base md:text-sm h-32 resize-none"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-zinc-100 text-zinc-950 font-medium rounded-lg px-4 py-3 hover:bg-white transition-colors mt-4"
            >
              復元する
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <button
              onClick={onStart}
              className="w-full bg-zinc-100 text-zinc-950 font-medium rounded-lg px-4 py-3 hover:bg-white transition-colors"
            >
              新しく始める
            </button>
            <button
              onClick={() => setIsRestore(true)}
              className="w-full bg-[#050505] text-zinc-300 font-medium rounded-lg px-4 py-3 border border-zinc-800 hover:bg-zinc-900 transition-colors"
            >
              復元キーからデータを引き継ぐ
            </button>
          </div>
        )}

        {isRestore && (
          <div className="mt-6 text-center">
            <button
              onClick={() => { setIsRestore(false); setError(''); }}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              戻る
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function SetupForm({ initialData, onSave, onLogout }: { initialData: UserData | null, onSave: (data: UserData) => void, onLogout: () => void }) {
  const [name, setName] = useState(initialData?.name || '');
  const [quote, setQuote] = useState(initialData?.quote || 'Memento Mori');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [bgColor, setBgColor] = useState(initialData?.bgColor || '#050505');
  const [textColor, setTextColor] = useState(initialData?.textColor || '#fafafa');
  const [decadeGoals, setDecadeGoals] = useState<Record<string, string>>(initialData?.decadeGoals || {});
  const defaultDate = initialData?.birthDate ? new Date(initialData.birthDate) : new Date('1990-01-01');
  const [year, setYear] = useState(defaultDate.getFullYear().toString());
  const [month, setMonth] = useState((defaultDate.getMonth() + 1).toString());
  const [day, setDay] = useState(defaultDate.getDate().toString());
  const [expectedLifespan, setExpectedLifespan] = useState(initialData?.expectedLifespan?.toString() || '80');
  const [showBackup, setShowBackup] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const birthDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    onSave({ name: name || 'Anonymous', birthDate, expectedLifespan: parseInt(expectedLifespan, 10), quote: quote || 'Memento Mori', notes, bgColor, textColor, decadeGoals });
  };

  const generateBackupCode = () => {
    const birthDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    const payload = { n: name, b: birthDate, l: parseInt(expectedLifespan, 10), q: quote, m: notes, bg: bgColor, tc: textColor, dg: decadeGoals };
    return btoa(encodeURIComponent(JSON.stringify(payload)));
  };

  const handleCopyBackup = () => {
    navigator.clipboard.writeText(generateBackupCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-50 flex items-center justify-center p-4 sm:p-6 font-sans overflow-x-hidden selection:bg-zinc-800">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-[#0a0a0a] p-6 sm:p-8 rounded-2xl shadow-2xl border border-zinc-800/50"
      >
        <h1 className="text-2xl font-light mb-2 tracking-tight">Memento Mori</h1>
        <div className="flex justify-between items-start mb-8">
          <p className="text-zinc-500 text-sm">あなたの人生の残り時間を計算します。</p>
          <div className="flex gap-2">
            <button onClick={() => setShowBackup(!showBackup)} className="text-zinc-600 hover:text-zinc-300 transition-colors" title="復元キーを発行">
              <KeyRound size={16} />
            </button>
            <button onClick={onLogout} className="text-zinc-600 hover:text-zinc-300 transition-colors" title="リセット">
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {showBackup && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-8 p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg"
          >
            <p className="text-xs text-zinc-400 mb-2">この復元キーを保存しておくと、別の端末やブラウザでもデータを引き継げます。</p>
            <div className="flex gap-2">
              <textarea
                readOnly
                value={generateBackupCode()}
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                className="flex-1 bg-[#050505] border border-zinc-800 rounded px-3 py-2 text-zinc-300 font-mono text-xs focus:outline-none h-20 resize-none break-all"
              />
              <button
                type="button"
                onClick={handleCopyBackup}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-2 rounded transition-colors flex items-center justify-center"
              >
                {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
              </button>
            </div>
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wider">名前</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your Name"
              className="w-full bg-[#050505] border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 focus:outline-none focus:border-zinc-600 transition-colors font-sans text-base md:text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wider">生年月日</label>
            <div className="flex gap-3">
              <div className="flex-[2]">
                <input
                  type="number"
                  required
                  min="1900"
                  max={new Date().getFullYear()}
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="YYYY"
                  className="w-full bg-[#050505] border border-zinc-800 rounded-lg px-2 sm:px-4 py-3 text-zinc-100 focus:outline-none focus:border-zinc-600 transition-colors font-mono text-base md:text-sm text-center"
                />
              </div>
              <div className="flex-1">
                <input
                  type="number"
                  required
                  min="1"
                  max="12"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  placeholder="MM"
                  className="w-full bg-[#050505] border border-zinc-800 rounded-lg px-2 sm:px-4 py-3 text-zinc-100 focus:outline-none focus:border-zinc-600 transition-colors font-mono text-base md:text-sm text-center"
                />
              </div>
              <div className="flex-1">
                <input
                  type="number"
                  required
                  min="1"
                  max="31"
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                  placeholder="DD"
                  className="w-full bg-[#050505] border border-zinc-800 rounded-lg px-2 sm:px-4 py-3 text-zinc-100 focus:outline-none focus:border-zinc-600 transition-colors font-mono text-base md:text-sm text-center"
                />
              </div>
              <div className="relative flex items-center justify-center w-12 bg-[#050505] border border-zinc-800 rounded-lg overflow-hidden hover:bg-zinc-900 transition-colors">
                <Calendar size={18} className="text-zinc-400 absolute pointer-events-none" />
                <input
                  type="date"
                  value={year.length === 4 && month && day ? `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}` : ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      const [y, m, d] = e.target.value.split('-');
                      setYear(y);
                      setMonth(parseInt(m, 10).toString());
                      setDay(parseInt(d, 10).toString());
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wider">想定寿命（年齢）</label>
            <input
              type="number"
              required
              min="1"
              max="150"
              value={expectedLifespan}
              onChange={(e) => setExpectedLifespan(e.target.value)}
              className="w-full bg-[#050505] border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 focus:outline-none focus:border-zinc-600 transition-colors font-mono text-base md:text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wider">座右の銘・目標</label>
            <input
              type="text"
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              placeholder="Memento Mori"
              className="w-full bg-[#050505] border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 focus:outline-none focus:border-zinc-600 transition-colors font-sans text-base md:text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wider">人生で大切なこと（メモ）</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="家族との時間、健康、挑戦し続けること..."
              className="w-full bg-[#050505] border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 focus:outline-none focus:border-zinc-600 transition-colors font-sans text-base md:text-sm h-24 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wider">背景色</label>
            <div className="flex items-center gap-4 bg-[#050505] border border-zinc-800 rounded-lg px-4 py-3">
              <input
                type="color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
              />
              <span className="text-zinc-300 font-mono text-sm uppercase">{bgColor}</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wider">テキスト色</label>
            <div className="flex items-center gap-4 bg-[#050505] border border-zinc-800 rounded-lg px-4 py-3">
              <input
                type="color"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
              />
              <span className="text-zinc-300 font-mono text-sm uppercase">{textColor}</span>
            </div>
          </div>

          <div className="pt-6 border-t border-zinc-900/50 space-y-4">
            <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider">年代別の目標・スローガン</label>
            {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].filter(d => d <= parseInt(expectedLifespan || '80')).map(decade => (
              <div key={decade} className="flex items-center gap-2 sm:gap-3">
                <span className="text-zinc-500 font-mono text-xs w-8">{decade}s</span>
                <input
                  type="text"
                  value={decadeGoals[decade] || ''}
                  onChange={(e) => setDecadeGoals({ ...decadeGoals, [decade]: e.target.value })}
                  placeholder={`${decade}代の目標...`}
                  className="flex-1 bg-[#050505] border border-zinc-800 rounded-lg px-2 py-1 text-zinc-100 focus:outline-none focus:border-zinc-600 transition-colors font-sans text-sm sm:text-base"
                />
              </div>
            ))}
          </div>

          <button
            type="submit"
            className="w-full bg-zinc-100 text-zinc-950 font-medium rounded-lg px-4 py-3 hover:bg-white transition-colors mt-4"
          >
            刻む
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function CountdownView({ userData, onEdit, onLogout, onUpdateUserData }: { userData: UserData, onEdit: () => void, onLogout: () => void, onUpdateUserData: (data: Partial<UserData>) => void }) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ years: 0, months: 0, days: 0, hours: 0, minutes: 0, seconds: 0, milliseconds: 0 });
  const [progress, setProgress] = useState({ elapsed: 0, remaining: 100 });
  const [deathDate, setDeathDate] = useState<string>('');
  const [isSharing, setIsSharing] = useState(false);
  const [isReflectModalOpen, setIsReflectModalOpen] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);

  const handleShare = async () => {
    if (!shareRef.current) return;
    try {
      setIsSharing(true);
      // Wait for state to update so buttons are hidden
      await new Promise(resolve => setTimeout(resolve, 100));

      const dataUrl = await toPng(shareRef.current, {
        quality: 1.0,
        pixelRatio: 2,
        style: {
          backgroundColor: userData.bgColor || '#050505',
        }
      });

      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'memento-mori.png', { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Memento Mori',
          text: `My remaining time... ${userData.quote}`,
          files: [file]
        });
      } else {
        const link = document.createElement('a');
        link.download = 'memento-mori.png';
        link.href = dataUrl;
        link.click();
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message?.includes('Share canceled')) {
        // User canceled the share, ignore
        return;
      }
      console.error('Failed to share image', err);
      alert('画像の生成に失敗しました。');
    } finally {
      setIsSharing(false);
    }
  };

  const pad = (num: number, size: number = 2) => num.toString().padStart(size, '0');

  useEffect(() => {
    const birth = new Date(userData.birthDate);
    const end = new Date(birth);
    end.setFullYear(end.getFullYear() + userData.expectedLifespan);
    const totalMs = end.getTime() - birth.getTime();

    const formattedDeathDate = `${end.getFullYear()}.${pad(end.getMonth() + 1)}.${pad(end.getDate())}`;
    setDeathDate(formattedDeathDate);

    let animationFrameId: number;

    const update = () => {
      const now = new Date();

      if (now >= end) {
        setTimeLeft({ years: 0, months: 0, days: 0, hours: 0, minutes: 0, seconds: 0, milliseconds: 0 });
        setProgress({ elapsed: 100, remaining: 0 });
        return;
      }

      const elapsedMs = now.getTime() - birth.getTime();
      const elapsedPercent = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));

      setProgress({
        elapsed: elapsedPercent,
        remaining: 100 - elapsedPercent
      });

      let tempDate = new Date(now);

      let years = end.getFullYear() - tempDate.getFullYear();
      tempDate.setFullYear(tempDate.getFullYear() + years);
      if (tempDate > end) {
        years--;
        tempDate = new Date(now);
        tempDate.setFullYear(tempDate.getFullYear() + years);
      }

      let months = 0;
      while (true) {
        let nextMonth = new Date(tempDate);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        if (nextMonth > end) break;
        months++;
        tempDate = nextMonth;
      }

      let diffMs = end.getTime() - tempDate.getTime();

      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      diffMs -= days * (1000 * 60 * 60 * 24);

      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      diffMs -= hours * (1000 * 60 * 60);

      const minutes = Math.floor(diffMs / (1000 * 60));
      diffMs -= minutes * (1000 * 60);

      const seconds = Math.floor(diffMs / 1000);
      const milliseconds = diffMs - seconds * 1000;

      setTimeLeft({ years, months, days, hours, minutes, seconds, milliseconds });

      animationFrameId = requestAnimationFrame(update);
    };

    animationFrameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrameId);
  }, [userData]);

  return (
    <div
      ref={shareRef}
      className="min-h-screen flex flex-col items-center p-4 sm:p-6 font-sans relative overflow-x-hidden selection:bg-zinc-800 transition-colors duration-500"
      style={{ backgroundColor: userData.bgColor || '#050505', color: userData.textColor || '#fafafa' }}
    >
      <div className="absolute top-4 left-4 md:top-8 md:left-8 z-10 max-w-[60%] sm:max-w-none">
        <div className="font-medium text-base md:text-xl tracking-wide mb-1 opacity-90 truncate">
          {userData.name}
        </div>
        <div className="text-[9px] md:text-xs font-mono tracking-widest uppercase opacity-60">
          BORN: <span className="opacity-80">{userData.birthDate.replace(/-/g, '.')}</span>
        </div>
        <div className="text-[9px] md:text-xs font-mono tracking-widest uppercase mt-0.5 opacity-60">
          LIFESPAN: <span className="opacity-80">{userData.expectedLifespan} YEARS</span>
        </div>
      </div>

      {!isSharing && (
        <div className="absolute top-4 right-4 md:top-8 md:right-8 flex gap-1 md:gap-2 z-10 bg-[#050505]/50 backdrop-blur-sm rounded-full sm:bg-transparent sm:backdrop-blur-none p-1 sm:p-0">
          <button
            onClick={() => setIsReflectModalOpen(true)}
            className="p-2 md:p-3 opacity-60 hover:opacity-100 transition-opacity rounded-full hover:bg-black/10"
            title="カレンダー振り返り"
          >
            <Calendar size={18} className="md:w-5 md:h-5" />
          </button>
          <button
            onClick={handleShare}
            disabled={isSharing}
            className="p-2 md:p-3 opacity-60 hover:opacity-100 transition-opacity rounded-full hover:bg-black/10"
            title="シェア"
          >
            <Share2 size={18} className="md:w-5 md:h-5" />
          </button>
          <button
            onClick={onEdit}
            className="p-2 md:p-3 opacity-60 hover:opacity-100 transition-opacity rounded-full hover:bg-black/10"
            title="設定"
          >
            <Settings size={18} className="md:w-5 md:h-5" />
          </button>
          <button
            onClick={onLogout}
            className="p-2 md:p-3 opacity-60 hover:opacity-100 transition-opacity rounded-full hover:bg-black/10"
            title="ログアウト"
          >
            <LogOut size={18} className="md:w-5 md:h-5" />
          </button>
        </div>
      )}

      <div className="flex-1 w-full flex flex-col items-center justify-center mt-32 md:mt-0">
        <motion.div
          initial={{ opacity: 0, filter: 'blur(10px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="w-full max-w-5xl flex flex-col items-center"
        >
          <div className="text-center mb-16 md:mb-20 w-full px-2">
            <InlineEdit
              value={userData.quote}
              onSave={(val) => onUpdateUserData({ quote: val })}
              className="text-sm md:text-xl tracking-[0.15em] md:tracking-[0.2em] font-light mb-8 md:mb-12 max-w-[90%] md:max-w-2xl mx-auto leading-relaxed opacity-90 block"
              placeholder="Double tap to set your quote..."
            />

            <div className="flex flex-wrap justify-center items-baseline gap-x-3 sm:gap-x-6 md:gap-x-8 gap-y-6 md:gap-y-8">
              <TimeBlock value={timeLeft.years} label="YEARS" />
              <TimeBlock value={pad(timeLeft.months)} label="MONTHS" />
              <TimeBlock value={pad(timeLeft.days)} label="DAYS" />
              <TimeBlock value={pad(timeLeft.hours)} label="HOURS" />
              <TimeBlock value={pad(timeLeft.minutes)} label="MINS" />
              <TimeBlock value={pad(timeLeft.seconds)} label="SECS" />
              <TimeBlock value={pad(Math.floor(timeLeft.milliseconds / 10))} label="MS" />
            </div>
          </div>

          <div className="w-full max-w-3xl space-y-6">
            <div className="flex justify-between items-end">
              <div className="text-[10px] md:text-xs font-mono tracking-widest uppercase flex flex-col gap-1 opacity-60">
                <span>Elapsed {progress.elapsed.toFixed(6)}%</span>
                <span className="opacity-90">Remaining {progress.remaining.toFixed(6)}%</span>
              </div>
              <div className="text-right">
                <span className="text-[9px] md:text-[10px] tracking-[0.2em] uppercase block mb-1 opacity-60">Expected End Date</span>
                <span className="font-mono text-sm md:text-base tracking-widest opacity-80">{deathDate}</span>
              </div>
            </div>

            <div className="relative w-full h-8 mb-1">
              <motion.div
                className="absolute bottom-0 opacity-90"
                style={{ left: `${progress.elapsed}%`, x: '-50%' }}
              >
                <WalkingIcon />
              </motion.div>
            </div>
            <div className="h-[2px] w-full flex rounded-full">
              <div
                className="h-full"
                style={{ width: `${progress.elapsed}%`, backgroundColor: 'currentColor', opacity: 0.15 }}
              />
              <div
                className="h-full relative"
                style={{
                  width: `${progress.remaining}%`,
                  backgroundColor: 'currentColor',
                  opacity: 0.9,
                  boxShadow: '0 0 10px currentColor'
                }}
              />
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 1 }}
        className="w-full max-w-3xl mt-12 pb-8"
      >
        <div className="w-12 h-[1px] mx-auto mb-8 opacity-20" style={{ backgroundColor: 'currentColor' }} />
        <h3 className="text-[10px] tracking-[0.3em] uppercase mb-6 text-center font-medium opacity-60">Important Things</h3>
        <div className="text-sm md:text-base leading-loose whitespace-pre-wrap text-center max-w-2xl mx-auto font-light opacity-80">
          <InlineEdit
            value={userData.notes || ''}
            onSave={(val) => onUpdateUserData({ notes: val })}
            multiline
            className="w-full text-center"
            placeholder="Double tap to add important notes..."
          />
        </div>
      </motion.div>

      <DecadesList
        birthDate={userData.birthDate}
        expectedLifespan={userData.expectedLifespan}
        decadeGoals={userData.decadeGoals}
        textColor={userData.textColor}
        onUpdateGoal={(decade, goal) => {
          onUpdateUserData({
            decadeGoals: { ...(userData.decadeGoals || {}), [decade]: goal }
          });
        }}
      />

      <ReflectModal
        isOpen={isReflectModalOpen}
        onClose={() => setIsReflectModalOpen(false)}
        userData={userData}
      />
    </div>
  );
}

function DecadesList({ birthDate, expectedLifespan, decadeGoals, textColor, onUpdateGoal }: { birthDate: string, expectedLifespan: number, decadeGoals?: Record<string, string>, textColor?: string, onUpdateGoal: (decade: number, goal: string) => void }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const birth = new Date(birthDate);
  const decades = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].filter(d => d <= expectedLifespan);

  const formatTimeDiff = (start: Date, end: Date) => {
    let years = end.getFullYear() - start.getFullYear();
    let tempDate = new Date(start);
    tempDate.setFullYear(tempDate.getFullYear() + years);
    if (tempDate > end) {
      years--;
      tempDate = new Date(start);
      tempDate.setFullYear(tempDate.getFullYear() + years);
    }
    let months = 0;
    while (true) {
      let nextMonth = new Date(tempDate);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      if (nextMonth > end) break;
      months++;
      tempDate = nextMonth;
    }
    let diffMs = end.getTime() - tempDate.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    const parts = [];
    if (years > 0) parts.push(`${years}y`);
    if (months > 0) parts.push(`${months}m`);
    parts.push(`${days}d`);
    return parts.join(' ');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7, duration: 1 }}
      className="w-full max-w-3xl mt-4 pb-12"
    >
      <div className="w-12 h-[1px] mx-auto mb-8 opacity-20" style={{ backgroundColor: 'currentColor' }} />
      <h3 className="text-[10px] tracking-[0.3em] uppercase mb-8 text-center font-medium opacity-60">Decades Timeline</h3>
      <div className="grid gap-4">
        {decades.map(decade => {
          const start = new Date(birth);
          start.setFullYear(start.getFullYear() + decade);
          const end = new Date(birth);
          end.setFullYear(end.getFullYear() + decade + 10);

          const isPast = now >= end;
          const isCurrent = now >= start && now < end;

          let timeText = '';
          let label = '';
          if (isPast) {
            timeText = 'Completed';
            label = 'Passed';
          } else if (isCurrent) {
            timeText = formatTimeDiff(now, end);
            label = 'Remaining in ' + decade + 's';
          } else {
            timeText = formatTimeDiff(now, start);
            label = 'Until ' + decade + 's';
          }

          const goal = decadeGoals?.[decade] || '';

          return (
            <div key={decade} className={`p-5 rounded-xl border flex flex-col md:flex-row gap-4 justify-between items-start md:items-center transition-all ${isPast ? 'opacity-30 border-transparent bg-black/10' : (isCurrent ? 'border-current bg-black/20' : 'opacity-60 border-transparent bg-black/10')}`} style={isCurrent ? { borderColor: textColor, boxShadow: `0 0 20px ${textColor}15` } : {}}>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-mono text-2xl font-light" style={{ color: isCurrent ? textColor : undefined }}>{decade}s</span>
                  {isCurrent && <span className="text-[9px] px-2 py-0.5 rounded-full border tracking-widest uppercase" style={{ borderColor: textColor, color: textColor }}>Current</span>}
                </div>
                <div className="text-sm font-light opacity-90 leading-relaxed text-left">
                  <InlineEdit
                    value={goal}
                    onSave={(val) => onUpdateGoal(decade, val)}
                    className="w-full text-left"
                    placeholder="Double tap to set goal..."
                  />
                </div>
              </div>
              <div className="text-left md:text-right mt-2 md:mt-0">
                <div className="text-[9px] tracking-[0.2em] uppercase opacity-50 mb-1">{label}</div>
                <div className="font-mono text-sm tracking-wider opacity-90">{timeText}</div>
              </div>
            </div>
          )
        })}
      </div>
    </motion.div>
  );
}

function TimeBlock({ value, label }: { value: string | number, label: string }) {
  return (
    <div className="flex flex-col items-center min-w-[3rem] sm:min-w-0">
      <span className="font-mono font-light tracking-tighter tabular-nums text-4xl sm:text-5xl md:text-7xl">
        {value}
      </span>
      <span className="text-[8px] sm:text-[9px] md:text-[11px] tracking-[0.2em] md:tracking-[0.3em] mt-1 md:mt-3 opacity-60">
        {label}
      </span>
    </div>
  );
}

function InlineEdit({
  value,
  onSave,
  multiline = false,
  className = "",
  placeholder = "Double tap to edit..."
}: {
  value: string,
  onSave: (val: string) => void,
  multiline?: boolean,
  className?: string,
  placeholder?: string
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      const length = inputRef.current.value.length;
      inputRef.current.setSelectionRange(length, length);
    }
  }, [isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    if (tempValue !== value) {
      onSave(tempValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) {
      handleBlur();
    }
    if (e.key === 'Escape') {
      setIsEditing(false);
      setTempValue(value);
    }
  };

  if (isEditing) {
    if (multiline) {
      return (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={`bg-transparent border-b border-zinc-500/50 focus:border-zinc-300 outline-none resize-none w-full ${className}`}
          rows={Math.max(3, tempValue.split('\n').length)}
          placeholder={placeholder}
        />
      );
    }
    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type="text"
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={`bg-transparent border-b border-zinc-500/50 focus:border-zinc-300 outline-none w-full ${className}`}
        placeholder={placeholder}
      />
    );
  }

  return (
    <div
      onDoubleClick={() => {
        setTempValue(value);
        setIsEditing(true);
      }}
      className={`cursor-pointer hover:opacity-80 transition-opacity ${className} ${!value ? 'opacity-40 italic' : ''}`}
      title="Double tap to edit"
    >
      {value || placeholder}
    </div>
  );
}

function WalkingIcon() {
  return (
    <div className="relative w-6 h-6 text-zinc-400 transform rotate-6">
      <style>{`
        @keyframes walk-frame {
          0%, 24.9% { opacity: 1; }
          25%, 100% { opacity: 0; }
        }
        .frame-1 { animation: walk-frame 1s infinite; animation-delay: 0s; }
        .frame-2 { animation: walk-frame 1s infinite; animation-delay: 0.25s; }
        .frame-3 { animation: walk-frame 1s infinite; animation-delay: 0.5s; }
        .frame-4 { animation: walk-frame 1s infinite; animation-delay: 0.75s; }
      `}</style>

      {/* Frame 1: Right foot forward */}
      <svg className="absolute inset-0 frame-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="4" r="2" />
        <path d="M12 6v6" />
        <path d="M12 8l-3 3" /> {/* Right arm back */}
        <path d="M12 8l3 3" />  {/* Left arm forward */}
        <path d="M12 12l3 4l1 4" /> {/* Right leg forward */}
        <path d="M12 12l-3 4l-1 4" /> {/* Left leg back */}
      </svg>

      {/* Frame 2: Midpoint (body slightly up) */}
      <svg className="absolute inset-0 frame-2 opacity-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="3" r="2" />
        <path d="M12 5v6" />
        <path d="M12 7l-1 4" /> {/* Right arm down */}
        <path d="M12 7l1 4" />  {/* Left arm down */}
        <path d="M12 11l1 5l-1 4" /> {/* Right leg bent */}
        <path d="M12 11l-1 5l1 4" /> {/* Left leg straight */}
      </svg>

      {/* Frame 3: Left foot forward */}
      <svg className="absolute inset-0 frame-3 opacity-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="4" r="2" />
        <path d="M12 6v6" />
        <path d="M12 8l3 3" />  {/* Right arm forward */}
        <path d="M12 8l-3 3" /> {/* Left arm back */}
        <path d="M12 12l-3 4l-1 4" /> {/* Right leg back */}
        <path d="M12 12l3 4l1 4" /> {/* Left leg forward */}
      </svg>

      {/* Frame 4: Midpoint (body slightly up) */}
      <svg className="absolute inset-0 frame-4 opacity-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="3" r="2" />
        <path d="M12 5v6" />
        <path d="M12 7l1 4" /> {/* Right arm down */}
        <path d="M12 7l-1 4" />  {/* Left arm down */}
        <path d="M12 11l-1 5l1 4" /> {/* Right leg straight */}
        <path d="M12 11l1 5l-1 4" /> {/* Left leg bent */}
      </svg>
    </div>
  );
}
