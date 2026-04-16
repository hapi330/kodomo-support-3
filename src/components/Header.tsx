"use client";
import { useEffect, useState } from "react";
import { calcLevel, xpForCurrentLevel, xpForNextLevel } from "@/lib/storage";

interface HeaderProps {
  totalXP: number;
  childName: string;
  streak: number;
}

export default function Header({ totalXP, childName, streak }: HeaderProps) {
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

  const pad = (n: number) => String(n).padStart(2, "0");
  const timeStr = time
    ? `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`
    : "--:--:--";
  const dateStr = time
    ? `${time.getFullYear()}/${pad(time.getMonth() + 1)}/${pad(time.getDate())}`
    : "----/--/--";

  const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
  const dayStr = time ? `(${dayNames[time.getDay()]})` : "";

  return (
    <header
      className="sticky top-0 z-50 px-4 py-3"
      style={{
        background: "linear-gradient(180deg, #1E3A14 0%, #2D2D44 100%)",
        borderBottom: "3px solid #4A8A1A",
        boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
      }}
    >
      <div className="max-w-6xl mx-auto flex flex-col gap-2">
        {/* Top row */}
        <div className="flex items-center justify-between gap-4">
          {/* Title */}
          <div className="flex items-center gap-3">
            <span className="text-3xl animate-float">🌿</span>
            <div>
              <h1
                className="font-black text-xl leading-tight"
                style={{ color: "#7DC53D", textShadow: "1px 2px 0 rgba(0,0,0,0.6)" }}
              >
                こどもサポート
              </h1>
              <p className="text-xs" style={{ color: "#A0C878" }}>
                {childName}くんの冒険の書
              </p>
            </div>
          </div>

          {/* Clock */}
          <div
            className="text-center px-4 py-2 rounded"
            style={{ background: "#0D0D1A", border: "2px solid #4A4A6A" }}
          >
            <div
              className="pixel-font text-2xl font-bold tracking-widest"
              style={{ color: "#7FFF00", textShadow: "0 0 10px rgba(127,255,0,0.5)" }}
              suppressHydrationWarning
            >
              {timeStr}
            </div>
            <div className="text-xs" style={{ color: "#A0C878" }} suppressHydrationWarning>
              {dateStr} {dayStr}
            </div>
          </div>

          {/* Streak & XP summary */}
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-2 px-3 py-2 rounded"
              style={{ background: "#0D0D1A", border: "2px solid #D97706" }}
            >
              <span className="text-xl">🔥</span>
              <div>
                <div className="pixel-font text-lg font-bold" style={{ color: "#FCD34D" }}>
                  {streak}
                </div>
                <div className="text-xs" style={{ color: "#9CA3AF" }}>れんぞく</div>
              </div>
            </div>
            <div
              className="flex items-center gap-2 px-3 py-2 rounded"
              style={{ background: "#0D0D1A", border: "2px solid #17DD62" }}
            >
              <span className="text-xl">⭐</span>
              <div>
                <div className="pixel-font text-lg font-bold" style={{ color: "#6EE7B7" }}>
                  {totalXP.toLocaleString()}
                </div>
                <div className="text-xs" style={{ color: "#9CA3AF" }}>けいけんち</div>
              </div>
            </div>
          </div>
        </div>

        {/* XP Bar */}
        <div className="flex items-center gap-3">
          <span
            className="text-sm font-black px-2 py-1 rounded"
            style={{ background: "#17DD62", color: "#0D1A0D", minWidth: "64px", textAlign: "center" }}
          >
            Lv.{level}
          </span>
          <div className="xp-bar-outer flex-1">
            <div className="xp-bar-inner" style={{ width: `${xpPct}%` }} />
          </div>
          <span className="text-xs pixel-font" style={{ color: "#7FFF00", minWidth: "80px", textAlign: "right" }}>
            {xpProgress}/{xpNeeded} XP
          </span>
        </div>
      </div>
    </header>
  );
}
