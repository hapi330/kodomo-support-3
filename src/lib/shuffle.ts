export type ShuffledOption = {
  key: string;
  label: string;
  isCorrect: boolean;
};

export function shuffleArrayFisherYates<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

export function buildShuffledOptions(
  labels: string[],
  correctLabel: string,
  keyPrefix: string
): ShuffledOption[] {
  return shuffleArrayFisherYates(
    labels.map((label, i) => ({
      key: `${keyPrefix}-${i}-${label}`,
      label,
      isCorrect: label === correctLabel,
    }))
  );
}

export function shuffledChoiceOrder(choices: string[]): number[] {
  return shuffleArrayFisherYates(choices.map((_, idx) => idx));
}
