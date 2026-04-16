import type { GeneratedQuestion, UploadedContent } from "@/lib/storage";

const FALLBACK_CHOICES = ["わからない", "もういちどよむ", "ヒントを見る"];

export function buildUploadedContent(input: {
  title: string;
  subject: string;
  rawText: string;
}): UploadedContent {
  const now = new Date();
  const contentId = `content-${now.getTime()}`;
  const normalized = normalizeText(input.rawText);
  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const sourceLines = lines.length > 0 ? lines : [normalized];
  const questions = buildQuestions(sourceLines, contentId);

  return {
    id: contentId,
    title: input.title.trim(),
    subject: input.subject.trim() || "その他",
    rawText: normalized,
    editedText: sourceLines.slice(0, 2).join(" ").slice(0, 120),
    uploadDate: now.toISOString(),
    questions,
  };
}

function buildQuestions(lines: string[], contentId: string): GeneratedQuestion[] {
  const problems = extractProblemLines(lines.join("\n")).slice(0, 8);
  const source = problems.length > 0 ? problems : lines.slice(0, 8);

  return source.map((line, index) => {
    const solvedAnswer = solveMathProblem(line);
    const answer = solvedAnswer ?? pickAnswerToken(line) ?? line.slice(0, 16);
    const choices = buildChoices(answer, line);
    const correctIndex = choices.indexOf(answer);

    return {
      id: `q-${contentId}-${index + 1}`,
      question: line,
      answer,
      hints: [
        "まずは問題文の条件を確認して、何を求めるか整理しよう。",
        "式にできる場合は、先に式を書いてから計算するとミスしにくいよ。",
        `正解は「${answer}」だよ。`,
      ],
      choices,
      correctIndex: correctIndex >= 0 ? correctIndex : 0,
      timesAnswered: 0,
      timesCorrect: 0,
    };
  });
}

function buildChoices(answer: string, sourceLine: string): string[] {
  const numericChoices = buildNumericChoices(answer);
  if (numericChoices) {
    return shuffle(numericChoices);
  }

  const tokenCandidates = tokenize(sourceLine).filter((token) => token !== answer);
  const distractors = Array.from(new Set(tokenCandidates)).slice(0, 2);

  while (distractors.length < 2) {
    distractors.push(FALLBACK_CHOICES[distractors.length]);
  }

  const choices = [answer, ...distractors];
  return shuffle(choices).slice(0, 3);
}

function pickAnswerToken(line: string): string | null {
  const tokens = tokenize(line);
  if (tokens.length === 0) return null;
  return tokens.sort((a, b) => b.length - a.length)[0] ?? null;
}

function extractProblemLines(text: string): string[] {
  const cleaned = normalizeText(text);
  const markerRegex = /(?:^|\s)([（(]?\d{1,2}[)）.．])\s*([\s\S]*?)(?=(?:\s[（(]?\d{1,2}[)）.．]\s*)|$)/g;
  const chunks: string[] = [];
  for (const match of cleaned.matchAll(markerRegex)) {
    const body = (match[2] ?? "").trim();
    if (body) chunks.push(body);
  }

  if (chunks.length === 0) {
    return cleaned
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !isInstructionLine(line));
  }

  let instruction = "";
  const problems: string[] = [];

  for (const chunk of chunks) {
    if (isInstructionLine(chunk)) {
      instruction = chunk;
      continue;
    }

    const normalized = instruction ? `${instruction}\n${chunk}` : chunk;
    problems.push(normalized);
  }

  return problems;
}

function isInstructionLine(line: string): boolean {
  if (line.length > 60) return false;
  return /(次の|つぎの).*(計算|問題|問い)/.test(line) || /(しましょう|答えなさい|書きなさい)$/.test(line);
}

function solveMathProblem(line: string): string | null {
  const normalized = toAsciiMath(line);
  const gatherMatch = normalized.match(
    /([\d.]+)\s*は[、,\s]*([\d.]+)\s*を[\[\]（）()0-9０-９\s]*個?集めた数/
  );
  if (gatherMatch) {
    const lhs = Number(gatherMatch[1]);
    const rhs = Number(gatherMatch[2]);
    if (Number.isFinite(lhs) && Number.isFinite(rhs) && rhs !== 0) {
      return toCleanNumber(lhs / rhs);
    }
  }

  const expression = extractExpression(normalized);
  if (!expression) return null;
  const value = evalRationalExpression(expression);
  return value ? formatRational(value) : null;
}

function extractExpression(text: string): string | null {
  const candidates = text.match(/[0-9./と+\-*/×÷\s]+/g) ?? [];
  const withOps = candidates
    .map((item) => item.trim())
    .filter((item) => /[+\-*/×÷]/.test(item) && /\d/.test(item));
  if (withOps.length === 0) return null;
  return withOps.sort((a, b) => b.length - a.length)[0] ?? null;
}

type Rational = { n: number; d: number };

function evalRationalExpression(expression: string): Rational | null {
  const normalized = expression.replace(/[×xX]/g, "*").replace(/÷/g, "/").replace(/\s+/g, "");
  const tokens = normalized.match(/([+\-*]|[^+\-*]+)/g);
  if (!tokens || tokens.length === 0) return null;

  let acc = parseRational(tokens[0] ?? "");
  if (!acc) return null;

  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i];
    const right = parseRational(tokens[i + 1] ?? "");
    if (!op || !right) return null;

    if (op === "+") acc = add(acc, right);
    else if (op === "-") acc = sub(acc, right);
    else if (op === "*") acc = mul(acc, right);
    else if (op === "/") return null;
    else return null;
  }

  return simplify(acc);
}

function parseRational(raw: string): Rational | null {
  if (!raw) return null;
  if (raw.includes("と")) {
    const [wholeRaw, fracRaw] = raw.split("と");
    const whole = Number(wholeRaw);
    const frac = parseRational(fracRaw);
    if (!Number.isFinite(whole) || !frac) return null;
    return simplify({ n: whole * frac.d + frac.n, d: frac.d });
  }
  if (raw.includes("/")) {
    const [nRaw, dRaw] = raw.split("/");
    const n = Number(nRaw);
    const d = Number(dRaw);
    if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return null;
    return simplify({ n, d });
  }
  const num = Number(raw);
  if (!Number.isFinite(num)) return null;
  if (Number.isInteger(num)) return { n: num, d: 1 };
  const scaled = Math.round(num * 1000);
  return simplify({ n: scaled, d: 1000 });
}

function add(a: Rational, b: Rational): Rational {
  return simplify({ n: a.n * b.d + b.n * a.d, d: a.d * b.d });
}
function sub(a: Rational, b: Rational): Rational {
  return simplify({ n: a.n * b.d - b.n * a.d, d: a.d * b.d });
}
function mul(a: Rational, b: Rational): Rational {
  return simplify({ n: a.n * b.n, d: a.d * b.d });
}
function simplify(value: Rational): Rational {
  const sign = value.d < 0 ? -1 : 1;
  const n = value.n * sign;
  const d = Math.abs(value.d);
  const g = gcd(Math.abs(n), d);
  return { n: n / g, d: d / g };
}

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

function formatRational(value: Rational): string {
  if (value.d === 1) return String(value.n);
  const absN = Math.abs(value.n);
  if (absN > value.d) {
    const whole = Math.trunc(value.n / value.d);
    const rem = absN % value.d;
    return rem === 0 ? String(whole) : `${whole}と${rem}/${value.d}`;
  }
  return `${value.n}/${value.d}`;
}

function toAsciiMath(text: string): string {
  return text
    .replace(/[０-９]/g, (char) => String(char.charCodeAt(0) - 0xff10))
    .replace(/[，]/g, ",")
    .replace(/[．]/g, ".")
    .replace(/[－ー―]/g, "-")
    .replace(/[　]/g, " ");
}

function toCleanNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

function buildNumericChoices(answer: string): string[] | null {
  if (/^-?\d+$/.test(answer)) {
    const num = Number(answer);
    return shuffle([String(num), String(num + 1), String(Math.max(0, num - 1))]);
  }

  const fraction = answer.match(/^(\d+)\/(\d+)$/);
  if (fraction) {
    const n = Number(fraction[1]);
    const d = Number(fraction[2]);
    return shuffle([`${n}/${d}`, `${n + 1}/${d}`, `${n}/${d + 1}`]);
  }

  const mixed = answer.match(/^(\d+)と(\d+)\/(\d+)$/);
  if (mixed) {
    const whole = Number(mixed[1]);
    const n = Number(mixed[2]);
    const d = Number(mixed[3]);
    return shuffle([`${whole}と${n}/${d}`, `${whole}と${n + 1}/${d}`, `${whole + 1}と${n}/${d}`]);
  }

  const decimal = answer.match(/^-?\d+\.\d+$/);
  if (decimal) {
    const num = Number(answer);
    return shuffle([toCleanNumber(num), toCleanNumber(num + 0.1), toCleanNumber(Math.max(0, num - 0.1))]);
  }

  return null;
}

function tokenize(line: string): string[] {
  return line
    .replace(/[()（）「」【】［］、。.,]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .slice(0, 20);
}

function normalizeText(raw: string): string {
  return raw.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function shuffle<T>(values: T[]): T[] {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
