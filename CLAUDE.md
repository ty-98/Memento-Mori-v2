# Memento Mori v2 — Claude Code Context

## プロジェクト概要
人生の残り時間をカウントダウンで可視化するWebアプリ。ストア哲学の引用、時間配分の振り返り、10年ごとの目標管理などの機能を持つ。

## 技術スタック
- **フロントエンド**: React 19 + TypeScript + Vite + Tailwind CSS v4
- **バックエンド**: Express (API Routes) + SQLite (better-sqlite3)
- **AI**: Google Gemini API (`@google/genai`)
- **認証**: Google OAuth（カレンダー連携）
- **デプロイ**: Vercel（GitHub連携による自動デプロイ）
- **アニメーション**: motion/react (Framer Motion)

## ディレクトリ構成
```
/
├── src/
│   ├── App.tsx              # メインコンポーネント（UserData, TimeLeft管理）
│   ├── gemini.ts            # Gemini API呼び出し
│   ├── components/
│   │   ├── ReflectModal.tsx  # 振り返りモーダル
│   │   ├── StoicQuotes.tsx   # ストア哲学引用
│   │   └── TimeAllocation.tsx # 時間配分UI
│   └── data/
│       └── stoicQuotes.ts    # 引用データ
├── api/
│   ├── index.ts             # Vercel用APIルート（本番）
│   └── local.ts             # ローカル開発用サーバー
├── vercel.json              # /api/* → /api/index.ts にリライト
└── .env                     # ローカル環境変数（Gitに含まない）
```

## 環境変数
| 変数名 | 用途 |
|--------|------|
| `GEMINI_API_KEY` | Gemini AI API認証 |
| `APP_URL` | アプリのホストURL |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth (カレンダー連携) |

## 開発コマンド
```bash
npm install        # 依存関係インストール
npm run dev        # ローカル開発サーバー起動
npm run build      # 本番ビルド
npm run lint       # 型チェック
```

## デプロイフロー
GitHub `main` ブランチへの push → Vercel が自動ビルド・デプロイ
- Vercelプロジェクト名: `memento-mori-v2`
- リポジトリ: `ty-98/Memento-Mori-v2`

## 注意事項
- `node_modules/` と `.env` は `.gitignore` 済み
- SQLiteのDBファイル (`memento.db`) はローカルのみ、本番はVercel KV (`@vercel/kv`) を使用
- このプロジェクトはGoogle AI Studio（Antigravity）から Claude Code へ移行済み
