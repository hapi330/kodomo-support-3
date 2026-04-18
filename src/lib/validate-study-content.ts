import { resolveAnswerInChoices } from "@/lib/question-claude-helpers";
import {
  formatQuestionBlockTitle,
  normalizeQuestion,
  padChoices,
  padHints,
} from "@/lib/question-draft";
import type { GeneratedQuestion, UploadedContent } from "@/lib/storage";

export type StudyContentIssueSeverity = "error" | "warning";

export type StudyContentIssue = {
  severity: StudyContentIssueSeverity;
  /** 教材全体の問題は null */
  questionIndex: number | null;
  message: string;
};

export type StudyContentValidationResult = {
  /** error が1件もない */
  ok: boolean;
  issues: StudyContentIssue[];
};

function push(
  issues: StudyContentIssue[],
  severity: StudyContentIssueSeverity,
  questionIndex: number | null,
  message: string
) {
  issues.push({ severity, questionIndex, message });
}

function validateQuestion(q: GeneratedQuestion, index: number, draft: UploadedContent): StudyContentIssue[] {
  const issues: StudyContentIssue[] = [];
  const nq = normalizeQuestion(q);
  const label = formatQuestionBlockTitle(draft, index);

  const questionText = String(nq.question ?? "").trim();
  if (!questionText) {
    push(issues, "error", index, `「${label}」: 問題文が空です。`);
  } else if (questionText.length < 4) {
    push(issues, "warning", index, `「${label}」: 問題文が短すぎる可能性があります。`);
  }

  const answerText = String(nq.answer ?? "").trim();
  if (!answerText) {
    push(issues, "error", index, `「${label}」: 正解が空です。`);
  }

  const hints = padHints(nq.hints ?? []);
  hints.forEach((h, hi) => {
    if (!String(h).trim()) {
      push(issues, "error", index, `「${label}」: ヒント ${hi + 1} が空です。`);
    }
  });

  const choices = padChoices(nq.choices ?? []);
  const trimmedChoices = choices.map((c) => String(c).trim());
  trimmedChoices.forEach((c, ci) => {
    if (!c) {
      push(issues, "error", index, `「${label}」: 選択肢 ${["A", "B", "C"][ci]} が空です。`);
    }
  });

  const uniq = new Set(trimmedChoices.filter(Boolean));
  if (trimmedChoices.filter(Boolean).length === 3 && uniq.size < 3) {
    push(issues, "error", index, `「${label}」: 選択肢に同じ内容が重複しています。`);
  }

  if (answerText && trimmedChoices.every(Boolean)) {
    const resolved = resolveAnswerInChoices(answerText, choices);
    if (resolved === null) {
      push(
        issues,
        "error",
        index,
        `「${label}」: 三択のどれにも正解「${answerText.slice(0, 40)}${answerText.length > 40 ? "…" : ""}」と一致するものがありません（表記を揃えてください）。`
      );
    } else {
      const ci = nq.correctIndex;
      if (ci < 0 || ci > 2) {
        push(issues, "error", index, `「${label}」: 正解の選択肢（A/B/C）の指定が不正です。`);
      } else {
        const picked = choices[ci];
        if (resolveAnswerInChoices(answerText, [picked]) === null) {
          push(
            issues,
            "error",
            index,
            `「${label}」: 「正解の選択肢」で選ばれている肢が、正解文と対応していません。A/B/C を確認してください。`
          );
        }
      }
    }
  }

  const hintSet = new Set(hints.map((h) => String(h).trim()).filter(Boolean));
  if (hintSet.size < 3 && hints.every((h) => String(h).trim())) {
    push(issues, "warning", index, `「${label}」: ヒントの内容が一部同じです。`);
  }

  return issues;
}

/**
 * 学習用教材（UploadedContent）の構成・ヒント・正解・三択が学習画面で成立するか検証する。
 */
export function validateUploadedContent(content: UploadedContent): StudyContentValidationResult {
  const issues: StudyContentIssue[] = [];

  if (!String(content.title ?? "").trim()) {
    push(issues, "error", null, "教材タイトルが空です。");
  }

  if (!content.questions?.length) {
    push(issues, "error", null, "問題が1問もありません。");
  }

  const seenIds = new Map<string, number>();
  content.questions.forEach((q, i) => {
    const id = q.id ?? "";
    if (id) {
      if (seenIds.has(id)) {
        push(issues, "warning", i, `問題ID「${id}」が重複しています（${(seenIds.get(id) ?? 0) + 1}問目と同じ）。`);
      } else {
        seenIds.set(id, i);
      }
    }
  });

  content.questions.forEach((q, index) => {
    issues.push(...validateQuestion(q, index, content));
  });

  const hasError = issues.some((x) => x.severity === "error");
  return { ok: !hasError, issues };
}
