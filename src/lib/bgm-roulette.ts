/** 勉強セッションのBGMサイクル長（分）とクイズXP倍率 */

/** 本試験ルーレット（8 / 10 / 12 分）＋ 予習のみ 3 分 */
export type BgmCycleMinutes = 3 | 8 | 10 | 12;

export type BgmRouletteResult = { minutes: BgmCycleMinutes; xpMultiplier: number };

/** 予習モード：3 分で終了。BGM は本試験と同じロジック（残り1分・30秒でテンポアップ） */
export const PREP_SESSION_MINUTES = 3 as const satisfies BgmCycleMinutes;

export const PREP_BGM_RESULT: BgmRouletteResult = {
  minutes: PREP_SESSION_MINUTES,
  xpMultiplier: 1.0,
};

export const BGM_ROULETTE_TABLE: ReadonlyArray<BgmRouletteResult> = [
  { minutes: 8, xpMultiplier: 1.5 },
  { minutes: 10, xpMultiplier: 1.2 },
  { minutes: 12, xpMultiplier: 1.0 },
];

/** ルーレットを使わないときの既定（12分・XP×1.0） */
export const DEFAULT_BGM_WITHOUT_ROULETTE: BgmRouletteResult = BGM_ROULETTE_TABLE[2];

export const MAX_ROULETTE_SPINS = 3;

export type RouletteFlowPhase = "choose" | "spin";

export function spinBgmRoulette(): BgmRouletteResult {
  const idx = Math.floor(Math.random() * BGM_ROULETTE_TABLE.length);
  return BGM_ROULETTE_TABLE[idx] ?? BGM_ROULETTE_TABLE[0];
}
