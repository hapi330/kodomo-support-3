"use client";

import { useCallback, useEffect, useState } from "react";
import Header from "@/components/Header";
import Timer from "@/components/Timer";
import AdminMode from "@/components/learning/AdminMode";
import LearnerMode from "@/components/learning/LearnerMode";
import LifeManagement from "@/components/LifeManagement";
import Games from "@/components/Games";
import Dashboard from "@/components/Dashboard";
import {
  AppState,
  CalendarEvent,
  ChoreItem,
  StudyRecord,
  calcLevel,
  loadState,
  saveState,
  updateStreak,
} from "@/lib/storage";
import { playLevelUp, speak } from "@/lib/sounds";
import { mcField } from "@/lib/mc-styles";

type Tab = "home" | "learn" | "life" | "games" | "dashboard" | "settings";

const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: "home", icon: "🏠", label: "ホーム" },
  { key: "learn", icon: "📚", label: "べんきょう" },
  { key: "life", icon: "📅", label: "せいかつ" },
  { key: "games", icon: "🎮", label: "あそび" },
  { key: "dashboard", icon: "📊", label: "きろく" },
  { key: "settings", icon: "⚙️", label: "せってい" },
];

const HOME_QUICK_LINKS: { tab: Tab; icon: string; label: string; color: string; desc: string }[] = [
  { tab: "learn", icon: "📚", label: "べんきょうする", color: "#5D9E2F", desc: "問題をとこう！" },
  { tab: "life", icon: "📅", label: "よていをみる", color: "#3B82F6", desc: "カレンダー・時間割" },
  { tab: "games", icon: "🎮", label: "あそぶ", color: "#A78BFA", desc: "ミニゲーム・ほうび" },
  { tab: "dashboard", icon: "📊", label: "きろくをみる", color: "#F59E0B", desc: "がんばりのきろく" },
];

const TIMER_MINUTES = [5, 10, 15, 20, 30] as const;

export default function HomePage() {
  const [state, setState] = useState<AppState | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const loaded = loadState();
        const updated = updateStreak(loaded);
        saveState(updated);
        setState(updated);
      } catch (error) {
        console.error("Failed to initialize app state:", error);
        setInitError("初期化に失敗しました。再読み込みしてください。");
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const [tab, setTab] = useState<Tab>("home");
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminInput, setAdminInput] = useState("");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [showAdminPrompt, setShowAdminPrompt] = useState(false);
  const [levelUpMsg, setLevelUpMsg] = useState("");

  const updateState = useCallback((updater: (prev: AppState) => AppState) => {
    setState((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      saveState(next);
      return next;
    });
  }, []);

  const addXP = useCallback(
    (xp: number) => {
      updateState((prev) => {
        const oldLevel = calcLevel(prev.totalXP);
        const newTotal = Math.max(0, prev.totalXP + xp);
        const newLevel = calcLevel(newTotal);
        if (newLevel > oldLevel) {
          const msg = `レベル ${newLevel} にアップ！おめでとう！`;
          setLevelUpMsg(msg);
          if (prev.settings.soundEnabled) playLevelUp();
          if (prev.settings.speechEnabled) speak(msg);
          setTimeout(() => setLevelUpMsg(""), 4000);
        }
        return { ...prev, totalXP: newTotal, level: newLevel };
      });
    },
    [updateState]
  );

  const handleAnswer = useCallback(
    (record: StudyRecord) => {
      updateState((prev) => ({
        ...prev,
        studyRecords: [...prev.studyRecords, record],
      }));
      if (record.isCorrect) {
        addXP(record.question.length > 30 ? 30 : 20);
      }
    },
    [updateState, addXP]
  );

  const checkAdmin = () => {
    if (!state) return;
    if (adminInput === state.settings.adminPassword) {
      setAdminUnlocked(true);
      setIsAdminMode(true);
      setShowAdminPrompt(false);
      setAdminInput("");
    } else {
      setAdminInput("");
      alert("パスワードが違います");
    }
  };

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-6xl animate-float">⛏️</div>
          <div className="pixel-font text-xl" style={{ color: "#7DC53D" }}>
            {initError ?? "ロード中…"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#1A1A2E" }}>
      <Header
        totalXP={state.totalXP}
        childName={state.settings.childName}
        streak={state.streak}
      />

      {levelUpMsg && (
        <div
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 px-8 py-6 rounded-2xl text-center animate-star-pop"
          style={{
            background: "linear-gradient(135deg, #D97706, #FCD34D)",
            border: "4px solid #FFD700",
            boxShadow: "0 0 40px rgba(255,215,0,0.6)",
          }}
        >
          <div className="text-5xl mb-2">⬆️</div>
          <div className="text-2xl font-black text-white">{levelUpMsg}</div>
        </div>
      )}

      {showAdminPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.8)" }}>
          <div className="mc-panel p-6 w-80 space-y-4 animate-slide-up">
            <h3 className="font-black text-lg" style={{ color: "#FCD34D" }}>🔐 管理者パスワード</h3>
            <input
              type="password"
              value={adminInput}
              onChange={(e) => setAdminInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && checkAdmin()}
              autoFocus
              placeholder="パスワードを入力"
              className="w-full p-3 rounded text-base"
              style={mcField}
            />
            <div className="flex gap-2">
              <button type="button" onClick={checkAdmin} className="mc-btn mc-btn-green flex-1">ひらく</button>
              <button
                type="button"
                onClick={() => { setShowAdminPrompt(false); setAdminInput(""); }}
                className="mc-btn mc-btn-gray flex-1"
              >
                もどる
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-4 pb-24">

        {tab === "home" && (
          <div className="space-y-4 animate-slide-up">
            <div
              className="p-5 rounded-xl relative overflow-hidden"
              style={{
                background: "linear-gradient(135deg, #1E3A14 0%, #2D1A4A 100%)",
                border: "3px solid #5D9E2F",
              }}
            >
              <div className="relative z-10">
                <div className="text-2xl font-black mb-1" style={{ color: "#7FFF00" }}>
                  おかえり！{state.settings.childName}くん 👋
                </div>
                <div className="text-base" style={{ color: "#A0C878" }}>
                  今日も冒険を始めよう！
                </div>
              </div>
              <div
                className="absolute right-4 top-1/2 -translate-y-1/2 text-6xl opacity-20 animate-float"
              >
                ⛏️
              </div>
            </div>

            <Timer
              childName={state.settings.childName}
              soundEnabled={state.settings.soundEnabled}
              speechEnabled={state.settings.speechEnabled}
            />

            <div className="grid grid-cols-2 gap-3">
              {HOME_QUICK_LINKS.map((item) => (
                <button
                  key={item.tab}
                  type="button"
                  onClick={() => setTab(item.tab)}
                  className="mc-panel mc-card-hover p-4 text-left cursor-pointer"
                >
                  <div className="text-3xl mb-2">{item.icon}</div>
                  <div className="font-black text-base" style={{ color: item.color }}>
                    {item.label}
                  </div>
                  <div className="text-xs mt-1" style={{ color: "#9CA3AF" }}>{item.desc}</div>
                </button>
              ))}
            </div>

            <div className="mc-panel p-4">
              <h3 className="font-black mb-2 text-sm" style={{ color: "#7DC53D" }}>
                今日のお手伝い
              </h3>
              <div className="flex flex-wrap gap-2">
                {state.chores.slice(0, 4).map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold"
                    style={{
                      background: c.completed ? "#0D3A0D" : "#2D2D44",
                      border: `2px solid ${c.completed ? "#17DD62" : "#4A4A6A"}`,
                      color: c.completed ? "#17DD62" : "#E8E8E8",
                    }}
                  >
                    {c.icon} {c.title}
                    {c.completed && " ✅"}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "learn" && (
          <div className="space-y-4 animate-slide-up">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsAdminMode(false)}
                className="flex-1 py-3 rounded font-black text-base"
                style={{
                  background: !isAdminMode ? "#5D9E2F" : "#2D2D44",
                  color: !isAdminMode ? "white" : "#9CA3AF",
                  border: `2px solid ${!isAdminMode ? "#7DC53D" : "#4A4A6A"}`,
                }}
              >
                📚 まなぶ
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!adminUnlocked) setShowAdminPrompt(true);
                  else setIsAdminMode(true);
                }}
                className="flex-1 py-3 rounded font-black text-base"
                style={{
                  background: isAdminMode ? "#D97706" : "#2D2D44",
                  color: isAdminMode ? "white" : "#9CA3AF",
                  border: `2px solid ${isAdminMode ? "#FCD34D" : "#4A4A6A"}`,
                }}
              >
                🔧 管理者
              </button>
            </div>

            {isAdminMode ? (
              <AdminMode defaultTargetName={state.settings.childName} />
            ) : (
              <LearnerMode
                soundEnabled={state.settings.soundEnabled}
                speechEnabled={state.settings.speechEnabled}
                onAnswer={handleAnswer}
                childName={state.settings.childName}
              />
            )}
          </div>
        )}

        {tab === "life" && (
          <div className="animate-slide-up">
            <LifeManagement
              events={state.calendarEvents}
              chores={state.chores}
              timetable={state.timetable}
              onEventsChange={(events: CalendarEvent[]) =>
                updateState((prev) => ({ ...prev, calendarEvents: events }))
              }
              onChoresChange={(chores: ChoreItem[]) =>
                updateState((prev) => ({ ...prev, chores }))
              }
              onXPGain={addXP}
              soundEnabled={state.settings.soundEnabled}
              speechEnabled={state.settings.speechEnabled}
            />
          </div>
        )}

        {tab === "games" && (
          <div className="animate-slide-up">
            <Games
              totalXP={state.totalXP}
              onXPGain={addXP}
              soundEnabled={state.settings.soundEnabled}
              speechEnabled={state.settings.speechEnabled}
              childName={state.settings.childName}
            />
          </div>
        )}

        {tab === "dashboard" && (
          <div className="animate-slide-up">
            <Dashboard
              records={state.studyRecords}
              sessions={state.studySessions}
              streak={state.streak}
              totalXP={state.totalXP}
              content={state.uploadedContent}
            />
          </div>
        )}

        {tab === "settings" && (
          <div className="space-y-4 animate-slide-up">
            <h2 className="text-xl font-black" style={{ color: "#7DC53D" }}>⚙️ せってい</h2>

            <div className="mc-panel p-4 space-y-4">
              <div>
                <label className="text-sm font-bold block mb-1" style={{ color: "#9CA3AF" }}>
                  子供の名前
                </label>
                <input
                  type="text"
                  value={state.settings.childName}
                  onChange={(e) =>
                    updateState((prev) => ({
                      ...prev,
                      settings: { ...prev.settings, childName: e.target.value },
                    }))
                  }
                  className="w-full p-3 rounded text-base"
                  style={mcField}
                />
              </div>

              <div>
                <label className="text-sm font-bold block mb-1" style={{ color: "#9CA3AF" }}>
                  管理者パスワード
                </label>
                <input
                  type="password"
                  value={state.settings.adminPassword}
                  onChange={(e) =>
                    updateState((prev) => ({
                      ...prev,
                      settings: { ...prev.settings, adminPassword: e.target.value },
                    }))
                  }
                  className="w-full p-3 rounded text-base"
                  style={mcField}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold">効果音</div>
                  <div className="text-xs" style={{ color: "#9CA3AF" }}>ゲームの音</div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    updateState((prev) => ({
                      ...prev,
                      settings: { ...prev.settings, soundEnabled: !prev.settings.soundEnabled },
                    }))
                  }
                  className={`mc-btn ${state.settings.soundEnabled ? "mc-btn-green" : "mc-btn-gray"} px-4 py-2`}
                >
                  {state.settings.soundEnabled ? "🔊 ON" : "🔇 OFF"}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold">音声よみあげ</div>
                  <div className="text-xs" style={{ color: "#9CA3AF" }}>問題を読み上げる</div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    updateState((prev) => ({
                      ...prev,
                      settings: { ...prev.settings, speechEnabled: !prev.settings.speechEnabled },
                    }))
                  }
                  className={`mc-btn ${state.settings.speechEnabled ? "mc-btn-green" : "mc-btn-gray"} px-4 py-2`}
                >
                  {state.settings.speechEnabled ? "🗣️ ON" : "🔇 OFF"}
                </button>
              </div>

              <div>
                <label className="text-sm font-bold block mb-1" style={{ color: "#9CA3AF" }}>
                  宿題タイマーの時間（分）
                </label>
                <div className="flex gap-2">
                  {TIMER_MINUTES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() =>
                        updateState((prev) => ({
                          ...prev,
                          settings: { ...prev.settings, timerDuration: m },
                        }))
                      }
                      className={`mc-btn flex-1 py-2 text-sm ${
                        state.settings.timerDuration === m ? "mc-btn-green" : "mc-btn-gray"
                      }`}
                    >
                      {m}分
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mc-panel p-4">
              <h3 className="font-black mb-3" style={{ color: "#EF4444" }}>⚠️ データ管理</h3>
              <button
                type="button"
                onClick={() => {
                  if (confirm("すべてのデータをリセットしますか？この操作は元に戻せません。")) {
                    localStorage.removeItem("kodomo-support-3");
                    window.location.reload();
                  }
                }}
                className="mc-btn mc-btn-red w-full py-3"
              >
                🗑️ データをリセット
              </button>
            </div>
          </div>
        )}
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-40"
        style={{
          background: "linear-gradient(180deg, transparent 0%, #0D0D1A 10%)",
          borderTop: "3px solid #4A4A6A",
          backdropFilter: "blur(10px)",
        }}
      >
        <div className="max-w-4xl mx-auto px-2 py-2">
          <div className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className="flex-1 flex flex-col items-center gap-1 py-2 rounded-lg transition-all"
                style={{
                  background: tab === t.key ? "#1E3A14" : "transparent",
                  border: `2px solid ${tab === t.key ? "#5D9E2F" : "transparent"}`,
                }}
              >
                <span className="text-xl">{t.icon}</span>
                <span
                  className="text-xs font-bold"
                  style={{ color: tab === t.key ? "#7DC53D" : "#6B7280" }}
                >
                  {t.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </nav>
    </div>
  );
}
