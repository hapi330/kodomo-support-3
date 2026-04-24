/**
 * けいけんちの設計（目安）
 * - 目標: 約 180 日（半年）で 1 万 XP → 国語・算数など 1 日 ~14 問正解（BGM 倍率 1.0 のとき）程度のペース
 * - BGM ルーレット倍率は本番クイズの正解 XP にのみ乗算
 */

/** 親子の「ご褒美約束」の到達目安（けいけんち） */
export const TARGET_REWARD_MILESTONE_XP = 10_000;

/** 到達目安の日数（説明文用） */
export const ESTIMATED_DAYS_TO_REWARD_MILESTONE = 180;

/** 本番クイズで正解（BGM 倍率の前の基礎値） */
export const XP_PER_CORRECT_QUIZ_BASE = 4;

/** 本試験：ヒント練習で1回外したとき（1問あたり） */
export const XP_HINT_MISS = -2;

/** 本試験：本番クイズで1回外したとき（1問あたり） */
export const XP_QUIZ_MISS = -2;

/** 本試験：教材を初めて最後までクリアしたときの基本ボーナス（2 周目以降はなし） */
export const XP_FIRST_CONTENT_CLEAR_BONUS = 24;

/** 予習モードを最後まで終えたとき（3分経過で一覧へ戻るとき） */
export const XP_PREP_CLEAR_BONUS = 12;

/** 予習モードで1回外したとき（1問あたり・予習に採点がある場合） */
export const XP_PREP_MISS = -1;

/** なぞなぞ正解 */
export const XP_RIDDLE_CORRECT = 16;

/** タイピング 1 語クリア */
export const XP_TYPING_BASE = 3;

/** タイピング連続ボーナス（1 段階あたり） */
export const XP_TYPING_STREAK_PER_STEP = 1;

export const XP_TYPING_STREAK_MAX_STEPS = 5;

// --- 報酬交換所（ゲーム内）のコスト（経済に合わせて調整） ---
export const REWARD_EXCHANGE_COSTS = [100, 75, 150, 250, 125, 400] as const;

export function xpForQuizCorrect(bgmMultiplier: number): number {
  const m = Number.isFinite(bgmMultiplier) && bgmMultiplier > 0 ? bgmMultiplier : 1;
  return Math.max(1, Math.round(XP_PER_CORRECT_QUIZ_BASE * m));
}

export function xpForTypingWord(streakBeforeSolve: number): number {
  const bonus = Math.min(
    Math.max(0, streakBeforeSolve),
    XP_TYPING_STREAK_MAX_STEPS
  ) * XP_TYPING_STREAK_PER_STEP;
  return XP_TYPING_BASE + bonus;
}

/** 説明文用: 倍率 1.0 のとき 1 日あたり何問正解を想定しているか */
export function approximateCorrectQuizPerDayAt1x(): number {
  const v =
    TARGET_REWARD_MILESTONE_XP /
    ESTIMATED_DAYS_TO_REWARD_MILESTONE /
    XP_PER_CORRECT_QUIZ_BASE;
  return Math.round(v * 10) / 10;
}

export function shouldShow10kMilestoneReward(
  prevTotalXp: number,
  nextTotalXp: number,
  alreadyMarked: boolean | undefined
): boolean {
  if (alreadyMarked === true) return false;
  return (
    prevTotalXp < TARGET_REWARD_MILESTONE_XP &&
    nextTotalXp >= TARGET_REWARD_MILESTONE_XP
  );
}
