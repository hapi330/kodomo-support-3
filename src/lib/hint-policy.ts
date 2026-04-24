export const DEFAULT_SAFE_HINT = "問題文の条件を整理して、使う考え方を決めよう。";

/**
 * ヒントを学習用に正規化する。
 * - 空文字を除外
 * - 重複を除外
 * - 最終答えの文字列を含むヒントを除外
 * - 1〜maxCount 件に制限
 * - 0件になった場合は安全なフォールバックを1件返す
 */
export function sanitizeHintsForStudy(
  hints: string[],
  answer: string,
  options?: { maxCount?: number; fallbackHint?: string; allowZeroHints?: boolean }
): string[] {
  const maxCount = options?.maxCount ?? 3;
  const fallbackHint = options?.fallbackHint ?? DEFAULT_SAFE_HINT;
  const allowZeroHints = options?.allowZeroHints ?? false;
  const answerLower = String(answer).trim().toLowerCase();
  const uniq = new Set<string>();
  const normalizedUniq = new Set<string>();
  const normalizeHintForDedup = (hint: string): string =>
    hint
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[。．.!！?？、,]/g, "");
  const cleaned = hints
    .map((h) => String(h ?? "").trim())
    .filter(Boolean)
    .filter((h) => !answerLower || !h.toLowerCase().includes(answerLower))
    .filter((h) => {
      const normalized = normalizeHintForDedup(h);
      if (uniq.has(h) || normalizedUniq.has(normalized)) return false;
      uniq.add(h);
      normalizedUniq.add(normalized);
      return true;
    })
    .slice(0, maxCount);

  if (cleaned.length > 0) return cleaned;
  if (allowZeroHints) return [];
  return [fallbackHint];
}
