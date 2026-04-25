# こどもサポート-3

親は Mac で更新し、子どもは iPad ホーム画面からアプリのように使う想定の学習アプリです。

## ローカル開発

```bash
npm install
npm run dev
```

- Mac から: `http://localhost:3000`
- iPad から（同一Wi-Fi）: `npm run dev:lan` を使い、表示された `http://192.168.x.x:3000` を開く

## 本番運用（公開URL + PWA）

ネットワーク変更のたびに IP を確認しないため、公開URL運用を推奨します。

### 1) Vercel にデプロイ

1. GitHub に push
2. [Vercel](https://vercel.com/) でこのリポジトリを Import
3. Framework は Next.js のまま Deploy

### 2) 永続データ用の Blob を有効化

このアプリの教材データ API（`/api/problems`）は、以下の優先順で保存先を使います。

1. `BLOB_READ_WRITE_TOKEN` がある場合: Vercel Blob に保存
2. ない場合: `src/data/current_problems.json` に保存（ローカル開発向け）

Vercel Project Settings -> Storage で Blob を作成し、Environment Variables に次を設定してください。

- `BLOB_READ_WRITE_TOKEN`（必須）
- `PROBLEMS_BLOB_PATHNAME`（任意。未設定時は `kodomo-support/current_problems.json`）

AI機能を使う場合は既存の API Key（OpenAI/Claude など）も Vercel 環境変数へ設定してください。

### 3) iPad にホーム画面追加

1. iPad Safari で公開URL（例: `https://xxxxx.vercel.app`）を開く
2. 共有 -> **ホーム画面に追加**
3. 以後はホーム画面アイコンから起動

`manifest` と `sw.js` は実装済みなので、そのまま PWA として使えます。

## 費用の目安

- **ローカルLAN運用**: 0円（ただし IP 変更ごとに再設定が必要）
- **Vercel + Blob運用**: 無料枠から開始可能（アクセス・保存量増加で従量課金の可能性）
- **AI API（利用時）**: OpenAI/Claude などは別途従量課金

## 運用ルール（推奨）

- 実装更新: Mac で開発 -> `git push`
- 反映: Vercel 自動デプロイ完了後に iPad で再起動
- データバックアップ: 必要に応じて Blob データを定期エクスポート
