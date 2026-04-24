import type { CalendarEvent, ChoreItem, StudyRecord } from "@/lib/storage";
import { calcLevel, xpForNextLevel } from "@/lib/storage";
import { TARGET_REWARD_MILESTONE_XP } from "@/lib/xp-economy";

export type DayPhase = "morning" | "afternoon" | "evening" | "night";

export function getDayPhase(d: Date): DayPhase {
  const h = d.getHours();
  if (h >= 5 && h < 11) return "morning";
  if (h >= 11 && h < 17) return "afternoon";
  if (h >= 17 && h < 22) return "evening";
  return "night";
}

function isoDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function tomorrowIso(from: Date): string {
  const x = new Date(from);
  x.setDate(x.getDate() + 1);
  return x.toISOString().split("T")[0];
}

/** 小学高学年で扱う漢字を多めに（読みながら勉強にもなる表記） */
function greetingLine(phase: DayPhase, name: string): string {
  switch (phase) {
    case "morning":
      return `おはよう、${name}くん！今日の冒険、始めよう！`;
    case "afternoon":
      return `こんにちは、${name}くん！午後も頑張ろう！`;
    case "evening":
      return `こんばんは、${name}くん！今日はどうだった？`;
    default:
      return `お疲れ、${name}くん。お休み前に、記録だけでも見る？`;
  }
}

export function buildHomeGuideComment(params: {
  now: Date;
  childName: string;
  totalXP: number;
  streak: number;
  studyRecords: StudyRecord[];
  calendarEvents: CalendarEvent[];
  chores: ChoreItem[];
  rewardPromiseSealedAt: string;
  totalStudyQuestions: number;
}): string {
  const {
    now,
    childName,
    totalXP,
    streak,
    studyRecords,
    calendarEvents,
    chores,
    rewardPromiseSealedAt,
    totalStudyQuestions,
  } = params;

  const lines: string[] = [];
  const phase = getDayPhase(now);
  lines.push(greetingLine(phase, childName));

  const today = isoDate(now);
  const todayRecords = studyRecords.filter((r) => r.date.startsWith(today));

  const todayEvents = calendarEvents.filter((e) => e.date === today);
  if (todayEvents.length > 0) {
    const ev = todayEvents[0];
    const time =
      ev.startTime && ev.endTime
        ? `${ev.startTime}〜${ev.endTime}`
        : ev.startTime
          ? `${ev.startTime}〜`
          : "";
    lines.push(
      time
        ? `今日の予定: ${ev.title}（${time}）`
        : `今日の予定: ${ev.title}`
    );
    if (todayEvents.length > 1) {
      lines.push(`ほか ${todayEvents.length - 1} 件もあるよ。📅 生活タブでチェック！`);
    }
  } else {
    const tom = tomorrowIso(now);
    const tomEv = calendarEvents.filter((e) => e.date === tom);
    if (tomEv.length > 0) {
      const ev = tomEv[0];
      lines.push(`明日は「${ev.title}」があるよ。忘れないように！`);
    }
  }

  if (todayRecords.length > 0) {
    const correct = todayRecords.filter((r) => r.isCorrect).length;
    lines.push(
      `今日の勉強: ${todayRecords.length} 問（正解 ${correct}）`
    );
  } else {
    lines.push("今日の記録はまだないよ。📚 勉強に行こう！");
  }

  const level = calcLevel(totalXP);
  const levelEnd = xpForNextLevel(level);
  const toNextLevel = Math.max(0, levelEnd - totalXP);
  if (level >= 2 && toNextLevel > 0 && toNextLevel <= 80) {
    lines.push(`次のレベルまで あと ${toNextLevel} XP！`);
  }

  if (totalXP < TARGET_REWARD_MILESTONE_XP) {
    const rem = TARGET_REWARD_MILESTONE_XP - totalXP;
    const pct = Math.min(100, Math.round((totalXP / TARGET_REWARD_MILESTONE_XP) * 100));
    lines.push(
      `ご褒美（${TARGET_REWARD_MILESTONE_XP.toLocaleString()} XP）まで 残り ${rem.toLocaleString()}（${pct}%）`
    );
  } else {
    lines.push("ご褒美の経験値、達成おめでとう！⭐");
  }

  if (streak >= 2) {
    lines.push(`連続記録 ${streak} 日！🔥`);
  }

  if (totalStudyQuestions > 0) {
    lines.push(`問題は全部で ${totalStudyQuestions} 問 あるよ。`);
  }

  const incomplete = chores.filter((c) => !c.completed);
  if (incomplete.length > 0 && incomplete.length <= 5) {
    lines.push(
      `お手伝い、残り ${incomplete.length} 個（${incomplete.map((c) => c.icon).join("")}）`
    );
  }

  if (!rewardPromiseSealedAt.trim()) {
    lines.push("⚙️ ご褒美の約束（コミット）、まだなら「設定」からどうぞ！");
  }

  return lines.slice(0, 7).join("\n");
}
