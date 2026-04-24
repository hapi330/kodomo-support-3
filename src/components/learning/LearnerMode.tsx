"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatJaDateTime } from "@/lib/format-ja-datetime";
import { GeneratedQuestion, StudyRecord, UploadedContent, type StudySessionCompletePayload } from "@/lib/storage";
import { playCorrect, playExplosion, playPingPong, playWrong } from "@/lib/sounds";
import {
  setStudySessionBgmMuted,
  startStudySessionBgm,
  stopStudySessionBgm,
} from "@/lib/study-session-bgm";
import { getSubject } from "@/lib/config";
import { percent } from "@/lib/percent";
import FractionText from "@/components/FractionText";
import ContentEditor from "@/components/learning/ContentEditor";
import { DeleteProblemModal } from "@/components/learning/DeleteProblemModal";
import { EditPasswordModal } from "@/components/learning/EditPasswordModal";
import { useStudyQuestListCrud } from "@/hooks/useStudyQuestListCrud";
import { isQuestionPlayableInStudy } from "@/lib/inserted-enrichment-gate";
import { saveProblemContent } from "@/lib/problems-client";
import {
  XP_FIRST_CONTENT_CLEAR_BONUS,
  XP_HINT_MISS,
  XP_PREP_CLEAR_BONUS,
  XP_PREP_MISS,
  XP_QUIZ_MISS,
  xpForQuizCorrect,
} from "@/lib/xp-economy";
import {
  DEFAULT_BGM_WITHOUT_ROULETTE,
  MAX_ROULETTE_SPINS,
  PREP_BGM_RESULT,
  PREP_SESSION_MINUTES,
  type BgmCycleMinutes,
  type BgmRouletteResult,
  type RouletteFlowPhase,
  spinBgmRoulette,
} from "@/lib/bgm-roulette";
import { BgmRouletteSpinModal, RouletteChooseModal } from "@/components/learning/RouletteStartModals";
import ReadingPassagePanel from "@/components/learning/ReadingPassagePanel";

const CHOICE_BADGE_COLORS = ["#3B82F6", "#D97706", "#EF4444"] as const;
const LETTERS = ["A", "B", "C"] as const;
/** 本番クイズで問題カードを省くとき、スクリーンリーダー用に全文を残す */
const SR_ONLY =
  "absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0";
const DIAGRAM_ACTIVE_BG = "rgba(34,197,94,0.35)";
const DIAGRAM_IDLE_BG = "rgba(34,197,94,0.12)";
const normalizeHintForDedup = (hint: string): string =>
  hint
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[。．.!！?？、,]/g, "");

function assistiveQuestionText(q: GeneratedQuestion): string {
  const extra =
    q.questionFurigana && q.questionFurigana !== q.question
      ? `（${q.questionFurigana}）`
      : "";
  return q.question + extra;
}

function DiagramFigure({ q }: { q: GeneratedQuestion }) {
  const [activeHotspot, setActiveHotspot] = useState<number | null>(null);
  const hotspots = q.diagramHotspots ?? [];
  if (!q.diagramImageUrl) return null;

  const toggleHotspot = (i: number) => {
    setActiveHotspot((prev) => (prev === i ? null : i));
  };

  return (
    <div className="mt-4 space-y-2">
      <div
        className="relative w-full max-w-2xl mx-auto rounded-xl overflow-hidden"
        style={{ border: "2px solid #4A4A6A", background: "#111827" }}
      >
        <img
          src={q.diagramImageUrl}
          alt={q.diagramAlt || "図式問題の図"}
          className="w-full h-auto block"
          loading="lazy"
        />
        {hotspots.map((hs, i) => (
          <button
            key={`${hs.label}-${i}`}
            type="button"
            onClick={() => toggleHotspot(i)}
            className="absolute rounded-md transition-colors"
            style={{
              left: `${hs.x}%`,
              top: `${hs.y}%`,
              width: `${hs.w}%`,
              height: `${hs.h}%`,
              border: "2px solid #22C55E",
              background: activeHotspot === i ? DIAGRAM_ACTIVE_BG : DIAGRAM_IDLE_BG,
            }}
            aria-label={`図の注目ポイント: ${hs.label}`}
            title={hs.label}
          />
        ))}
      </div>
      {hotspots.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center">
          {hotspots.map((hs, i) => (
            <button
              key={`tag-${hs.label}-${i}`}
              type="button"
              onClick={() => toggleHotspot(i)}
              className="px-2 py-1 rounded text-xs font-bold"
              style={{
                background: activeHotspot === i ? "#14532D" : "#1F2937",
                border: `1px solid ${activeHotspot === i ? "#22C55E" : "#4B5563"}`,
                color: activeHotspot === i ? "#86EFAC" : "#D1D5DB",
              }}
            >
              {hs.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionBody({ q }: { q: GeneratedQuestion }) {
  return (
    <>
      <div className="text-xl sm:text-2xl font-black leading-relaxed" style={{ color: "#E8E8E8" }}>
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
      <DiagramFigure q={q} />
    </>
  );
}

function QuestionCard({ q, speechEnabled = false }: { q: GeneratedQuestion; speechEnabled?: boolean }) {
  return (
    <div
      className="p-5 rounded-xl"
      style={{ background: "#0D0D1A", border: "3px solid #4A4A6A" }}
      role="region"
      aria-label="問題"
    >
      <ReadingPassagePanel q={q} speechEnabled={speechEnabled} />
      <QuestionBody q={q} />
    </div>
  );
}

/** 出題＋ヒントを1枚のカードにまとめる（別カードの重複感を減らす） */
function QuestionAndHintsCard({
  q,
  hintStepCount,
  hintLevel,
  visibleHints,
  speechEnabled,
}: {
  q: GeneratedQuestion;
  hintStepCount: number;
  hintLevel: number;
  visibleHints: string[];
  speechEnabled: boolean;
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
      <ReadingPassagePanel q={q} speechEnabled={speechEnabled} />
      <QuestionBody q={q} />

      <div className="mt-5 pt-4 border-t border-white/10 space-y-4">
        {hintStepCount > 1 && (
          <div className="text-center text-sm sm:text-base font-bold" style={{ color: "#93C5FD" }}>
            ステップ {hintLevel + 1} / {hintStepCount}
          </div>
        )}
        {visibleHints.length === 0 && (
          <p className="text-base sm:text-lg leading-relaxed text-center" style={{ color: "#9CA3AF" }}>
            この問題はヒントなしでチャレンジ！
          </p>
        )}
        {visibleHints.map((hint, i) => (
          <div key={i}>
            <span
              className="text-sm sm:text-base font-bold"
              style={{ color: hintLabelColors[i] ?? "#A0C878" }}
            >
              ヒント {Math.min(hintLevel + 1, 3)} {hintIcons[Math.min(hintLevel, 2)] ?? "📌"}
            </span>
            <p className="text-lg sm:text-xl mt-2 leading-relaxed" style={{ color: "#D1D5DB" }}>
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
    <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full" role="group" aria-label="三択">
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
            className={`flex flex-col items-center justify-start gap-1.5 sm:gap-2 min-h-[7.5rem] sm:min-h-[8.5rem] p-2 sm:p-3 rounded-xl font-bold text-center transition-all touch-manipulation ${
              isFinal && picked ? "disabled:cursor-not-allowed" : "active:scale-[0.98]"
            }`}
            style={{ background: bg, border: `3px solid ${border}` }}
          >
            <span
              className="shrink-0 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg text-xs sm:text-sm font-black"
              style={{ background: badgeBg, color: "white" }}
            >
              {LETTERS[i]}
            </span>
            <div className="w-full min-h-0 flex-1 overflow-y-auto overscroll-contain text-sm sm:text-base leading-snug sm:leading-relaxed break-words [scrollbar-width:thin]">
              <FractionText text={choice} />
            </div>
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
  answerUnit,
}: {
  answer: string;
  answerFurigana?: string;
  answerUnit?: string;
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
      {answerUnit && (
        <div className="text-sm sm:text-base mt-2 font-bold" style={{ color: "#93C5FD" }}>
          単位: {answerUnit}
        </div>
      )}
    </div>
  );
}

interface LearnerModeProps {
  soundEnabled: boolean;
  /** せっていの「音声よみあげ」ON のとき、本文の読み上げボタンを有効にする */
  speechEnabled: boolean;
  onAnswer: (record: StudyRecord) => void;
  /** 経験値を即時加減算する（+はごほうび、-はミスペナルティ） */
  onXPGain: (delta: number) => void;
  childName: string;
  /** 設置（管理者）と同じパスワード — 学習の「編集」に必要 */
  adminPassword: string;
  /** 1教材の問題を最後まで終えたとき（「おわり！」）— 日時付きログ用 */
  onStudySessionComplete?: (info: StudySessionCompletePayload) => void;
  /** ヘッダー「勉強時間」表示（ルーレットサイクル残り） */
  onStudyTimerChange?: (v: null | { remainingSec: number; cycleMin: BgmCycleMinutes }) => void;
}

type Step = "select" | "edit" | "hint" | "quiz" | "result";

export default function LearnerMode({
  soundEnabled,
  speechEnabled,
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

  /** クエスト一覧: 未クリア / クリア済み */
  const [questListTab, setQuestListTab] = useState<"challenge" | "cleared">("challenge");
  const { challengeList, clearedList } = useMemo(() => {
    const ch: UploadedContent[] = [];
    const cl: UploadedContent[] = [];
    for (const c of quest.content) {
      if (c.studyCleared) cl.push(c);
      else ch.push(c);
    }
    return { challengeList: ch, clearedList: cl };
  }, [quest.content]);
  const displayedQuests = questListTab === "challenge" ? challengeList : clearedList;

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
  /** ▶ のあと：まず「ルーレットする？」→ 選んだら spin でルーレット画面 */
  const [roulettePhase, setRoulettePhase] = useState<RouletteFlowPhase | null>(null);
  const [showTimeUpFx, setShowTimeUpFx] = useState(false);
  const [showMissPenaltyFx, setShowMissPenaltyFx] = useState(false);
  /** 勉強開始（ルーレット確定）時刻 — ヘッダー用サイクル残り秒の基準 */
  const [studyCycleClockStart, setStudyCycleClockStart] = useState<number | null>(null);
  /** 勉強セッション中のループ BGM のミュート（効果音・読み上げとは別） */
  const [studyBgmMuted, setStudyBgmMuted] = useState(false);
  /** 教材クリア直後：OK で閉じるサマリー（ミス・ルーレット・獲得XP） */
  const [sessionClearSummaryModal, setSessionClearSummaryModal] = useState<{
    missCount: number;
    missPenaltyXp: number;
    cycleMinutes: number;
    xpMultiplier: number;
    netXpGained: number;
  } | null>(null);
  /** セッション集計（startContent でリセット） */
  const [sessionHintMisses, setSessionHintMisses] = useState(0);
  const [sessionQuizMisses, setSessionQuizMisses] = useState(0);
  const [sessionQuizXpSum, setSessionQuizXpSum] = useState(0);

  /** 勉強中の「やめる」・エラー戻り・最終問題クリア後に共通 */
  const leaveStudySessionToSelect = useCallback(() => {
    setStudyCycleClockStart(null);
    onStudyTimerChange?.(null);
    setStep("select");
    setSelectedContent(null);
    setBgmRoulette(null);
    setPendingStartContent(null);
    setRoulettePhase(null);
    setRouletteSpinCount(0);
    setRouletteStopped(false);
    setStudyBgmMuted(false);
  }, [onStudyTimerChange]);

  useEffect(() => {
    setStudySessionBgmMuted(studyBgmMuted);
  }, [studyBgmMuted]);

  useEffect(() => {
    if (!soundEnabled || selectedContent === null || bgmRoulette === null) {
      setStudyBgmMuted(false);
    }
  }, [soundEnabled, selectedContent, bgmRoulette]);

  /** クエスト開始〜一覧に戻るまで：BGMサイクル（本試験は 8/10/12 分、予習は3分） */
  useEffect(() => {
    if (!soundEnabled || selectedContent === null || bgmRoulette === null) {
      stopStudySessionBgm();
      return;
    }
    const isPrep = bgmRoulette.minutes === PREP_SESSION_MINUTES;
    startStudySessionBgm({
      cycleMinutes: bgmRoulette.minutes,
      onCycleEndPulse: isPrep
        ? undefined
        : () => {
            setShowExplosion(true);
            window.setTimeout(() => setShowExplosion(false), 1400);
            setShowTimeUpFx(true);
            window.setTimeout(() => setShowTimeUpFx(false), 2600);
            if (soundEnabled) playExplosion();
          },
    });
    return () => {
      stopStudySessionBgm();
    };
  }, [soundEnabled, selectedContent, bgmRoulette]);

  /** ルーレット画面中は一定間隔で 8/10/12 を回転表示（「する」を選んだあとだけ） */
  useEffect(() => {
    if (!pendingStartContent || rouletteStopped || roulettePhase !== "spin") return;
    const id = window.setInterval(() => {
      setBgmRoulette(spinBgmRoulette());
    }, 120);
    return () => {
      window.clearInterval(id);
    };
  }, [pendingStartContent, rouletteStopped, roulettePhase]);

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
    setSessionClearSummaryModal(null);
    setSessionHintMisses(0);
    setSessionQuizMisses(0);
    setSessionQuizXpSum(0);
    setSessionCorrect(0);
    setSessionTotal(0);
    setSelectedContent(c);
    setBgmRoulette(selectedRoulette);
    setPendingStartContent(null);
    setRoulettePhase(null);
    setRouletteSpinCount(0);
    void Promise.resolve().then(() => {
      setStudyCycleClockStart(Date.now());
    });
    const queue = [...c.questions];
    setQuestionQueue(queue);
    setQueueIndex(0);
    loadQuestion(queue[0]);
  };

  /** ▶：まず「ルーレットする？しない？」 */
  const openRouletteChooseModal = (c: UploadedContent) => {
    setSessionClearSummaryModal(null);
    setPendingStartContent(c);
    setRoulettePhase("choose");
  };

  /** 予習：本試験と同じヒント→3択。プリント清書なし（アプリのみ） */
  const startPrepSession = (c: UploadedContent) => {
    startContent(c, PREP_BGM_RESULT);
  };

  /** しない → 12分・×1.0 で即スタート */
  const startStudyWithoutRoulette = () => {
    if (!pendingStartContent) return;
    startContent(pendingStartContent, DEFAULT_BGM_WITHOUT_ROULETTE);
  };

  /** する → ルーレット画面へ */
  const confirmRouletteSpin = () => {
    if (!pendingStartContent) return;
    setRoulettePhase("spin");
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
    setRoulettePhase(null);
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

  /** ヒント段階では最終答えを表示しない。ヒントを順に見た後で本番クイズへ進む。 */
  const nextHintStep = () => {
    if (!currentQ || step !== "hint") return;
    const seen = new Set<string>();
    const usableHints = currentQ.hints
      .map((h) => String(h).trim())
      .filter(Boolean)
      .filter((hint) => {
        const normalized = normalizeHintForDedup(hint);
        if (seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
      });
    const lastHintIndex = Math.max(0, usableHints.length - 1);
    if (hintLevel < lastHintIndex) {
      if (soundEnabled) playCorrect();
      setHintLevel((h) => h + 1);
      return;
    }
    if (soundEnabled) playCorrect();
    setStep("quiz");
  };

  const handleAnswer = (choiceIdx: number) => {
    if (!currentQ || selectedChoice !== null) return;
    setSelectedChoice(choiceIdx);
    const correct = choiceIdx === currentQ.correctIndex;
    setIsCorrect(correct);

    const timeSpent = Math.floor((Date.now() - startTime) / 1000);
    const mult = bgmRoulette?.xpMultiplier ?? 1;
    const gained = correct ? xpForQuizCorrect(mult) : 0;
    const record: StudyRecord = {
      id: `r-${Date.now()}`,
      date: new Date().toISOString(),
      subject: selectedContent?.subject ?? "",
      question: currentQ.question,
      correctAnswer: currentQ.answer,
      userAnswer: currentQ.choices[choiceIdx],
      isCorrect: correct,
      timeSpent,
      xpMultiplier: mult,
      bgmCycleMinutes: bgmRoulette?.minutes,
      quizXpEarned: correct ? gained : undefined,
    };
    onAnswer(record);

    if (correct) {
      onXPGain(gained);
      setXpGained(gained);
      setSessionQuizXpSum((s) => s + gained);
      setSessionCorrect((s) => s + 1);
      if (soundEnabled) {
        const kokugoSubj = getSubject(selectedContent?.subject ?? "").key === "こくご";
        if (kokugoSubj) playPingPong();
        else playCorrect();
      }
    } else {
      setSessionQuizMisses((n) => n + 1);
      onXPGain(
        bgmRoulette?.minutes === PREP_SESSION_MINUTES ? XP_PREP_MISS : XP_QUIZ_MISS
      );
      triggerMissPenaltyFx();
      setXpGained(0);
      if (soundEnabled) { playWrong(); setTimeout(() => playExplosion(), 300); }
      setShowExplosion(true);
      setTimeout(() => setShowExplosion(false), 1000);
    }
    setSessionTotal((s) => s + 1);
    const isLastQuestion = queueIndex + 1 >= questionQueue.length;
    if (!correct && isLastQuestion) {
      setSelectedChoice(null);
      setIsCorrect(null);
      setStep("quiz");
      return;
    }
    setStep("result");
  };

  const nextQuestion = () => {
    if (!questionQueue.length) return;
    const nextIdx = queueIndex + 1;
    if (nextIdx >= questionQueue.length) {
      const contentAtEnd = selectedContent;
      const clearedAt = new Date().toISOString();
      const isPrepSession = bgmRoulette?.minutes === PREP_SESSION_MINUTES;

      if (isPrepSession && contentAtEnd) {
        const hintM = sessionHintMisses;
        const quizM = sessionQuizMisses;
        const quizSum = sessionQuizXpSum;
        const missPenaltyXp = (hintM + quizM) * Math.abs(XP_PREP_MISS);
        const missCount = hintM + quizM;
        const netXpGained = quizSum + XP_PREP_CLEAR_BONUS - missPenaltyXp;
        onXPGain(XP_PREP_CLEAR_BONUS);
        setSessionClearSummaryModal({
          missCount,
          missPenaltyXp,
          cycleMinutes: PREP_SESSION_MINUTES,
          xpMultiplier: PREP_BGM_RESULT.xpMultiplier,
          netXpGained,
        });
        leaveStudySessionToSelect();
        return;
      }

      const skipBonus = Boolean(contentAtEnd?.studyCleared);
      const rouletteResolved = bgmRoulette ?? DEFAULT_BGM_WITHOUT_ROULETTE;
      const hintM = sessionHintMisses;
      const quizM = sessionQuizMisses;
      const quizSum = sessionQuizXpSum;
      const missPenaltyXp =
        hintM * Math.abs(XP_HINT_MISS) + quizM * Math.abs(XP_QUIZ_MISS);
      const missCount = hintM + quizM;
      const firstBonusXp = !skipBonus ? XP_FIRST_CONTENT_CLEAR_BONUS : 0;
      const netXpGained = quizSum + firstBonusXp - missPenaltyXp;

      if (contentAtEnd) {
        onStudySessionComplete?.({
          clearedAt,
          contentId: contentAtEnd.id,
          title: contentAtEnd.title,
          subject: contentAtEnd.subject,
          firstClearBonus: !skipBonus,
        });
      }
      if (contentAtEnd && !skipBonus) {
        onXPGain(XP_FIRST_CONTENT_CLEAR_BONUS);
        void saveProblemContent({
          ...contentAtEnd,
          studyCleared: true,
          studyClearedAt: clearedAt,
        }).then(() => {
          void quest.refreshContent();
        });
      }
      if (contentAtEnd) {
        setSessionClearSummaryModal({
          missCount,
          missPenaltyXp,
          cycleMinutes: rouletteResolved.minutes,
          xpMultiplier: rouletteResolved.xpMultiplier,
          netXpGained,
        });
      }
      leaveStudySessionToSelect();
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
      <div className="text-center py-12 space-y-4 px-4">
        <div className="text-4xl">❌</div>
        <div className="text-sm max-w-md mx-auto leading-relaxed" style={{ color: "#EF4444" }}>
          {quest.fetchError}
        </div>
        <button
          type="button"
          className="px-6 py-3 rounded-xl font-bold text-base"
          style={{ background: "#5D9E2F", color: "#fff", border: "2px solid #7FFF00" }}
          onClick={() => void quest.retryLoad()}
        >
          もう一度読み込む
        </button>
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
      <div className="space-y-3 relative">
        {sessionClearSummaryModal && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center px-4"
            style={{ background: "rgba(0,0,0,0.82)" }}
            role="presentation"
          >
            <div
              className="w-full max-w-md rounded-2xl p-6 space-y-4 text-center animate-slide-up shadow-2xl"
              style={{ background: "#101422", border: "3px solid #22C55E" }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="session-clear-summary-title"
            >
              <div
                id="session-clear-summary-title"
                className="text-xl font-black leading-snug"
                style={{ color: "#86EFAC" }}
              >
                お疲れ様でした！
              </div>
              <div className="text-sm sm:text-base leading-relaxed space-y-2" style={{ color: "#E5E7EB" }}>
                <p>
                  ミスは<strong style={{ color: "#FCD34D" }}>{sessionClearSummaryModal.missCount}</strong>
                  回でマイナス
                  <strong style={{ color: "#FCA5A5" }}>{sessionClearSummaryModal.missPenaltyXp}</strong>
                  ポイント！
                </p>
                <p>
                  時間ボーナスは
                  <strong style={{ color: "#93C5FD" }}>{sessionClearSummaryModal.cycleMinutes}</strong>分で
                  <strong style={{ color: "#93C5FD" }}>
                    {sessionClearSummaryModal.xpMultiplier.toFixed(1)}
                  </strong>
                  倍！
                </p>
                <p>
                  獲得ポイントは
                  <strong style={{ color: "#7FFF00" }}>{sessionClearSummaryModal.netXpGained}</strong>
                  ポイント！
                </p>
              </div>
              <button
                type="button"
                className="mc-btn mc-btn-green w-full py-3 text-base font-black"
                onClick={() => setSessionClearSummaryModal(null)}
              >
                OK
              </button>
            </div>
          </div>
        )}

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

        <div
          className="flex rounded-xl overflow-hidden border-2 w-full max-w-xl"
          style={{ borderColor: "#4A4A6A" }}
          role="tablist"
          aria-label="クエストの表示切替"
        >
          <button
            type="button"
            role="tab"
            aria-selected={questListTab === "challenge"}
            onClick={() => setQuestListTab("challenge")}
            className="flex-1 py-2.5 px-2 text-sm sm:text-base font-black transition-colors"
            style={{
              background: questListTab === "challenge" ? "#1E3A14" : "#1A1A2E",
              color: questListTab === "challenge" ? "#86EFAC" : "#9CA3AF",
              borderBottom: questListTab === "challenge" ? "3px solid #22C55E" : "3px solid transparent",
            }}
          >
            ⚔️ チャレンジ！
            <span className="text-xs font-bold opacity-90 ml-1">({challengeList.length})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={questListTab === "cleared"}
            onClick={() => setQuestListTab("cleared")}
            className="flex-1 py-2.5 px-2 text-sm sm:text-base font-black transition-colors"
            style={{
              background: questListTab === "cleared" ? "#14532D" : "#1A1A2E",
              color: questListTab === "cleared" ? "#BBF7D0" : "#9CA3AF",
              borderBottom: questListTab === "cleared" ? "3px solid #22C55E" : "3px solid transparent",
            }}
          >
            ✅ クリア済み
            <span className="text-xs font-bold opacity-90 ml-1">({clearedList.length})</span>
          </button>
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

        {pendingStartContent && roulettePhase === "choose" && (
          <RouletteChooseModal
            onSkipDefaultNine={startStudyWithoutRoulette}
            onStartSpin={confirmRouletteSpin}
            onCancel={cancelRouletteStart}
          />
        )}

        {pendingStartContent && roulettePhase === "spin" && bgmRoulette && (
          <BgmRouletteSpinModal
            result={bgmRoulette}
            rouletteStopped={rouletteStopped}
            rouletteSpinCount={rouletteSpinCount}
            onStop={stopRoulette}
            onConfirmStudyStart={confirmRouletteStart}
            onReroll={rerollRoulette}
            onCancel={cancelRouletteStart}
          />
        )}

        {displayedQuests.length === 0 ? (
          <div
            className="text-center py-10 px-4 rounded-xl text-sm sm:text-base leading-relaxed"
            style={{ background: "#1A1A2E", border: "2px dashed #4A4A6A", color: "#9CA3AF" }}
          >
            {questListTab === "challenge"
              ? "チャレンジできる教材はまだありません。管理者の「クエスト作成」で追加してね。"
              : "まだクリアした教材がありません。勉強で最後まで終えるとここに表示されます。"}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {displayedQuests.map((c) => {
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
                        onClick={() => startPrepSession(c)}
                        className="mc-btn mc-btn-gray text-xs sm:text-sm px-2 sm:px-3 py-2"
                        title="予習：アプリで3択のみ（プリント清書なし）。おわりで経験値"
                      >
                        予習
                      </button>
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
                        className="text-[10px] sm:text-xs font-black px-2 py-1.5 rounded min-w-[4.5rem] text-center leading-tight inline-flex flex-col items-center justify-center gap-0.5"
                        style={{
                          background: c.studyCleared ? "#14532D" : "#1F2937",
                          color: c.studyCleared ? "#86EFAC" : "#9CA3AF",
                          border: `2px solid ${c.studyCleared ? "#22C55E" : "#4B5563"}`,
                        }}
                      >
                        {c.studyCleared ? (
                          <>
                            <span>クリア</span>
                            {c.studyClearedAt ? (
                              <span className="text-[9px] font-bold opacity-95 max-w-[5.5rem] break-words">
                                {formatJaDateTime(c.studyClearedAt)}
                              </span>
                            ) : (
                              <span className="text-[9px] font-normal opacity-75">（日時なし）</span>
                            )}
                          </>
                        ) : (
                          "未クリア"
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => openRouletteChooseModal(c)}
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
        )}
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
          <button type="button" onClick={leaveStudySessionToSelect} className="mc-btn mc-btn-green px-8 py-3">
            クエスト一覧に戻る
          </button>
        </div>
      </div>
    );
  }

  const isKokugoSingleHint = selectedContent
    ? getSubject(selectedContent.subject).key === "こくご"
    : false;
  const seenHints = new Set<string>();
  const nonEmptyHints = currentQ.hints
    .map((h) => String(h).trim())
    .filter(Boolean)
    .filter((hint) => {
      const normalized = normalizeHintForDedup(hint);
      if (seenHints.has(normalized)) return false;
      seenHints.add(normalized);
      return true;
    });
  const hintStepCount = isKokugoSingleHint ? Math.min(1, nonEmptyHints.length) : nonEmptyHints.length;
  const visibleHints = hintStepCount === 0
    ? []
    : [isKokugoSingleHint ? nonEmptyHints[0] : nonEmptyHints[Math.min(hintLevel, hintStepCount - 1)]];

  const progress = questionQueue.length > 0
    ? Math.round((queueIndex / questionQueue.length) * 100)
    : 0;

  const isPrepSession = bgmRoulette?.minutes === PREP_SESSION_MINUTES;
  const missPenaltyPointsShown = isPrepSession
    ? Math.abs(XP_PREP_MISS)
    : Math.abs(XP_HINT_MISS);

  return (
    <div className="space-y-3 relative">
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
          className="fixed inset-0 z-[60] flex items-center justify-center px-4 pointer-events-none"
          style={{ background: "rgba(0,0,0,0.55)" }}
          role="alert"
          aria-live="assertive"
        >
          <div
            className="max-w-sm w-full px-8 py-8 rounded-2xl text-center animate-star-pop shadow-2xl"
            style={{
              background: "linear-gradient(165deg, #3A0D0D 0%, #1a0505 100%)",
              border: "4px solid #F87171",
              boxShadow: "0 0 40px rgba(239,68,68,0.45), inset 0 1px 0 rgba(255,255,255,0.08)",
            }}
          >
            <div className="text-7xl mb-3 drop-shadow-lg">💥</div>
            <div className="text-3xl sm:text-4xl font-black tracking-wide" style={{ color: "#FECACA" }}>
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
              マイナス{missPenaltyPointsShown} ポイント！
            </div>
          </div>
        </div>
      )}

      {/* Progress */}
      <div className="flex items-center gap-3">
        {isPrepSession && (
          <span
            className="text-[10px] sm:text-xs font-black px-2 py-0.5 rounded shrink-0"
            style={{ background: "#1E3A8A", color: "#BFDBFE", border: "1px solid #3B82F6" }}
          >
            予習
          </span>
        )}
        <span className="text-sm" style={{ color: "#9CA3AF" }}>
          {queueIndex + 1}/{questionQueue.length}
        </span>
        <div className="xp-bar-outer flex-1">
          <div className="xp-bar-inner" style={{ width: `${progress}%` }} />
        </div>
        <button
          onClick={leaveStudySessionToSelect}
          className="text-xs px-2 py-1 rounded"
          style={{ background: "#374151", color: "#9CA3AF" }}
        >
          やめる
        </button>
      </div>
      {bgmRoulette && (
        <div
          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded"
          style={{ background: "#1E3A14", border: "2px solid #17DD62", color: "#BBF7D0" }}
        >
          <div className="text-xs sm:text-sm font-bold flex-1 min-w-[12rem] text-left leading-snug">
            {isPrepSession ? (
              <>
                📘 予習 BGM: {bgmRoulette.minutes}分 / ×{bgmRoulette.xpMultiplier.toFixed(1)}（アプリのみ・プリント清書なし）
              </>
            ) : (
              <>
                🎰 BGMルーレット: {bgmRoulette.minutes}分 / XP ×{bgmRoulette.xpMultiplier.toFixed(1)}
              </>
            )}
          </div>
          {soundEnabled && (
            <button
              type="button"
              onClick={() => setStudyBgmMuted((m) => !m)}
              className="shrink-0 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-black transition-opacity"
              style={{
                background: studyBgmMuted ? "#374151" : "#14532D",
                border: `2px solid ${studyBgmMuted ? "#6B7280" : "#22C55E"}`,
                color: studyBgmMuted ? "#D1D5DB" : "#86EFAC",
              }}
              aria-pressed={studyBgmMuted}
              title={studyBgmMuted ? "BGM を鳴らす" : "BGM をミュート"}
            >
              {studyBgmMuted ? "🔇 BGM ミュート中" : "🔊 BGM 再生中"}
            </button>
          )}
        </div>
      )}

      {step === "hint" && (
        <div className="space-y-3">
          <QuestionAndHintsCard
            q={currentQ}
            hintStepCount={hintStepCount}
            hintLevel={hintLevel}
            visibleHints={visibleHints}
            speechEnabled={speechEnabled}
          />
          <button
            type="button"
            onClick={nextHintStep}
            className="mc-btn mc-btn-blue w-full py-3 text-base font-black"
          >
            {hintLevel + 1 >= hintStepCount ? "本番クイズへ進む" : "つぎのヒントを見る"}
          </button>
        </div>
      )}

      {step === "quiz" && (
        <div className="space-y-3">
          <QuestionAssistiveOnly q={currentQ} />
          <div
            className="p-5 rounded-xl"
            style={{ background: "#0D0D1A", border: "3px solid #4A4A6A" }}
            role="region"
            aria-label={isPrepSession ? "問題（予習）" : "問題（本番）"}
          >
            <ReadingPassagePanel q={currentQ} speechEnabled={speechEnabled} />
            <QuestionBody q={currentQ} />
          </div>
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
          <QuestionCard q={currentQ} speechEnabled={speechEnabled} />
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
          {!isPrepSession && (
            <AnswerForWorksheetCopy
              answer={currentQ.answer}
              answerFurigana={currentQ.answerFurigana}
              answerUnit={currentQ.answerUnit}
            />
          )}
          {isPrepSession && (
            <p className="text-xs leading-relaxed mb-3 px-1" style={{ color: "#9CA3AF" }}>
              本試験では、ここに出た答えをプリントに清書します。予習はアプリだけで OK です。
            </p>
          )}
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
