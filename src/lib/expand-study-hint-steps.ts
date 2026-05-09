import { padHints } from "@/lib/question-draft";
import type { GeneratedQuestion } from "@/lib/storage";

/**
 * 教材由来で「1.… 2.… 3.…」が1ヒントにまとまっている場合に分割する。
 * 図式問題などで段階ヒント（ヒント1→2→3）として順に見せるため。
 *
 * 小数「2.5」などを誤分割しないよう、`n.` の直後が数字で始まる場合は分割しない。
 */
const COMPOSITE_HINT_SPLIT = /\s+(?=[123１２３][\.．])(?!\s*\d)/u;

export function splitCompositeNumberedHint(text: string): string[] {
  const t = text.trim();
  if (!t) return [];
  const parts = t.split(COMPOSITE_HINT_SPLIT).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return parts;
  return [t];
}

export function flattenHintsForQuiz(hints: string[]): string[] {
  const out: string[] = [];
  for (const h of hints) {
    const trimmed = String(h).trim();
    if (!trimmed) continue;
    out.push(...splitCompositeNumberedHint(trimmed));
  }
  return out;
}

/** クイズ画面の「💡 とき方ステップ」用に、重複除去済みのヒント列を返す */
export function buildQuizHintSteps(q: GeneratedQuestion): string[] {
  const padded = padHints(q.hints ?? []).map((h) => String(h).trim()).filter(Boolean);
  const expanded = flattenHintsForQuiz(padded);
  const seen = new Set<string>();
  return expanded.filter((step) => {
    const key = step.toLowerCase().replace(/\s+/g, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
