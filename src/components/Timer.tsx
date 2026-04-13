"use client";
/* eslint-disable react-hooks/purity -- タイマーはユーザー操作・interval 内で壁時計を参照する */
import { useEffect, useRef, useState } from "react";
import { playHomeworkAlert, playLevelUp, speak } from "@/lib/sounds";

interface TimerProps {
  childName: string;
  soundEnabled: boolean;
  speechEnabled: boolean;
  /** べんきょう計測開始時（任意） */
  onStudyStart?: () => void;
}

type Phase = "idle" | "countdown" | "studying";

export default function Timer({
  childName,
  soundEnabled,
  speechEnabled,
  onStudyStart = () => {},
}: TimerProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [countdownMins, setCountdownMins] = useState(10);
  const [remainSec, setRemainSec] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [praiseMsg, setPraiseMsg] = useState("");
  const [showAlert, setShowAlert] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef<number>(0);

  const clearTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const startCountdown = () => {
    clearTimer();
    const totalSec = countdownMins * 60;
    setRemainSec(totalSec);
    setPhase("countdown");
    const end = Date.now() + totalSec * 1000;
    intervalRef.current = setInterval(() => {
      const left = Math.ceil((end - Date.now()) / 1000);
      if (left <= 0) {
        clearTimer();
        setRemainSec(0);
        setShowAlert(true);
        if (soundEnabled) playHomeworkAlert();
        if (speechEnabled) {
          setTimeout(() => speak(`${childName}くん、そろそろ宿題を始めよう！`), 800);
        }
        // Auto start studying after alert
        setTimeout(() => {
          setShowAlert(false);
          beginStudy();
        }, 4000);
      } else {
        setRemainSec(left);
      }
    }, 500);
  };

  const beginStudy = () => {
    clearTimer();
    setPhase("studying");
    setElapsedSec(0);
    startRef.current = Date.now();
    onStudyStart();
    intervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startRef.current) / 1000);
      setElapsedSec(elapsed);
      // Praise every 5 minutes
      if (elapsed > 0 && elapsed % 300 === 0) {
        const msgs = [
          "すごい！5分たったよ！がんばってるね！",
          "10分！クリーパーもびっくり！",
          "15分達成！ダイヤモンドプレイヤーだ！",
          "20分！信じられない！ヒーローだ！",
          "25分！マスタービルダーに認定！",
        ];
        const idx = Math.floor(elapsed / 300) - 1;
        const msg = msgs[idx % msgs.length];
        setPraiseMsg(msg);
        if (soundEnabled) playLevelUp();
        if (speechEnabled) speak(msg);
        setTimeout(() => setPraiseMsg(""), 4000);
      }
    }, 1000);
  };

  const stopTimer = () => {
    clearTimer();
    setPhase("idle");
    setElapsedSec(0);
    setRemainSec(0);
  };

  useEffect(() => () => clearTimer(), []);

  const fmt = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const pct = phase === "countdown"
    ? Math.round(((countdownMins * 60 - remainSec) / (countdownMins * 60)) * 100)
    : 0;

  return (
    <div className="mc-panel p-4 rounded animate-slide-up">
      <h2 className="text-lg font-black mb-3 flex items-center gap-2" style={{ color: "#7DC53D" }}>
        ⏰ タイマー
      </h2>

      {/* Alert overlay */}
      {showAlert && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.85)" }}
        >
          <div
            className="text-center p-8 rounded-xl animate-slide-up"
            style={{ background: "#1E3A14", border: "4px solid #7DC53D", maxWidth: 400 }}
          >
            <div className="text-6xl mb-4">📚</div>
            <div
              className="text-3xl font-black mb-2"
              style={{ color: "#7FFF00" }}
            >
              {childName}くん！
            </div>
            <div className="text-xl font-bold" style={{ color: "#E8E8E8" }}>
              そろそろ宿題を始めよう！
            </div>
            <div className="text-5xl mt-4 animate-float">🏠</div>
          </div>
        </div>
      )}

      {/* Praise popup */}
      {praiseMsg && (
        <div
          className="fixed top-24 left-1/2 -translate-x-1/2 z-40 px-6 py-4 rounded-xl text-center animate-star-pop"
          style={{ background: "#D97706", border: "3px solid #FCD34D", maxWidth: 320 }}
        >
          <div className="text-2xl mb-1">🌟</div>
          <div className="text-base font-black text-white">{praiseMsg}</div>
        </div>
      )}

      {phase === "idle" && (
        <div className="space-y-4">
          <p className="text-sm" style={{ color: "#A0C878" }}>
            何分後に宿題を始める？
          </p>
          <div className="flex gap-3">
            {[5, 10, 15, 20].map((m) => (
              <button
                key={m}
                onClick={() => setCountdownMins(m)}
                className={`mc-btn flex-1 text-sm py-2 ${
                  countdownMins === m ? "mc-btn-green" : "mc-btn-gray"
                }`}
              >
                {m}分
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <button
              onClick={startCountdown}
              className="mc-btn mc-btn-blue flex-1 text-base py-3"
            >
              ⏳ カウントダウン開始
            </button>
            <button
              onClick={beginStudy}
              className="mc-btn mc-btn-green flex-1 text-base py-3"
            >
              📚 今すぐ始める！
            </button>
          </div>
        </div>
      )}

      {phase === "countdown" && (
        <div className="space-y-3">
          <div
            className="text-center py-4 rounded"
            style={{ background: "#0D0D1A" }}
          >
            <div className="text-xs mb-1" style={{ color: "#9CA3AF" }}>
              宿題まであと…
            </div>
            <div
              className="pixel-font text-5xl font-bold"
              style={{ color: remainSec <= 60 ? "#EF4444" : "#7FFF00" }}
            >
              {fmt(remainSec)}
            </div>
          </div>
          {/* Progress bar */}
          <div className="xp-bar-outer">
            <div
              className="xp-bar-inner"
              style={{
                width: `${pct}%`,
                background: "linear-gradient(90deg, #3B82F6, #7DC53D)",
              }}
            />
          </div>
          <div className="flex gap-2">
            <button onClick={stopTimer} className="mc-btn mc-btn-red flex-1">
              ⛔ キャンセル
            </button>
            <button onClick={beginStudy} className="mc-btn mc-btn-green flex-1">
              📚 今すぐ始める
            </button>
          </div>
        </div>
      )}

      {phase === "studying" && (
        <div className="space-y-3">
          <div
            className="text-center py-4 rounded"
            style={{ background: "#0D1A0D" }}
          >
            <div className="text-xs mb-1" style={{ color: "#A0C878" }}>
              べんきょう中！
            </div>
            <div
              className="pixel-font text-5xl font-bold animate-pulse-glow"
              style={{ color: "#17DD62" }}
            >
              {fmt(elapsedSec)}
            </div>
            <div className="text-xs mt-1" style={{ color: "#6B7280" }}>
              {Math.floor(elapsedSec / 60)}分 けいぞく中
            </div>
          </div>
          <button onClick={stopTimer} className="mc-btn mc-btn-red w-full py-3">
            🏁 べんきょうをおわる
          </button>
        </div>
      )}
    </div>
  );
}
