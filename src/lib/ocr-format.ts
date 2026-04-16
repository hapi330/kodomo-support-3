export type OcrLanguage = "日本語" | "中国語" | "英語" | "混合";
export type OcrGenre = "算数" | "国語" | "ニュース" | "専門書";

export interface OcrFlag {
  type: "low_confidence" | "math_symbol" | "kanji_variant";
  text: string;
  reason: string;
}

export interface OcrApiResponse {
  draftText: string;
  flags: Array<OcrFlag & { label: string }>;
  language: OcrLanguage;
  genre: OcrGenre;
  approvalMessage: string;
}

export type OcrWord = {
  text?: string;
  confidence?: number;
};

export type OcrWordsContainer = {
  words?: OcrWord[];
};

export const APPROVAL_MESSAGE =
  "上記内容で間違いがないか、修正が必要な箇所があれば教えてください";
export const LOW_CONFIDENCE_THRESHOLD = 65;
export const MAX_FLAG_TOKENS = 30;

const MATH_SYMBOL_PATTERN = /[+\-−－×xX÷/=＝≦≧<>∠△㎠㎡㎥]/;
const KANJI_VARIANT_PATTERN = /[国國学學体體円圓辺邊広廣]/;

export function normalizeDraftText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/([一-龠々ぁ-んァ-ンー])\s+(?=[一-龠々ぁ-んァ-ンー])/g, "$1")
    .replace(/(\d)\s*([./])\s*(\d)/g, "$1$2$3")
    .replace(/([（(])\s+/g, "$1")
    .replace(/\s+([）)])/g, "$1")
    .replace(/[|｜¦]/g, "1")
    .replace(/[０Oo○◯]/g, "0")
    .replace(/[①⑴]/g, "(1)")
    .replace(/[②⑵]/g, "(2)")
    .replace(/[③⑶]/g, "(3)")
    .replace(/[④⑷]/g, "(4)")
    .replace(/[⑤⑸]/g, "(5)")
    .replace(/[⑥⑹]/g, "(6)")
    .replace(/[⑦⑺]/g, "(7)")
    .replace(/[⑧⑻]/g, "(8)")
    .replace(/[⑨⑼]/g, "(9)")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function detectLanguage(text: string): OcrLanguage {
  const hasKana = /[\u3040-\u30ff]/.test(text);
  const hasCjk = /[\u4e00-\u9fff]/.test(text);
  const hasLatin = /[A-Za-z]/.test(text);

  if (hasKana && hasCjk) return "日本語";
  if (!hasKana && hasCjk && !hasLatin) return "中国語";
  if (hasLatin && !hasCjk) return "英語";
  return "混合";
}

export function detectGenre(text: string): OcrGenre {
  if (/(問|計算|分数|小数|図形|角度|㎠|㎡|㎥|÷|×|＝)/.test(text)) return "算数";
  if (/(漢字|読解|ことば|文法|国語|慣用句)/.test(text)) return "国語";
  if (/(速報|記者|ニュース|社会面|政治|経済)/.test(text)) return "ニュース";
  return "専門書";
}

export function buildFlags(
  text: string,
  lowConfidenceTokens: string[]
): OcrFlag[] {
  const flags: OcrFlag[] = [];

  for (const token of lowConfidenceTokens) {
    if (!token) continue;
    flags.push({
      type: "low_confidence",
      text: token,
      reason: "OCR信頼度が低いため要確認",
    });
  }

  const lines = text.split("\n");
  for (const line of lines) {
    if (MATH_SYMBOL_PATTERN.test(line)) {
      flags.push({
        type: "math_symbol",
        text: line.slice(0, 120),
        reason: "算数記号を含むため、全角/半角や記号種別を要確認",
      });
    }
    if (KANJI_VARIANT_PATTERN.test(line)) {
      flags.push({
        type: "kanji_variant",
        text: line.slice(0, 120),
        reason: "漢字バリアントが含まれるため、原文との差異を要確認",
      });
    }
  }

  return dedupeFlags(flags);
}

export function extractLowConfidenceTokens(
  words: OcrWord[] = [],
  threshold = LOW_CONFIDENCE_THRESHOLD,
  maxTokens = MAX_FLAG_TOKENS
): string[] {
  return words
    .filter((word) => typeof word.confidence === "number" && word.confidence < threshold)
    .map((word) => (word.text ?? "").trim())
    .filter(Boolean)
    .slice(0, maxTokens);
}

export function buildLabeledFlags(
  text: string,
  lowConfidenceTokens: string[]
): Array<OcrFlag & { label: string }> {
  return buildFlags(text, lowConfidenceTokens).map((flag) => ({
    ...flag,
    label: `[要確認] ${flag.text} (${flag.reason})`,
  }));
}

export function toFinalOutput(params: {
  finalText: string;
  language: OcrLanguage;
  genre: OcrGenre;
  userEdited: boolean;
}): string {
  const { finalText, language, genre, userEdited } = params;
  return [
    "# 最終確定テキスト（他AI引き継ぎ用）",
    finalText,
    "",
    "# データ属性",
    `- 言語：${language}`,
    `- ジャンル：${genre}`,
    `- ユーザー修正：${userEdited ? "あり" : "なし"}`,
  ].join("\n");
}

function dedupeFlags(flags: OcrFlag[]): OcrFlag[] {
  const seen = new Set<string>();
  return flags.filter((flag) => {
    const key = `${flag.type}:${flag.text}:${flag.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
