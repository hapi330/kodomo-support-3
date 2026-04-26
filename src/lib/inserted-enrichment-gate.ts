import { padChoices } from "@/lib/question-draft";
import { resolveAnswerInChoices } from "@/lib/question-claude-helpers";
import type { GeneratedQuestion, UploadedContent } from "@/lib/storage";

/**
 * 三択が学習に使える状態か。
 * 三択の空・重複・正解不一致のいずれかなら AI 補完の対象とする。
 */
export function lacksValidChoices(q: GeneratedQuestion): boolean {
  const ch = padChoices(q.choices ?? []);
  const trimmed = ch.map((c) => String(c).trim());
  if (trimmed.some((c) => !c)) return true;
  if (new Set(trimmed).size < 3) return true;

  const answer = String(q.answer ?? "").trim();
  if (!answer) return true;
  if (resolveAnswerInChoices(answer, ch) === null) return true;
  return false;
}

/**
 * AI で三択（必要なら正解も）を埋められるか。
 * 問題文があれば、正解が空でも未整備なら対象（差し込みで本文だけ入れたケースを含む）。
 */
export function isEligibleForChoiceAiEnrichment(q: GeneratedQuestion): boolean {
  return Boolean(String(q.question ?? "").trim()) && lacksValidChoices(q);
}

/** 教材に AI 補完が必要な問が1つでもあるか（保存直後の自動生成・手動生成の両方で使用） */
export function hasPendingChoiceEnrichment(content: UploadedContent): boolean {
  return content.questions.some(isEligibleForChoiceAiEnrichment);
}

/**
 * 旧名の互換エイリアス（`hasPendingChoiceEnrichment` と同一）。
 * 古い import やキャッシュで `hasInsertedQuestionsPendingEnrichment` が参照されてもビルドが通るようにする。
 */
export const hasInsertedQuestionsPendingEnrichment = hasPendingChoiceEnrichment;
export const hasPendingChoiceHintEnrichment = hasPendingChoiceEnrichment;
export const isEligibleForChoiceHintAiEnrichment = isEligibleForChoiceAiEnrichment;
export const lacksFilledHintsAndChoices = lacksValidChoices;

/** 学習画面で出題可能か（三択・正解の整合が取れているか） */
export function isQuestionPlayableInStudy(q: GeneratedQuestion): boolean {
  return Boolean(String(q.question ?? "").trim()) && !lacksValidChoices(q);
}
