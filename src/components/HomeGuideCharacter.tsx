"use client";

import { useEffect, useMemo, useState } from "react";
import type { AppState } from "@/lib/storage";
import { buildHomeGuideComment } from "@/lib/home-guide-messages";

type HomeGuideCharacterProps = {
  state: AppState;
};

/** マイクラ風・簡易ブロック人（SVG ピクセル） */
function McBlockGuide() {
  return (
    <svg
      viewBox="0 0 8 12"
      className="w-20 h-28 sm:w-24 sm:h-32 shrink-0 drop-shadow-[4px_6px_0_rgba(0,0,0,0.45)]"
      style={{ imageRendering: "pixelated" }}
      aria-hidden
    >
      <title>ガイド</title>
      {/* hair */}
      <rect x="2" y="0" width="4" height="1" fill="#3d2b1f" />
      {/* face */}
      <rect x="2" y="1" width="4" height="3" fill="#c9a063" />
      {/* eyes */}
      <rect x="2" y="2" width="1" height="1" fill="#1e293b" />
      <rect x="5" y="2" width="1" height="1" fill="#1e293b" />
      {/* mouth */}
      <rect x="3" y="3" width="2" height="1" fill="#7c2d12" />
      {/* shirt */}
      <rect x="1" y="4" width="6" height="4" fill="#2563eb" />
      <rect x="1" y="4" width="1" height="1" fill="#1d4ed8" />
      <rect x="6" y="4" width="1" height="1" fill="#1d4ed8" />
      {/* arms */}
      <rect x="0" y="5" width="1" height="2" fill="#c9a063" />
      <rect x="7" y="5" width="1" height="2" fill="#c9a063" />
      {/* pants */}
      <rect x="2" y="8" width="4" height="3" fill="#1e3a8a" />
      {/* legs gap */}
      <rect x="3" y="10" width="1" height="2" fill="#0f172a" />
      <rect x="4" y="10" width="1" height="2" fill="#0f172a" />
    </svg>
  );
}

export default function HomeGuideCharacter({ state }: HomeGuideCharacterProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const totalStudyQuestions = useMemo(
    () => state.uploadedContent.reduce((s, c) => s + c.questions.length, 0),
    [state.uploadedContent]
  );

  const comment = useMemo(
    () =>
      buildHomeGuideComment({
        now,
        childName: state.settings.childName,
        totalXP: state.totalXP,
        streak: state.streak,
        studyRecords: state.studyRecords,
        calendarEvents: state.calendarEvents,
        chores: state.chores,
        rewardPromiseSealedAt: state.settings.rewardPromiseSealedAt,
        totalStudyQuestions,
      }),
    [
      now,
      state.settings.childName,
      state.settings.rewardPromiseSealedAt,
      state.totalXP,
      state.streak,
      state.studyRecords,
      state.calendarEvents,
      state.chores,
      totalStudyQuestions,
    ]
  );

  return (
    <div
      className="mc-panel p-3 sm:p-4 overflow-hidden"
      style={{
        background: "linear-gradient(145deg, #0f172a 0%, #1e293b 50%, #14532d 100%)",
        border: "3px solid #5D9E2F",
      }}
    >
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-end">
        <div className="flex-1 min-w-0 order-2 sm:order-1">
          <div
            className="relative rounded-xl px-3 py-2.5 sm:px-4 sm:py-3"
            style={{
              background: "#fefce8",
              border: "4px solid #1e293b",
              boxShadow: "inset 0 -4px 0 #d4d4d8",
            }}
          >
            <p
              className="relative text-sm sm:text-[15px] leading-snug sm:leading-relaxed whitespace-pre-line font-bold pixel-font"
              style={{ color: "#0f172a" }}
              aria-live="polite"
            >
              {comment}
            </p>
          </div>
          <p className="text-[10px] mt-1.5 text-center sm:text-left" style={{ color: "#86EFAC" }}>
            時刻・経験値・予定・記録に合わせてコメントが変わるよ（漢字の練習にも！）
          </p>
        </div>
        <div className="flex justify-center sm:justify-end order-1 sm:order-2 shrink-0">
          <McBlockGuide />
        </div>
      </div>
    </div>
  );
}
