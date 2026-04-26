"use client";
import { useEffect, useState } from "react";
import { TypingCategoryArt } from "@/components/games/TypingCategoryArt";
import type { GameThemeId } from "@/lib/game-themes";
import { playCorrect, playWrong, playClick, speak } from "@/lib/sounds";
import { mcField } from "@/lib/mc-styles";
import { formatJaDateTime } from "@/lib/format-ja-datetime";
import {
  REWARD_EXCHANGE_COSTS,
  XP_RIDDLE_CORRECT,
  XP_TYPING_BASE,
  xpForTypingWord,
} from "@/lib/xp-economy";

interface GamesProps {
  totalXP: number;
  onXPGain: (xp: number) => void;
  soundEnabled: boolean;
  speechEnabled: boolean;
  childName: string;
}

type TypingWord = { word: string; jp: string };

const TYPING_WORD_CATEGORIES: {
  id: GameThemeId;
  label: string;
  icon: string;
  panelBorder: string;
  wordColor: string;
  words: TypingWord[];
}[] = [
  {
    id: "manabi",
    label: "学び（6年）",
    icon: "📚",
    panelBorder: "#3B82F6",
    wordColor: "#93C5FD",
    words: [
      { word: "multiply", jp: "かける（掛け算）" },
      { word: "divide", jp: "わる（割り算）" },
      { word: "fraction", jp: "分数" },
      { word: "kanji", jp: "漢字" },
      { word: "textbook", jp: "教科書" },
      { word: "homework", jp: "宿題" },
      { word: "equation", jp: "式" },
      { word: "answer", jp: "答え" },
      { word: "problem", jp: "問題" },
      { word: "remainder", jp: "あまり" },
      { word: "decimal", jp: "小数" },
      { word: "study", jp: "勉強" },
    ],
  },
  {
    id: "norimono",
    label: "乗り物",
    icon: "🚄",
    panelBorder: "#38BDF8",
    wordColor: "#7DD3FC",
    words: [
      { word: "airplane", jp: "飛行機" },
      { word: "airport", jp: "空港" },
      { word: "pilot", jp: "パイロット" },
      { word: "runway", jp: "滑走路" },
      { word: "wing", jp: "翼" },
      { word: "shinkansen", jp: "新幹線" },
      { word: "plarail", jp: "プラレール" },
      { word: "train", jp: "電車" },
      { word: "station", jp: "駅" },
      { word: "tunnel", jp: "トンネル" },
      { word: "rail", jp: "レール" },
      { word: "jet", jp: "ジェット機" },
    ],
  },
  {
    id: "kyara",
    label: "キャラクター",
    icon: "🎭",
    panelBorder: "#A855F7",
    wordColor: "#D8B4FE",
    words: [
      { word: "minecraft", jp: "マインクラフト" },
      { word: "creeper", jp: "クリーパー" },
      { word: "mario", jp: "マリオ" },
      { word: "mushroom", jp: "キノコ" },
      { word: "yokai", jp: "妖怪" },
      { word: "medal", jp: "メダル" },
      { word: "detective", jp: "探偵" },
      { word: "mystery", jp: "なぞ" },
      { word: "survival", jp: "サバイバル" },
      { word: "science", jp: "科学" },
      { word: "block", jp: "ブロック" },
      { word: "hero", jp: "ヒーロー" },
    ],
  },
  {
    id: "seikatsu",
    label: "生活",
    icon: "🏠",
    panelBorder: "#22C55E",
    wordColor: "#86EFAC",
    words: [
      { word: "safety", jp: "安全" },
      { word: "health", jp: "健康" },
      { word: "bicycle", jp: "自転車" },
      { word: "traffic", jp: "交通" },
      { word: "manners", jp: "マナー" },
      { word: "weather", jp: "天気" },
      { word: "calendar", jp: "カレンダー" },
      { word: "money", jp: "お金" },
      { word: "friend", jp: "友だち" },
      { word: "home", jp: "家" },
      { word: "cook", jp: "料理" },
      { word: "sleep", jp: "睡眠" },
    ],
  },
];

/** 自由記述（choices なし）または学びカテゴリの3択 */
type RiddleItem = {
  question: string;
  answer: string;
  choices?: readonly [string, string, string];
  correctIndex?: 0 | 1 | 2;
};

type RiddleMcOption = { text: string; correct: boolean };
type SavedStory = {
  id: string;
  title: string;
  words: string;
  length: 300 | 500 | 800;
  text: string;
  createdAt: string;
};

const STORY_STORAGE_KEY = "mc_story_library_v1";

function shuffleRiddleMcOptions(opts: RiddleMcOption[]): RiddleMcOption[] {
  const a = [...opts];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const RIDDLE_CATEGORIES: {
  id: GameThemeId;
  label: string;
  icon: string;
  panelBorder: string;
  riddles: RiddleItem[];
}[] = [
  {
    id: "manabi",
    label: "学び（6年）",
    icon: "📚",
    panelBorder: "#3B82F6",
    riddles: [
      {
        question: "漢字「森」は「木」がいくつ並んだ形？",
        answer: "3つ",
        choices: ["3つ", "2つ", "4つ"],
        correctIndex: 0,
      },
      {
        question: "12÷3の答えは？",
        answer: "4",
        choices: ["4", "3", "36"],
        correctIndex: 0,
      },
      {
        question: "7×8の答えは？（九九）",
        answer: "56",
        choices: ["56", "54", "63"],
        correctIndex: 0,
      },
      {
        question: "分数 1/2＋1/4 を計算すると？（答えは分数で）",
        answer: "3/4",
        choices: ["3/4", "2/4", "3/8"],
        correctIndex: 0,
      },
      {
        question: "割り算で「わる数」が大きいほど答えは？",
        answer: "小さくなる",
        choices: ["小さくなる", "大きくなる", "かわらない"],
        correctIndex: 0,
      },
      {
        question: "文章題で「あつめた数」から「つかった数」を引くと？",
        answer: "のこり",
        choices: ["のこり", "わる", "たす"],
        correctIndex: 0,
      },
      {
        question: "国語で「主語」とは文のなかのだれ・なにを指す？",
        answer: "だれが・なにが",
        choices: ["だれが・なにが", "どうし", "じゅつご"],
        correctIndex: 0,
      },
      {
        question: "小数 0.5 は分数でいうと？",
        answer: "2分の1",
        choices: ["2分の1", "1分の2", "5分の10"],
        correctIndex: 0,
      },
      {
        question: "三角形の内角の和は何度？",
        answer: "180度",
        choices: ["180度", "90度", "360度"],
        correctIndex: 0,
      },
      {
        question: "漢字「働」の部首は？",
        answer: "にんべん",
        choices: ["にんべん", "りっしんべん", "てんてん"],
        correctIndex: 0,
      },
    ],
  },
  {
    id: "norimono",
    label: "乗り物",
    icon: "🚄",
    panelBorder: "#38BDF8",
    riddles: [
      { question: "飛行機が離陸する長い道の名前は？", answer: "滑走路" },
      { question: "飛行機を操縦する人の職業は？", answer: "パイロット" },
      { question: "プラレールのレールが曲がっている部分は？", answer: "カーブ" },
      { question: "のぞみやひかりがある、とても速い鉄道は？", answer: "新幹線" },
      { question: "電車がとまる、人が乗る高い場所は？", answer: "ホーム" },
      { question: "飛行機の大きな羽の名前は？", answer: "主翼" },
      { question: "空港で飛行機に乗る前に保安検査を受ける流れをなんという？", answer: "搭乗手続き" },
      { question: "電車に乗る前にきっぷを見せる場所は？", answer: "改札" },
      { question: "山の中を通る電車の道は？", answer: "トンネル" },
      { question: "飛行機が着陸する施設は？", answer: "空港" },
    ],
  },
  {
    id: "kyara",
    label: "キャラクター",
    icon: "🎭",
    panelBorder: "#A855F7",
    riddles: [
      { question: "マインクラフトで緑色で近づくと爆発する敵は？", answer: "クリーパー" },
      { question: "マリオの双子の弟で緑の服のキャラは？", answer: "ルイージ" },
      { question: "妖怪ウォッチで赤いネコ型の妖怪の名前は？", answer: "ジバニャン" },
      { question: "おしりたんていシリーズで、犯人を追うのは？", answer: "たんてい" },
      { question: "科学漫画サバイバルで、危険な場面を学ぶスタイルの本は？", answer: "サバイバル" },
      { question: "マリオが食べると大きくなるキノコの色は？（代表的なもの）", answer: "赤" },
      { question: "妖怪ウォッチでメダルを入れる道具は？", answer: "妖怪ウォッチ" },
      { question: "マインクラフトで石や木を掘る道具の総称は？", answer: "ツール" },
      { question: "ピーチ姫が住む建物は？", answer: "お城" },
      { question: "ジャングルや砂漠で知恵を使って生き残る物語のジャンルは？", answer: "サバイバル" },
    ],
  },
  {
    id: "seikatsu",
    label: "生活",
    icon: "🏠",
    panelBorder: "#22C55E",
    riddles: [
      { question: "地震のときまず身を守る場所は？（学校で練習するやつ）", answer: "机の下" },
      { question: "火事のときエレベーターに乗ってはいけないのはなぜ？", answer: "閉じ込められるから" },
      { question: "自転車に乗るとき頭にかぶるのは？", answer: "ヘルメット" },
      { question: "食べ物を冷蔵庫に入れる主な理由は？", answer: "腐らないように" },
      { question: "人の家にあがる前に押すのは？", answer: "インターホン" },
      { question: "ゴミを分ける理由のひとつは？", answer: "リサイクル" },
      { question: "夜ふかしで不足しやすく、からだの調子に影響するのは？", answer: "睡眠" },
      { question: "道路を渡るときまず見るのは？", answer: "左右" },
      { question: "お金を大切に使うことをなんという？", answer: "節約" },
      { question: "友だちのものを勝手にとってはいけないのは？", answer: "盗み" },
    ],
  },
];

function pickRandomRiddleForTheme(theme: GameThemeId): RiddleItem {
  const cat = RIDDLE_CATEGORIES.find((c) => c.id === theme) ?? RIDDLE_CATEGORIES[0];
  const pool = cat.riddles;
  return pool[Math.floor(Math.random() * pool.length)];
}

const REWARD_DEFS = [
  { id: "1", name: "ゲーム30分延長", icon: "🎮" },
  { id: "2", name: "好きなおやつを選ぶ権利", icon: "🍫" },
  { id: "3", name: "ご飯のメニューを決める", icon: "🍕" },
  { id: "4", name: "マインクラフトの新しいMOD", icon: "📦" },
  { id: "5", name: "映画を選ぶ権利", icon: "🎬" },
  { id: "6", name: "特別なお出かけ", icon: "🎡" },
] as const;

const REWARDS = REWARD_DEFS.map((r, i) => ({
  ...r,
  cost: REWARD_EXCHANGE_COSTS[i] ?? REWARD_EXCHANGE_COSTS[0],
}));

const RIDDLE_MC_BADGE = ["#3B82F6", "#D97706", "#EF4444"] as const;
const RIDDLE_MC_LETTERS = ["A", "B", "C"] as const;

function GamesBackButton({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" onClick={onBack} className="mc-btn mc-btn-gray text-sm px-3 py-2">
      ← もどる
    </button>
  );
}

export default function Games({
  totalXP,
  onXPGain,
  soundEnabled,
  speechEnabled,
  childName,
}: GamesProps) {
  const [activeGame, setActiveGame] = useState<"menu" | "riddle" | "typing" | "reward" | "story">("menu");
  const [riddleCategoryId, setRiddleCategoryId] = useState<GameThemeId>("manabi");
  const [typingCategoryId, setTypingCategoryId] = useState<GameThemeId>("manabi");
  // Story state
  const [storyTitle, setStoryTitle] = useState("");
  const [storyWords, setStoryWords] = useState("");
  const [storyLength, setStoryLength] = useState<300 | 500 | 800>(300);
  const [storyText, setStoryText] = useState("");
  const [storyLoading, setStoryLoading] = useState(false);
  const [storyError, setStoryError] = useState("");
  const [savedStories, setSavedStories] = useState<SavedStory[]>([]);
  const [currentStoryId, setCurrentStoryId] = useState<string | null>(null);

  // Riddle state
  const [riddle, setRiddle] = useState<RiddleItem | null>(null);
  const [riddleMcShuffled, setRiddleMcShuffled] = useState<RiddleMcOption[] | null>(null);
  const [riddleAnswer, setRiddleAnswer] = useState("");
  const [riddleResult, setRiddleResult] = useState<"none" | "correct" | "wrong">("none");
  // Typing state
  const [currentWordIdx, setCurrentWordIdx] = useState(0);
  const [typedText, setTypedText] = useState("");
  const [typingScore, setTypingScore] = useState(0);
  const [typingStreak, setTypingStreak] = useState(0);

  const typingCategory =
    TYPING_WORD_CATEGORIES.find((c) => c.id === typingCategoryId) ?? TYPING_WORD_CATEGORIES[0];
  const typingWords = typingCategory.words;
  const currentWord = typingWords[currentWordIdx % typingWords.length];

  const riddleCategoryMeta =
    RIDDLE_CATEGORIES.find((c) => c.id === riddleCategoryId) ?? RIDDLE_CATEGORIES[0];

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORY_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as SavedStory[];
      if (!Array.isArray(parsed)) return;
      setSavedStories(parsed);
    } catch {
      // ignore storage parse errors
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORY_STORAGE_KEY, JSON.stringify(savedStories));
    } catch {
      // ignore storage write errors
    }
  }, [savedStories]);

  const fetchRiddle = (nextTheme?: GameThemeId) => {
    setRiddleResult("none");
    setRiddleAnswer("");
    setRiddleMcShuffled(null);
    const theme = nextTheme ?? riddleCategoryId;
    if (nextTheme) setRiddleCategoryId(nextTheme);
    const r = pickRandomRiddleForTheme(theme);
    setRiddle(r);
    if (r.choices !== undefined && r.correctIndex !== undefined) {
      const built: RiddleMcOption[] = r.choices.map((text, i) => ({
        text,
        correct: i === r.correctIndex,
      }));
      setRiddleMcShuffled(shuffleRiddleMcOptions(built));
    }
    if (speechEnabled) speak(r.question);
  };

  const resolveRiddleMc = (isCorrect: boolean) => {
    if (!riddle) return;
    setRiddleResult(isCorrect ? "correct" : "wrong");
    if (isCorrect) {
      onXPGain(XP_RIDDLE_CORRECT);
      if (soundEnabled) playCorrect();
      if (speechEnabled) speak(`せいかい！すごい！${XP_RIDDLE_CORRECT}ポイントゲット！`);
    } else if (soundEnabled) {
      playWrong();
    }
  };

  const checkRiddle = () => {
    if (!riddle) return;
    const correct =
      riddleAnswer.trim().includes(riddle.answer) ||
      riddle.answer.includes(riddleAnswer.trim());
    setRiddleResult(correct ? "correct" : "wrong");
    if (correct) {
      onXPGain(XP_RIDDLE_CORRECT);
      if (soundEnabled) playCorrect();
      if (speechEnabled) speak(`せいかい！すごい！${XP_RIDDLE_CORRECT}ポイントゲット！`);
    } else {
      if (soundEnabled) playWrong();
    }
  };

  const handleTyping = (val: string) => {
    setTypedText(val);
    if (val.toLowerCase() === currentWord.word.toLowerCase()) {
      const xp = xpForTypingWord(typingStreak);
      onXPGain(xp);
      if (soundEnabled) playCorrect();
      setTypingScore((s) => s + xp);
      setTypingStreak((s) => s + 1);
      setTypedText("");
      setCurrentWordIdx((i) => (i + 1) % typingWords.length);
    }
  };

  const redeemReward = (cost: number, name: string) => {
    if (totalXP < cost) {
      if (speechEnabled) speak("まだけいけんちが足りないよ！もっとべんきょうしよう！");
      return;
    }
    onXPGain(-cost);
    if (soundEnabled) playCorrect();
    if (speechEnabled) speak(`${name}と交換したよ！おめでとう！`);
    alert(`「${name}」と交換しました！お家の人に見せてね！🎉`);
  };

  const generateStory = async (isSequel: boolean) => {
    if (!storyTitle.trim()) {
      setStoryError("タイトルを入力してね。");
      return;
    }
    if (!storyWords.trim()) {
      setStoryError("ワードを1つ以上入力してね。");
      return;
    }
    setStoryLoading(true);
    setStoryError("");
    try {
      const res = await fetch("/api/story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: storyTitle.trim(),
          words: storyWords.trim(),
          length: storyLength,
          childName,
          previousStory: isSequel ? storyText : "",
        }),
      });
      const data = (await res.json()) as { story?: string; error?: string };
      if (!res.ok || !data.story) {
        throw new Error(data.error ?? "物語の生成に失敗しました");
      }
      setStoryText(data.story);
      setCurrentStoryId(null);
      if (soundEnabled) playCorrect();
      if (speechEnabled) speak(isSequel ? "続編を作ったよ！" : "物語ができたよ！");
    } catch (e) {
      setStoryError(e instanceof Error ? e.message : "物語の生成に失敗しました");
      if (soundEnabled) playWrong();
    } finally {
      setStoryLoading(false);
    }
  };

  const saveCurrentStory = () => {
    if (!storyText.trim()) return;
    const payload: SavedStory = {
      id: currentStoryId ?? crypto.randomUUID(),
      title: storyTitle.trim() || "無題の物語",
      words: storyWords.trim(),
      length: storyLength,
      text: storyText,
      createdAt: new Date().toISOString(),
    };
    setSavedStories((prev) => [payload, ...prev.filter((s) => s.id !== payload.id)].slice(0, 50));
    setCurrentStoryId(payload.id);
    if (soundEnabled) playCorrect();
    if (speechEnabled) speak("物語を保存したよ！");
  };

  const deleteCurrentStory = () => {
    if (currentStoryId) {
      setSavedStories((prev) => prev.filter((s) => s.id !== currentStoryId));
    }
    setCurrentStoryId(null);
    setStoryText("");
    if (soundEnabled) playClick();
  };

  const openSavedStory = (story: SavedStory) => {
    setStoryTitle(story.title);
    setStoryWords(story.words);
    setStoryLength(story.length);
    setStoryText(story.text);
    setCurrentStoryId(story.id);
    setStoryError("");
  };

  const startAnotherStory = () => {
    setStoryTitle("");
    setStoryWords("");
    setStoryLength(300);
    setStoryText("");
    setStoryError("");
    setCurrentStoryId(null);
    if (soundEnabled) playClick();
  };

  if (activeGame === "menu") {
    return (
      <div className="space-y-3" aria-label={`${childName}くんのあそび`}>
        <h3 className="text-lg font-black" style={{ color: "#7DC53D" }}>
          あそびと報酬 🎮
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { key: "riddle", icon: "🧩", label: "AIなぞなぞ", desc: `+${XP_RIDDLE_CORRECT} XP` },
            {
              key: "typing",
              icon: "⌨️",
              label: "タイピング",
              desc: `+${XP_TYPING_BASE}〜 XP/語（連続で増える）`,
            },
            { key: "story", icon: "📖", label: "物語づくり", desc: "ワードからお話を作る" },
            { key: "reward", icon: "🎁", label: "報酬交換所", desc: `${totalXP.toLocaleString()} XP所持` },
          ].map((g) => (
            <button
              key={g.key}
              onClick={() => {
                setActiveGame(g.key as typeof activeGame);
                if (g.key === "riddle") fetchRiddle();
                if (soundEnabled) playClick();
              }}
              className="mc-panel mc-card-hover p-4 text-left cursor-pointer"
            >
              <div className="text-3xl mb-2">{g.icon}</div>
              <div className="font-black text-base">{g.label}</div>
              <div className="text-xs mt-1" style={{ color: "#A0C878" }}>{g.desc}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // RIDDLE
  if (activeGame === "riddle") {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-black" style={{ color: riddleCategoryMeta.panelBorder }}>
            🧩 AIなぞなぞ
          </h3>
          <GamesBackButton onBack={() => setActiveGame("menu")} />
        </div>
            <div className="flex flex-wrap gap-2">
          {RIDDLE_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                fetchRiddle(cat.id);
                if (soundEnabled) playClick();
              }}
              className="px-3 py-2 rounded-lg text-sm font-bold transition-all"
              style={{
                background: riddleCategoryId === cat.id ? "#0C4A6E" : "#1A1A2E",
                border: `2px solid ${riddleCategoryId === cat.id ? cat.panelBorder : "#4B5563"}`,
                color: riddleCategoryId === cat.id ? "#F0F9FF" : "#9CA3AF",
              }}
            >
              <span className="mr-1">{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>
        {riddleCategoryId === "manabi" && (
          <p className="text-xs" style={{ color: "#93C5FD" }}>
            学び：3つの選択肢（A・B・C）から正解をタップ！
          </p>
        )}
        {riddle ? (
          <div className="space-y-3">
            <div className="py-2 flex justify-center">
              <TypingCategoryArt theme={riddleCategoryId} />
            </div>
            <div
              className="p-5 rounded-xl text-xl font-bold leading-relaxed"
              style={{ background: "#0D0D1A", border: `3px solid ${riddleCategoryMeta.panelBorder}` }}
            >
              {riddle.question}
              {speechEnabled && (
                <button
                  onClick={() => speak(riddle.question)}
                  className="block mt-2 text-sm px-3 py-1 rounded"
                  style={{ background: "#1A1A2E", color: riddleCategoryMeta.panelBorder }}
                >
                  🔊 きく
                </button>
              )}
            </div>
            {riddleResult === "none" &&
              (riddleMcShuffled && riddleMcShuffled.length === 3 ? (
                <div className="grid grid-cols-3 gap-2 sm:gap-3" role="group" aria-label="三択">
                  {riddleMcShuffled.map((opt, idx) => (
                    <button
                      key={`${opt.text}-${idx}`}
                      type="button"
                      onClick={() => resolveRiddleMc(opt.correct)}
                      className="flex flex-col items-center justify-start gap-2 min-h-[6rem] sm:min-h-[7rem] rounded-xl p-2 sm:p-3 font-bold text-center transition-transform touch-manipulation active:scale-[0.98]"
                      style={{
                        background: "#1A1A2E",
                        border: `3px solid ${RIDDLE_MC_BADGE[idx % 3]}`,
                        color: "#E8E8E8",
                      }}
                    >
                      <span
                        className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg text-xs sm:text-sm font-black"
                        style={{
                          background: RIDDLE_MC_BADGE[idx % 3],
                          color: "#0D0D1A",
                        }}
                      >
                        {RIDDLE_MC_LETTERS[idx]}
                      </span>
                      <span className="w-full min-h-0 flex-1 overflow-y-auto text-[11px] sm:text-xs leading-snug break-words [scrollbar-width:thin]">
                        {opt.text}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={riddleAnswer}
                    onChange={(e) => setRiddleAnswer(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && checkRiddle()}
                    placeholder="こたえを入力…"
                    className="flex-1 p-3 rounded text-base"
                    style={mcField}
                  />
                  <button type="button" onClick={checkRiddle} className="mc-btn mc-btn-green px-5">
                    こたえる！
                  </button>
                </div>
              ))}
            {riddleResult !== "none" && (
              <div
                className="p-4 rounded-xl text-center animate-slide-up"
                style={{
                  background: riddleResult === "correct" ? "#0D3A0D" : "#1A0D0D",
                  border: `3px solid ${riddleResult === "correct" ? "#17DD62" : "#EF4444"}`,
                }}
              >
                <div className="text-3xl mb-2">{riddleResult === "correct" ? "🎉" : "💥"}</div>
                <div className="text-xl font-black" style={{ color: riddleResult === "correct" ? "#7FFF00" : "#EF4444" }}>
                  {riddleResult === "correct"
                    ? `せいかい！+${XP_RIDDLE_CORRECT} XP！`
                    : `ざんねん！こたえは「${riddle.answer}」だよ！`}
                </div>
                <button type="button" onClick={() => fetchRiddle()} className="mt-3 mc-btn mc-btn-blue px-6 py-2">
                  つぎのなぞなぞ
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  // TYPING
  if (activeGame === "typing") {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-black" style={{ color: typingCategory.panelBorder }}>⌨️ タイピング練習</h3>
          <GamesBackButton onBack={() => setActiveGame("menu")} />
        </div>
        <div className="flex flex-wrap gap-2">
          {TYPING_WORD_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setTypingCategoryId(cat.id);
                setCurrentWordIdx(0);
                setTypedText("");
                if (soundEnabled) playClick();
              }}
              className="px-3 py-2 rounded-lg text-sm font-bold transition-all"
              style={{
                background: typingCategoryId === cat.id ? "#292524" : "#1A1A2E",
                border: `2px solid ${typingCategoryId === cat.id ? cat.panelBorder : "#4B5563"}`,
                color: typingCategoryId === cat.id ? "#F9FAFB" : "#9CA3AF",
              }}
            >
              <span className="mr-1">{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>
        <div
          className="p-4 rounded-xl text-center space-y-3"
          style={{ background: "#0D0D1A", border: `3px solid ${typingCategory.panelBorder}` }}
        >
          <div className="py-2">
            <TypingCategoryArt theme={typingCategoryId} />
          </div>
          <div className="flex justify-between text-sm px-2">
            <span style={{ color: "#9CA3AF" }}>
              スコア:{" "}
              <span className="pixel-font text-lg" style={{ color: "#7FFF00" }}>
                {typingScore}
              </span>
            </span>
            <span style={{ color: "#9CA3AF" }}>
              れんぞく:{" "}
              <span className="pixel-font text-lg" style={{ color: "#FCD34D" }}>
                {typingStreak}
              </span>
            </span>
          </div>
          <div
            className="text-4xl font-black py-2 break-all"
            style={{ color: typingCategory.wordColor, letterSpacing: "0.12em" }}
          >
            {currentWord.word}
          </div>
          <div className="text-base" style={{ color: "#A0C878" }}>
            （{currentWord.jp}）
          </div>
          <input
            type="text"
            value={typedText}
            onChange={(e) => handleTyping(e.target.value)}
            placeholder="ここに打ってね…"
            autoFocus
            className="w-full p-3 rounded text-lg text-center font-mono"
            style={{
              background: "#1A1A2E",
              border: `2px solid ${
                typedText && currentWord.word.toLowerCase().startsWith(typedText.toLowerCase())
                  ? "#17DD62"
                  : "#EF4444"
              }`,
              color: "#E8E8E8",
            }}
          />
          <div className="text-xs" style={{ color: "#6B7280" }}>
            問題 {(currentWordIdx % typingWords.length) + 1}/{typingWords.length}
          </div>
        </div>
      </div>
    );
  }

  // REWARDS
  if (activeGame === "reward") {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-black" style={{ color: "#FFD700" }}>🎁 ほうびこうかんじょ</h3>
          <GamesBackButton onBack={() => setActiveGame("menu")} />
        </div>
        <div
          className="flex items-center gap-3 p-3 rounded"
          style={{ background: "#0D1A0D", border: "2px solid #17DD62" }}
        >
          <span className="text-2xl">⭐</span>
          <div>
            <div className="text-xs" style={{ color: "#9CA3AF" }}>もっているけいけんち</div>
            <div className="pixel-font text-2xl font-bold" style={{ color: "#7FFF00" }}>
              {totalXP.toLocaleString()} XP
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {REWARDS.map((r) => {
            const canAfford = totalXP >= r.cost;
            return (
              <div
                key={r.id}
                className="flex items-center gap-4 p-4 rounded-xl"
                style={{
                  background: canAfford ? "#1A2E1A" : "#1A1A2E",
                  border: `3px solid ${canAfford ? "#17DD62" : "#4A4A6A"}`,
                  opacity: canAfford ? 1 : 0.6,
                }}
              >
                <span className="text-3xl">{r.icon}</span>
                <div className="flex-1">
                  <div className="font-black text-base">{r.name}</div>
                  <div className="text-sm" style={{ color: "#FCD34D" }}>
                    {r.cost.toLocaleString()} XP
                  </div>
                </div>
                <button
                  onClick={() => redeemReward(r.cost, r.name)}
                  className={`mc-btn ${canAfford ? "mc-btn-gold" : "mc-btn-gray"} px-4 py-2`}
                  disabled={!canAfford}
                >
                  {canAfford ? "こうかん！" : "XP不足"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // STORY
  if (activeGame === "story") {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-black" style={{ color: "#F59E0B" }}>📖 物語づくり</h3>
          <GamesBackButton onBack={() => setActiveGame("menu")} />
        </div>
        <div className="mc-panel p-4 space-y-3" style={{ borderColor: "#F59E0B" }}>
          <div>
            <label className="text-xs font-bold block mb-1" style={{ color: "#9CA3AF" }}>
              タイトル
            </label>
            <input
              type="text"
              value={storyTitle}
              onChange={(e) => setStoryTitle(e.target.value)}
              placeholder="タイトルを記入して"
              className="w-full p-3 rounded text-base"
              style={mcField}
            />
          </div>
          <div>
            <label className="text-xs font-bold block mb-1" style={{ color: "#9CA3AF" }}>
              物語のワード・ポイント（カンマ区切り）
            </label>
            <input
              type="text"
              value={storyWords}
              onChange={(e) => setStoryWords(e.target.value)}
              placeholder="物語のワード・ポイントを記入して"
              className="w-full p-3 rounded text-base"
              style={mcField}
            />
          </div>
          <div>
            <label className="text-xs font-bold block mb-1" style={{ color: "#9CA3AF" }}>
              文章の長さ
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[300, 500, 800].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setStoryLength(n as 300 | 500 | 800)}
                  className={`mc-btn ${storyLength === n ? "mc-btn-green" : "mc-btn-gray"} py-2`}
                >
                  {n}文字
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void generateStory(false)}
              disabled={storyLoading}
              className="mc-btn mc-btn-blue py-3 disabled:opacity-50"
            >
              {storyLoading ? "生成中..." : "物語を作る"}
            </button>
            <button
              type="button"
              onClick={() => void generateStory(true)}
              disabled={storyLoading || !storyText}
              className="mc-btn mc-btn-gold py-3 disabled:opacity-50"
            >
              続編を作る
            </button>
          </div>
          {storyError && (
            <div className="text-sm font-bold p-3 rounded" style={{ background: "#3A0D0D", border: "2px solid #EF4444", color: "#FCA5A5" }}>
              {storyError}
            </div>
          )}
        </div>
        {storyText && (
          <div className="space-y-3">
            <div className="mc-panel p-5" style={{ borderColor: "#F59E0B", background: "#0D0D1A" }}>
              <div className="text-lg font-black mb-2" style={{ color: "#FCD34D" }}>
                {storyTitle || "物語"}
              </div>
              <div className="text-lg sm:text-xl leading-loose whitespace-pre-wrap" style={{ color: "#E8E8E8" }}>
                {storyText}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={saveCurrentStory} className="mc-btn mc-btn-green py-3">
                保存
              </button>
              <button type="button" onClick={deleteCurrentStory} className="mc-btn mc-btn-gray py-3">
                削除
              </button>
            </div>
            {currentStoryId && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button type="button" onClick={() => void generateStory(true)} className="mc-btn mc-btn-gold py-3">
                  続編
                </button>
                <button type="button" onClick={startAnotherStory} className="mc-btn mc-btn-blue py-3">
                  別の物語
                </button>
                <button type="button" onClick={() => setActiveGame("menu")} className="mc-btn mc-btn-gray py-3">
                  ホームに戻る
                </button>
              </div>
            )}
          </div>
        )}
        <div className="mc-panel p-4 space-y-2" style={{ borderColor: "#F59E0B", background: "#121326" }}>
          <div className="text-sm font-black" style={{ color: "#FCD34D" }}>保存した物語一覧</div>
          {savedStories.length === 0 ? (
            <div className="text-sm" style={{ color: "#9CA3AF" }}>まだ保存された物語はありません。</div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {savedStories.map((story) => (
                <button
                  key={story.id}
                  type="button"
                  onClick={() => openSavedStory(story)}
                  className="w-full text-left p-3 rounded-lg border-2 transition-colors"
                  style={{
                    background: currentStoryId === story.id ? "#172554" : "#1A1A2E",
                    borderColor: currentStoryId === story.id ? "#60A5FA" : "#374151",
                    color: "#E5E7EB",
                  }}
                >
                  <div className="font-bold text-sm">{story.title}</div>
                  <div className="text-xs mt-1" style={{ color: "#A5B4FC" }}>
                    {story.length}文字 / {formatJaDateTime(story.createdAt)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
