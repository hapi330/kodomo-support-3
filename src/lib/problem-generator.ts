import type Anthropic from "@anthropic-ai/sdk";
import type { GeneratedQuestion, UploadedContent } from "@/lib/storage";
import {
  assistantTextFromMessage,
  CLAUDE_SONNET_4_5,
  getAnthropicClient,
} from "@/lib/anthropic-client";
import { buildProblemGenerationSystemPrompt } from "@/lib/problem-generator-prompt";
import {
  normalizeSubjectLabel,
  optionalFurigana,
  parseLeadingJsonObject,
  resolveAnswerInChoices,
  shuffleChoices,
} from "@/lib/question-claude-helpers";
import { estimateTranscribedProblemCount } from "@/lib/transcribed-problem-count";

/** 文字起こしの設問数に追従できるよう余裕を持たせる（出力トークン上限内） */
const MAX_QUESTIONS = 24;
const MAX_TOKENS = 16384;

export async function buildUploadedContent(input: {
  title: string;
  subject: string;
  rawText: string;
}): Promise<UploadedContent> {
  const now = new Date();
  const contentId = `content-${now.getTime()}`;
  const normalized = normalizeText(input.rawText);
  const subject = input.subject.trim() || "その他";

  const anthropic = getAnthropicClient();
  if (!anthropic) {
    throw new Error("ANTHROPIC_API_KEY が未設定です");
  }

  const targetQuestionCount = Math.min(
    MAX_QUESTIONS,
    Math.max(1, estimateTranscribedProblemCount(normalized))
  );

  const questions = await generateQuestionsWithClaude({
    anthropic,
    rawText: normalized,
    subject,
    contentId,
    targetQuestionCount,
  });

  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const editedText =
    lines.slice(0, 2).join(" ").slice(0, 120) || normalized.slice(0, 120);

  return {
    id: contentId,
    title: input.title.trim(),
    subject,
    rawText: normalized,
    editedText,
    uploadDate: now.toISOString(),
    questions,
    studyCleared: false,
  };
}

async function generateQuestionsWithClaude(params: {
  anthropic: Anthropic;
  rawText: string;
  subject: string;
  contentId: string;
  /** 文字起こしから推定した設問数（プロンプトで件数合わせに使う） */
  targetQuestionCount: number;
}): Promise<GeneratedQuestion[]> {
  const subjectLabel = normalizeSubjectLabel(params.subject);
  const n = params.targetQuestionCount;
  const userMessage = `教科: ${subjectLabel}

教材テキスト（文字起こし・ユーザー確定文。各問題の本文はこれに忠実に転記すること）:
---
${params.rawText}
---

## 件数（必須）
- 上記教材に含まれる**独立した設問**（「問題1」「問題-2」「(1)」「問3」など番号付きの各小問）の数を **N** と数える。
- **questions 配列の長さは min(N, ${MAX_QUESTIONS}) になるように出力する**（教材の設問を漏らさない）。目安として自動推定した件数は **${n}**（N とずれる場合は教材の実際の N を優先する）。
- 教材に設問が ${MAX_QUESTIONS} より多いときは、**先頭から ${MAX_QUESTIONS} 件**を出力する。

上記に基づき問題を生成し、指定スキーマのJSONのみを返してください。
各要素の question フィールドは、上記テキスト中の**該当する問題ブロックを省略せず**写した文字列とし、正解語だけ・漢字1語だけに要約しないこと。`;

  const response = await params.anthropic.messages.create({
    model: CLAUDE_SONNET_4_5,
    max_tokens: MAX_TOKENS,
    temperature: 0.2,
    system: buildProblemGenerationSystemPrompt(MAX_QUESTIONS),
    messages: [{ role: "user", content: userMessage }],
  });

  const raw = assistantTextFromMessage(response);
  const parsed = parseQuestionsJson(raw);
  const list = parsed.questions?.length
    ? parsed.questions
    : Array.isArray(parsed)
      ? (parsed as ClaudeQuestionPayload[])
      : [];

  if (list.length === 0) {
    throw new Error("問題を生成できませんでした。テキストを増やすか、教科を確認してください。");
  }

  const out: GeneratedQuestion[] = [];
  for (let i = 0; i < Math.min(list.length, MAX_QUESTIONS); i++) {
    const q = normalizePayload(list[i]);
    if (!q) continue;

    const { choices, correctIndex } = shuffleChoices(q.answer, q.choices);
    const hints = padHints(q.hints);

    const question: GeneratedQuestion = {
      id: `q-${params.contentId}-${out.length + 1}`,
      question: q.question,
      answer: q.answer,
      hints,
      choices,
      correctIndex,
      timesAnswered: 0,
      timesCorrect: 0,
    };
    if (q.questionFurigana) question.questionFurigana = q.questionFurigana;
    if (q.answerFurigana) question.answerFurigana = q.answerFurigana;
    out.push(question);
  }

  if (out.length === 0) {
    throw new Error("有効な問題が1件も得られませんでした。");
  }

  return out;
}

type ClaudeQuestionPayload = {
  question?: string;
  questionFurigana?: string;
  answer?: string;
  answerFurigana?: string;
  choices?: string[];
  hints?: string[];
};

type ParsedWrapper = { questions?: ClaudeQuestionPayload[] };

function normalizePayload(raw: ClaudeQuestionPayload): {
  question: string;
  answer: string;
  choices: string[];
  hints: string[];
  questionFurigana?: string;
  answerFurigana?: string;
} | null {
  const question = sanitizeQuestion(String(raw.question ?? "").trim());
  const answerRaw = String(raw.answer ?? "").trim();
  const choicesIn = Array.isArray(raw.choices)
    ? raw.choices.map((c) => String(c).trim())
    : [];

  if (!question || !answerRaw || choicesIn.length !== 3) return null;
  const answer = resolveAnswerInChoices(answerRaw, choicesIn);
  if (answer === null) return null;

  const unique = new Set(choicesIn);
  if (unique.size < 3) return null;

  return {
    question,
    answer,
    choices: choicesIn,
    hints: Array.isArray(raw.hints) ? raw.hints.map((h) => String(h).trim()) : [],
    questionFurigana: optionalFurigana(raw.questionFurigana),
    answerFurigana: optionalFurigana(raw.answerFurigana),
  };
}

/** 教材どおりの問題文を残すため、指示行の削除はしない（空白・改行のみ整える） */
function sanitizeQuestion(q: string): string {
  return q
    .trim()
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

function padHints(hints: string[]): string[] {
  const defaults = [
    "問題のねらいを思い出してみよう。",
    "教材の用語や手順を確認してみよう。",
    "もう一度だけ、答えの形を確認してみよう。",
  ];
  const h = [...hints];
  while (h.length < 3) {
    h.push(defaults[h.length]);
  }
  return h.slice(0, 3);
}

function parseQuestionsJson(raw: string): ParsedWrapper {
  try {
    return parseLeadingJsonObject<ParsedWrapper>(raw);
  } catch {
    throw new Error("問題データの形式が正しくありません。もう一度お試しください。");
  }
}

function normalizeText(raw: string): string {
  return raw.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

