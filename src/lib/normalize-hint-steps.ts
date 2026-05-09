import type { GeneratedQuestion } from "@/lib/storage";

/** Claude / JSON / 編集画面から受け取った hintSteps を `GeneratedQuestion` 用に正規化する（最大3段） */
export function normalizeHintStepsArray(
  raw: GeneratedQuestion["hintSteps"] | unknown[] | undefined | null
): GeneratedQuestion["hintSteps"] {
  if (!Array.isArray(raw)) return undefined;
  const mapped = raw
    .map((step) => ({
      prompt: String((step as { prompt?: unknown })?.prompt ?? "").trim(),
      explanation:
        String((step as { explanation?: unknown })?.explanation ?? "").trim() || undefined,
      choices: Array.isArray((step as { choices?: unknown }).choices)
        ? (step as { choices: unknown[] }).choices
            .map((choice) => ({
              text: String((choice as { text?: unknown })?.text ?? "").trim(),
              isCorrect: Boolean((choice as { isCorrect?: unknown })?.isCorrect),
            }))
            .filter((choice) => choice.text.length > 0)
            .slice(0, 3)
        : [],
    }))
    .filter(
      (step) =>
        (step.prompt.length > 0 || Boolean(step.explanation)) && step.choices.length === 3
    )
    .slice(0, 3);
  return mapped;
}
