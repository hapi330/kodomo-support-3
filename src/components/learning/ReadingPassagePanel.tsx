"use client";

import { useCallback, useMemo } from "react";
import FractionText from "@/components/FractionText";
import { speak } from "@/lib/sounds";
import type { GeneratedQuestion } from "@/lib/storage";

type Block = { label: string; text: string };

function blocksFromQuestion(q: GeneratedQuestion): Block[] {
  const raw = q.readingBlocks?.filter((b) => String(b.text ?? "").trim()) ?? [];
  if (raw.length > 0) {
    return raw.map((b) => ({
      label: (b.label ?? "パート").trim() || "パート",
      text: String(b.text).trim(),
    }));
  }
  if (q.readingPassage?.trim()) {
    return [{ label: "本文", text: q.readingPassage.trim() }];
  }
  return [];
}

export default function ReadingPassagePanel({
  q,
  speechEnabled,
}: {
  q: GeneratedQuestion;
  speechEnabled: boolean;
}) {
  const blocks = useMemo(() => blocksFromQuestion(q), [q]);

  const fullTextForSelection = useMemo(() => blocks.map((b) => b.text).join("\n\n"), [blocks]);

  const readAloud = useCallback(
    (text: string) => {
      if (!speechEnabled || !text.trim()) return;
      speak(text);
    },
    [speechEnabled]
  );

  const readSelection = useCallback(() => {
    const sel = window.getSelection();
    const t = sel?.toString().trim() ?? "";
    if (!t) return;
    readAloud(t);
  }, [readAloud]);

  if (blocks.length === 0) return null;

  return (
    <div className="mb-5 pb-4 border-b border-white/15 space-y-3" role="region" aria-label="読解本文">
      <div className="text-sm sm:text-base font-black tracking-wide" style={{ color: "#93C5FD" }}>
        📖 本文・資料
      </div>
      {blocks.map((b, i) => (
        <div
          key={i}
          className="rounded-lg p-3 sm:p-4"
          style={{ background: "#111827", border: "2px solid #374151" }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="text-sm sm:text-base font-bold" style={{ color: "#A5B4FC" }}>
              {b.label}
            </span>
            {speechEnabled && (
              <button
                type="button"
                className="mc-btn mc-btn-blue text-xs sm:text-sm px-3 py-1.5 shrink-0"
                onClick={() => readAloud(b.text)}
              >
                🔊 このパートを読む
              </button>
            )}
          </div>
          <div className="text-base sm:text-lg md:text-xl leading-relaxed" style={{ color: "#E5E7EB" }}>
            {b.text.split("\n").map((line, li) => (
              <span key={li}>
                {li > 0 && <br />}
                <FractionText text={line} />
              </span>
            ))}
          </div>
        </div>
      ))}
      {speechEnabled && fullTextForSelection.length > 0 && (
        <div className="rounded-lg p-3 sm:p-4" style={{ background: "#0C1220", border: "2px dashed #4B5563" }}>
          <p className="text-xs sm:text-sm mb-2 leading-relaxed" style={{ color: "#9CA3AF" }}>
            下の文字をドラッグして選び、「選択した部分を読む」でその範囲だけ読み上げます。
          </p>
          <div
            className="text-base sm:text-lg leading-relaxed cursor-text select-text max-h-[min(50vh,20rem)] overflow-y-auto p-3 rounded"
            style={{ background: "#1A1A2E", color: "#F3F4F6" }}
          >
            {fullTextForSelection.split("\n").map((line, li) => (
              <span key={li}>
                {li > 0 && <br />}
                <FractionText text={line} />
              </span>
            ))}
          </div>
          <button
            type="button"
            className="mt-3 mc-btn mc-btn-gray text-sm px-4 py-2.5 w-full sm:w-auto"
            onClick={readSelection}
          >
            🎯 選択した部分を読む
          </button>
        </div>
      )}
    </div>
  );
}
