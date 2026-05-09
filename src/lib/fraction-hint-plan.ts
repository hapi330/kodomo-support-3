import type { GeneratedQuestion } from "@/lib/storage";

export const FRACTION_HINT_PASS_POINTS = 1;

export type FractionHintPlan = {
  step1Explanation?: string;
  step1Prompt: string;
  step1Choices: string[];
  step1Correct: string;
  step2Explanation?: string;
  step2Formula: string;
  step2Prompt: string;
  step2Choices: string[];
  step2Correct: string;
  step3Explanation?: string;
  step3Prompt?: string;
  step3Choices?: string[];
  step3Correct?: string;
};

type Rational = { n: number; d: number };

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

function reduceFraction(raw: Rational): Rational {
  if (raw.d === 0) return raw;
  const sign = raw.d < 0 ? -1 : 1;
  const n = raw.n * sign;
  const d = Math.abs(raw.d);
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}

function lcm(a: number, b: number): number {
  return Math.abs(a * b) / gcd(a, b);
}

function parseRationalToken(token: string): Rational | null {
  const t = token.trim();
  const mixed = t.match(/^(-?\d+)\s+and\s+(\d+)\s*\/\s*(\d+)$/i);
  if (mixed) {
    const whole = Number(mixed[1]);
    const n = Number(mixed[2]);
    const d = Number(mixed[3]);
    if (!Number.isFinite(whole) || !Number.isFinite(n) || !Number.isFinite(d) || d === 0) return null;
    const sign = whole < 0 ? -1 : 1;
    const improper = Math.abs(whole) * d + n;
    return reduceFraction({ n: sign * improper, d });
  }
  const frac = t.match(/^(-?\d+)\s*\/\s*(\d+)$/);
  if (frac) {
    const n = Number(frac[1]);
    const d = Number(frac[2]);
    if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return null;
    return reduceFraction({ n, d });
  }
  if (/^-?\d+$/.test(t)) {
    const n = Number(t);
    return { n, d: 1 };
  }
  return null;
}

function extractFractionExpression(text: string): { left: string; op: "+" | "-"; right: string } | null {
  const m = text.match(
    /(-?\d+\s+and\s+\d+\s*\/\s*\d+|-?\d+\s*\/\s*\d+|-?\d+)\s*([+\-])\s*(-?\d+\s+and\s+\d+\s*\/\s*\d+|-?\d+\s*\/\s*\d+|-?\d+)/i
  );
  if (!m) return null;
  const op = m[2] === "-" ? "-" : "+";
  return { left: m[1].trim(), op, right: m[3].trim() };
}

function toEquivalentDisplay(token: string, den: number, lcdValue: number): { work: string; done: string } | null {
  const parsed = parseRationalToken(token);
  if (!parsed) return null;
  const k = lcdValue / den;
  const absN = Math.abs(parsed.n);
  const whole = Math.floor(absN / parsed.d);
  const rem = absN % parsed.d;
  const signPrefix = parsed.n < 0 ? "-" : "";
  if (whole > 0 && rem > 0) {
    return {
      work: `${signPrefix}${whole} and (${rem}*${k})/(${den}*${k})`,
      done: `${signPrefix}${whole} and ${(rem * k)}/${lcdValue}`,
    };
  }
  return {
    work: `(${parsed.n}*${k})/(${den}*${k})`,
    done: `${parsed.n * k}/${lcdValue}`,
  };
}

export function buildFractionHintPlan(q: GeneratedQuestion): FractionHintPlan | null {
  if (Array.isArray(q.hintSteps) && q.hintSteps.length >= 2) {
    const step1 = q.hintSteps[0];
    const step2 = q.hintSteps[1];
    const step3 = q.hintSteps[2];
    const s1Correct = step1.choices.find((c) => c.isCorrect)?.text?.trim();
    const s2Correct = step2.choices.find((c) => c.isCorrect)?.text?.trim();
    const s3Correct = step3?.choices.find((c) => c.isCorrect)?.text?.trim();
    const s1Choices = step1.choices.map((c) => c.text.trim()).filter(Boolean);
    const s2Choices = step2.choices.map((c) => c.text.trim()).filter(Boolean);
    const s3Choices = step3 ? step3.choices.map((c) => c.text.trim()).filter(Boolean) : undefined;
    if (s1Correct && s2Correct && s1Choices.length === 3 && s2Choices.length === 3) {
      const p1 = step1.prompt.trim();
      const e1 = step1.explanation?.trim() || "";
      const p2 = step2.prompt.trim();
      const e2 = step2.explanation?.trim() || "";
      const p3 = step3?.prompt?.trim() || "";
      const e3 = step3?.explanation?.trim() || "";
      const hasRichStep3 =
        Boolean(step3) && s3Choices && s3Choices.length === 3 && Boolean(s3Correct);
      return {
        step1Explanation: p1
          ? e1 || "ヒント1を見て、考え方を確認しよう。"
          : "ヒント1を見て、考え方を確認しよう。",
        step1Prompt: p1 || e1 || "ヒント1の問いに答えよう",
        step1Choices: s1Choices,
        step1Correct: s1Correct,
        step2Explanation: p2
          ? e2 || "ヒント2を見て、答えまでの手順を確認しよう。"
          : "ヒント2を見て、答えまでの手順を確認しよう。",
        step2Formula: p2 ? e2 : "",
        step2Prompt: p2 || e2 || "最後に答えを計算してみよう！",
        step2Choices: s2Choices,
        step2Correct: s2Correct,
        step3Explanation: hasRichStep3 && p3 && e3 ? e3 : undefined,
        step3Prompt: hasRichStep3 ? p3 || e3 || "ステップ3の問いに答えよう" : undefined,
        step3Choices: hasRichStep3 ? s3Choices : undefined,
        step3Correct: hasRichStep3 ? s3Correct : undefined,
      };
    }
  }

  const expr = extractFractionExpression(q.question);
  if (!expr) return null;
  const left = parseRationalToken(expr.left);
  const right = parseRationalToken(expr.right);
  if (!left || !right || left.d <= 1 || right.d <= 1) return null;
  const lcdValue = lcm(left.d, right.d);
  const leftEq = toEquivalentDisplay(expr.left, left.d, lcdValue);
  const rightEq = toEquivalentDisplay(expr.right, right.d, lcdValue);
  if (!leftEq || !rightEq) return null;

  const wrong1 = String(Math.max(Math.min(left.d, right.d), Math.floor(lcdValue / 2)));
  const wrong2 = String(lcdValue * 4);
  const step1Choices = Array.from(new Set([String(lcdValue), wrong1, wrong2])).slice(0, 3);
  while (step1Choices.length < 3) {
    step1Choices.push(String(lcdValue + step1Choices.length));
  }

  const step2Choices = Array.isArray(q.choices) ? [...q.choices] : [];
  if (!step2Choices.includes(q.answer)) step2Choices[0] = q.answer;

  return {
    step1Explanation: "分母が違うときは、まず最小公倍数（さいしょうこうばいすう）で分母をそろえます。",
    step1Prompt: `問題： ${left.d} と ${right.d} の最小公倍数はいくつかな？`,
    step1Choices: step1Choices.slice(0, 3),
    step1Correct: String(lcdValue),
    step2Explanation: "ステップ1で求めた最小公倍数を使って、通分して計算します。",
    step2Formula: `${leftEq.work} ${expr.op} ${rightEq.work} = ${leftEq.done} ${expr.op} ${rightEq.done}`,
    step2Prompt: "最後に答えを計算してみよう！",
    step2Choices: step2Choices.slice(0, 3),
    step2Correct: q.answer,
  };
}
