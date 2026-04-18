/**
 * 文字起こしテキストから「設問がいくつあるか」の目安を推定する。
 * 問題生成で期待する問題数をプロンプトに渡し、LLM が足りない件数を出しにくくする。
 */
export function estimateTranscribedProblemCount(rawText: string): number {
  const t = rawText.replace(/\r\n/g, "\n");
  const scores: number[] = [];

  const problemDashNum = t.match(/(?:^|\n)\s*問題\s*[-−﹣－]?\s*\d+/gi);
  if (problemDashNum) scores.push(problemDashNum.length);

  const problemDot = t.match(/(?:^|\n)\s*問題\s*\d+\s*[\.．]/gi);
  if (problemDot) scores.push(problemDot.length);

  const qNum = t.match(/(?:^|\n)\s*問\s*\d+/gi);
  if (qNum) scores.push(qNum.length);

  const parenLines = t
    .split("\n")
    .filter((line) => /^\s*[（(]\s*\d+\s*[）)]/.test(line)).length;
  scores.push(parenLines);

  if (scores.length === 0) return 1;
  return Math.max(1, ...scores);
}
