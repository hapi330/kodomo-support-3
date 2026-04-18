import type { UploadedContent } from "@/lib/storage";

/** タイトルに含まれる数字列（例: 「4-1-8」→ [4, 1, 8]） */
function titleNumberKey(title: string): number[] {
  const m = title.match(/\d+/g);
  if (!m) return [];
  return m.map((s) => parseInt(s, 10));
}

function lexCompareNumbers(a: number[], b: number[]): number {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a[i];
    const y = b[i];
    if (x === undefined && y === undefined) return 0;
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (x !== y) return x - y;
  }
  return 0;
}

/**
 * 勉強タブのクエスト一覧用: タイトル内の数字が**小さい順**（若い番号が上）。
 * 数字が同じか取れないときは uploadDate 昇順。
 */
export function sortUploadedContentForStudyList(items: UploadedContent[]): UploadedContent[] {
  return [...items].sort((a, b) => {
    const cmp = lexCompareNumbers(titleNumberKey(a.title), titleNumberKey(b.title));
    if (cmp !== 0) return cmp;
    return a.uploadDate.localeCompare(b.uploadDate);
  });
}
