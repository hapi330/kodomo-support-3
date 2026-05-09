import type Anthropic from "@anthropic-ai/sdk";
import { normalizeHintStepsArray } from "@/lib/normalize-hint-steps";
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
import { getSubject } from "@/lib/config";
import { sanitizeHintsForStudy } from "@/lib/hint-policy";
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

  const targetQuestionCount = Math.min(
    MAX_QUESTIONS,
    Math.max(1, estimateTranscribedProblemCount(normalized))
  );

  let questions: GeneratedQuestion[];
  if (!anthropic) {
    questions = buildLocalQuestionsFallback(normalized, subject, contentId);
  } else {
    try {
      questions = await generateQuestionsWithClaude({
        anthropic,
        rawText: normalized,
        subject,
        contentId,
        targetQuestionCount,
      });
    } catch (error) {
      const fallback = buildLocalQuestionsFallback(normalized, subject, contentId);
      if (fallback.length === 0) throw error;
      questions = fallback;
    }
  }

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
  const isMath = getSubject(params.subject).key === "さんすう";
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
各要素の question フィールドは、上記テキスト中の**該当する問題ブロックを省略せず**写した文字列とし、正解語だけ・漢字1語だけに要約しないこと。
各要素の question では OCR由来の記号（□, ( ), [図], [表], [判読不明]）を保持し、判読不明は補完しないこと。`;

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
    const studySteps = isMath
      ? sanitizeMathStudySteps(q.studySteps)
      : sanitizeHintsForStudy(q.studySteps, q.answer, { allowZeroHints: true });

    const question: GeneratedQuestion = {
      id: `q-${params.contentId}-${out.length + 1}`,
      question: q.question,
      answer: q.answer,
      hints: studySteps,
      hintSteps: q.hintSteps,
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
  steps?: string[];
  hints?: string[];
  hintSteps?: {
    prompt?: string;
    explanation?: string;
    choices?: { text?: string; isCorrect?: boolean }[];
  }[];
};

type ParsedWrapper = { questions?: ClaudeQuestionPayload[] };

function pickFallbackAnswer(result: string, choices: string[]): string {
  const byResult = result.trim();
  if (byResult) return byResult;
  // 一部のOCR指示書は [Result] を持たないため、先頭選択肢を暫定正解として成立させる
  return choices[0] ?? "";
}

function normalizePayload(raw: ClaudeQuestionPayload): {
  question: string;
  answer: string;
  choices: string[];
  studySteps: string[];
  hintSteps?: {
    prompt: string;
    explanation?: string;
    choices: { text: string; isCorrect: boolean }[];
  }[];
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

  const stepsIn = Array.isArray(raw.steps)
    ? raw.steps.map((s) => String(s).trim())
    : Array.isArray(raw.hints)
      ? raw.hints.map((h) => String(h).trim())
      : [];

  const hintSteps = normalizeHintStepsArray(raw.hintSteps);

  return {
    question,
    answer,
    choices: choicesIn,
    studySteps: stepsIn,
    hintSteps,
    questionFurigana: optionalFurigana(raw.questionFurigana),
    answerFurigana: optionalFurigana(raw.answerFurigana),
  };
}

/** 教材どおりの問題文を残すため、指示行の削除はしない（空白・改行のみ整える） */
function sanitizeQuestion(q: string): string {
  const cleaned = q
    .trim()
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (!t) return false;
      if (/^##\s*画像.*解析データ/i.test(t)) return false;
      if (/^\[(Target|Question ID|Hint\s*\d+|Choices|Formula|Result|Note)\]\s*/i.test(t)) return false;
      return true;
    })
    .map((l) => l.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
  return cleaned || q.trim();
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

function sanitizeMathStudySteps(steps: string[]): string[] {
  const uniqRaw = new Set<string>();
  const uniqNormalized = new Set<string>();
  return steps
    .map((s) => String(s ?? "").trim())
    .filter(Boolean)
    .filter((s) => {
      const normalized = s
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[。．.!！?？、,]/g, "");
      if (uniqRaw.has(s) || uniqNormalized.has(normalized)) return false;
      uniqRaw.add(s);
      uniqNormalized.add(normalized);
      return true;
    })
    .slice(0, 3);
}

type Fraction = { n: number; d: number };

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x || 1;
}

function reduceFraction(f: Fraction): Fraction {
  if (f.d === 0) return f;
  const sign = f.d < 0 ? -1 : 1;
  const n = f.n * sign;
  const d = Math.abs(f.d);
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}

function parseFractionToken(token: string): Fraction | null {
  const t = token.trim();
  const m = t.match(/^(-?\d+)\s*\/\s*(-?\d+)$/);
  if (m) {
    const n = Number.parseInt(m[1], 10);
    const d = Number.parseInt(m[2], 10);
    if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return null;
    return reduceFraction({ n, d });
  }
  if (/^-?\d+$/.test(t)) {
    const n = Number.parseInt(t, 10);
    return { n, d: 1 };
  }
  return null;
}

function calcBinaryExpr(expr: string): Fraction | null {
  const compact = expr.replace(/[＝=].*$/, "").replace(/\s+/g, "");
  const m = compact.match(/^(-?\d+(?:\/-?\d+)?)\s*([+\-×xX*÷/])\s*(-?\d+(?:\/-?\d+)?)$/);
  if (!m) return null;
  const left = parseFractionToken(m[1]);
  const op = m[2];
  const right = parseFractionToken(m[3]);
  if (!left || !right) return null;

  let out: Fraction | null = null;
  if (op === "+") out = { n: left.n * right.d + right.n * left.d, d: left.d * right.d };
  if (op === "-") out = { n: left.n * right.d - right.n * left.d, d: left.d * right.d };
  if (op === "×" || op === "x" || op === "X" || op === "*") out = { n: left.n * right.n, d: left.d * right.d };
  if (op === "÷") out = right.n === 0 ? null : { n: left.n * right.d, d: left.d * right.n };
  // "/" は a/b 形式と衝突しやすいので演算子としては使わない
  if (!out || out.d === 0) return null;
  return reduceFraction(out);
}

function fractionToAnswer(f: Fraction): string {
  const r = reduceFraction(f);
  if (r.d === 1) return String(r.n);
  return `${r.n}/${r.d}`;
}

function createNearbyChoices(correct: Fraction): string[] {
  const c = reduceFraction(correct);
  const a1 = reduceFraction({ n: c.n + c.d, d: c.d });
  const a2 = reduceFraction({ n: c.n - c.d, d: c.d });
  const list = [fractionToAnswer(c), fractionToAnswer(a1), fractionToAnswer(a2)].filter(Boolean);
  const uniq = Array.from(new Set(list));
  if (uniq.length >= 3) return uniq.slice(0, 3);
  if (!uniq.includes("1")) uniq.push("1");
  if (!uniq.includes("0")) uniq.push("0");
  return uniq.slice(0, 3);
}

function buildFallbackQuestions(rawText: string, subject: string, contentId: string): GeneratedQuestion[] {
  const isMath = getSubject(subject).key === "さんすう";
  if (!isMath) return [];

  const lines = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const out: GeneratedQuestion[] = [];
  for (const line of lines) {
    const expr = line.replace(/^[（(]?\d+[)）.]?\s*/, "");
    const result = calcBinaryExpr(expr);
    if (!result) continue;
    const choices = createNearbyChoices(result);
    if (choices.length !== 3) continue;
    const answer = fractionToAnswer(result);
    const correctIndex = choices.findIndex((c) => c === answer);
    if (correctIndex < 0) continue;

    out.push({
      id: `q-${contentId}-${out.length + 1}`,
      question: line,
      answer,
      hints: [
        "通分または約分を確認しよう",
        `${expr} = ?`,
        `答えは ${answer}`,
      ],
      choices,
      correctIndex,
      timesAnswered: 0,
      timesCorrect: 0,
    });
    if (out.length >= MAX_QUESTIONS) break;
  }
  return out;
}

function buildLocalQuestionsFallback(rawText: string, subject: string, contentId: string): GeneratedQuestion[] {
  const structured = buildStructuredAnalysisFallback(rawText, contentId);
  if (structured.length > 0) return structured;

  const math = buildFallbackQuestions(rawText, subject, contentId);
  if (math.length > 0) return math;
  return buildGenericQuestionsFromText(rawText, contentId);
}

function buildStructuredAnalysisFallback(rawText: string, contentId: string): GeneratedQuestion[] {
  const lines = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.some((line) => /^\[Question ID\]/i.test(line))) return [];

  type ParsedBlock = {
    questionId?: string;
    text?: string;
    result?: string;
    choices?: string[];
    hints: string[];
  };
  const blocks: ParsedBlock[] = [];
  let current: ParsedBlock | null = null;

  for (const line of lines) {
    const id = line.match(/^\[Question ID\]\s*(.+)$/i);
    if (id) {
      if (current) blocks.push(current);
      current = { questionId: id[1].trim(), hints: [] };
      continue;
    }
    if (!current) continue;

    const text = line.match(/^\[Text\]\s*(.+)$/i);
    if (text) {
      current.text = text[1].trim();
      continue;
    }
    const result = line.match(/^\[Result\]\s*(.+)$/i);
    if (result) {
      current.result = result[1].trim();
      continue;
    }
    const choices = line.match(/^\[Choices\]\s*(.+)$/i);
    if (choices) {
      current.choices = choices[1]
        .split(/[、,]/)
        .map((x) => x.trim())
        .filter(Boolean);
      continue;
    }
    const hint = line.match(/^\[Hint\s*\d+\]\s*(.+)$/i);
    if (hint) {
      current.hints.push(hint[1].trim());
    }
  }
  if (current) blocks.push(current);

  const out: GeneratedQuestion[] = [];
  for (const b of blocks) {
    const rawChoices = Array.isArray(b.choices) ? b.choices : [];
    const dedup = Array.from(new Set(rawChoices.filter(Boolean)));
    const answer = pickFallbackAnswer(String(b.result ?? ""), dedup);
    const question = sanitizeQuestion(
      [b.questionId ? `問題 ${b.questionId}` : "", b.text ?? ""].filter(Boolean).join("\n")
    );
    if (!question || !answer) continue;

    const choices = dedup.includes(answer) ? dedup : [answer, ...dedup];
    while (choices.length < 3) {
      choices.push(`候補${choices.length + 1}`);
    }
    const three = choices.slice(0, 3);
    const correctIndex = three.findIndex((c) => c === answer);
    if (correctIndex < 0) {
      three[0] = answer;
    }
    out.push({
      id: `q-${contentId}-${out.length + 1}`,
      question,
      answer,
      hints:
        b.hints.length > 0
          ? b.hints.slice(0, 3)
          : ["問題文の条件を整理しよう", "単位をそろえて計算しよう", "結果を比べて判断しよう"],
      choices: three,
      correctIndex: Math.max(0, three.findIndex((c) => c === answer)),
      timesAnswered: 0,
      timesCorrect: 0,
    });
    if (out.length >= MAX_QUESTIONS) break;
  }
  return out;
}

function buildGenericQuestionsFromText(rawText: string, contentId: string): GeneratedQuestion[] {
  const lines = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^問題\d+\s*$/.test(line));

  const blocks: string[] = [];
  let cur: string[] = [];
  for (const line of lines) {
    const isNew = /^[（(]?\d+[)）.]?\s*/.test(line) || /^問\d+/.test(line);
    if (isNew && cur.length > 0) {
      blocks.push(cur.join("\n"));
      cur = [line];
      continue;
    }
    cur.push(line);
  }
  if (cur.length > 0) blocks.push(cur.join("\n"));

  const source = (blocks.length > 0 ? blocks : lines).slice(0, 8);
  const out: GeneratedQuestion[] = source.map((text, idx) => {
    const answer = `本文を読んで答えよう ${idx + 1}`;
    return {
      id: `q-${contentId}-${idx + 1}`,
      question: text,
      answer,
      hints: [
        "本文のキーワードを確認しよう",
        "文の前後関係に注目しよう",
        "わからないときは音読して整理しよう",
      ],
      choices: [answer, "わからない", "もう一度読む"],
      correctIndex: 0,
      timesAnswered: 0,
      timesCorrect: 0,
    };
  });

  if (out.length > 0) return out;
  return [
    {
      id: `q-${contentId}-1`,
      question: rawText.slice(0, 300) || "本文が空です。",
      answer: "本文を読んで答えよう 1",
      hints: [
        "まずは本文を最後まで読もう",
        "大事な語に印をつけよう",
        "自分の言葉で説明してみよう",
      ],
      choices: ["本文を読んで答えよう 1", "わからない", "もう一度読む"],
      correctIndex: 0,
      timesAnswered: 0,
      timesCorrect: 0,
    },
  ];
}

