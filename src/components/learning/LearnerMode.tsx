"use client";
/* eslint-disable react-hooks/purity -- 出題順シャッフル・解答計測で RNG / 壁時計を使う */
import { useEffect, useState } from "react";
import { GeneratedQuestion, StudyRecord, UploadedContent } from "@/lib/storage";
import { playCorrect, playWrong, playExplosion, speak } from "@/lib/sounds";
import { getSubject } from "@/lib/config";
import { percent } from "@/lib/percent";
import FractionText from "@/components/FractionText";

interface LearnerModeProps {
  soundEnabled: boolean;
  speechEnabled: boolean;
  onAnswer: (record: StudyRecord) => void;
  childName: string;
}

type Step = "select" | "hint" | "quiz" | "result";

export default function LearnerMode({
  soundEnabled,
  speechEnabled,
  onAnswer,
  childName,
}: LearnerModeProps) {
  const [content, setContent] = useState<UploadedContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

  const [selectedContent, setSelectedContent] = useState<UploadedContent | null>(null);
  const [currentQ, setCurrentQ] = useState<GeneratedQuestion | null>(null);
  const [step, setStep] = useState<Step>("select");
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

  useEffect(() => {
    fetch("/api/problems")
      .then((res) => res.json())
      .then((data: UploadedContent[]) => {
        setContent(Array.isArray(data) ? data : []);
      })
      .catch(() => setFetchError("問題データの読み込みに失敗しました"))
      .finally(() => setIsLoading(false));
  }, []);

  const startContent = (c: UploadedContent) => {
    setSelectedContent(c);
    const queue = [...c.questions];
    setQuestionQueue(queue);
    setQueueIndex(0);
    loadQuestion(queue[0]);
  };

  const loadQuestion = (q: GeneratedQuestion) => {
    setCurrentQ(q);
    setStep("hint");
    setHintLevel(0);
    setSelectedChoice(null);
    setIsCorrect(null);
    setStartTime(Date.now());
    if (speechEnabled) speak(q.questionFurigana ?? q.question);
  };

  const showNextHint = () => {
    if (hintLevel < (currentQ?.hints.length ?? 0) - 1) {
      setHintLevel((h) => h + 1);
    } else {
      goToQuiz();
    }
  };

  const goToQuiz = () => setStep("quiz");

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
    };
    onAnswer(record);

    if (correct) {
      const xp = Math.max(10, 30 - hintLevel * 8);
      setXpGained(xp);
      setSessionCorrect((s) => s + 1);
      if (soundEnabled) playCorrect();
      if (speechEnabled) speak("せいかい！すごい！");
    } else {
      setXpGained(0);
      if (soundEnabled) { playWrong(); setTimeout(() => playExplosion(), 300); }
      setShowExplosion(true);
      setTimeout(() => setShowExplosion(false), 1000);
      const answerReading = currentQ.answerFurigana ?? currentQ.answer;
      if (speechEnabled) speak(`ざんねん！正解は${answerReading}だよ！`);
    }
    setSessionTotal((s) => s + 1);
    setStep("result");
  };

  const nextQuestion = () => {
    if (!questionQueue.length) return;
    const nextIdx = queueIndex + 1;
    if (nextIdx >= questionQueue.length) {
      setStep("select");
      setSelectedContent(null);
    } else {
      setQueueIndex(nextIdx);
      loadQuestion(questionQueue[nextIdx]);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12 space-y-4">
        <div className="text-6xl animate-float">⏳</div>
        <div className="text-base" style={{ color: "#9CA3AF" }}>もんだいを読み込み中…</div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="text-center py-12 space-y-2">
        <div className="text-4xl">❌</div>
        <div className="text-sm" style={{ color: "#EF4444" }}>{fetchError}</div>
      </div>
    );
  }

  if (content.length === 0) {
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
            写真をアップロードしたら、Claude が問題を作ってくれるよ
          </div>
        </div>
        <div className="flex justify-center gap-3 text-3xl">
          <span>🗡️</span><span>🛡️</span><span>💎</span>
        </div>
      </div>
    );
  }

  if (step === "select") {
    return (
      <div className="space-y-4">
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

        <div className="grid grid-cols-1 gap-3">
          {content.map((c) => {
            const sub = getSubject(c.subject);
            return (
              <button
                key={c.id}
                onClick={() => startContent(c)}
                className="mc-panel mc-card-hover text-left p-4 w-full cursor-pointer"
                style={{ background: "#2D2D44", borderLeft: `4px solid ${sub.color}` }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{sub.mcIcon}</span>
                  <div>
                    <div className="text-base font-black">{c.title}</div>
                    <div className="text-sm" style={{ color: sub.color }}>
                      {c.subject} / {c.questions.length}問
                    </div>
                  </div>
                  <div className="ml-auto text-2xl" style={{ color: sub.color }}>▶</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (!currentQ) return null;

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

      {/* Progress */}
      <div className="flex items-center gap-3">
        <span className="text-sm" style={{ color: "#9CA3AF" }}>
          {queueIndex + 1}/{questionQueue.length}
        </span>
        <div className="xp-bar-outer flex-1">
          <div className="xp-bar-inner" style={{ width: `${progress}%` }} />
        </div>
        <button
          onClick={() => { setStep("select"); setSelectedContent(null); }}
          className="text-xs px-2 py-1 rounded"
          style={{ background: "#374151", color: "#9CA3AF" }}
        >
          やめる
        </button>
      </div>

      {/* Question */}
      <div
        className="p-5 rounded-xl"
        style={{ background: "#0D0D1A", border: "3px solid #4A4A6A" }}
      >
        <div className="text-xs mb-2" style={{ color: "#A0C878" }}>もんだい</div>
        <div className="text-xl font-black leading-relaxed" style={{ color: "#E8E8E8" }}>
          {currentQ.question.split("\n").map((line, i) => (
            <span key={i}>
              {i > 0 && <br />}
              <FractionText text={line} />
            </span>
          ))}
        </div>
        {currentQ.questionFurigana && currentQ.questionFurigana !== currentQ.question && (
          <div className="text-sm mt-1" style={{ color: "#7DC53D" }}>
            ({currentQ.questionFurigana})
          </div>
        )}
        {speechEnabled && (
          <button
            onClick={() => speak(currentQ.questionFurigana ?? currentQ.question)}
            className="mt-2 text-xs px-3 py-1 rounded"
            style={{ background: "#1E3A14", color: "#7DC53D" }}
          >
            🔊 もう一度きく
          </button>
        )}
      </div>

      {/* Hints */}
      {step === "hint" && (
        <div className="space-y-3">
          {currentQ.hints.slice(0, hintLevel + 1).map((hint, i) => (
            <div
              key={i}
              className="p-3 rounded animate-slide-up"
              style={{
                background: i === 0 ? "#1A2E1A" : i === 1 ? "#1A1A2E" : "#2E1A1A",
                border: `2px solid ${i === 0 ? "#17DD62" : i === 1 ? "#3B82F6" : "#D97706"}`,
              }}
            >
              <span className="text-xs font-bold" style={{ color: i === 0 ? "#17DD62" : i === 1 ? "#60A5FA" : "#FCD34D" }}>
                ヒント {i + 1} {i === 0 ? "🌱" : i === 1 ? "💡" : "🔥"}
              </span>
              <p className="text-base mt-1"><FractionText text={hint} /></p>
            </div>
          ))}
          <div className="flex gap-3">
            {hintLevel < currentQ.hints.length - 1 ? (
              <button onClick={showNextHint} className="mc-btn mc-btn-gold flex-1 py-3">
                💡 次のヒントを見る ({hintLevel + 1}/{currentQ.hints.length})
              </button>
            ) : null}
            <button onClick={goToQuiz} className="mc-btn mc-btn-green flex-1 py-3 text-lg">
              📝 答える！
            </button>
          </div>
        </div>
      )}

      {/* Quiz */}
      {step === "quiz" && (
        <div className="space-y-3">
          <div className="text-sm font-bold" style={{ color: "#A0C878" }}>答えを選んでね！</div>
          {currentQ.choices.map((choice, i) => (
            <button
              key={i}
              onClick={() => handleAnswer(i)}
              disabled={selectedChoice !== null}
              className="w-full text-left p-4 rounded-xl font-bold text-base transition-all disabled:cursor-not-allowed"
              style={{
                background:
                  selectedChoice === null ? "#2D2D44"
                  : selectedChoice === i ? (isCorrect ? "#0D3A0D" : "#3A0D0D")
                  : i === currentQ.correctIndex && selectedChoice !== null ? "#0D3A0D"
                  : "#2D2D44",
                border: `3px solid ${
                  selectedChoice === null ? "#4A4A6A"
                  : selectedChoice === i ? (isCorrect ? "#17DD62" : "#EF4444")
                  : i === currentQ.correctIndex && selectedChoice !== null ? "#17DD62"
                  : "#4A4A6A"
                }`,
              }}
            >
              <span
                className="inline-block w-8 h-8 rounded text-center leading-8 mr-3 text-sm font-black"
                style={{ background: ["#3B82F6","#D97706","#EF4444"][i] ?? "#4B5563", color: "white" }}
              >
                {["A","B","C"][i]}
              </span>
              <FractionText text={choice} />
            </button>
          ))}
        </div>
      )}

      {/* Result */}
      {step === "result" && (
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
          {!isCorrect && (
            <div className="text-base mb-3">
              <span style={{ color: "#9CA3AF" }}>正解は </span>
              <span className="font-black" style={{ color: "#17DD62" }}>
                <FractionText text={currentQ.answer} />
              </span>
              {currentQ.answerFurigana && currentQ.answerFurigana !== currentQ.answer && (
                <span style={{ color: "#A0C878" }}>（{currentQ.answerFurigana}）</span>
              )}
              <span style={{ color: "#9CA3AF" }}> だよ！</span>
            </div>
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
      )}
    </div>
  );
}
