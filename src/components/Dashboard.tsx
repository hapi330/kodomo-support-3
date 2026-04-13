"use client";
import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { StudyRecord, StudySession, GeneratedQuestion, UploadedContent } from "@/lib/storage";
import { percent } from "@/lib/percent";

interface DashboardProps {
  records: StudyRecord[];
  sessions: StudySession[];
  streak: number;
  totalXP: number;
  content: UploadedContent[];
}

function DashboardChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#0D0D1A", border: "2px solid #4A4A6A", padding: "8px 12px", borderRadius: 4 }}>
      <div className="text-xs" style={{ color: "#9CA3AF" }}>{label}</div>
      <div className="font-bold" style={{ color: "#7FFF00" }}>{payload[0].value}%</div>
    </div>
  );
}

export default function Dashboard({
  records,
  sessions,
  streak,
  totalXP,
  content,
}: DashboardProps) {
  const [showReview, setShowReview] = useState(false);

  // Last 7 days accuracy
  const last7Days = useMemo(() => {
    /* eslint-disable react-hooks/purity -- 7日窓の基準時刻（records 更新時に再計算） */
    const now = Date.now();
    /* eslint-enable react-hooks/purity */
    const days: { date: string; correct: number; total: number; pct: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * 86400000);
      const dateStr = d.toISOString().split("T")[0];
      const dayRecords = records.filter((r) => r.date.startsWith(dateStr));
      const correct = dayRecords.filter((r) => r.isCorrect).length;
      const total = dayRecords.length;
      const label = `${d.getMonth() + 1}/${d.getDate()}`;
      days.push({ date: label, correct, total, pct: percent(correct, total) });
    }
    return days;
  }, [records]);

  // Subject breakdown
  const subjectStats = useMemo(() => {
    const map: Record<string, { correct: number; total: number }> = {};
    records.forEach((r) => {
      if (!map[r.subject]) map[r.subject] = { correct: 0, total: 0 };
      map[r.subject].total++;
      if (r.isCorrect) map[r.subject].correct++;
    });
    return Object.entries(map).map(([subject, s]) => ({
      subject,
      pct: percent(s.correct, s.total),
      total: s.total,
    }));
  }, [records]);

  // Weak questions (wrong more than correct)
  const weakQuestions = useMemo(() => {
    const allQs: GeneratedQuestion[] = content.flatMap((c) => c.questions);
    return allQs.filter((q) => q.timesAnswered > 0 && q.timesCorrect / q.timesAnswered < 0.5);
  }, [content]);

  const wrongRecents = useMemo(
    () => records.filter((r) => !r.isCorrect).slice(-10),
    [records]
  );

  const { totalAnswered, overallPct } = useMemo(() => {
    const totalAnswered = records.length;
    const correct = records.filter((r) => r.isCorrect).length;
    return { totalAnswered, overallPct: percent(correct, totalAnswered) };
  }, [records]);

  const totalStudyMin = useMemo(
    () => sessions.reduce((sum, s) => sum + s.duration, 0),
    [sessions]
  );

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "せいかいりつ", value: `${overallPct}%`, icon: "🎯", color: "#17DD62" },
          { label: "れんぞく", value: `${streak}日`, icon: "🔥", color: "#F59E0B" },
          { label: "けいけんち", value: `${totalXP.toLocaleString()}`, icon: "⭐", color: "#7FFF00" },
          { label: "べんきょう時間", value: `${totalStudyMin}分`, icon: "⏱", color: "#5DECF5" },
        ].map((s) => (
          <div
            key={s.label}
            className="p-4 rounded-xl text-center"
            style={{ background: "#0D0D1A", border: `2px solid ${s.color}44` }}
          >
            <div className="text-3xl mb-1">{s.icon}</div>
            <div className="pixel-font text-2xl font-bold" style={{ color: s.color }}>
              {s.value}
            </div>
            <div className="text-xs" style={{ color: "#9CA3AF" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Accuracy chart */}
      <div className="mc-panel p-4">
        <h3 className="font-black mb-3" style={{ color: "#7DC53D" }}>
          📈 せいかいりつ（7日間）
        </h3>
        {totalAnswered === 0 ? (
          <div className="text-center py-8" style={{ color: "#9CA3AF" }}>
            まだデータがないよ！問題をといてみよう！
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={last7Days} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="date" tick={{ fill: "#9CA3AF", fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fill: "#9CA3AF", fontSize: 11 }} />
              <Tooltip content={<DashboardChartTooltip />} />
              <Line
                type="monotone"
                dataKey="pct"
                stroke="#7DC53D"
                strokeWidth={3}
                dot={{ fill: "#7FFF00", r: 5 }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Subject breakdown */}
      {subjectStats.length > 0 && (
        <div className="mc-panel p-4">
          <h3 className="font-black mb-3" style={{ color: "#7DC53D" }}>
            📚 教科別せいかいりつ
          </h3>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={subjectStats} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="subject" tick={{ fill: "#9CA3AF", fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fill: "#9CA3AF", fontSize: 10 }} />
              <Tooltip content={<DashboardChartTooltip />} />
              <Bar dataKey="pct" fill="#5D9E2F" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Weak areas */}
      {weakQuestions.length > 0 && (
        <div className="mc-panel p-4">
          <h3 className="font-black mb-3" style={{ color: "#EF4444" }}>
            ⚠️ 苦手な問題
          </h3>
          <div className="space-y-2">
            {weakQuestions.slice(0, 5).map((q) => (
              <div
                key={q.id}
                className="p-3 rounded"
                style={{ background: "#1A0D0D", border: "2px solid #EF444444" }}
              >
                <div className="text-sm">{q.question}</div>
                <div className="text-xs mt-1" style={{ color: "#9CA3AF" }}>
                  {q.timesCorrect}/{q.timesAnswered} 正解
                  （{percent(q.timesCorrect, q.timesAnswered)}%）
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Review section */}
      <div className="mc-panel p-4">
        <h3 className="font-black mb-3" style={{ color: "#A78BFA" }}>
          🔄 復習リスト
        </h3>
        {wrongRecents.length === 0 ? (
          <div className="text-center py-4" style={{ color: "#9CA3AF" }}>
            <div className="text-2xl mb-2">🏆</div>
            <div className="text-sm">まだ間違いがないよ！すごい！</div>
          </div>
        ) : (
          <>
            <p className="text-sm mb-3" style={{ color: "#9CA3AF" }}>
              最近まちがえた問題 ({wrongRecents.length}問)
            </p>
            <button
              onClick={() => setShowReview((v) => !v)}
              className="mc-btn mc-btn-diamond w-full py-3 mb-3"
            >
              {showReview ? "▲ とじる" : "▼ 復習リストをみる"}
            </button>
            {showReview && (
              <div className="space-y-2">
                {wrongRecents.map((r, i) => (
                  <div
                    key={r.id}
                    className="p-3 rounded animate-slide-up"
                    style={{ background: "#1A1A2E", border: "2px solid #A78BFA44" }}
                  >
                    <span className="text-xs" style={{ color: "#A78BFA" }}>復習 {i + 1}</span>
                    <div className="text-sm mt-1">{r.question}</div>
                    <div className="text-xs mt-1" style={{ color: "#17DD62" }}>
                      正解: {r.correctAnswer}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
