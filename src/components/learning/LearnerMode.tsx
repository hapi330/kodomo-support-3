"use client";
import { useCallback, useEffect, useState } from "react";
import { GeneratedQuestion, StudyRecord, UploadedContent } from "@/lib/storage";
import { playCorrect, playExplosion, playPingPong, playWrong } from "@/lib/sounds";
import { startStudySessionBgm, stopStudySessionBgm } from "@/lib/study-session-bgm";
import { getSubject } from "@/lib/config";
import { percent } from "@/lib/percent";
import FractionText from "@/components/FractionText";
import ContentEditor from "@/components/learning/ContentEditor";
import { DeleteProblemModal } from "@/components/learning/DeleteProblemModal";
import { EditPasswordModal } from "@/components/learning/EditPasswordModal";
import { useStudyQuestListCrud } from "@/hooks/useStudyQuestListCrud";
import { isQuestionPlayableInStudy } from "@/lib/inserted-enrichment-gate";
import { saveProblemContent } from "@/lib/problems-client";

const CHOICE_BADGE_COLORS = ["#3B82F6", "#D97706", "#EF4444"] as const;
const LETTERS = ["A", "B", "C"] as const;
type BgmCycleMinutes = 5 | 7 | 9;
type BgmRouletteResult = { minutes: BgmCycleMinutes; xpMultiplier: number };
const BGM_ROULETTE_TABLE: ReadonlyArray<BgmRouletteResult> = [
  { minutes: 9, xpMultiplier: 1.0 },
  { minutes: 7, xpMultiplier: 1.2 },
  { minutes: 5, xpMultiplier: 1.5 },
];
const MAX_ROULETTE_SPINS = 3;
/** 本番クイズで問題カードを省くとき、スクリーンリーダー用に全文を残す */
const SR_ONLY =
  "absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0";

function spinBgmRoulette(): BgmRouletteResult {
  const idx = Math.floor(Math.random() * BGM_ROULETTE_TABLE.length);
  return BGM_ROULETTE_TABLE[idx] ?? BGM_ROULETTE_TABLE[0];
}

function assistiveQuestionText(q: GeneratedQuestion): string {
  const extra =
    q.questionFurigana && q.questionFurigana !== q.question
      ? `（${q.questionFurigana}）`
      : "";
  return q.question + extra;
}

function QuestionBody({ q }: { q: GeneratedQuestion }) {
  return (
    <>
      <div className="text-xl font-black leading-relaxed" style={{ color: "#E8E8E8" }}>
        {q.question.split("\n").map((line, i) => (
          <span key={i}>
            {i > 0 && <br />}
            <FractionText text={line} />
          </span>
        ))}
      </div>
      {q.questionFurigana && q.questionFurigana !== q.question && (
        <div className="text-sm mt-1" style={{ color: "#7DC53D" }}>
          ({q.questionFurigana})
        </div>
      )}
    </>
  );
}

function QuestionCard({ q }: { q: GeneratedQuestion }) {
  return (
    <div
      className="p-5 rounded-xl"
      style={{ background: "#0D0D1A", border: "3px solid #4A4A6A" }}
      role="region"
      aria-label="問題"
    >
      <QuestionBody q={q} />
    </div>
  );
}

/** 出題＋ヒントを1枚のカードにまとめる（別カードの重複感を減らす） */
function QuestionAndHintsCard({
  q,
  hintStepCount,
  hintLevel,
  hintsForStep,
}: {
  q: GeneratedQuestion;
  hintStepCount: number;
  hintLevel: number;
  hintsForStep: string[];
}) {
  const hintLabelColors = ["#17DD62", "#60A5FA", "#FCD34D"] as const;
  const hintIcons = ["🌱", "💡", "🔥"] as const;

  return (
    <div
      className="p-5 rounded-xl"
      style={{ background: "#0D0D1A", border: "3px solid #4A4A6A" }}
      role="region"
      aria-label="問題とヒント"
    >
      <QuestionBody q={q} />

      <div className="mt-5 pt-4 border-t border-white/10 space-y-3">
        {hintStepCount > 1 && (
          <div className="text-center text-sm font-bold" style={{ color: "#93C5FD" }}>
            ステップ {hintLevel + 1} / {hintStepCount}
          </div>
        )}
        {hintsForStep.map((hint, i) => (
          <div key={i}>
            <span className="text-xs font-bold" style={{ color: hintLabelColors[i] ?? "#A0C878" }}>
              ヒント {i + 1} {hintIcons[i] ?? "📌"}
            </span>
            <p className="text-base mt-1 leading-relaxed" style={{ color: "#D1D5DB" }}>
              <FractionText text={hint} />
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuestionAssistiveOnly({ q }: { q: GeneratedQuestion }) {
  return (
    <p className={SR_ONLY} aria-live="polite">
      {assistiveQuestionText(q)}
    </p>
  );
}

type TripleChoiceMode = "practice" | "final";

function TripleChoiceButtons({
  choices,
  mode,
  onPick,
  finalState,
}: {
  choices: string[];
  mode: TripleChoiceMode;
  onPick: (index: number) => void;
  /** mode === "final" のとき、選択後の正誤表示に使う */
  finalState?: {
    selectedChoice: number | null;
    correctIndex: number;
    isCorrect: boolean | null;
  };
}) {
  const sel = finalState?.selectedChoice ?? null;
  const correctIdx = finalState?.correctIndex ?? 0;
  const picked = sel !== null;
  const isFinal = mode === "final";

  return (
    <div className="space-y-3">
      {choices.map((choice, i) => {
        const badgeBg = CHOICE_BADGE_COLORS[i] ?? "#4B5563";
        let bg = "#2D2D44";
        let border = "#4A4A6A";
        if (isFinal && picked && finalState) {
          const showGreen = i === correctIdx;
          const isSelected = sel === i;
          if (isSelected) {
            bg = finalState.isCorrect ? "#0D3A0D" : "#3A0D0D";
            border = finalState.isCorrect ? "#17DD62" : "#EF4444";
          } else if (showGreen) {
            bg = "#0D3A0D";
            border = "#17DD62";
          }
        }

        return (
          <button
            key={`${mode}-${i}`}
            type="button"
            onClick={() => onPick(i)}
            disabled={isFinal && picked}
            className={`w-full text-left p-4 rounded-xl font-bold text-base transition-all ${
              isFinal && picked ? "disabled:cursor-not-allowed" : ""
            }`}
            style={{ background: bg, border: `3px solid ${border}` }}
          >
            <span
              className="inline-block w-8 h-8 rounded text-center leading-8 mr-3 text-sm font-black"
              style={{ background: badgeBg, color: "white" }}
            >
              {LETTERS[i]}
            </span>
            <FractionText text={choice} />
          </button>
        );
      })}
    </div>
  );
}

/** プリント清書用：答えを大きく表示（読み書きサポート・全科目共通） */
function AnswerForWorksheetCopy({
  answer,
  answerFurigana,
}: {
  answer: string;
  answerFurigana?: string;
}) {
  const lines = answer.split("\n").filter((l) => l.length > 0);
  const displayLines = lines.length > 0 ? lines : [answer];
  return (
    <div
      className="mt-3 mb-4 px-3 py-5 sm:px-5 rounded-xl text-center"
      style={{
        background: "rgba(0,0,0,0.45)",
        border: "3px solid rgba(127,255,0,0.55)",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)",
      }}
      role="region"
      aria-label="プリントに書くための答え"
    >
      <div className="text-xs sm:text-sm font-black mb-3 tracking-wide" style={{ color: "#A3E635" }}>
        プリントに書く答え（大きく表示）
      </div>
      <div
        className="text-3xl sm:text-4xl md:text-5xl font-black leading-snug break-words"
        style={{ color: "#F8FAFC", letterSpacing: "0.02em" }}
      >
        {displayLines.map((line, i) => (
          <span key={i} className="block">
            <FractionText text={line} />
          </span>
        ))}
      </div>
      {answerFurigana && answerFurigana !== answer && (
        <div
          className="text-lg sm:text-xl md:text-2xl mt-3 font-bold leading-snug"
          style={{ color: "#BBF7D0" }}
        >
          （{answerFurigana}）
        </div>
      )}
    </div>
  );
}

interface LearnerModeProps {
  soundEnabled: boolean;
  onAnswer: (record: StudyRecord) => void;
  /** 経験値を即時加減算する（+はごほうび、-はミスペナルティ） */
  onXPGain: (delta: number) => void;
  childName: string;
  /** 設置（管理者）と同じパスワード — 学習の「編集」に必要 */
  adminPassword: string;
  /** 1教材の問題を最後まで終えたとき（「おわり！」） */
  onStudySessionComplete?: () => void;
  /** ヘッダー「勉強時間」表示（ルーレットサイクル残り） */
  onStudyTimerChange?: (v: null | { remainingSec: number; cycleMin: BgmCycleMinutes }) => void;
}

type Step = "select" | "edit" | "hint" | "quiz" | "result";

export default function LearnerMode({
  soundEnabled,
  onAnswer,
  onXPGain,
  childName,
  adminPassword,
  onStudySessionComplete,
  onStudyTimerChange,
}: LearnerModeProps) {
  const [step, setStep] = useState<Step>("select");
  const enterEditMode = useCallback(() => setStep("edit"), []);
  const leaveEditMode = useCallback(() => setStep("select"), []);

  const quest = useStudyQuestListCrud(adminPassword, {
    onEnterEditMode: enterEditMode,
    onLeaveEditMode: leaveEditMode,
  });

  const [selectedContent, setSelectedContent] = useState<UploadedContent | null>(null);
  const [currentQ, setCurrentQ] = useState<GeneratedQuestion | null>(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [showExplosion, setShowExplosion] = useState(false);
  const [xpGained, setXpGained] = useState(0);
  const [queueIndex, setQueueIndex] = useState(0);
  const [questionQueue, setQuestionQueue] = useState<GeneratedQuestion[]>([]);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [startTime, setStartTime] = useState<number>(0);
  const [bgmRoulette, setBgmRoulette] = useState<BgmRouletteResult | null>(null);
  const [pendingStartContent, setPendingStartContent] = useState<UploadedContent | null>(null);
  const [rouletteSpinCount, setRouletteSpinCount] = useState(0);
  const [rouletteStopped, setRouletteStopped] = useState(false);
  const [showTimeUpFx, setShowTimeUpFx] = useState(false);
  const [showMissPenaltyFx, setShowMissPenaltyFx] = useState(false);
  /** 勉強開始（ルーレット確定）時刻 — ヘッダー用サイクル残り秒の基準 */
  const [studyCycleClockStart, setStudyCycleClockStart] = useState<number | null>(null);

  /** クエスト開始〜一覧に戻るまで：5/7/9分ルーレットのサイクルBGMを繰り返し */
  useEffect(() => {
    if (!soundEnabled || selectedContent === null || bgmRoulette === null) {
      stopStudySessionBgm();
      return;
    }
    startStudySessionBgm({
      cycleMinutes: bgmRoulette.minutes,
      onCycleEndPulse: () => {
        setShowExplosion(true);
        window.setTimeout(() => setShowExplosion(false), 1200);
        setShowTimeUpFx(true);
        window.setTimeout(() => setShowTimeUpFx(false), 1400);
        if (soundEnabled) playExplosion();
      },
    });
    return () => {
      stopStudySessionBgm();
    };
  }, [soundEnabled, selectedContent, bgmRoulette]);

  /** ルーレット画面中は一定間隔で 5/7/9 を回転表示 */
  useEffect(() => {
    if (!pendingStartContent || rouletteStopped) return;
    const id = window.setInterval(() => {
      setBgmRoulette(spinBgmRoulette());
    }, 120);
    return () => {
      window.clearInterval(id);
    };
  }, [pendingStartContent, rouletteStopped]);

  useEffect(() => {
    if (
      studyCycleClockStart == null ||
      !bgmRoulette ||
      !selectedContent ||
      step === "select" ||
      step === "edit"
    ) {
      onStudyTimerChange?.(null);
      return;
    }
    const tick = () => {
      const cycleMs = bgmRoulette.minutes * 60 * 1000;
      const elapsed = Date.now() - studyCycleClockStart;
      const remMs = cycleMs - (elapsed % cycleMs);
      const remainingSec = Math.max(0, Math.ceil(remMs / 1000));
      onStudyTimerChange?.({ remainingSec, cycleMin: bgmRoulette.minutes });
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearInterval(id);
    };
  }, [studyCycleClockStart, bgmRoulette, selectedContent, step, onStudyTimerChange]);

  useEffect(() => {
    return () => {
      onStudyTimerChange?.(null);
    };
  }, [onStudyTimerChange]);

  const startContent = (c: UploadedContent, selectedRoulette: BgmRouletteResult) => {
    setSelectedContent(c);
    setBgmRoulette(selectedRoulette);
    setPendingStartContent(null);
    setRouletteSpinCount(0);
    void Promise.resolve().then(() => {
      setStudyCycleClockStart(Date.now());
    });
    const queue = [...c.questions];
    setQuestionQueue(queue);
    setQueueIndex(0);
    loadQuestion(queue[0]);
  };

  const beginRouletteStart = (c: UploadedContent) => {
    setPendingStartContent(c);
    setRouletteSpinCount(1);
    setBgmRoulette(spinBgmRoulette());
    setRouletteStopped(false);
  };

  const rerollRoulette = () => {
    if (rouletteSpinCount >= MAX_ROULETTE_SPINS) return;
    setRouletteSpinCount((prev) => prev + 1);
    setRouletteStopped(false);
  };

  const stopRoulette = () => {
    if (!pendingStartContent || rouletteStopped) return;
    setRouletteStopped(true);
  };

  const confirmRouletteStart = () => {
    if (!pendingStartContent || !bgmRoulette) return;
    startContent(pendingStartContent, bgmRoulette);
  };

  const cancelRouletteStart = () => {
    setPendingStartContent(null);
    setRouletteSpinCount(0);
    setBgmRoulette(null);
    setRouletteStopped(false);
  };

  const triggerMissPenaltyFx = () => {
    setShowMissPenaltyFx(true);
    window.setTimeout(() => setShowMissPenaltyFx(false), 1200);
  };

  /** 勉強中は speechSynthesis を使わない（答えの先読み・誤読み上げを防ぐ） */
  const loadQuestion = (q: GeneratedQuestion) => {
    setCurrentQ(q);
    setStep("hint");
    setHintLevel(0);
    setSelectedChoice(null);
    setIsCorrect(null);
    setStartTime(Date.now());
  };

  const goToQuiz = () => setStep("quiz");

  /** ヒント各ステップ: 3択が正解なら次のヒントへ。最終ステップならクイズへ。国語はヒント1のみ。国語ヒント中は正解＝ピンポン、不正解＝爆発のみ。 */
  const handleHintStepChoice = (choiceIdx: number) => {
    if (!currentQ || step !== "hint" || !selectedContent) return;
    const kokugo = getSubject(selectedContent.subject).key === "こくご";
    if (choiceIdx === currentQ.correctIndex) {
      if (soundEnabled) {
        if (kokugo) playPingPong();
        else playCorrect();
      }
      const lastHintIndex = kokugo ? 0 : Math.max(0, currentQ.hints.length - 1);
      if (hintLevel < lastHintIndex) {
        setHintLevel((h) => h + 1);
      } else {
        goToQuiz();
      }
    } else {
      onXPGain(-2);
      triggerMissPenaltyFx();
      if (soundEnabled) {
        if (kokugo) playExplosion();
        else {
          playWrong();
          setTimeout(() => playExplosion(), 200);
        }
      }
      setShowExplosion(true);
      setTimeout(() => setShowExplosion(false), 1000);
    }
  };

  const handleAnswer = (choiceIdx: number) => {
    if (!currentQ || selectedChoice !== null) return;
    setSelectedChoice(choiceIdx);
    const correct = choiceIdx === currentQ.correctIndex;
    setIsCorrect(correct);

    const timeSpent = Math.floor((Date.now() - startTime) / 1000);
    const record: StudyRecord = {
      id: `r-${Date.now()}`,
      date: new Date().toISOString(),
      subject: selectedContent?.subject ?? "",
      question: currentQ.question,
      correctAnswer: currentQ.answer,
      userAnswer: currentQ.choices[choiceIdx],
      isCorrect: correct,
      timeSpent,
      xpMultiplier: bgmRoulette?.xpMultiplier ?? 1,
      bgmCycleMinutes: bgmRoulette?.minutes,
    };
    onAnswer(record);

    if (correct) {
      setXpGained(0);
      setSessionCorrect((s) => s + 1);
      if (soundEnabled) playCorrect();
    } else {
      onXPGain(-2);
      triggerMissPenaltyFx();
      setXpGained(0);
      if (soundEnabled) { playWrong(); setTimeout(() => playExplosion(), 300); }
      setShowExplosion(true);
      setTimeout(() => setShowExplosion(false), 1000);
    }
    setSessionTotal((s) => s + 1);
    setStep("result");
  };

  const nextQuestion = () => {
    if (!questionQueue.length) return;
    const nextIdx = queueIndex + 1;
    if (nextIdx >= questionQueue.length) {
      const contentAtEnd = selectedContent;
      const skipBonus = Boolean(contentAtEnd?.studyCleared);
      if (contentAtEnd && !skipBonus) {
        onXPGain(100);
        void saveProblemContent({ ...contentAtEnd, studyCleared: true }).then(() => {
          void quest.refreshContent();
        });
      }
      onStudySessionComplete?.();
      setStudyCycleClockStart(null);
      onStudyTimerChange?.(null);
      setStep("select");
      setSelectedContent(null);
      setBgmRoulette(null);
      setPendingStartContent(null);
      setRouletteSpinCount(0);
      setRouletteStopped(false);
    } else {
      setQueueIndex(nextIdx);
      loadQuestion(questionQueue[nextIdx]);
    }
  };

  if (quest.isLoading) {
    return (
      <div className="text-center py-12 space-y-4">
        <div className="text-6xl animate-float">⏳</div>
        <div className="text-base" style={{ color: "#9CA3AF" }}>もんだいを読み込み中…</div>
      </div>
    );
  }

  if (quest.fetchError) {
    return (
      <div className="text-center py-12 space-y-2">
        <div className="text-4xl">❌</div>
        <div className="text-sm" style={{ color: "#EF4444" }}>{quest.fetchError}</div>
      </div>
    );
  }

  if (quest.content.length === 0) {
    return (
      <div className="text-center py-10 space-y-4">
        <div className="text-6xl animate-float">⛏️</div>
        <div
          className="p-4 rounded-xl mx-2"
          style={{ background: "#0D1A0D", border: "3px solid #5D9E2F" }}
        >
          <div className="text-xl font-black mb-2" style={{ color: "#7FFF00" }}>
            まだぼうけんの準備中だよ！
          </div>
          <div className="text-base leading-relaxed" style={{ color: "#A0C878" }}>
            お父さんに写真をお願いしてね 📸
          </div>
          <div className="text-sm mt-3" style={{ color: "#6B7280" }}>
            写真をアップロードしたら、アプリで問題を作るよ
          </div>
        </div>
        <div className="flex justify-center gap-3 text-3xl">
          <span>🗡️</span><span>🛡️</span><span>💎</span>
        </div>
      </div>
    );
  }

  if (step === "edit" && quest.editDraft) {
    return (
      <div className="space-y-4">
        <ContentEditor
          draft={quest.editDraft}
          onDraftChange={quest.setEditDraft}
          onSave={() => void quest.saveEdit()}
          onCancel={quest.cancelEdit}
          saving={quest.editSaving}
          onAiEnrichHintChoices={() => void quest.runAiEnrichOnEditDraft()}
          aiEnrichBusy={quest.editAiEnrichBusy}
        />
      </div>
    );
  }

  if (step === "select") {
    return (
      <div className="space-y-4 relative">
        <EditPasswordModal
          open={quest.editPasswordGate !== null}
          password={quest.editPasswordInput}
          onPasswordChange={quest.setEditPasswordInput}
          onSubmit={quest.submitEditPassword}
          onCancel={quest.cancelEditPassword}
        />

        <DeleteProblemModal
          open={quest.deleteConfirmId !== null}
          busy={quest.deleteBusy}
          onConfirm={() => void quest.confirmDelete()}
          onCancel={() => quest.setDeleteConfirmId(null)}
        />

        {/* プロフィール挨拶 */}
        <div className="flex items-center gap-2 text-sm" style={{ color: "#A0C878" }}>
          <span className="text-lg">🗡️</span>
          <span className="font-black">{childName}くん</span>
          <span>のクエストリスト</span>
        </div>

        {sessionTotal > 0 && (
          <div
            className="p-3 rounded flex gap-4 text-center"
            style={{ background: "#0D1A0D", border: "2px solid #17DD62" }}
          >
            <div className="flex-1">
              <div className="text-2xl font-black pixel-font" style={{ color: "#7FFF00" }}>
                {sessionCorrect}/{sessionTotal}
              </div>
              <div className="text-xs" style={{ color: "#9CA3AF" }}>せいかいすう</div>
            </div>
            <div className="flex-1">
              <div className="text-2xl font-black pixel-font" style={{ color: "#FCD34D" }}>
                {percent(sessionCorrect, sessionTotal)}%
              </div>
              <div className="text-xs" style={{ color: "#9CA3AF" }}>せいかいりつ</div>
            </div>
          </div>
        )}

        {pendingStartContent && bgmRoulette && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ background: "rgba(0,0,0,0.7)" }}
          >
            <div
              className="w-full max-w-md p-5 rounded-2xl space-y-4 animate-slide-up"
              style={{ background: "#101422", border: "3px solid #17DD62" }}
            >
              <div className="text-center space-y-1">
                <div className="text-xl font-black" style={{ color: "#7FFF00" }}>
                  🎰 BGMルーレット
                </div>
                <div className="text-xs" style={{ color: "#A0C878" }}>
                  スタート前にストップして時間とXP倍率を確定
                </div>
              </div>
              <div
                className={`rounded-xl p-4 text-center ${rouletteStopped ? "" : "animate-pulse"}`}
                style={{ background: "#1E3A14", border: "2px solid #7DC53D" }}
              >
                <div className="text-4xl font-black" style={{ color: "#ECFCCB" }}>
                  {bgmRoulette.minutes}分
                </div>
                <div className="text-lg font-bold mt-1" style={{ color: "#BBF7D0" }}>
                  XP ×{bgmRoulette.xpMultiplier.toFixed(1)}
                </div>
                <div className="text-xs mt-2" style={{ color: "#A0C878" }}>
                  {rouletteStopped ? "確定済み" : "回転中..."}
                </div>
              </div>
              <div className="text-xs text-center" style={{ color: "#A0C878" }}>
                {rouletteSpinCount >= MAX_ROULETTE_SPINS
                  ? "3回目なので再抽選なし"
                  : `再抽選 ${rouletteSpinCount}/3（あと${MAX_ROULETTE_SPINS - rouletteSpinCount}回）`}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {!rouletteStopped ? (
                  <button type="button" onClick={stopRoulette} className="mc-btn mc-btn-red col-span-2">
                    ストップ！
                  </button>
                ) : (
                  <button type="button" onClick={confirmRouletteStart} className="mc-btn mc-btn-green col-span-2">
                    この条件で勉強スタート
                  </button>
                )}
                {rouletteStopped && rouletteSpinCount < MAX_ROULETTE_SPINS && (
                  <button type="button" onClick={rerollRoulette} className="mc-btn mc-btn-blue">
                    もう一回まわす
                  </button>
                )}
                <button type="button" onClick={cancelRouletteStart} className="mc-btn mc-btn-gray">
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3">
          {quest.content.map((c) => {
            const sub = getSubject(c.subject);
            return (
              <div
                key={c.id}
                className="mc-panel mc-card-hover p-3 sm:p-4 w-full"
                style={{ background: "#2D2D44", borderLeft: `4px solid ${sub.color}` }}
              >
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <span className="text-2xl sm:text-3xl shrink-0">{sub.mcIcon}</span>
                  <div className="flex-1 min-w-[140px]">
                    <div className="text-base font-black leading-tight">{c.title}</div>
                    <div className="text-sm" style={{ color: sub.color }}>
                      {c.subject} / {c.questions.length}問
                    </div>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2 ml-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => quest.requestEdit(c)}
                      className="mc-btn mc-btn-blue text-xs sm:text-sm px-2 sm:px-3 py-2"
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      onClick={() => quest.setDeleteConfirmId(c.id)}
                      className="mc-btn mc-btn-red text-xs sm:text-sm px-2 sm:px-3 py-2"
                    >
                      削除
                    </button>
                    <span
                      className="text-[10px] sm:text-xs font-black px-2 py-1.5 rounded min-w-[3.25rem] text-center"
                      style={{
                        background: c.studyCleared ? "#14532D" : "#1F2937",
                        color: c.studyCleared ? "#86EFAC" : "#9CA3AF",
                        border: `2px solid ${c.studyCleared ? "#22C55E" : "#4B5563"}`,
                      }}
                    >
                      {c.studyCleared ? "クリア" : "未クリア"}
                    </span>
                    <button
                      type="button"
                      onClick={() => beginRouletteStart(c)}
                      className="mc-btn mc-btn-green text-sm sm:text-base px-3 py-2 min-w-[2.75rem]"
                      aria-label="はじめる"
                    >
                      ▶
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (!currentQ) return null;

  if (!isQuestionPlayableInStudy(currentQ)) {
    return (
      <div className="space-y-4">
        <div className="text-sm" style={{ color: "#9CA3AF" }}>
          {queueIndex + 1}/{questionQueue.length}
        </div>
        <div
          className="p-6 rounded-xl text-center space-y-4"
          style={{ background: "#2D1A1A", border: "3px solid #DC2626" }}
        >
          <div className="text-5xl">⚠️</div>
          <div className="text-xl font-black" style={{ color: "#FCA5A5" }}>
            この問題はヒント・選択肢が未設定です
          </div>
          <p className="text-sm leading-relaxed" style={{ color: "#D1D5DB" }}>
            問題文だけのまま保存されているか、AI
            生成に失敗している可能性があります。編集で「正解」を入れるか、「ヒント・三択を AI
            で生成（後から実行）」を押してから続きをプレイしてください。
          </p>
          <button
            type="button"
            onClick={() => {
              setStudyCycleClockStart(null);
              onStudyTimerChange?.(null);
              setStep("select");
              setSelectedContent(null);
              setBgmRoulette(null);
              setPendingStartContent(null);
              setRouletteSpinCount(0);
              setRouletteStopped(false);
            }}
            className="mc-btn mc-btn-green px-8 py-3"
          >
            クエスト一覧に戻る
          </button>
        </div>
      </div>
    );
  }

  const isKokugoSingleHint = selectedContent
    ? getSubject(selectedContent.subject).key === "こくご"
    : false;
  const hintStepCount = isKokugoSingleHint ? 1 : Math.max(1, currentQ.hints.length);
  const hintsForStep = isKokugoSingleHint
    ? currentQ.hints.slice(0, 1)
    : currentQ.hints.slice(0, hintLevel + 1);

  const progress = questionQueue.length > 0
    ? Math.round((queueIndex / questionQueue.length) * 100)
    : 0;

  return (
    <div className="space-y-4 relative">
      {showExplosion && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center pointer-events-none"
          style={{ background: "rgba(239,68,68,0.15)" }}
        >
          <div className="text-8xl animate-explode">💥</div>
        </div>
      )}
      {showTimeUpFx && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none"
          style={{ background: "rgba(127,29,29,0.35)" }}
        >
          <div
            className="px-8 py-6 rounded-2xl text-center animate-star-pop"
            style={{ background: "#3A0D0D", border: "4px solid #EF4444" }}
          >
            <div className="text-6xl mb-2">💥</div>
            <div className="text-3xl font-black" style={{ color: "#FCA5A5" }}>
              タイムアップ！
            </div>
          </div>
        </div>
      )}
      {showMissPenaltyFx && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          style={{ background: "rgba(127,29,29,0.4)" }}
        >
          <div
            className="px-8 py-7 rounded-2xl text-center animate-star-pop"
            style={{ background: "#3A0D0D", border: "4px solid #EF4444" }}
          >
            <div className="text-6xl mb-2">💥</div>
            <div className="text-3xl font-black" style={{ color: "#FCA5A5" }}>
              -2 ポイント！
            </div>
          </div>
        </div>
      )}

      {/* Progress */}
      <div className="flex items-center gap-3">
        <span className="text-sm" style={{ color: "#9CA3AF" }}>
          {queueIndex + 1}/{questionQueue.length}
        </span>
        <div className="xp-bar-outer flex-1">
          <div className="xp-bar-inner" style={{ width: `${progress}%` }} />
        </div>
        <button
          onClick={() => {
            setStudyCycleClockStart(null);
            onStudyTimerChange?.(null);
            setStep("select");
            setSelectedContent(null);
            setBgmRoulette(null);
            setPendingStartContent(null);
            setRouletteSpinCount(0);
            setRouletteStopped(false);
          }}
          className="text-xs px-2 py-1 rounded"
          style={{ background: "#374151", color: "#9CA3AF" }}
        >
          やめる
        </button>
      </div>
      {bgmRoulette && (
        <div
          className="text-xs font-bold px-3 py-2 rounded text-center"
          style={{ background: "#1E3A14", border: "2px solid #17DD62", color: "#BBF7D0" }}
        >
          🎰 BGMルーレット: {bgmRoulette.minutes}分 / XP ×{bgmRoulette.xpMultiplier.toFixed(1)}
        </div>
      )}

      {step === "hint" && (
        <div className="space-y-3">
          <QuestionAndHintsCard
            q={currentQ}
            hintStepCount={hintStepCount}
            hintLevel={hintLevel}
            hintsForStep={hintsForStep}
          />
          <TripleChoiceButtons
            choices={currentQ.choices}
            mode="practice"
            onPick={handleHintStepChoice}
          />
        </div>
      )}

      {step === "quiz" && (
        <div className="space-y-3">
          <QuestionAssistiveOnly q={currentQ} />
          <TripleChoiceButtons
            choices={currentQ.choices}
            mode="final"
            onPick={handleAnswer}
            finalState={{
              selectedChoice,
              correctIndex: currentQ.correctIndex,
              isCorrect,
            }}
          />
        </div>
      )}

      {/* Result */}
      {step === "result" && (
        <div className="space-y-3">
          <QuestionCard q={currentQ} />
          <div
            className="p-5 rounded-xl text-center animate-slide-up"
            style={{
              background: isCorrect ? "#0D3A0D" : "#1A0D0D",
              border: `3px solid ${isCorrect ? "#17DD62" : "#EF4444"}`,
            }}
          >
          <div className="text-5xl mb-3">{isCorrect ? "🎉" : "💥"}</div>
          <div className="text-2xl font-black mb-2" style={{ color: isCorrect ? "#7FFF00" : "#EF4444" }}>
            {isCorrect ? "せいかい！" : "ざんねん…"}
          </div>
          <AnswerForWorksheetCopy
            answer={currentQ.answer}
            answerFurigana={currentQ.answerFurigana}
          />
          {isCorrect && xpGained > 0 && (
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className="text-sm" style={{ color: "#9CA3AF" }}>+</span>
              <span className="pixel-font text-2xl font-bold" style={{ color: "#7FFF00" }}>{xpGained}</span>
              <span className="text-sm" style={{ color: "#7FFF00" }}>XP ゲット！</span>
            </div>
          )}
          <button
            onClick={nextQuestion}
            className={`mc-btn ${isCorrect ? "mc-btn-green" : "mc-btn-blue"} px-8 py-3 text-base`}
          >
            {queueIndex + 1 >= questionQueue.length ? "🏁 おわり！" : "つぎの問題 →"}
          </button>
          </div>
        </div>
      )}
    </div>
  );
}
