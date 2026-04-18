/**
 * 問題生成・差し込み補完で共通する Claude 応答の整形・三択処理
 */

function shuffleInPlace<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function normalizeSubjectLabel(subject: string): string {
  const s = subject.trim();
  if (/国語|こくご/i.test(s)) return "国語";
  if (/算数|数学|さんすう/i.test(s)) return "算数";
  if (/理科|りか/i.test(s)) return "理科";
  if (/社会|しゃかい/i.test(s)) return "社会";
  if (/英語|えいご|外国語|がいこくご/i.test(s)) return "英語";
  return s || "その他";
}

/** テキスト内の最初の `{`〜最後の `}` を抜き出す */
export function extractJsonObject(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return text.slice(start, end + 1);
  }
  return text;
}

/** フェンス付き応答を想定し、先頭の JSON オブジェクトをパース */
export function parseLeadingJsonObject<T>(raw: string): T {
  const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const jsonStr = extractJsonObject(stripped);
  return JSON.parse(jsonStr) as T;
}

/** 正解文字列と選択肢の表記ゆれ（全角半角・空白）を吸収して一致する要素を返す */
export function resolveAnswerInChoices(answer: string, choicesIn: string[]): string | null {
  if (choicesIn.includes(answer)) return answer;
  const norm = (s: string) => s.normalize("NFKC").replace(/\s+/g, "");
  const a = norm(answer);
  const byNorm = choicesIn.find((c) => norm(c) === a);
  if (byNorm !== undefined) return byNorm;
  const compact = answer.replace(/\s+/g, "");
  const byCompact = choicesIn.find((c) => c.replace(/\s+/g, "") === compact);
  return byCompact ?? null;
}

/**
 * AI が返した三択にユーザーの正解文字列が含まれないとき、正解をそのまま1枠に入れて3つユニークにそろえる。
 * （表記ゆれで resolve に失敗し、補完全体がスキップされるのを防ぐ）
 */
export function ensureThreeUniqueChoicesContainingAnswer(
  answer: string,
  suggested: string[]
): string[] {
  const a = answer.trim();
  const raw = suggested.map((s) => String(s).trim());
  if (
    raw.length === 3 &&
    new Set(raw).size === 3 &&
    resolveAnswerInChoices(a, raw) !== null
  ) {
    return raw;
  }

  const pool = suggested.map((s) => String(s).trim()).filter((s) => s.length > 0);
  const out: string[] = [a];
  const used = new Set<string>([a]);
  for (const c of pool) {
    if (out.length >= 3) break;
    if (used.has(c)) continue;
    if (resolveAnswerInChoices(a, [c]) !== null) continue;
    out.push(c);
    used.add(c);
  }
  let n = 0;
  while (out.length < 3) {
    const filler = `ちがうこたえ${++n}`;
    if (!used.has(filler)) {
      out.push(filler);
      used.add(filler);
    }
  }
  return out.slice(0, 3);
}

export function shuffleChoices(
  answer: string,
  choices: string[]
): { choices: string[]; correctIndex: number } {
  let idx = choices.findIndex((c) => c === answer);
  if (idx < 0) {
    idx = choices.findIndex(
      (c) => c.replace(/\s+/g, "") === answer.replace(/\s+/g, "")
    );
  }
  if (idx < 0) {
    idx = 0;
  }
  const correct = choices[idx];
  const shuffled = shuffleInPlace([...choices]);
  const correctIndex = shuffled.indexOf(correct);
  return {
    choices: shuffled,
    correctIndex: correctIndex >= 0 ? correctIndex : 0,
  };
}

export function optionalFurigana(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s.length > 0 ? s : undefined;
}
