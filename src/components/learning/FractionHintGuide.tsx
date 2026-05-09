"use client";

import { useCallback, useRef, useState } from "react";
import FractionText from "@/components/FractionText";
import {
  FRACTION_HINT_PASS_POINTS,
  type FractionHintPlan,
} from "@/lib/fraction-hint-plan";
import { playCorrect, playExplosion, playLevelUp, playPingPong } from "@/lib/sounds";
import { buildShuffledOptions, type ShuffledOption } from "@/lib/shuffle";
import { STEP_SCROLL_DELAY_MS, STEP_WRONG_RESET_MS } from "@/lib/study-ui-timing";

const FRACTION_HINT_PANEL_STYLE = { background: "#172554", border: "1px solid #60A5FA" } as const;
const FRACTION_HINT_BUTTON_STYLE = { background: "#1E3A8A", border: "1px solid #60A5FA", color: "#DBEAFE" } as const;

export function FractionHintGuide({
  plan,
  soundEnabled,
  onPenalty,
  onPass,
}: {
  plan: FractionHintPlan;
  soundEnabled: boolean;
  onPenalty: () => void;
  onPass: () => void;
}) {
  const [step1Solved, setStep1Solved] = useState(false);
  const [step2Solved, setStep2Solved] = useState(false);
  const [step3Solved, setStep3Solved] = useState(false);
  const [step1Locked, setStep1Locked] = useState(false);
  const [step2Locked, setStep2Locked] = useState(false);
  const [step3Locked, setStep3Locked] = useState(false);
  const [feedback1, setFeedback1] = useState("");
  const [feedback2, setFeedback2] = useState("");
  const [feedback3, setFeedback3] = useState("");
  const [showCrackerFx, setShowCrackerFx] = useState(false);
  const step2Ref = useRef<HTMLDivElement | null>(null);
  const step3Ref = useRef<HTMLDivElement | null>(null);
  const hasStep3 = Boolean(
    plan.step3Correct && Array.isArray(plan.step3Choices) && plan.step3Choices.length === 3
  );
  const [step1Options] = useState<ShuffledOption[]>(() =>
    buildShuffledOptions(plan.step1Choices, plan.step1Correct, "f-step1")
  );
  const [step2Options] = useState<ShuffledOption[]>(() =>
    buildShuffledOptions(plan.step2Choices, plan.step2Correct, "f-step2")
  );
  const [step3Options] = useState<ShuffledOption[]>(() =>
    hasStep3 && plan.step3Choices && plan.step3Correct
      ? buildShuffledOptions(plan.step3Choices, plan.step3Correct, "f-step3")
      : []
  );

  const handleWrongChoice = useCallback(
    (setLocked: (v: boolean) => void, setFeedback: (msg: string) => void, message: string) => {
      if (soundEnabled) playExplosion();
      onPenalty();
      setLocked(true);
      setFeedback(message);
      window.setTimeout(() => setLocked(false), STEP_WRONG_RESET_MS);
    },
    [onPenalty, soundEnabled]
  );

  const celebrateStep2Solved = useCallback(() => {
    if (soundEnabled) {
      playLevelUp();
      playCorrect();
    }
    setShowCrackerFx(true);
    window.setTimeout(() => setShowCrackerFx(false), 900);
    onPass();
  }, [onPass, soundEnabled]);

  return (
    <div className="p-4 rounded-xl space-y-4 relative" style={{ background: "#0D0D1A", border: "2px solid #3B82F6" }}>
      {showCrackerFx && (
        <div
          className="fixed inset-0 z-[80] pointer-events-none flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.3)" }}
        >
          <div className="text-center">
            <div className="text-6xl animate-star-pop">🎉</div>
            <div className="text-2xl font-black mt-2" style={{ color: "#FDE68A" }}>
              クラッカー！
            </div>
            <div className="flex items-center justify-center gap-3 mt-2 text-2xl">
              <span style={{ animation: "confetti-fall 0.8s linear forwards" }}>🎊</span>
              <span style={{ animation: "confetti-fall 1s linear forwards" }}>✨</span>
              <span style={{ animation: "confetti-fall 0.9s linear forwards" }}>🎊</span>
            </div>
          </div>
        </div>
      )}
      <div className="text-sm font-black" style={{ color: "#93C5FD" }}>
        💡 とき方（{hasStep3 ? 3 : 2}ステップ）
      </div>

      <div className="rounded-lg p-3 space-y-2" style={FRACTION_HINT_PANEL_STYLE}>
        <div className="text-xs sm:text-sm leading-relaxed" style={{ color: "#BFDBFE" }}>
          {plan.step1Explanation ?? "ヒント1を見て、考え方を確認しよう。"}
        </div>
        <div className="text-sm font-black" style={{ color: "#DBEAFE" }}>
          {plan.step1Prompt}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {step1Options.map((option) => (
            <button
              key={option.key}
              type="button"
              disabled={step1Solved || step1Locked}
              onClick={() => {
                const ok = option.isCorrect;
                if (ok) {
                  if (soundEnabled) playPingPong();
                  setStep1Solved(true);
                  setFeedback1("✅ 正解！ヒント2へ進もう");
                  window.setTimeout(
                    () => step2Ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
                    STEP_SCROLL_DELAY_MS
                  );
                  return;
                }
                handleWrongChoice(setStep1Locked, setFeedback1, "❌ もう一度！最小公倍数を考えてみよう");
              }}
              className="px-3 py-2 rounded-lg text-sm font-black disabled:opacity-60"
              style={FRACTION_HINT_BUTTON_STYLE}
            >
              <FractionText text={option.label} />
            </button>
          ))}
        </div>
        {feedback1 && (
          <div className="text-xs font-bold" style={{ color: step1Solved ? "#86EFAC" : "#FCA5A5" }}>
            {feedback1}
          </div>
        )}
      </div>

      {step1Solved && (
        <div ref={step2Ref} className="rounded-lg p-3 space-y-2" style={FRACTION_HINT_PANEL_STYLE}>
          <div className="text-xs sm:text-sm leading-relaxed" style={{ color: "#BFDBFE" }}>
            {plan.step2Explanation ?? "ヒント2を見て、答えまでの手順を確認しよう。"}
          </div>
          {plan.step2Formula && (
            <div className="text-sm font-black leading-relaxed" style={{ color: "#DBEAFE" }}>
              <FractionText text={plan.step2Formula} />
            </div>
          )}
          <div className="text-sm font-black" style={{ color: "#DBEAFE" }}>
            {plan.step2Prompt}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {step2Options.map((option) => (
              <button
                key={option.key}
                type="button"
                disabled={step2Solved || step2Locked}
                onClick={() => {
                  const ok = option.isCorrect;
                  if (ok) {
                    setStep2Solved(true);
                    if (hasStep3) {
                      setFeedback2("✅ ステップ2クリア！つぎのステップへ");
                      window.setTimeout(
                        () => step3Ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
                        STEP_SCROLL_DELAY_MS
                      );
                    } else {
                      setFeedback2(`🎉 クリア！ +${FRACTION_HINT_PASS_POINTS} ポイント`);
                      celebrateStep2Solved();
                    }
                    return;
                  }
                  handleWrongChoice(setStep2Locked, setFeedback2, "❌ ちがうよ。通分後の式でもう一度計算しよう");
                }}
                className="px-3 py-2 rounded-lg text-sm font-black disabled:opacity-60"
                style={FRACTION_HINT_BUTTON_STYLE}
              >
                <FractionText text={option.label} />
              </button>
            ))}
          </div>
          {feedback2 && (
            <div className="text-xs font-bold" style={{ color: step2Solved ? "#86EFAC" : "#FCA5A5" }}>
              {feedback2}
            </div>
          )}
        </div>
      )}

      {step2Solved && hasStep3 && (
        <div ref={step3Ref} className="rounded-lg p-3 space-y-2" style={FRACTION_HINT_PANEL_STYLE}>
          <div className="text-xs sm:text-sm leading-relaxed" style={{ color: "#BFDBFE" }}>
            {plan.step3Explanation ?? "ステップ3を確認して、最後の答えを確定しよう。"}
          </div>
          <div className="text-sm font-black" style={{ color: "#DBEAFE" }}>
            {plan.step3Prompt}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {step3Options.map((option) => (
              <button
                key={option.key}
                type="button"
                disabled={step3Solved || step3Locked}
                onClick={() => {
                  const ok = option.isCorrect;
                  if (ok) {
                    setStep3Solved(true);
                    setFeedback3(`🎉 クリア！ +${FRACTION_HINT_PASS_POINTS} ポイント`);
                    celebrateStep2Solved();
                    return;
                  }
                  handleWrongChoice(setStep3Locked, setFeedback3, "❌ もう一度。ヒント3を見て考えてみよう");
                }}
                className="px-3 py-2 rounded-lg text-sm font-black disabled:opacity-60"
                style={FRACTION_HINT_BUTTON_STYLE}
              >
                <FractionText text={option.label} />
              </button>
            ))}
          </div>
          {feedback3 && (
            <div className="text-xs font-bold" style={{ color: step3Solved ? "#86EFAC" : "#FCA5A5" }}>
              {feedback3}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
