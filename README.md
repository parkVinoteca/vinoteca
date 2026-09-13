# Vinoteca 🍷

ワインテイスティング記録PWAアプリ

## セットアップ

### 1. 依存パッケージのインストール
```bash
npm install
```

### 2. 環境変数の設定
`.env.local`を編集してGemini APIキーを設定:
```
NEXT_PUBLIC_GEMINI_API_KEY=あなたのGemini APIキー
```

### 3. Supabaseのテーブル作成
Supabaseダッシュボード → SQL Editor → `supabase_schema.sql`の内容を貼り付けて実行

### 4. 開発サーバーの起動
```bash
npm run dev
```

### 5. Vercelへのデプロイ
- GitHubにpush
- Vercelでリポジトリをインポート
- 環境変数を設定:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_GEMINI_API_KEY`

## 機能
- 📝 通常テイスティング記録（ラベル自動認識）
- 🎭 ブラインドテイスティングモード
- 📚 マイワインセラー（フィルター・ソート）
- 🤖 AI取向分析・推薦
- 🇯🇵🇰🇷 日本語・韓国語切替
