import React from "react";

/**
 * テキスト内の分数（X/Y や NとX/Y）を教科書風の縦積み形式でレンダリングする。
 *
 * 例:
 *   "5/6"     → ⁵⁄₆ 形式のスタック表示
 *   "3と5/6"  → 3と⁵⁄₆ 形式のスタック表示（帯分数）
 *
 * furigana / 読み上げ用データは別途 questionFurigana フィールドで管理する。
 */

function Fraction({ num, den }: { num: string; den: string }) {
  return (
    <span
      className="inline-flex flex-col items-center font-bold"
      style={{
        verticalAlign: "middle",
        fontSize: "0.82em",
        lineHeight: 1.1,
        margin: "0 3px",
      }}
    >
      <span
        style={{
          borderBottom: "2px solid currentColor",
          minWidth: "1.4em",
          textAlign: "center",
          paddingBottom: "1px",
        }}
      >
        {num}
      </span>
      <span
        style={{
          minWidth: "1.4em",
          textAlign: "center",
          paddingTop: "1px",
        }}
      >
        {den}
      </span>
    </span>
  );
}

const FRACTION_TOKEN_RE = /(\d+と\d+\/\d+|\d+\/\d+)/g;

interface FractionTextProps {
  text: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function FractionText({ text, className, style }: FractionTextProps) {
  const nodes: React.ReactNode[] = [];
  let last = 0;

  for (const m of text.matchAll(FRACTION_TOKEN_RE)) {
    const token = m[0];
    const idx = m.index ?? 0;
    if (idx > last) nodes.push(text.slice(last, idx));

    const mixed = token.match(/^(\d+)と(\d+)\/(\d+)$/);
    if (mixed) {
      nodes.push(
        <React.Fragment key={idx}>
          {mixed[1]}と
          <Fraction num={mixed[2]} den={mixed[3]} />
        </React.Fragment>
      );
    } else {
      const [num, den] = token.split("/");
      nodes.push(<Fraction key={idx} num={num} den={den} />);
    }

    last = idx + token.length;
  }

  if (last < text.length) nodes.push(text.slice(last));

  return (
    <span className={className} style={style}>
      {nodes}
    </span>
  );
}
