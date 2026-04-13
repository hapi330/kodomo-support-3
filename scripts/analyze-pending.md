# Claude による問題生成ガイド

---

## ⚠️ 問題生成の厳格ルール（必ず守ること）

### ルール1: 原文忠実の原則
入力テキストに**文章題**が含まれる場合、名前・設定・状況を勝手に変えてはいけない。
原文の文言をそのまま `question` フィールドに採用すること。

```
❌ NG: "ポーションが5/6Lあったよ。飲んだら8/15L残ったよ。何L飲んだかな？"
✅ OK: "ジュースが5/6Lありました。何Lか飲んだので、残りが8/15Lになりました。何L飲みましたか？"
```

### ルール2: 計算問題はシンプルに
原文が数式のみ（計算問題）の場合、ストーリーや擬人化を**加えない**。
`「式」を計算しましょう。` の形式のみとする。

```
❌ NG: "ダイヤが9/10個あって、2/5個使ったらいくつかな？"
✅ OK: "9/10 − 2/5 を計算しましょう。"
```

### ルール3: 分数表記の固定
- `question` / `choices` / `answer` フィールドの分数は `X/Y` 形式で記述する
- `questionFurigana` / `answerFurigana` フィールドに「〇ぶんの〇」を**必ず**記述する
- アプリ側が `X/Y` を自動で縦積み表示（教科書形式）にレンダリングする

```json
{
  "question": "2/3 − 2/9 を計算しましょう。",
  "questionFurigana": "さんぶんのに ひく きゅうぶんのに を けいさんしましょう。",
  "answer": "4/9",
  "answerFurigana": "きゅうぶんのし"
}
```

---

このドキュメントは、管理者が保存したタスクデータを Claude が解析し、
`src/data/current_problems.json` に問題データを書き出すための標準手順・ルールです。

---

## ワークフロー

```
① 管理者がアプリの「クエスト作成モード」でテキストを入力・保存
        ↓
   src/data/pending_task.json に保存される

② ユーザーがターミナルで Claude に依頼
   例:「pending_task.json から問題を作って」

③ Claude が以下の手順で問題を生成し current_problems.json を更新

④ アプリをリロードすると学習画面に反映される
```

---

## Step 1: タスクファイルを読む

`src/data/pending_task.json` を Read ツールで読み込む。

### pending_task.json のフォーマット
```json
{
  "targetName": "かんた",
  "targetProfile": "ASD・読み書き学習障害のある小学6年生。漢字の読み書きが苦手。視覚的サポートと段階的ヒントが有効。",
  "subject": "さんすう",
  "title": "漢字テスト 第3回",
  "rawText": "問1. 次の漢字の読み方を書きましょう。...",
  "savedAt": "2026-04-12T10:00:00.000Z"
}
```

---

## Step 2: 問題を生成する

### ターゲット配慮ルール（標準）

**必須:**
- `questionFurigana` — 問題文の全漢字をひらがなに変換したもの（読み上げ・表示に使用）
- `answerFurigana` — 正解のふりがな
- ヒントは必ず3段階（やさしい → ふつう → くわしい）
- 選択肢は3択。正解1つ + 「惜しい間違い」2つ

**文体ルール:**
- 問題文は「〜かな？」「〜しよう！」「〜だよ」など親しみやすい口調
- 難しい語彙は避け、小学生が理解できる言葉を使う
- 漢字を使う場合は必ず furigana を付与する

**ASD/LD 配慮:**
- 設問は短く、一度に一つのことだけ聞く
- 「どれ？」より「〇〇は次のうちどれかな？」と明確に
- 選択肢は視覚的に区別しやすい（似すぎない）
- ヒントは具体的な手順・例示を含める

**選択肢の作り方:**
- 正解: 正しい答え
- 誤答1: 計算ミスや変換ミスで出やすい、惜しい答え
- 誤答2: テーマ関連だが明確に違う答え
- 3択の順序はランダムに（正解が必ず最初にならないよう correctIndex で管理）

---

## Step 3: current_problems.json を更新する

`src/data/current_problems.json` の既存データを**保持したまま**、新しい `UploadedContent` を追記する。

### UploadedContent の型定義
```typescript
interface UploadedContent {
  id: string;              // "content-{timestamp}"
  title: string;           // pending_task の title
  subject: string;         // pending_task の subject
  rawText: string;         // pending_task の rawText
  editedText: string;      // rawText と同じでOK
  uploadDate: string;      // pending_task の savedAt
  questions: GeneratedQuestion[];
}

interface GeneratedQuestion {
  id: string;                  // "q-{timestamp}-{index}"
  question: string;            // 問題文（漢字あり）
  questionFurigana?: string;   // 問題文のふりがな（必須）
  answer: string;              // 正解
  answerFurigana?: string;     // 正解のふりがな（必須）
  hints: string[];             // ヒント3段階
  choices: string[];           // 3択の選択肢
  correctIndex: number;        // 正解インデックス (0/1/2)
  timesAnswered: number;       // 0
  timesCorrect: number;        // 0
}
```

---

## current_problems.json の記述例

```json
[
  {
    "id": "content-1715500000000",
    "title": "漢字テスト 第3回",
    "subject": "こくご",
    "rawText": "問1. 次の漢字の読み方を書きましょう。(1)宿題 (2)計算",
    "editedText": "問1. 次の漢字の読み方を書きましょう。(1)宿題 (2)計算",
    "uploadDate": "2026-04-12T10:00:00.000Z",
    "questions": [
      {
        "id": "q-1715500000000-0",
        "question": "「宿題」の読み方はどれかな？",
        "questionFurigana": "「しゅくだい」の よみかた は どれかな？",
        "answer": "しゅくだい",
        "answerFurigana": "しゅくだい",
        "hints": [
          "「宿」という字は、とまる場所という意味があるよ。「宿屋」とかにも使うね",
          "「宿」は「しゅく」、「題」は「だい」と読むよ",
          "合わせると「しゅく＋だい」…わかった？"
        ],
        "choices": ["やどだい", "しゅくだい", "しゅくもく"],
        "correctIndex": 1,
        "timesAnswered": 0,
        "timesCorrect": 0
      }
    ]
  }
]
```

---

## Step 4: 完了後の確認

- `src/data/pending_task.json` は処理後も残しておく（履歴として）
- `src/data/current_problems.json` に正しく追記されたか確認
- アプリ側は `/api/problems` GET で読み込むのでリロードするだけでOK
