import type { GeneratedQuestion, UploadedContent } from "@/lib/storage";

/** 編集画面で追加する空の問題（保存前に本文・正解・選択肢を埋める） */
export function createEmptyQuestion(
  contentId: string,
  options?: { editorInserted?: boolean }
): GeneratedQuestion {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return normalizeQuestion({
    id: `q-${contentId}-${suffix}`,
    question: "",
    answer: "",
    hints: ["", "", ""],
    choices: ["", "", ""],
    correctIndex: 0,
    timesAnswered: 0,
    timesCorrect: 0,
    editorInserted: options?.editorInserted ?? false,
  });
}

/** `atIndex` の直前に空の問題を挿入（0＝先頭、length＝末尾と同じ） */
export function insertQuestionAt(draft: UploadedContent, atIndex: number): UploadedContent {
  const len = draft.questions.length;
  const i = Math.max(0, Math.min(atIndex, len));
  const q = createEmptyQuestion(draft.id, { editorInserted: true });
  const next = [...draft.questions];
  next.splice(i, 0, q);
  return { ...draft, questions: next };
}

export function appendQuestion(draft: UploadedContent): UploadedContent {
  return insertQuestionAt(draft, draft.questions.length);
}

export function removeQuestionAt(draft: UploadedContent, index: number): UploadedContent {
  if (index < 0 || index >= draft.questions.length) return draft;
  const questions = draft.questions.filter((_, i) => i !== index);
  return { ...draft, questions };
}

export function padHints(hints: string[]): string[] {
  const h = [...hints];
  while (h.length < 3) h.push("");
  return h.slice(0, 3);
}

export function padChoices(choices: string[]): string[] {
  const c = [...choices];
  while (c.length < 3) c.push("");
  return c.slice(0, 3);
}

export function normalizeQuestion(q: GeneratedQuestion): GeneratedQuestion {
  const hints = padHints(q.hints ?? []);
  const choices = padChoices(q.choices ?? []);
  let correctIndex = q.correctIndex;
  if (correctIndex < 0 || correctIndex > 2) correctIndex = 0;
  return {
    ...q,
    hints,
    choices,
    correctIndex,
    question: q.question ?? "",
    answer: q.answer ?? "",
    editorInserted: q.editorInserted,
  };
}

/** 編集画面の問題ブロック見出し（例: 問題 3（差し込み1）） */
export function formatQuestionBlockTitle(draft: UploadedContent, index: number): string {
  const q = draft.questions[index];
  if (!q?.editorInserted) return `問題 ${index + 1}`;
  const ord = draft.questions.slice(0, index + 1).filter((x) => x.editorInserted).length;
  return `問題 ${index + 1}（差し込み${ord}）`;
}

export function updateQuestionAt(
  draft: UploadedContent,
  index: number,
  fn: (q: GeneratedQuestion) => GeneratedQuestion
): UploadedContent {
  const questions = draft.questions.map((q, i) => (i === index ? fn(normalizeQuestion(q)) : q));
  return { ...draft, questions };
}
