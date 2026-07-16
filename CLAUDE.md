# Memento Mori v2 — Claude Code Context

## プロジェクト概要
人生の残り時間をカウントダウンで可視化するWebアプリ（PWA対応）。
ストア哲学の引用、時間配分の振り返り、10年ごとの目標管理、バケットリスト、AIアドバイザー、人生の目的（Purpose）設定などの機能を持つ。

## 技術スタック
- **フロントエンド**: React 19 + TypeScript + Vite + Tailwind CSS v4
- **バックエンド**: Express + SQLite（better-sqlite3）/ Vercel KV（本番）
- **AI**: Groq API（`groq-sdk`、モデル: `llama-3.3-70b-versatile`）※エンドポイント名は `/api/gemini` のまま
- **MCPサーバー**: `@modelcontextprotocol/sdk`（Claude Desktop連携用）
- **認証**: ユーザーID + パスワード（scrypt）方式
- **デプロイ**: Vercel（GitHub連携による自動デプロイ）、PWA対応
- **アニメーション**: motion/react (Framer Motion)

## ディレクトリ構成
```
/
├── src/
│   ├── App.tsx                  # メインコンポーネント・全画面UI・UserData/TimeLeft管理
│   ├── gemini.ts                # （未使用）旧Gemini APIクライアント
│   ├── components/
│   │   ├── AdvisorPanel.tsx     # AIアドバイザー（ADVISOR タブ）+ Purposeダイアログも内包
│   │   ├── AdvisorModal.tsx     # アドバイザーモーダル
│   │   ├── BucketListPanel.tsx  # バケットリスト（BUCKET タブ）
│   │   ├── BucketListModal.tsx  # バケットリストモーダル
│   │   ├── MemoSheet.tsx        # フローティングメモシート
│   │   ├── PurposePanel.tsx     # 人生の目的設定 + 三大資本スコア（PURPOSE タブ）
│   │   ├── ReflectModal.tsx     # 振り返りモーダル
│   │   ├── StoicQuotes.tsx      # ストア哲学引用
│   │   └── TimeAllocation.tsx   # 時間配分UI
│   ├── data/
│   │   └── stoicQuotes.ts       # 引用データ
│   ├── index.css
│   └── main.tsx
├── api/
│   ├── index.ts                 # Express APIルート（本番Vercel / ローカル共用）
│   └── local.ts                 # ローカル開発サーバー（Vite + Express を統合起動）
├── mcp/
│   └── server.ts                # MCP Serverスクリプト（Claude Desktopからの接続用）
├── vercel.json                  # /api/* → /api/index.ts にリライト
└── .env                         # ローカル環境変数（Gitに含まない）
```

## 画面タブ構成（CountdownView）
| タブ | アイコン | 内容 |
|------|---------|------|
| HOME | Home | カウントダウン、進捗バー、座右の銘、Stoic引用、時間配分、Decades Timeline、Purpose表示 |
| LIFE | Heart | 大切なこと（ノート）、Favorites、Longevity Tips（AI生成） |
| BUCKET | ListChecks | バケットリスト（やりたいことリスト） |
| ADVISOR | Compass | AIアドバイザー（日5回制限、バケットリスト/目標/ノート提案） |
| PURPOSE | Flame | 人生の目的設定（対話式AI）、三大資本スコア（人的・社会・金融） |

フローティングボタン: メモ（NotebookPen）— MemoSheet を開く

## UserData 型の主要フィールド
```typescript
interface UserData {
  id?: string;              // バックエンド登録時に付与されるUUID
  username?: string;        // ログインID
  name: string;
  birthDate: string;        // "YYYY-MM-DD"
  expectedLifespan: number; // 想定寿命（歳）
  gender?: 'male' | 'female' | null;
  quote: string;            // 座右の銘
  notes?: string;           // 人生で大切なこと（長文）
  bgColor?: string;         // 背景色
  textColor?: string;       // テキスト色
  decadeGoals?: Record<string, string>; // 年代別目標（キー: "20", "30"...）
  avatar?: string | null;   // Base64 JPEG（256px以内）
  bucketList?: BucketItem[];
  memos?: Memo[];
  favorites?: string[];     // タグ形式
  shareToken?: string | null; // AI連携用シェアトークン
  purpose?: string;         // 人生の目的（2000文字以内）
  capitalScores?: { human: number; social: number; financial: number } | null; // 1〜5
}
```

## データ永続化
- **ローカル**: `localStorage`（`life_countdown_data` キー）に常に保存
- **バックエンド同期**: `userData.id` がある（登録済みユーザー）場合は `POST /api/user/:id` でも同期
- **ゲストモード**: バックエンド登録なしで localStorage のみで使用可能

## APIエンドポイント一覧
| メソッド | パス | 概要 |
|---------|------|------|
| POST | `/api/auth/register` | 新規登録 |
| POST | `/api/auth/login` | ログイン |
| POST | `/api/user/:id` | プロフィール更新 |
| PUT | `/api/auth/:id/credentials` | ユーザーID・パスワード変更 |
| DELETE | `/api/user/:id` | アカウント削除 |
| POST | `/api/user/:id/share-token` | シェアトークン発行 |
| DELETE | `/api/user/:id/share-token` | シェアトークン失効 |
| GET | `/api/share/:token` | 公開プロフィール取得（MCP用） |
| POST | `/api/share/:token/bucket` | バケットアイテム追加（MCP用） |
| PATCH | `/api/share/:token/bucket/:itemId` | バケットアイテム更新（MCP用） |
| DELETE | `/api/share/:token/bucket/:itemId` | バケットアイテム削除（MCP用） |
| POST | `/api/share/:token/memo` | メモ追加（MCP用） |
| PUT | `/api/share/:token/notes` | ノート更新（MCP用） |
| PUT | `/api/share/:token/goals` | 年代目標更新（MCP用） |
| POST | `/api/gemini` | AI生成（Groq llama-3.3-70b） |

## セキュリティ
- パスワード: scrypt（salt付き）。レガシーSHA-256はログイン時に自動マイグレート
- ログインレートリミット: 10回 / 15分 / ユーザーID
- AI（Groq）レートリミット: 30回 / 時 / IP
- Share API レートリミット: 60回 / 時 / トークン
- 入力サニタイズ: `sanitizeUserData()` でCSSインジェクション・XSS防止

## MCPサーバー（Claude Desktop連携）
```json
{
  "mcpServers": {
    "memento-mori": {
      "command": "npx",
      "args": ["tsx", "mcp/server.ts"],
      "env": {
        "MEMENTO_MORI_TOKEN": "<シェアトークン>"
      }
    }
  }
}
```
提供ツール: `get_life_profile`, `list_bucket_items`, `add_bucket_item`, `complete_bucket_item`, `update_bucket_item`, `delete_bucket_item`, `add_memo`, `update_notes`, `update_decade_goal`

## 環境変数
| 変数名 | 用途 |
|--------|------|
| `GROQ_API_KEY` | Groq AI API認証（AIアドバイス・長寿Tips生成） |
| `KV_REST_API_URL` | Vercel KV接続URL（本番。これがある場合SQLiteの代わりにKVを使用） |
| `KV_REST_API_TOKEN` | Vercel KV認証トークン（本番） |

## 開発コマンド
```bash
npm install        # 依存関係インストール
npm run dev        # ローカル開発サーバー起動（Vite + Express を http://localhost:3000 で統合）
npm run build      # 本番ビルド（dist/ に出力、PWA含む）
npm run lint       # TypeScript型チェック（tsc --noEmit）
```

## デプロイフロー
GitHub `main` ブランチへの push → Vercel が自動ビルド・デプロイ
- Vercelプロジェクト名: `memento-mori-v2`
- リポジトリ: `ty-98/Memento-Mori-v2`

## 注意事項
- `node_modules/` と `.env` は `.gitignore` 済み
- SQLite DB（`memento.db`）はローカルのみ。本番は Vercel KV（`@vercel/kv`）を使用（`KV_REST_API_URL` 環境変数の有無で自動切替）
- AI バックエンドは **Groq**（`llama-3.3-70b-versatile`）を使用。フロントエンドのAPIコール先は `/api/gemini` のまま（名前の変更なし）
- `src/gemini.ts` はレガシーコードで現在未使用
- `AdvisorPanel.tsx` にはADVISORタブの機能に加え、PURPOSE対話フロー（`PurposeStep`）も内包している（後に `PurposePanel.tsx` に分離）
