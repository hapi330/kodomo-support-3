# Mac と iPad で挙動が違うときの整理（開発・LAN 接続）

## よくある誤解：「反映しない」＝ バグではないことが多い

| 要因 | 内容 | 対処 |
|------|------|------|
| **localStorage が端末別** | 進捗・XP・設定などは **ブラウザの中** にだけ保存される。Mac の Safari と iPad の Safari は **別ストレージ** | iPad でも最初から表示されるのが正常。共有したい場合は今後サーバー保存などが必要 |
| **問題データ（`/api/problems`）** | dev サーバーが **Mac 上のファイル** を読む。iPad は **同じ URL** で見ている限り **同じ API** | Mac で JSON を更新し、iPad を **リロード** すれば取れる（キャッシュ時はスーパーリロード） |
| **コード変更の即時反映（HMR）** | Turbopack が **WebSocket** で更新を送る。`allowedDevOrigins` と `dev:lan` で LAN から許可 | ターミナルに `Blocked cross-origin` が出たら `next.config` の `allowedDevOrigins` と dev 再起動を確認 |
| **Safari のキャッシュ** | 古い JS が残ると「直ったつもりが古い画面」 | iPad で **アドレスバー横の更新を長押し → キャッシュを無視して再読み込み**（またはプライベートウィンドウで試す） |
| **URL ミス** | iPad で `localhost` を開くと **iPad 自身** を指す | **`http://（MacのIP）:3000`** を使う（`npm run dev:lan` の緑の URL） |
| **IP が変わった** | Wi‑Fi 再接続で Mac の IP が変わる | `allowedDevOrigins` は起動時に IP を読むため **`dev:lan` を再起動** |
| **ファイアウォール** | Mac がポート 3000 の受信を拒否 | システム設定で Node / ターミナルを許可 |

## 本番（`next build` + デプロイ）では

同一 URL を全端末で見るなら、データ設計（DB / アカウント）次第で「共有」は可能。現状のローカルストレージ主体の実装では **端末間では共有されない**。
