import { resolveAnswerInChoices } from "@/lib/question-claude-helpers";
import { getSubject } from "@/lib/config";
import { buildQuizHintSteps } from "@/lib/expand-study-hint-steps";
import {
  formatQuestionBlockTitle,
  normalizeQuestion,
  padChoices,
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
  const isMath = getSubject(draft.subject).key === "さんすう";
  const stepCount = (nq.hints ?? []).map((h) => String(h).trim()).filter(Boolean).length;
  const richStepCount = Array.isArray(nq.hintSteps) ? nq.hintSteps.length : 0;
  const diagramUrl = String(nq.diagramImageUrl ?? "").trim();
  if (isMath && diagramUrl.length > 0) {
    const quizHintSteps = buildQuizHintSteps(nq).length;
    if (quizHintSteps > 0 && quizHintSteps < 3) {
      push(
        issues,
        "warning",
        index,
        `「${label}」: 図式問題のヒントが ${quizHintSteps} 段階です。発達支援のため、ヒント欄を3つ埋めるか、「1. … 2. … 3. …」の形で段階を分けるとよいです。`
      );
    }
  }
  if (isMath && stepCount === 0 && richStepCount === 0) {
    push(issues, "warning", index, `「${label}」: 算数は解き方ステップが未設定です。`);
  }
  if (Array.isArray(nq.hintSteps)) {
    nq.hintSteps.forEach((step, si) => {
      if (!step.prompt?.trim() && !step.explanation?.trim()) {
        push(
          issues,
          "error",
          index,
          `「${label}」: ヒントステップ${si + 1}の問い（prompt）か説明（explanation）のどちらかが必要です。`
        );
      }
      if (!Array.isArray(step.choices) || step.choices.length !== 3) {
        push(issues, "error", index, `「${label}」: ヒントステップ${si + 1}は3択（3件）が必要です。`);
        return;
      }
      const correctCount = step.choices.filter((c) => c.isCorrect).length;
      if (correctCount !== 1) {
        push(
          issues,
          "error",
          index,
          `「${label}」: ヒントステップ${si + 1}は正解フラグ isCorrect=true を1つだけ設定してください。`
        );
      }
    });
  }

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

  const imageUrl = String(nq.diagramImageUrl ?? "").trim();
  if (imageUrl && !/^https?:\/\/|^\//.test(imageUrl)) {
    push(
      issues,
      "warning",
      index,
      `「${label}」: 図画像URLは「/」始まりか https:// で指定してください。`
    );
  }

  const unit = String(nq.answerUnit ?? "").trim();
  if (unit.length > 0 && unit.length > 12) {
    push(issues, "warning", index, `「${label}」: 単位が長すぎる可能性があります。`);
  }

  (nq.diagramHotspots ?? []).forEach((hs, hi) => {
    if (hs.w <= 0 || hs.h <= 0) {
      push(issues, "warning", index, `「${label}」: 注目領域${hi + 1}の幅/高さが0以下です。`);
      return;
    }
    const outOfRange =
      hs.x < 0 || hs.y < 0 || hs.w < 0 || hs.h < 0 || hs.x + hs.w > 100 || hs.y + hs.h > 100;
    if (outOfRange) {
      push(
        issues,
        "warning",
        index,
        `「${label}」: 注目領域${hi + 1}は0-100%の範囲に収まるよう調整してください。`
      );
    }
  });

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
