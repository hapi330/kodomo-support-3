"use client";
import { useState } from "react";
import { TypingCategoryArt } from "@/components/games/TypingCategoryArt";
import type { GameThemeId } from "@/lib/game-themes";
import { playCorrect, playWrong, playClick, speak } from "@/lib/sounds";
import { mcField } from "@/lib/mc-styles";

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

type RiddleItem = { question: string; answer: string };

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
      { question: "漢字「森」は「木」がいくつ並んだ形？", answer: "3つ" },
      { question: "12÷3の答えは？", answer: "4" },
      { question: "7×8の答えは？（九九）", answer: "56" },
      { question: "分数 1/2＋1/4 を計算すると？（答えは分数で）", answer: "3/4" },
      { question: "割り算で「わる数」が大きいほど答えは？", answer: "小さくなる" },
      { question: "文章題で「あつめた数」から「つかった数」を引くと？", answer: "のこり" },
      { question: "国語で「主語」とは文のなかのだれ・なにを指す？", answer: "だれが・なにが" },
      { question: "小数 0.5 は分数でいうと？", answer: "2分の1" },
      { question: "三角形の内角の和は何度？", answer: "180度" },
      { question: "漢字「働」の部首は？", answer: "にんべん" },
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

const REWARDS = [
  { id: "1", name: "ゲーム30分延長", cost: 200, icon: "🎮" },
  { id: "2", name: "好きなおやつを選ぶ権利", cost: 150, icon: "🍫" },
  { id: "3", name: "ご飯のメニューを決める", cost: 300, icon: "🍕" },
  { id: "4", name: "マインクラフトの新しいMOD", cost: 500, icon: "📦" },
  { id: "5", name: "映画を選ぶ権利", cost: 250, icon: "🎬" },
  { id: "6", name: "特別なお出かけ", cost: 800, icon: "🎡" },
];

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
  const [activeGame, setActiveGame] = useState<"menu" | "riddle" | "typing" | "reward">("menu");
  const [riddleCategoryId, setRiddleCategoryId] = useState<GameThemeId>("manabi");
  const [typingCategoryId, setTypingCategoryId] = useState<GameThemeId>("manabi");

  // Riddle state
  const [riddle, setRiddle] = useState<{ question: string; answer: string } | null>(null);
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

  const fetchRiddle = (nextTheme?: GameThemeId) => {
    setRiddleResult("none");
    setRiddleAnswer("");
    const theme = nextTheme ?? riddleCategoryId;
    if (nextTheme) setRiddleCategoryId(nextTheme);
    const r = pickRandomRiddleForTheme(theme);
    setRiddle(r);
    if (speechEnabled) speak(r.question);
  };

  const checkRiddle = () => {
    if (!riddle) return;
    const correct =
      riddleAnswer.trim().includes(riddle.answer) ||
      riddle.answer.includes(riddleAnswer.trim());
    setRiddleResult(correct ? "correct" : "wrong");
    if (correct) {
      onXPGain(50);
      if (soundEnabled) playCorrect();
      if (speechEnabled) speak("せいかい！すごい！50ポイントゲット！");
    } else {
      if (soundEnabled) playWrong();
    }
  };

  const handleTyping = (val: string) => {
    setTypedText(val);
    if (val.toLowerCase() === currentWord.word.toLowerCase()) {
      const xp = 10 + typingStreak * 2;
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

  if (activeGame === "menu") {
    return (
      <div className="space-y-4" aria-label={`${childName}くんのあそび`}>
        <h3 className="text-lg font-black" style={{ color: "#7DC53D" }}>
          あそびと報酬 🎮
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { key: "riddle", icon: "🧩", label: "AIなぞなぞ", desc: "+50 XP" },
            { key: "typing", icon: "⌨️", label: "タイピング", desc: "+10 XP/word" },
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
      <div className="space-y-4">
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
        {riddle ? (
          <div className="space-y-4">
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
            {riddleResult === "none" && (
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
                <button onClick={checkRiddle} className="mc-btn mc-btn-green px-5">
                  こたえる！
                </button>
              </div>
            )}
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
                  {riddleResult === "correct" ? "せいかい！+50 XP！" : `ざんねん！こたえは「${riddle.answer}」だよ！`}
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
      <div className="space-y-4">
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
      <div className="space-y-4">
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

  return null;
}
