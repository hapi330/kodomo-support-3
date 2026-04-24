"use client";

import { useEffect, useState } from "react";
import { playClick, playCorrect, playPingPong, speak } from "@/lib/sounds";
import { mcField } from "@/lib/mc-styles";
import { TARGET_REWARD_MILESTONE_XP } from "@/lib/xp-economy";

type Step = "intro" | "write" | "commit";

type RewardPromiseRitualProps = {
  open: boolean;
  childName: string;
  initialText: string;
  soundEnabled: boolean;
  speechEnabled: boolean;
  onClose: () => void;
  /** 約束文と締め日時（ISO）を保存 */
  onSeal: (text: string, sealedAtIso: string) => void;
};

export default function RewardPromiseRitual({
  open,
  childName,
  initialText,
  soundEnabled,
  speechEnabled,
  onSeal,
  onClose,
}: RewardPromiseRitualProps) {
  const [step, setStep] = useState<Step>("intro");
  const [draft, setDraft] = useState(initialText);
  const [parentCommitted, setParentCommitted] = useState(false);
  const [childCommitted, setChildCommitted] = useState(false);

  useEffect(() => {
    if (open) {
      setStep("intro");
      setDraft(initialText);
      setParentCommitted(false);
      setChildCommitted(false);
    }
  }, [open, initialText]);

  if (!open) return null;

  const canSeal = draft.trim().length > 0 && parentCommitted && childCommitted;

  const handleParentCommit = () => {
    if (parentCommitted) return;
    setParentCommitted(true);
    if (soundEnabled) playClick();
  };

  const handleChildCommit = () => {
    if (childCommitted) return;
    setChildCommitted(true);
    if (soundEnabled) playPingPong();
  };

  const handleSeal = () => {
    if (!canSeal) return;
    const iso = new Date().toISOString();
    onSeal(draft.trim(), iso);
    if (soundEnabled) playCorrect();
    if (speechEnabled) {
      speak(
        `おうちの人も${childName}くんも、コミット！みまもりとがんばり、やくそくをまもろうね。`
      );
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.88)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reward-ritual-title"
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6 sm:p-8 space-y-5 animate-slide-up"
        style={{
          background: "linear-gradient(165deg, #1e1b4b 0%, #312e81 40%, #4c1d95 100%)",
          border: "3px solid #C4B5FD",
          boxShadow: "0 0 60px rgba(167,139,250,0.35)",
        }}
      >
        <div className="text-center space-y-1">
          <div className="text-4xl" aria-hidden>
            ✨
          </div>
          <h2
            id="reward-ritual-title"
            className="text-xl sm:text-2xl font-black"
            style={{ color: "#F5D0FE" }}
          >
            ご褒美の約束 — コミットの儀式
          </h2>
          <p className="text-xs" style={{ color: "#C4B5FD" }}>
            けいけんち {TARGET_REWARD_MILESTONE_XP.toLocaleString()} への道のり
          </p>
        </div>

        {step === "intro" && (
          <div className="space-y-4 text-sm leading-relaxed" style={{ color: "#E9D5FF" }}>
            <p>
              ここは、<strong style={{ color: "#FDE68A" }}>{childName}くん</strong>と{" "}
              <strong style={{ color: "#FDE68A" }}>おうちの人</strong>が、ちかくにいて行う
              <strong style={{ color: "#FBBF24" }}>「コミット」</strong>
              のイベントです。ご褒美の内容と、お互いのやくそくを、はっきり言葉にします。
            </p>
            <ul className="space-y-3 pl-1 border-l-2 border-violet-500/50" style={{ color: "#DDD6FE" }}>
              <li className="pl-3">
                <span className="font-black" style={{ color: "#86EFAC" }}>
                  子ども
                </span>
                ：ご褒美にむかって、けいけんちを集めてがんばる
              </li>
              <li className="pl-3">
                <span className="font-black" style={{ color: "#93C5FD" }}>
                  おうちの人
                </span>
                ：{childName}くんを見守り、約束したご褒美を守る
              </li>
            </ul>
            <p className="text-xs" style={{ color: "#A78BFA" }}>
              スマホやタブレットを親子のまんなかに。声に出して読んでもいいですよ。
            </p>
            <button
              type="button"
              onClick={() => setStep("write")}
              className="mc-btn mc-btn-green w-full py-4 text-base font-black"
            >
              はじめる →
            </button>
          </div>
        )}

        {step === "write" && (
          <div className="space-y-3">
            <label className="text-sm font-bold block" style={{ color: "#E9D5FF" }}>
              達成したらもらえるご褒美（親子で決めたこと）
            </label>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={6}
              className="w-full p-4 rounded-xl text-base resize-y min-h-[8rem]"
              style={mcField}
              placeholder="例：春休みにレゴ（◯◯円まで）を一つ選んでいい / 映画に行く など"
            />
            <button
              type="button"
              disabled={!draft.trim()}
              onClick={() => setStep("commit")}
              className="mc-btn mc-btn-green w-full py-3 font-black disabled:opacity-40"
            >
              内容を決めた → コミットへ
            </button>
            <button
              type="button"
              onClick={() => setStep("intro")}
              className="mc-btn mc-btn-gray w-full py-2 text-sm"
            >
              ← もどる
            </button>
          </div>
        )}

        {step === "commit" && (
          <div className="space-y-4">
            <p className="text-xs font-bold text-center" style={{ color: "#FDE68A" }}>
              約束の内容
            </p>
            <div
              className="p-4 rounded-xl text-sm leading-relaxed whitespace-pre-wrap"
              style={{
                background: "rgba(0,0,0,0.35)",
                border: "2px solid #A78BFA",
                color: "#FEF3C7",
              }}
            >
              {draft.trim()}
            </div>

            <p className="text-xs leading-relaxed text-center" style={{ color: "#C4B5FD" }}>
              つぎに、それぞれがタップして<strong style={{ color: "#FBBF24" }}>コミット</strong>
              します。順番はどちらからでも大丈夫です。
            </p>

            {/* 親のコミット */}
            <div
              className="rounded-xl p-4 space-y-2"
              style={{
                background: parentCommitted ? "rgba(34,197,94,0.15)" : "rgba(0,0,0,0.25)",
                border: `2px solid ${parentCommitted ? "#22C55E" : "#4B5563"}`,
              }}
            >
              <div className="text-xs font-black" style={{ color: "#93C5FD" }}>
                おうちの人
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "#E5E7EB" }}>
                わたしは {childName}くんを見守り、ここで約束したご褒美を守ります。
              </p>
              {parentCommitted ? (
                <div
                  className="py-3 text-center font-black rounded-lg"
                  style={{ background: "#14532D", color: "#86EFAC" }}
                >
                  ✓ コミットしました
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleParentCommit}
                  className="mc-btn w-full py-4 text-sm sm:text-base font-black"
                  style={{
                    background: "linear-gradient(90deg, #1D4ED8, #3B82F6)",
                    border: "2px solid #93C5FD",
                    color: "#F8FAFC",
                  }}
                >
                  親としてコミット！
                </button>
              )}
            </div>

            {/* 子どものコミット */}
            <div
              className="rounded-xl p-4 space-y-2"
              style={{
                background: childCommitted ? "rgba(34,197,94,0.15)" : "rgba(0,0,0,0.25)",
                border: `2px solid ${childCommitted ? "#22C55E" : "#4B5563"}`,
              }}
            >
              <div className="text-xs font-black" style={{ color: "#86EFAC" }}>
                {childName}くん
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "#E5E7EB" }}>
                わたしは、けいけんちを集めて、このご褒美にむかってがんばります。
              </p>
              {childCommitted ? (
                <div
                  className="py-3 text-center font-black rounded-lg"
                  style={{ background: "#14532D", color: "#86EFAC" }}
                >
                  ✓ コミットしました
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleChildCommit}
                  className="mc-btn w-full py-4 text-sm sm:text-base font-black"
                  style={{
                    background: "linear-gradient(90deg, #15803D, #22C55E)",
                    border: "2px solid #86EFAC",
                    color: "#F0FDF4",
                  }}
                >
                  {childName}くんとしてコミット！
                </button>
              )}
            </div>

            <button
              type="button"
              disabled={!canSeal}
              onClick={handleSeal}
              className="mc-btn w-full py-4 text-base font-black disabled:opacity-40"
              style={{
                background: canSeal ? "linear-gradient(90deg, #D97706, #F59E0B)" : undefined,
                border: "3px solid #FCD34D",
                color: "#0D1A0D",
              }}
            >
              🤝 ふたりともコミット！約束を結ぶ
            </button>
            <button
              type="button"
              onClick={() => setStep("write")}
              className="mc-btn mc-btn-gray w-full py-2 text-sm"
            >
              ← ご褒美の文を直す
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2 text-xs"
          style={{ color: "#9CA3AF" }}
        >
          閉じる（途中の内容は保存されません）
        </button>
      </div>
    </div>
  );
}
