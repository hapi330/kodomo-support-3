/** 0〜100 の整数パーセント（分母が 0 のときは 0） */
export function percent(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}
