import type Anthropic from "@anthropic-ai/sdk";
import {
  assistantTextFromMessage,
  CLAUDE_SONNET_4_5,
  getAnthropicClient,
} from "@/lib/anthropic-client";
import {
  ensureThreeUniqueChoicesContainingAnswer,
  normalizeSubjectLabel,
  optionalFurigana,
  parseLeadingJsonObject,
  resolveAnswerInChoices,
  shuffleChoices,
} from "@/lib/question-claude-helpers";
import { isEligibleForChoiceHintAiEnrichment } from "@/lib/inserted-enrichment-gate";
import type { GeneratedQuestion, UploadedContent } from "@/lib/storage";

const ENRICH_MAX_TOKENS = 4096;
const MAX_ATTEMPTS = 2;

export type QuestionEnrichFailure = {
  questionId: string;
  label: string;
  message: string;
};

type EnrichPayload = {
  hints?: string[];
  choices?: string[];
  questionFurigana?: string;
  answerFurigana?: string;
};

type InferPayload = EnrichPayload & {
  answer?: string;
};

function buildEnrichSystemPrompt(): string {
  return `あなたは日本の小学校向け教材の教員です。ユーザーが渡す「問題文」と「正解」は固定であり、変更してはいけません。
あなたの仕事は、ヒント3段階（やさしい順）と、正解を含む三択の選択肢（正解1＋紛らわしい不正解2）だけを生成することです。

## ルール
- choices はちょうど3要素。必ず1つが正解文字列と完全一致するようにする（表記ゆれを作らない）。
- ヒントはやさしい順から3つ。3つ目は学習のために正解が分かるようにしてよい。
- questionFurigana / answerFurigana は国語などで必要なときだけ。不要なら空文字 "" にする。
- 出力は有効なJSONオブジェクトのみ。説明文・マークダウン・コードフェンスは付けない。

## JSONスキーマ
{
  "hints": ["ヒント1", "ヒント2", "ヒント3"],
  "choices": ["不正解候補1", "正解（ユーザー指定と同一）", "不正解候補2"],
  "questionFurigana": "",
  "answerFurigana": ""
}`;
}

function buildInferFromQuestionSystemPrompt(): string {
  return `あなたは日本の小学校向け教材の教員です。ユーザーから「問題文」だけが渡されます。
教材の意図（穴埋め・漢字・語句・計算など）を読み取り、ふさわしい正解を1つ決めてください。

## ルール
- answer は短く明確に（1語〜短い文）。
- choices はちょうど3つ。必ず1つが answer と文字列完全一致。
- ヒントはやさしい順から3つ。
- questionFurigana / answerFurigana は国語で必要なら。不要なら "" 。
- 出力は有効なJSONのみ。コードフェンス禁止。

## JSONスキーマ
{
  "answer": "正解",
  "hints": ["ヒント1", "ヒント2", "ヒント3"],
  "choices": ["不正解1", "正解と同一文字列", "不正解2"],
  "questionFurigana": "",
  "answerFurigana": ""
}`;
}

async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let last: unknown;
  for (let a = 1; a <= MAX_ATTEMPTS; a++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      console.warn(`[enrich] ${label} attempt ${a}/${MAX_ATTEMPTS}`, e);
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

function parseAssistantJson<T>(text: string): T {
  try {
    return parseLeadingJsonObject<T>(text);
  } catch (firstErr) {
    const i = text.indexOf("{");
    if (i < 0) throw firstErr;
    return parseLeadingJsonObject<T>(text.slice(i));
  }
}

async function generateHintsAndChoices(params: {
  anthropic: Anthropic;
  subjectLabel: string;
  question: string;
  answer: string;
}): Promise<{
  hints: string[];
  choices: string[];
  correctIndex: number;
  questionFurigana?: string;
  answerFurigana?: string;
}> {
  const userMessage = `教科: ${params.subjectLabel}

次の問題文と正解は**固定**です。変えずに、ヒント3つと三択（正解を含む）だけを生成してください。

問題文:
---
${params.question}
---

正解（次の文字列と**一字一句同じ**選択肢を1つ必ず含めてください）:
「${params.answer}」

上記スキーマのJSONのみを返してください。`;

  const response = await params.anthropic.messages.create({
    model: CLAUDE_SONNET_4_5,
    max_tokens: ENRICH_MAX_TOKENS,
    temperature: 0.25,
    system: buildEnrichSystemPrompt(),
    messages: [{ role: "user", content: userMessage }],
  });

  const text = assistantTextFromMessage(response);
  const parsed = parseAssistantJson<EnrichPayload>(text);
  const hintsIn = Array.isArray(parsed.hints) ? parsed.hints.map((h) => String(h).trim()) : [];
  let choicesIn = Array.isArray(parsed.choices)
    ? parsed.choices.map((c) => String(c).trim())
    : [];

  while (hintsIn.length < 3) {
    hintsIn.push("もう一度、問題のねらいを思い出してみよう。");
  }

  if (choicesIn.length !== 3) {
    throw new Error("選択肢が3つではありませんでした");
  }

  choicesIn = ensureThreeUniqueChoicesContainingAnswer(params.answer, choicesIn);
  const resolved = resolveAnswerInChoices(params.answer, choicesIn);
  if (resolved === null) {
    throw new Error("正解を選択肢に組み込めませんでした");
  }
  if (new Set(choicesIn).size < 3) {
    throw new Error("選択肢に重複があります");
  }

  const { choices, correctIndex } = shuffleChoices(resolved, choicesIn);
  const hints = hintsIn.slice(0, 3);

  return {
    hints,
    choices,
    correctIndex,
    questionFurigana: optionalFurigana(parsed.questionFurigana),
    answerFurigana: optionalFurigana(parsed.answerFurigana),
  };
}

async function inferAnswerHintsChoicesFromQuestion(params: {
  anthropic: Anthropic;
  subjectLabel: string;
  question: string;
}): Promise<{
  answer: string;
  hints: string[];
  choices: string[];
  correctIndex: number;
  questionFurigana?: string;
  answerFurigana?: string;
}> {
  const userMessage = `教科: ${params.subjectLabel}

問題文のみ与えられています。正解・ヒント3つ・三択（正解含む）を決めてください。

問題文:
---
${params.question}
---

上記スキーマのJSONのみを返してください。`;

  const response = await params.anthropic.messages.create({
    model: CLAUDE_SONNET_4_5,
    max_tokens: ENRICH_MAX_TOKENS,
    temperature: 0.3,
    system: buildInferFromQuestionSystemPrompt(),
    messages: [{ role: "user", content: userMessage }],
  });

  const text = assistantTextFromMessage(response);
  const parsed = parseAssistantJson<InferPayload>(text);
  const answer = String(parsed.answer ?? "").trim();
  if (!answer) {
    throw new Error("AI が正解を出力できませんでした");
  }

  const hintsIn = Array.isArray(parsed.hints) ? parsed.hints.map((h) => String(h).trim()) : [];
  let choicesIn = Array.isArray(parsed.choices)
    ? parsed.choices.map((c) => String(c).trim())
    : [];

  while (hintsIn.length < 3) {
    hintsIn.push("もう一度、問題のねらいを思い出してみよう。");
  }
  if (choicesIn.length !== 3) {
    throw new Error("選択肢が3つではありませんでした");
  }

  choicesIn = ensureThreeUniqueChoicesContainingAnswer(answer, choicesIn);
  const resolved = resolveAnswerInChoices(answer, choicesIn);
  if (resolved === null) {
    throw new Error("正解を選択肢に組み込めませんでした");
  }
  if (new Set(choicesIn).size < 3) {
    throw new Error("選択肢に重複があります");
  }

  const { choices, correctIndex } = shuffleChoices(resolved, choicesIn);
  const hints = hintsIn.slice(0, 3);

  return {
    answer,
    hints,
    choices,
    correctIndex,
    questionFurigana: optionalFurigana(parsed.questionFurigana),
    answerFurigana: optionalFurigana(parsed.answerFurigana),
  };
}

/**
 * 問題文・正解があり、ヒント/三択が未整備の問に対し AI で埋める。
 * 正解が空のときは問題文から正解も推論する。
 */
export async function enrichInsertedQuestionsInContent(
  content: UploadedContent
): Promise<{
  content: UploadedContent;
  failures: QuestionEnrichFailure[];
}> {
  const anthropic = getAnthropicClient();
  if (!anthropic) {
    throw new Error("ANTHROPIC_API_KEY が未設定のため、ヒント・選択肢を自動生成できません");
  }

  const subjectLabel = normalizeSubjectLabel(content.subject);
  const questions: GeneratedQuestion[] = [];
  const failures: QuestionEnrichFailure[] = [];

  for (let index = 0; index < content.questions.length; index++) {
    const q = content.questions[index];
    if (!isEligibleForChoiceHintAiEnrichment(q)) {
      questions.push(q);
      continue;
    }

    const label = `問題 ${index + 1}`;
    const qid = q.id ?? `idx-${index}`;
    const answerTrim = String(q.answer ?? "").trim();
    const qText = String(q.question ?? "").trim();

    try {
      if (!answerTrim) {
        const infer = await withRetry(qid, () =>
          inferAnswerHintsChoicesFromQuestion({
            anthropic,
            subjectLabel,
            question: qText,
          })
        );
        questions.push({
          ...q,
          answer: infer.answer,
          hints: infer.hints,
          choices: infer.choices,
          correctIndex: infer.correctIndex,
          questionFurigana: infer.questionFurigana,
          answerFurigana: infer.answerFurigana,
          ...(q.editorInserted ? { editorInserted: false } : {}),
        });
      } else {
        const fill = await withRetry(qid, () =>
          generateHintsAndChoices({
            anthropic,
            subjectLabel,
            question: qText,
            answer: answerTrim,
          })
        );
        questions.push({
          ...q,
          hints: fill.hints,
          choices: fill.choices,
          correctIndex: fill.correctIndex,
          questionFurigana: fill.questionFurigana,
          answerFurigana: fill.answerFurigana,
          ...(q.editorInserted ? { editorInserted: false } : {}),
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("enrich question failed:", qid, e);
      failures.push({ questionId: qid, label, message: msg });
      questions.push(q);
    }
  }

  return { content: { ...content, questions }, failures };
}
