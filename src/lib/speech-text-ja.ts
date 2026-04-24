/**
 * Web Speech API（ja-JP）が「1/2」を日付（一月二日）のように読むのを避け、
 * 分数として「にぶんのいち」のように読ませる。
 */

const ONES = ["", "いち", "に", "さん", "よん", "ご", "ろく", "なな", "はち", "きゅう"] as const;

function under100(n: number): string {
  if (n < 10) return ONES[n];
  if (n === 10) return "じゅう";
  if (n < 20) return "じゅう" + (n % 10 ? ONES[n % 10] : "");
  const tens = Math.floor(n / 10);
  const o = n % 10;
  const tensNames = ["", "", "に", "さん", "よん", "ご", "ろく", "なな", "はち", "きゅう"];
  return tensNames[tens] + "じゅう" + (o ? ONES[o] : "");
}

function hundredsBlock(h: number): string {
  const map: Record<number, string> = {
    1: "ひゃく",
    2: "にひゃく",
    3: "さんびゃく",
    4: "よんひゃく",
    5: "ごひゃく",
    6: "ろっぴゃく",
    7: "ななひゃく",
    8: "はっぴゃく",
    9: "きゅうひゃく",
  };
  return map[h] ?? "";
}

function thousandsBlock(t: number): string {
  const map: Record<number, string> = {
    1: "せん",
    2: "にせん",
    3: "さんぜん",
    4: "よんせん",
    5: "ごせん",
    6: "ろくせん",
    7: "ななせん",
    8: "はっせん",
    9: "きゅうせん",
  };
  return map[t] ?? "";
}

/** 1〜9999 をひらがな（分数の分子・分母用）。範囲外は数字列のまま。 */
function intToHiraganaForFraction(n: number): string {
  if (!Number.isInteger(n) || n < 1) return String(n);
  if (n < 100) return under100(n);
  if (n < 1000) {
    const h = Math.floor(n / 100);
    const rest = n % 100;
    return hundredsBlock(h) + (rest ? under100(rest) : "");
  }
  if (n < 10000) {
    const t = Math.floor(n / 1000);
    const rest = n % 1000;
    return thousandsBlock(t) + (rest ? intToHiraganaForFraction(rest) : "");
  }
  return String(n);
}

const DATE_LIKE = /\d{4}\/\d{1,2}\/\d{1,2}/g;

function replaceFractionSlashesInSegment(segment: string): string {
  return segment.replace(/(-?)(\d+)\s*\/\s*(\d+)/g, (full, sign, a, b) => {
    const num = parseInt(a, 10);
    const den = parseInt(b, 10);
    if (den === 0) return full;
    const neg = sign === "-" ? "マイナス" : "";
    const spoken = `${intToHiraganaForFraction(den)}ぶんの${intToHiraganaForFraction(num)}`;
    return neg + spoken;
  });
}

/**
 * 日付っぽい `YYYY/M/D` はそのまま残し、それ以外の `a/b` を分数の読みに置き換える。
 */
export function prepareJapaneseSpeechText(text: string): string {
  let lastIndex = 0;
  let out = "";
  DATE_LIKE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = DATE_LIKE.exec(text)) !== null) {
    out += replaceFractionSlashesInSegment(text.slice(lastIndex, m.index));
    out += m[0];
    lastIndex = m.index + m[0].length;
  }
  out += replaceFractionSlashesInSegment(text.slice(lastIndex));
  return out;
}
