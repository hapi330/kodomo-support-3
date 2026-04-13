"use client";
import { useState } from "react";
import { CalendarEvent, ChoreItem, TimetableEntry } from "@/lib/storage";
import { playXPGain, speak } from "@/lib/sounds";
import { mcFieldRaised } from "@/lib/mc-styles";

interface LifeManagementProps {
  events: CalendarEvent[];
  chores: ChoreItem[];
  timetable: TimetableEntry[];
  onEventsChange: (events: CalendarEvent[]) => void;
  onChoresChange: (chores: ChoreItem[]) => void;
  onXPGain: (xp: number) => void;
  soundEnabled: boolean;
  speechEnabled: boolean;
}

const DAYS = ["月", "火", "水", "木", "金"];
const PERIODS = [1, 2, 3, 4, 5, 6];
const SUBJECT_COLORS: Record<string, string> = {
  こくご: "#3B82F6",
  さんすう: "#10B981",
  りか: "#8B5CF6",
  しゃかい: "#F59E0B",
  がいこくご: "#EC4899",
  たいいく: "#EF4444",
  おんがく: "#6366F1",
  ずこう: "#F97316",
  そうごう: "#14B8A6",
  家庭科: "#E11D48",
};

export default function LifeManagement({
  events,
  chores,
  timetable,
  onEventsChange,
  onChoresChange,
  onXPGain,
  soundEnabled,
  speechEnabled,
}: LifeManagementProps) {
  const [activeTab, setActiveTab] = useState<"calendar" | "timetable" | "chores">("calendar");
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEvent, setNewEvent] = useState<Partial<CalendarEvent>>({
    type: "other",
    color: "#60A5FA",
  });

  // Get this week's dates
  const getWeekDates = () => {
    const dates: string[] = [];
    const today = new Date();
    const day = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(d.toISOString().split("T")[0]);
    }
    return dates;
  };

  const weekDates = getWeekDates();
  const weekDayLabels = ["月", "火", "水", "木", "金", "土", "日"];

  const getEventsForDate = (date: string) =>
    events.filter((e) => e.date === date);

  const completeChore = (id: string) => {
    const chore = chores.find((c) => c.id === id);
    if (!chore || chore.completed) return;
    const updated = chores.map((c) =>
      c.id === id ? { ...c, completed: true, completedDate: new Date().toISOString() } : c
    );
    onChoresChange(updated);
    onXPGain(chore.points);
    if (soundEnabled) playXPGain();
    if (speechEnabled) speak(`${chore.title}、おつかれさま！${chore.points}ポイントゲット！`);
  };

  const resetChores = () => {
    onChoresChange(chores.map((c) => ({ ...c, completed: false, completedDate: undefined })));
  };

  const getSubjectForCell = (day: number, period: number) =>
    timetable.find((t) => t.day === day && t.period === period)?.subject ?? "";

  const addEvent = () => {
    if (!newEvent.title || !newEvent.date) return;
    const ev: CalendarEvent = {
      id: `ev-${Date.now()}`,
      date: newEvent.date!,
      title: newEvent.title!,
      type: newEvent.type as CalendarEvent["type"],
      startTime: newEvent.startTime,
      endTime: newEvent.endTime,
      color: newEvent.color ?? "#60A5FA",
    };
    onEventsChange([...events, ev]);
    setNewEvent({ type: "other", color: "#60A5FA" });
    setShowAddEvent(false);
  };

  const deleteEvent = (id: string) => {
    onEventsChange(events.filter((e) => e.id !== id));
  };

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex gap-2">
        {(["calendar", "timetable", "chores"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 py-2 rounded font-bold text-sm transition-all"
            style={{
              background: activeTab === tab ? "#5D9E2F" : "#2D2D44",
              color: activeTab === tab ? "white" : "#9CA3AF",
              border: `2px solid ${activeTab === tab ? "#7DC53D" : "#4A4A6A"}`,
            }}
          >
            {tab === "calendar" ? "📅 カレンダー" : tab === "timetable" ? "📋 時間割" : "🧹 お手伝い"}
          </button>
        ))}
      </div>

      {/* Calendar */}
      {activeTab === "calendar" && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-black" style={{ color: "#7DC53D" }}>今週のよてい</h3>
            <button
              onClick={() => setShowAddEvent(true)}
              className="mc-btn mc-btn-blue text-sm px-3 py-2"
            >
              ＋ 追加
            </button>
          </div>

          {/* Add event form */}
          {showAddEvent && (
            <div className="p-4 rounded space-y-3 animate-slide-up" style={{ background: "#0D0D1A", border: "2px solid #4A4A6A" }}>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="よていの名前"
                  value={newEvent.title ?? ""}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  className="p-2 rounded text-sm"
                  style={mcFieldRaised}
                />
                <input
                  type="date"
                  value={newEvent.date ?? ""}
                  onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                  className="p-2 rounded text-sm"
                  style={mcFieldRaised}
                />
                <input
                  type="time"
                  value={newEvent.startTime ?? ""}
                  onChange={(e) => setNewEvent({ ...newEvent, startTime: e.target.value })}
                  className="p-2 rounded text-sm"
                  style={mcFieldRaised}
                />
                <select
                  value={newEvent.type ?? "other"}
                  onChange={(e) => setNewEvent({ ...newEvent, type: e.target.value as CalendarEvent["type"] })}
                  className="p-2 rounded text-sm"
                  style={mcFieldRaised}
                >
                  <option value="juku">塾</option>
                  <option value="dance">ダンス</option>
                  <option value="event">行事</option>
                  <option value="other">その他</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={addEvent} className="mc-btn mc-btn-green flex-1 py-2">保存</button>
                <button onClick={() => setShowAddEvent(false)} className="mc-btn mc-btn-gray flex-1 py-2">キャンセル</button>
              </div>
            </div>
          )}

          {/* Week grid */}
          <div className="grid grid-cols-7 gap-1">
            {weekDates.map((date, i) => {
              const dayEvents = getEventsForDate(date);
              const isToday = date === new Date().toISOString().split("T")[0];
              const isWeekend = i >= 5;
              return (
                <div
                  key={date}
                  className="rounded p-2 min-h-20"
                  style={{
                    background: isToday ? "#1E3A14" : isWeekend ? "#1A1A2E" : "#2D2D44",
                    border: `2px solid ${isToday ? "#7DC53D" : "#4A4A6A"}`,
                  }}
                >
                  <div
                    className="text-xs font-bold text-center mb-1"
                    style={{ color: isToday ? "#7FFF00" : isWeekend ? "#F87171" : "#9CA3AF" }}
                  >
                    {weekDayLabels[i]}
                    <br />
                    <span className="pixel-font">{date.slice(8)}</span>
                  </div>
                  {dayEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="text-xs px-1 py-0.5 rounded mb-1 font-bold flex justify-between items-center"
                      style={{ background: ev.color + "33", color: ev.color, border: `1px solid ${ev.color}44` }}
                    >
                      <span className="truncate">{ev.title}</span>
                      <button onClick={() => deleteEvent(ev.id)} className="ml-1 opacity-60 hover:opacity-100">✕</button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Timetable */}
      {activeTab === "timetable" && (
        <div>
          <h3 className="font-black mb-3" style={{ color: "#7DC53D" }}>学校の時間割</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="w-12 p-2 text-xs" style={{ color: "#9CA3AF" }}>時間</th>
                  {DAYS.map((d) => (
                    <th key={d} className="p-2 text-sm font-black" style={{ color: "#7DC53D" }}>
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERIODS.map((period) => (
                  <tr key={period}>
                    <td
                      className="p-2 text-center font-black"
                      style={{ color: "#FCD34D", background: "#1A1A2E" }}
                    >
                      {period}
                    </td>
                    {DAYS.map((_, dayIdx) => {
                      const subj = getSubjectForCell(dayIdx, period);
                      const color = SUBJECT_COLORS[subj] ?? "#4B5563";
                      return (
                        <td key={dayIdx} className="p-1">
                          <div
                            className="rounded text-center py-2 text-sm font-bold"
                            style={{
                              background: subj ? color + "22" : "#1A1A2E",
                              border: `2px solid ${subj ? color + "66" : "#2D2D44"}`,
                              color: subj ? color : "#4B5563",
                            }}
                          >
                            {subj || "—"}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Chores */}
      {activeTab === "chores" && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-black" style={{ color: "#7DC53D" }}>
              今日のお手伝い
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: "#9CA3AF" }}>
                {chores.filter((c) => c.completed).length}/{chores.length} 完了
              </span>
              <button onClick={resetChores} className="mc-btn mc-btn-gray text-xs px-2 py-1">
                リセット
              </button>
            </div>
          </div>

          {/* Total points today */}
          <div
            className="flex items-center gap-3 p-3 rounded"
            style={{ background: "#0D1A0D", border: "2px solid #17DD62" }}
          >
            <span className="text-2xl">⭐</span>
            <div>
              <div className="text-xs" style={{ color: "#9CA3AF" }}>今日のポイント</div>
              <div className="pixel-font text-2xl font-bold" style={{ color: "#7FFF00" }}>
                {chores
                  .filter((c) => c.completed)
                  .reduce((sum, c) => sum + c.points, 0)}{" "}
                pt
              </div>
            </div>
          </div>

          {chores.map((chore) => (
            <div
              key={chore.id}
              className="flex items-center gap-4 p-4 rounded-xl"
              style={{
                background: chore.completed ? "#0D1A0D" : "#2D2D44",
                border: `3px solid ${chore.completed ? "#17DD62" : "#4A4A6A"}`,
                opacity: chore.completed ? 0.8 : 1,
              }}
            >
              <span className="text-3xl">{chore.icon}</span>
              <div className="flex-1">
                <div
                  className="text-base font-black"
                  style={{
                    color: chore.completed ? "#17DD62" : "#E8E8E8",
                    textDecoration: chore.completed ? "line-through" : "none",
                  }}
                >
                  {chore.title}
                </div>
                <div className="text-sm" style={{ color: "#FCD34D" }}>
                  ＋{chore.points} ポイント
                </div>
              </div>
              <button
                onClick={() => completeChore(chore.id)}
                disabled={chore.completed}
                className={`mc-btn ${chore.completed ? "mc-btn-gray" : "mc-btn-green"} px-4 py-2 text-base`}
              >
                {chore.completed ? "✅ 完了！" : "やった！"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
