# Vinoteca 🍷

日本語・韓国語で使えるワイン記録・AIソムリエのWeb/PWAです。
Next.js 15.5.24 / React 19 / TypeScript / Tailwind / Supabase。Node.js 24を使用します。

## ローカル起動

```sh
npm ci
cp .env.example .env.local
npm run dev
```

`.env.local`には開発用プロジェクトの設定を入力します。秘密値をコミット・チャット・ログに出力しないでください。

| 環境変数 | 用途 |
| --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | Supabase URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | 公開クライアント用キー。service_roleは禁止 |
| GEMINI_API_KEY | サーバー専用のラベル認識キー |
| ANTHROPIC_API_KEY | サーバー専用のAIソムリエキー |

`NEXT_PUBLIC_GEMINI_API_KEY`は使用しません。以前公開されたキーは所有者がプロバイダー画面で失効・再発行してください。
VercelのProductionとPreviewそれぞれに設定します。秘密値をローカルへ自動ダウンロードしません。

## データベース

新規開発DB: `supabase_schema.sql` → `supabase_schema_v2.sql` → `supabase/migrations/20260916_reliability.sql` の順に適用します。
既存DB: 新規作成SQLを再実行せず、レビュー済みのmigrationのみを適用します。
運用DBでは2026-09-17にmigration適用と読み取り検証が完了しています。
画像は非公開バケットに保存し、所有者に期限付きURLを発行します。

AI呼び出しはログイン必須。DBが利用枠を確保してから外部APIを呼びます。
日本時間基準で利用者ごとにソムリエ20回/日・100回/月、ラベル50回/日・300回/月。
プロジェクト全体の月間上限はソムリエ500回、ラベル2,000回、連続呼び出し間隔は10秒です。
API失敗も予約回数に含みます。これは金額の上限保証ではないため、プロバイダー側の予算管理も必要です。

## 検証

```sh
npm run typecheck
npm run lint
npm test
npm audit --audit-level=moderate
npm run build
```

Nodeテスト、モックAI応答、PGlite上のDB/RLS検証を使用します。テストで外部AIや運用データを呼び出しません。
GitHub Actionsで同じ検査を実行します。Previewを確認してからmainへマージし、Vercelで運用反映を確認します。

## 機能

- WSET方式の通常・ブラインド記録、セッション再開
- ラベルのクロップ・圧縮とサーバー側AI認識
- 出典リンク付きAIソムリエ、記録からの嗜好比較
- マイセラー、統計、日本語・韓国語切替
- メール/Googleログイン、パスワード再設定画面
- ホーム画面用アイコン、通信断時の案内（個人データはオフライン保存しません）

運用情報と既知の制約は `docs/VINOTECA_CONTEXT.md` を参照してください。
