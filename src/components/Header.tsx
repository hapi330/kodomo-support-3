"use client";
import { useEffect, useState } from "react";
import { calcLevel, xpForCurrentLevel, xpForNextLevel } from "@/lib/storage";
import { TARGET_REWARD_MILESTONE_XP } from "@/lib/xp-economy";

export type StudyCycleTimer = {
  /** 現在の BGM サイクル内の残り秒（9/12/15 分ルーレット） */
  remainingSec: number;
  cycleMin: 3 | 8 | 10 | 12;
};

interface HeaderProps {
  totalXP: number;
  childName: string;
  streak: number;
  /** 勉強セッション中のみ：現時刻の横に「勉強時間」カウントダウンを表示 */
  studyCycleTimer?: StudyCycleTimer | null;
}

export default function Header({ totalXP, childName, streak, studyCycleTimer = null }: HeaderProps) {
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const level = calcLevel(totalXP);
  const levelStart = xpForCurrentLevel(level);
  const levelEnd = xpForNextLevel(level);
  const xpProgress = totalXP - levelStart;
  const xpNeeded = levelEnd - levelStart;
  const xpPct = Math.min(100, Math.round((xpProgress / xpNeeded) * 100));

  const rewardRemaining =
    totalXP < TARGET_REWARD_MILESTONE_XP ? TARGET_REWARD_MILESTONE_XP - totalXP : 0;
  const rewardPct = Math.min(
    100,
    Math.round((Math.min(totalXP, TARGET_REWARD_MILESTONE_XP) / TARGET_REWARD_MILESTONE_XP) * 100)
  );

  const pad = (n: number) => String(n).padStart(2, "0");
  const timeStr = time
    ? `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`
    : "--:--:--";
  const dateStr = time
    ? `${time.getFullYear()}/${pad(time.getMonth() + 1)}/${pad(time.getDate())}`
    : "----/--/--";

  const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
  const dayStr = time ? `(${dayNames[time.getDay()]})` : "";

  const fmtCycle = (sec: number) => {
    const s = Math.max(0, Math.floor(sec));
    return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
  };

  return (
    <header
      className="sticky top-0 z-50 shrink-0 px-3 sm:px-6 lg:px-10 py-2 sm:py-2.5 pt-[max(0.5rem,env(safe-area-inset-top,0px))]"
      style={{
        background: "linear-gradient(180deg, #1E3A14 0%, #2D2D44 100%)",
        borderBottom: "3px solid #4A8A1A",
        boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
      }}
    >
      <div className="max-w-6xl lg:max-w-7xl mx-auto flex flex-col gap-1.5">
        {/* Top row */}
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          {/* Title */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <span className="text-2xl sm:text-3xl shrink-0 animate-float">🌿</span>
            <div className="min-w-0">
              <h1
                className="font-black text-lg sm:text-xl leading-tight truncate"
                style={{ color: "#7DC53D", textShadow: "1px 2px 0 rgba(0,0,0,0.6)" }}
              >
                こどもサポート
              </h1>
              <p className="text-[11px] sm:text-xs truncate" style={{ color: "#A0C878" }}>
                {childName}くんの冒険の書
              </p>
            </div>
          </div>

          {/* Clock */}
          <div
            className="text-center px-2.5 sm:px-4 py-1.5 sm:py-2 rounded shrink-0"
            style={{ background: "#0D0D1A", border: "2px solid #4A4A6A" }}
          >
            <div
              className="pixel-font text-xl sm:text-2xl font-bold tracking-widest"
              style={{ color: "#7FFF00", textShadow: "0 0 10px rgba(127,255,0,0.5)" }}
              suppressHydrationWarning
            >
              {timeStr}
            </div>
            <div className="text-[10px] sm:text-xs leading-tight" style={{ color: "#A0C878" }} suppressHydrationWarning>
              {dateStr} {dayStr}
            </div>
          </div>

          {studyCycleTimer && (
            <div
              className="text-center px-2.5 sm:px-4 py-1.5 rounded shrink-0"
              style={{ background: "#0D1A14", border: "2px solid #17DD62" }}
            >
              <div className="text-[10px] sm:text-xs font-bold" style={{ color: "#86EFAC" }}>
                勉強時間
              </div>
              <div
                className="pixel-font text-xl sm:text-2xl font-bold tracking-widest"
                style={{ color: "#6EE7B7", textShadow: "0 0 8px rgba(110,231,183,0.45)" }}
                suppressHydrationWarning
              >
                {fmtCycle(studyCycleTimer.remainingSec)}
              </div>
              <div className="text-[9px] sm:text-[10px]" style={{ color: "#6B7280" }}>
                {studyCycleTimer.cycleMin}分サイクル
              </div>
            </div>
          )}

          {/* Streak & XP summary */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <div
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded"
              style={{ background: "#0D0D1A", border: "2px solid #D97706" }}
            >
              <span className="text-lg sm:text-xl">🔥</span>
              <div>
                <div className="pixel-font text-base sm:text-lg font-bold leading-none" style={{ color: "#FCD34D" }}>
                  {streak}
                </div>
                <div className="text-[10px] sm:text-xs leading-none" style={{ color: "#9CA3AF" }}>れんぞく</div>
              </div>
            </div>
            <div
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded"
              style={{ background: "#0D0D1A", border: "2px solid #17DD62" }}
            >
              <span className="text-lg sm:text-xl">⭐</span>
              <div>
                <div className="pixel-font text-base sm:text-lg font-bold leading-none tabular-nums" style={{ color: "#6EE7B7" }}>
                  {totalXP.toLocaleString()}
                </div>
                <div className="text-[10px] sm:text-xs leading-none" style={{ color: "#9CA3AF" }}>けいけんち</div>
              </div>
            </div>
          </div>
        </div>

        {/* XP Bar */}
        <div className="flex items-center gap-2 sm:gap-3">
          <span
            className="text-xs sm:text-sm font-black px-1.5 sm:px-2 py-0.5 rounded shrink-0"
            style={{ background: "#17DD62", color: "#0D1A0D", minWidth: "52px", textAlign: "center" }}
          >
            Lv.{level}
          </span>
          <div className="xp-bar-outer flex-1 min-w-0">
            <div className="xp-bar-inner" style={{ width: `${xpPct}%` }} />
          </div>
          <span className="text-[10px] sm:text-xs pixel-font shrink-0" style={{ color: "#7FFF00", minWidth: "72px", textAlign: "right" }}>
            {xpProgress}/{xpNeeded} XP
          </span>
        </div>

        {rewardRemaining > 0 && (
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between text-[10px] sm:text-xs" style={{ color: "#E9D5FF" }}>
              <span>🎁 ご褒美まで（{TARGET_REWARD_MILESTONE_XP.toLocaleString()} XP）</span>
              <span className="pixel-font" style={{ color: "#F0ABFC" }}>
                あと {rewardRemaining.toLocaleString()} XP
              </span>
            </div>
            <div
              className="xp-bar-outer flex-1 h-2 rounded-full overflow-hidden"
              style={{ borderColor: "#7C3AED", background: "#1e1033" }}
            >
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{
                  width: `${rewardPct}%`,
                  background: "linear-gradient(90deg, #A78BFA, #E879F9)",
                }}
              />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
