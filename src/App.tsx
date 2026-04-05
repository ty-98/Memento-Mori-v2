import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Settings, LogOut, KeyRound, Copy, Check, Calendar, Share2, X, ListChecks, Compass, Home, Heart, NotebookPen } from 'lucide-react';
import { ReflectModal } from './components/ReflectModal';
import { BucketListPanel } from './components/BucketListPanel';
import { AdvisorPanel } from './components/AdvisorPanel';
import { StoicQuotes } from './components/StoicQuotes';
import { TimeAllocation } from './components/TimeAllocation';
import { MemoSheet, Memo } from './components/MemoSheet';

export interface BucketItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

export interface UserData {
  id?: string;
  username?: string;
  name: string;
  birthDate: string;
  expectedLifespan: number;
  quote: string;
  notes?: string;
  bgColor?: string;
  textColor?: string;
  decadeGoals?: Record<string, string>;
  avatar?: string | null;
  bucketList?: BucketItem[];
  memos?: Memo[];
  favorites?: string[];
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

  const sanitizeBucketList = (items: any): BucketItem[] => {
    if (!Array.isArray(items)) return [];
    return items
      .filter((item: any) => item && typeof item === 'object')
      .slice(0, 200)
      .map((item: any) => ({
        id: typeof item.id === 'string' ? item.id.slice(0, 36) : crypto.randomUUID(),
        text: typeof item.text === 'string' ? item.text.slice(0, 200) : '',
        completed: typeof item.completed === 'boolean' ? item.completed : false,
        createdAt: typeof item.createdAt === 'string' ? item.createdAt.slice(0, 30) : new Date().toISOString(),
      }))
      .filter((item: any) => item.text.length > 0);
  };

  const sanitizeMemos = (items: any): Memo[] => {
    if (!Array.isArray(items)) return [];
    return items
      .filter((item: any) => item && typeof item === 'object')
      .slice(0, 500)
      .map((item: any) => ({
        id: typeof item.id === 'string' ? item.id.slice(0, 36) : crypto.randomUUID(),
        text: typeof item.text === 'string' ? item.text.slice(0, 1000) : '',
        createdAt: typeof item.createdAt === 'string' ? item.createdAt.slice(0, 30) : new Date().toISOString(),
      }))
      .filter((item: any) => item.text.length > 0);
  };

  return {
    id: data.id,
    username: data.username,
    name: sanitizeString(data.name || data.n, 100, 'Anonymous'),
    birthDate: sanitizeString(data.birthDate || data.b, 20, '1990-01-01'),
    expectedLifespan: typeof (data.expectedLifespan || data.l) === 'number' ? (data.expectedLifespan || data.l) : 80,
    quote: sanitizeString(data.quote || data.q, 200, 'Memento Mori'),
    notes: sanitizeString(data.notes || data.m, 10000, ''),
    bgColor: sanitizeColor(data.bgColor || data.bg, '#050505'),
    textColor: sanitizeColor(data.textColor || data.tc, '#fafafa'),
    decadeGoals: sanitizeDecadeGoals(data.decadeGoals || data.dg),
    avatar: typeof data.avatar === 'string' ? data.avatar : null,
    bucketList: sanitizeBucketList(data.bucketList),
    memos: sanitizeMemos(data.memos),
    favorites: Array.isArray(data.favorites)
      ? data.favorites.filter((t: any) => typeof t === 'string' && t.length > 0).slice(0, 100).map((t: string) => t.slice(0, 50))
      : [],
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

  const handleSave = async (data: UserData, credentials?: { username?: string; password?: string }) => {
    if (credentials?.username && credentials?.password) {
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, username: credentials.username, password: credentials.password })
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Registration failed');
        }
        const savedData = await res.json();
        const sanitized = sanitizeUserData(savedData);
        setUserData(sanitized);
        setIsEditing(false);
        localStorage.setItem('life_countdown_data', JSON.stringify(sanitized));
      } catch (e: any) {
        alert(e.message);
      }
    } else {
      const sanitized = sanitizeUserData(data);
      setUserData(sanitized);
      setIsEditing(false);
      localStorage.setItem('life_countdown_data', JSON.stringify(sanitized));
      
      if (sanitized.id) {
        fetch(`/api/user/${sanitized.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sanitized)
        }).catch(err => console.error('Failed to sync update', err));
      }
    }
  };

  const handleLogout = () => {
    setUserData(null);
    setIsEditing(false);
    localStorage.removeItem('life_countdown_data');
  };

  if (isAuthLoading) return <div className="min-h-screen bg-[#050505]" />;

  if (!userData && !isEditing) {
    return <WelcomeScreen onStart={() => setIsEditing(true)} onLogin={handleSave} />;
  }

  const handleDeleteAccount = async () => {
    if (userData?.id) {
      if (!window.confirm('本当にアカウントを削除しますか？この操作は取り消せません。')) return;
      try {
        await fetch(`/api/user/${userData.id}`, { method: 'DELETE' });
        handleLogout();
      } catch (err) {
        alert('削除に失敗しました。');
      }
    }
  };

  const handleUpdateCredentials = async (credentials: any) => {
    if (userData?.id) {
      try {
        const res = await fetch(`/api/auth/${userData.id}/credentials`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(credentials)
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Update failed');
        }
        const data = await res.json();
        // Update local username if changed
        if (data.username && userData.username !== data.username) {
          const updated = { ...userData, username: data.username };
          setUserData(updated);
          localStorage.setItem('life_countdown_data', JSON.stringify(updated));
        }
        alert('認証情報を更新しました。');
      } catch (e: any) {
        alert(e.message);
      }
    }
  };

  if (isEditing) {
    return <SetupForm initialData={userData} onSave={handleSave} onLogout={handleLogout} onDeleteAccount={handleDeleteAccount} onUpdateCredentials={handleUpdateCredentials} onCancel={() => setIsEditing(false)} />;
  }

  const handleUpdateUserData = (newData: Partial<UserData>) => {
    if (userData) {
      const updated = { ...userData, ...newData };
      setUserData(updated);
      localStorage.setItem('life_countdown_data', JSON.stringify(updated));
      
      if (updated.id) {
        fetch(`/api/user/${updated.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated)
        }).catch(err => console.error('Failed to sync update', err));
      }
    }
  };

  return <CountdownView userData={userData!} onEdit={() => setIsEditing(true)} onLogout={handleLogout} onUpdateUserData={handleUpdateUserData} />;
}

function WelcomeScreen({ onStart, onLogin }: { onStart: () => void, onLogin: (data: UserData) => void }) {
  const [isLogin, setIsLogin] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (!res.ok) {
        throw new Error('ログインに失敗しました。ユーザーIDとパスワードを確認してください。');
      }
      const data = await res.json();
      onLogin(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
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
          {isLogin ? 'ユーザーIDとパスワードを入力してログインします。' : 'あなたの人生の残り時間を計算します。'}
        </p>

        {isLogin ? (
          <form onSubmit={handleLoginSubmit} className="space-y-6">
            {error && <div className="text-red-500 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">{error}</div>}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wider">ユーザーID</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="User ID"
                className="w-full bg-[#050505] border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 focus:outline-none focus:border-zinc-600 transition-colors font-sans text-base md:text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wider">パスワード</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full bg-[#050505] border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 focus:outline-none focus:border-zinc-600 transition-colors font-sans text-base md:text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-zinc-100 text-zinc-950 font-medium rounded-lg px-4 py-3 hover:bg-white transition-colors mt-4 disabled:opacity-50"
            >
              ログイン
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
              onClick={() => setIsLogin(true)}
              className="w-full bg-[#050505] text-zinc-300 font-medium rounded-lg px-4 py-3 border border-zinc-800 hover:bg-zinc-900 transition-colors"
            >
              ログインしてデータを引き継ぐ
            </button>
          </div>
        )}

        {isLogin && (
          <div className="mt-6 text-center">
            <button
              onClick={() => { setIsLogin(false); setError(''); }}
              type="button"
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

function SetupForm({ initialData, onSave, onLogout, onDeleteAccount, onUpdateCredentials, onCancel }: { initialData: UserData | null, onSave: (data: UserData, credentials?: { username?: string; password?: string }) => void, onLogout: () => void, onDeleteAccount?: () => void, onUpdateCredentials?: (creds: any) => void, onCancel?: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(initialData?.name || '');
  const [quote, setQuote] = useState(initialData?.quote || 'Memento Mori');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [bgColor, setBgColor] = useState(initialData?.bgColor || '#050505');
  const [textColor, setTextColor] = useState(initialData?.textColor || '#fafafa');
  const [decadeGoals, setDecadeGoals] = useState<Record<string, string>>(initialData?.decadeGoals || {});
  const [avatar, setAvatar] = useState<string | null>(initialData?.avatar || null);
  const defaultDate = initialData?.birthDate ? new Date(initialData.birthDate) : new Date('1990-01-01');
  const [year, setYear] = useState(defaultDate.getFullYear().toString());
  const [month, setMonth] = useState((defaultDate.getMonth() + 1).toString());
  const [day, setDay] = useState(defaultDate.getDate().toString());
  const [expectedLifespan, setExpectedLifespan] = useState(initialData?.expectedLifespan?.toString() || '80');

  const [showSecurity, setShowSecurity] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const isNew = !initialData;

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('画像サイズは5MB以下にしてください。');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 256;
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          setAvatar(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const birthDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    onSave({ id: initialData?.id, username: initialData?.username, name: name || 'Anonymous', birthDate, expectedLifespan: parseInt(expectedLifespan, 10), quote: quote || 'Memento Mori', notes, bgColor, textColor, decadeGoals, avatar }, isNew ? { username, password } : undefined);
  };

  const handleUpdateCreds = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateCredentials) {
      onUpdateCredentials({ currentPassword, newUsername, newPassword });
    }
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
            {!isNew && onCancel && (
              <button onClick={onCancel} type="button" className="text-zinc-600 hover:text-zinc-300 transition-colors mr-2" title="キャンセル">
                <X size={16} />
              </button>
            )}
            <button onClick={onLogout} type="button" className="text-zinc-600 hover:text-zinc-300 transition-colors" title="リセット">
              <LogOut size={16} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-col items-center mb-6">
            <label className="relative cursor-pointer group">
              <div className="w-24 h-24 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center overflow-hidden hover:border-zinc-500 transition-colors">
                {avatar ? (
                  <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-zinc-500 text-xs text-center px-2 group-hover:text-zinc-400">アイコン設定</span>
                )}
              </div>
              <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
            </label>
            {avatar && (
              <button type="button" onClick={() => setAvatar(null)} className="text-xs text-zinc-500 mt-2 hover:text-zinc-300">
                削除
              </button>
            )}
          </div>

          {isNew && (
            <>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wider">ユーザーID</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ログイン用ID (英数字)"
                  className="w-full bg-[#050505] border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 focus:outline-none focus:border-zinc-600 transition-colors font-sans text-base md:text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wider">パスワード</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="パスワード"
                  className="w-full bg-[#050505] border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 focus:outline-none focus:border-zinc-600 transition-colors font-sans text-base md:text-sm"
                />
              </div>
            </>
          )}
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
            className="w-full bg-zinc-100 text-zinc-950 font-medium rounded-lg px-4 py-3 hover:bg-white transition-colors mt-4 disabled:opacity-50"
          >
            {isNew ? '保存してはじめる' : '保存する'}
          </button>
        </form>

        {!isNew && (
          <div className="mt-12 pt-8 border-t border-zinc-900/50 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">アカウント・セキュリティ設定</h3>
              <button onClick={() => setShowSecurity(!showSecurity)} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                {showSecurity ? '隠す' : '表示する'}
              </button>
            </div>
            {showSecurity && (
              <div className="space-y-6">
                <form onSubmit={handleUpdateCreds} className="space-y-4 p-4 border border-zinc-800 rounded-lg bg-[#080808]">
                  <p className="text-xs text-zinc-500 mb-4">ユーザーIDやパスワードを変更します。</p>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1 uppercase tracking-wider">現在のパスワード (必須)</label>
                    <input
                      type="password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full bg-[#050505] border border-zinc-800 rounded-md px-3 py-2 text-zinc-100 focus:outline-none focus:border-zinc-600 transition-colors font-sans text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1 uppercase tracking-wider">新しいユーザーID (変更する場合のみ)</label>
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="w-full bg-[#050505] border border-zinc-800 rounded-md px-3 py-2 text-zinc-100 focus:outline-none focus:border-zinc-600 transition-colors font-sans text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1 uppercase tracking-wider">新しいパスワード (変更する場合のみ)</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-[#050505] border border-zinc-800 rounded-md px-3 py-2 text-zinc-100 focus:outline-none focus:border-zinc-600 transition-colors font-sans text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-zinc-800 text-zinc-300 font-medium rounded-md px-4 py-2 hover:bg-zinc-700 transition-colors text-sm disabled:opacity-50 mt-2"
                    disabled={!currentPassword || (!newUsername && !newPassword)}
                  >
                    認証情報を更新
                  </button>
                </form>

                <div className="p-4 border border-red-900/30 rounded-lg bg-red-950/10">
                  <h4 className="text-sm font-medium text-red-500 mb-2">危険な操作</h4>
                  <p className="text-xs text-zinc-500 mb-4">アカウントを削除すると、すべてのデータが完全に失われます。</p>
                  <button
                    onClick={onDeleteAccount}
                    className="w-full bg-red-500/10 text-red-500 font-medium rounded-md px-4 py-2 border border-red-500/20 hover:bg-red-500 hover:text-white transition-colors text-sm"
                  >
                    アカウントを完全に削除する
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}

function CountdownView({ userData, onEdit, onLogout, onUpdateUserData }: { userData: UserData, onEdit: () => void, onLogout: () => void, onUpdateUserData: (data: Partial<UserData>) => void }) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ years: 0, months: 0, days: 0, hours: 0, minutes: 0, seconds: 0, milliseconds: 0 });
  const [progress, setProgress] = useState({ elapsed: 0, remaining: 100 });
  const [deathDate, setDeathDate] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'home' | 'life' | 'bucket' | 'advisor'>('home');
  const [isSharing, setIsSharing] = useState(false);
  const [isReflectModalOpen, setIsReflectModalOpen] = useState(false);
  const [isMemoOpen, setIsMemoOpen] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);

  const handleAddMemo = (text: string) => {
    const newMemo: Memo = { id: crypto.randomUUID(), text, createdAt: new Date().toISOString() };
    onUpdateUserData({ memos: [...(userData.memos ?? []), newMemo] });
  };

  const handleDeleteMemo = (id: string) => {
    onUpdateUserData({ memos: (userData.memos ?? []).filter(m => m.id !== id) });
  };

  const handleShare = async () => {
    try {
      setIsSharing(true);
      const shareData = {
        title: 'Memento Mori',
        text: `My remaining time... ${userData?.quote}`,
        url: window.location.origin
      };

      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.origin);
        alert('URLをクリップボードにコピーしました！');
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message?.includes('Share canceled')) {
        // User canceled the share, ignore
        return;
      }
      console.error('Failed to share', err);
      alert('シェアに失敗しました。');
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

  const TAB_ITEMS = [
    { tab: 'home', icon: Home, label: 'HOME' },
    { tab: 'life', icon: Heart, label: 'LIFE' },
    { tab: 'bucket', icon: ListChecks, label: 'BUCKET' },
    { tab: 'advisor', icon: Compass, label: 'ADVISOR' },
  ] as const;

  return (
    <div
      ref={shareRef}
      className="h-[100dvh] flex flex-col font-sans selection:bg-zinc-800 transition-colors duration-500 overflow-hidden"
      style={{ backgroundColor: userData.bgColor || '#050505', color: userData.textColor || '#fafafa' }}
    >
      {/* ── ヘッダー ── */}
      <div className="shrink-0 flex items-center justify-between px-4 pt-4 pb-2 md:px-8 md:pt-5 md:pb-3">
        <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
          {userData.avatar && (
            <img src={userData.avatar} alt="Avatar" className="w-9 h-9 md:w-11 md:h-11 rounded-full object-cover border border-zinc-800/50 shadow-lg shrink-0" />
          )}
          <div className="min-w-0">
            <div className="font-medium text-sm md:text-lg tracking-wide opacity-90 truncate">{userData.name}</div>
            <div className="text-[9px] font-mono tracking-widest uppercase opacity-50 truncate">
              BORN: {userData.birthDate.replace(/-/g, '.')} · {userData.expectedLifespan}Y
            </div>
          </div>
        </div>

        {!isSharing && (
          <div className="flex gap-0.5 shrink-0">
            <button onClick={handleShare} disabled={isSharing} className="p-2 opacity-50 hover:opacity-100 transition-opacity rounded-full hover:bg-white/5" title="シェア">
              <Share2 size={17} />
            </button>
            <button onClick={onEdit} className="p-2 opacity-50 hover:opacity-100 transition-opacity rounded-full hover:bg-white/5" title="設定">
              <Settings size={17} />
            </button>
            <button onClick={onLogout} className="p-2 opacity-50 hover:opacity-100 transition-opacity rounded-full hover:bg-white/5" title="ログアウト">
              <LogOut size={17} />
            </button>
          </div>
        )}
      </div>

      {/* ── タブコンテンツ ── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">

        {/* HOME */}
        {activeTab === 'home' && (
          <div className="min-h-full flex flex-col items-center justify-center px-4 py-6">
            <div className="w-full max-w-4xl flex flex-col items-center">
              <InlineEdit
                value={userData.quote}
                onSave={(val) => onUpdateUserData({ quote: val })}
                className="text-xs md:text-lg tracking-[0.15em] md:tracking-[0.2em] font-light mb-7 md:mb-10 max-w-[90%] md:max-w-2xl mx-auto leading-relaxed opacity-80 block text-center"
                placeholder="Double tap to set your quote..."
              />
              <div className="flex flex-wrap justify-center items-baseline gap-x-3 sm:gap-x-5 md:gap-x-8 gap-y-4 md:gap-y-8 mb-10 md:mb-14">
                <TimeBlock value={timeLeft.years} label="YEARS" />
                <TimeBlock value={pad(timeLeft.months)} label="MONTHS" />
                <TimeBlock value={pad(timeLeft.days)} label="DAYS" />
                <TimeBlock value={pad(timeLeft.hours)} label="HOURS" />
                <TimeBlock value={pad(timeLeft.minutes)} label="MINS" />
                <TimeBlock value={pad(timeLeft.seconds)} label="SECS" />
                <TimeBlock value={pad(Math.floor(timeLeft.milliseconds / 10))} label="MS" />
              </div>
              <div className="w-full max-w-2xl space-y-4">
                <div className="flex justify-between items-end">
                  <div className="text-[10px] font-mono tracking-widest uppercase flex flex-col gap-1 opacity-50">
                    <span>Elapsed {progress.elapsed.toFixed(4)}%</span>
                    <span>Remaining {progress.remaining.toFixed(4)}%</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] tracking-[0.2em] uppercase block mb-1 opacity-50">Expected End Date</span>
                    <span className="font-mono text-sm tracking-widest opacity-70">{deathDate}</span>
                  </div>
                </div>
                <div className="relative w-full h-7">
                  <motion.div className="absolute bottom-0 opacity-80" style={{ left: `${progress.elapsed}%`, x: '-50%' }}>
                    <WalkingIcon />
                  </motion.div>
                </div>
                <div className="h-[2px] w-full flex rounded-full">
                  <div className="h-full" style={{ width: `${progress.elapsed}%`, backgroundColor: 'currentColor', opacity: 0.15 }} />
                  <div className="h-full" style={{ width: `${progress.remaining}%`, backgroundColor: 'currentColor', opacity: 0.9, boxShadow: '0 0 10px currentColor' }} />
                </div>
              </div>

              <div className="mt-8 w-full max-w-2xl">
                <StoicQuotes textColor={userData.textColor} />
              </div>
              <div className="w-full max-w-3xl mt-4">
                <TimeAllocation birthDate={userData.birthDate} expectedLifespan={userData.expectedLifespan} textColor={userData.textColor} />
              </div>
              <div className="w-full max-w-3xl mt-4">
                <DecadesList
                  birthDate={userData.birthDate}
                  expectedLifespan={userData.expectedLifespan}
                  decadeGoals={userData.decadeGoals}
                  textColor={userData.textColor}
                  onUpdateGoal={(decade, goal) => {
                    onUpdateUserData({ decadeGoals: { ...(userData.decadeGoals || {}), [decade]: goal } });
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* LIFE */}
        {activeTab === 'life' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="max-w-3xl mx-auto px-4 py-8 space-y-10"
          >
            <div>
              <h3 className="text-[10px] tracking-[0.3em] uppercase mb-5 font-medium opacity-50">Important Things</h3>
              <div className="text-sm md:text-base leading-loose whitespace-pre-wrap font-light opacity-80">
                <InlineEdit
                  value={userData.notes || ''}
                  onSave={(val) => onUpdateUserData({ notes: val })}
                  multiline
                  className="w-full"
                  placeholder="Double tap to add important notes..."
                />
              </div>
            </div>

            <FavoritesSection
              favorites={userData.favorites ?? []}
              onChange={(favs) => onUpdateUserData({ favorites: favs })}
              textColor={userData.textColor}
            />
          </motion.div>
        )}

        {/* BUCKET */}
        {activeTab === 'bucket' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="max-w-3xl mx-auto px-4 py-8"
          >
            <h3 className="text-[10px] tracking-[0.3em] uppercase mb-5 font-medium opacity-50">Bucket List</h3>
            <BucketListPanel
              items={userData.bucketList ?? []}
              onChange={(items) => onUpdateUserData({ bucketList: items })}
            />
          </motion.div>
        )}

        {/* ADVISOR */}
        {activeTab === 'advisor' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="max-w-3xl mx-auto px-4 py-8"
          >
            <h3 className="text-[10px] tracking-[0.3em] uppercase mb-5 font-medium opacity-50">Life Advisor</h3>
            <AdvisorPanel userData={userData} onUpdateUserData={onUpdateUserData} />
          </motion.div>
        )}


      </div>

      {/* ── ボトムナビゲーション ── */}
      {!isSharing && (
        <div
          className="shrink-0 border-t border-zinc-900/80 flex backdrop-blur-sm"
          style={{ backgroundColor: `${userData.bgColor || '#050505'}E6` }}
        >
          {TAB_ITEMS.map(({ tab, icon: Icon, label }) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 pb-4 transition-all duration-200 ${
                activeTab === tab ? 'opacity-100' : 'opacity-25 hover:opacity-60'
              }`}
            >
              <Icon size={18} />
              <span className="text-[8px] tracking-[0.2em] uppercase font-medium">{label}</span>
            </button>
          ))}
        </div>
      )}

      {/* メモフローティングボタン */}
      {!isSharing && (
        <button
          onClick={() => setIsMemoOpen(true)}
          className="fixed bottom-20 right-4 z-40 w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-110 active:scale-95"
          style={{ backgroundColor: userData.textColor || '#fafafa', color: userData.bgColor || '#050505' }}
          aria-label="メモを開く"
        >
          <NotebookPen size={16} />
          {(userData.memos?.length ?? 0) > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center"
              style={{ backgroundColor: userData.bgColor || '#050505', color: userData.textColor || '#fafafa', border: `1px solid ${userData.textColor || '#fafafa'}` }}
            >
              {Math.min(userData.memos!.length, 99)}
            </span>
          )}
        </button>
      )}

      {/* メモシート */}
      {isMemoOpen && (
        <MemoSheet
          memos={userData.memos ?? []}
          onAdd={handleAddMemo}
          onDelete={handleDeleteMemo}
          onClose={() => setIsMemoOpen(false)}
          bgColor={userData.bgColor}
          textColor={userData.textColor}
        />
      )}

      {/* モーダル */}
      <ReflectModal isOpen={isReflectModalOpen} onClose={() => setIsReflectModalOpen(false)} userData={userData} />
    </div>
  );
}

function FavoritesSection({ favorites, onChange, textColor }: { favorites: string[], onChange: (favs: string[]) => void, textColor?: string }) {
  const [input, setInput] = useState('');

  const add = () => {
    const tag = input.trim();
    if (!tag || favorites.includes(tag)) { setInput(''); return; }
    onChange([...favorites, tag]);
    setInput('');
  };

  const remove = (tag: string) => onChange(favorites.filter(t => t !== tag));

  return (
    <div>
      <h3 className="text-[10px] tracking-[0.3em] uppercase mb-5 font-medium opacity-50">Favorites</h3>
      <div className="flex flex-wrap gap-2 mb-3">
        {favorites.map(tag => (
          <span
            key={tag}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-current/20 opacity-80 hover:opacity-100 group transition-opacity cursor-default"
          >
            {tag}
            <button
              onClick={() => remove(tag)}
              className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity leading-none -mr-0.5"
              aria-label={`${tag}を削除`}
            >
              <X size={11} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder="コーヒー、登山、SF小説..."
          maxLength={50}
          className="flex-1 bg-transparent text-sm outline-none border-b border-current/20 pb-1 placeholder:opacity-25 focus:border-current/50 transition-colors"
        />
        <button
          onClick={add}
          disabled={!input.trim()}
          className="text-xs opacity-40 hover:opacity-80 disabled:opacity-20 transition-opacity pb-1"
        >
          追加
        </button>
      </div>
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
