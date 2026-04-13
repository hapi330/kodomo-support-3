"use client";
import { useState } from "react";
import { playCorrect, playWrong, playClick, speak } from "@/lib/sounds";
import { mcField } from "@/lib/mc-styles";

interface GamesProps {
  totalXP: number;
  onXPGain: (xp: number) => void;
  soundEnabled: boolean;
  speechEnabled: boolean;
  childName: string;
}

const DADJOKES = [
  { joke: "なぜスティーブはクリーパーが苦手なの？", punchline: "ちかづくと、どっか～ん！ってするから！💥" },
  { joke: "マインクラフトで一番やさしいモブは？", punchline: "村人！いつも「うーん」とかいいながら助けてくれる！" },
  { joke: "エンダーマンが怒る理由は？", punchline: "目が合っちゃったから…照れてるだけだよ！👁" },
  { joke: "ダイヤモンドを掘りすぎるとどうなる？", punchline: "持ちすぎて…ピカピカしすぎちゃう！💎" },
  { joke: "ゾンビがマインクラフトを好きな理由は？", punchline: "ブレインズ（脳みそ）じゃなくて、ブロック集めが楽しいから！🧟" },
  { joke: "スケルトンが算数が得意な理由は？", punchline: "骨（bone）の数を数えるのが上手だから！💀" },
  { joke: "なぜエンチャントの本は重い？", punchline: "魔法がいっぱい詰まってるから！📖✨" },
];

const MINECRAFT_WORDS = [
  { word: "creeper", jp: "クリーパー" },
  { word: "diamond", jp: "ダイヤモンド" },
  { word: "crafting", jp: "クラフト" },
  { word: "enderman", jp: "エンダーマン" },
  { word: "skeleton", jp: "スケルトン" },
  { word: "enchant", jp: "エンチャント" },
  { word: "nether", jp: "ネザー" },
  { word: "village", jp: "村" },
  { word: "zombie", jp: "ゾンビ" },
  { word: "furnace", jp: "かまど" },
  { word: "pickaxe", jp: "つるはし" },
  { word: "redstone", jp: "レッドストーン" },
];

const MINECRAFT_RIDDLES = [
  { question: "マインクラフトでダイヤモンドが見つかる一番深い場所は？", answer: "地下" },
  { question: "クリーパーが緑色なのはなぜ？バグで作られた生き物だから！では、最初に作られたのは何のはずだった？", answer: "ブタ" },
  { question: "エンダーパールを投げると何ができる？", answer: "テレポート" },
  { question: "ネザーにいる、炎を投げてくる敵の名前は？", answer: "ブレイズ" },
  { question: "本と羽ペンを使って作れるものは？", answer: "本と羽ペン（記名済みの本）" },
  { question: "レッドストーンで作れる基本的な装置は？", answer: "回路（スイッチや扉）" },
  { question: "エンダードラゴンを倒した後に出てくる柱の上にあるものは？", answer: "エンドクリスタル" },
  { question: "ウシからとれる食べ物は2種類。牛肉ともう一つは？", answer: "革（かわ）" },
  { question: "水の中でも呼吸できるようにするエンチャントは？", answer: "水中呼吸" },
  { question: "砂漠で見つかる、中にお宝が入った建物は？", answer: "砂漠の神殿" },
];

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
  const [activeGame, setActiveGame] = useState<"menu" | "joke" | "riddle" | "typing" | "reward">("menu");
  const [jokeIndex, setJokeIndex] = useState(0);
  const [showPunchline, setShowPunchline] = useState(false);

  // Riddle state
  const [riddle, setRiddle] = useState<{ question: string; answer: string } | null>(null);
  const [riddleAnswer, setRiddleAnswer] = useState("");
  const [riddleResult, setRiddleResult] = useState<"none" | "correct" | "wrong">("none");
  // Typing state
  const [currentWordIdx, setCurrentWordIdx] = useState(0);
  const [typedText, setTypedText] = useState("");
  const [typingScore, setTypingScore] = useState(0);
  const [typingStreak, setTypingStreak] = useState(0);

  const currentJoke = DADJOKES[jokeIndex % DADJOKES.length];
  const currentWord = MINECRAFT_WORDS[currentWordIdx % MINECRAFT_WORDS.length];

  const fetchRiddle = () => {
    setRiddleResult("none");
    setRiddleAnswer("");
    const r = MINECRAFT_RIDDLES[Math.floor(Math.random() * MINECRAFT_RIDDLES.length)];
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
      setCurrentWordIdx((i) => (i + 1) % MINECRAFT_WORDS.length);
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
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: "joke", icon: "😂", label: "デイリーダジャレ", desc: "毎日のジョーク" },
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

  // JOKE
  if (activeGame === "joke") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-black" style={{ color: "#FCD34D" }}>😂 デイリーダジャレ</h3>
          <GamesBackButton onBack={() => setActiveGame("menu")} />
        </div>
        <div className="p-6 rounded-xl text-center space-y-4" style={{ background: "#1A1A0D", border: "3px solid #FCD34D" }}>
          <div className="text-xl font-bold leading-relaxed">{currentJoke.joke}</div>
          {!showPunchline ? (
            <button
              onClick={() => { setShowPunchline(true); if (speechEnabled) speak(currentJoke.punchline); }}
              className="mc-btn mc-btn-gold px-8 py-3 text-base"
            >
              答えを見る！
            </button>
          ) : (
            <>
              <div
                className="text-xl font-black animate-slide-up"
                style={{ color: "#FCD34D" }}
              >
                {currentJoke.punchline}
              </div>
              <button
                onClick={() => { setJokeIndex((i) => i + 1); setShowPunchline(false); }}
                className="mc-btn mc-btn-green px-6 py-2"
              >
                つぎのジョーク！
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // RIDDLE
  if (activeGame === "riddle") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-black" style={{ color: "#5DECF5" }}>🧩 AIなぞなぞ</h3>
          <GamesBackButton onBack={() => setActiveGame("menu")} />
        </div>
        {riddle ? (
          <div className="space-y-4">
            <div
              className="p-5 rounded-xl text-xl font-bold leading-relaxed"
              style={{ background: "#0D0D1A", border: "3px solid #5DECF5" }}
            >
              {riddle.question}
              {speechEnabled && (
                <button
                  onClick={() => speak(riddle.question)}
                  className="block mt-2 text-sm px-3 py-1 rounded"
                  style={{ background: "#1A1A2E", color: "#5DECF5" }}
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
                <button onClick={fetchRiddle} className="mt-3 mc-btn mc-btn-blue px-6 py-2">
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
          <h3 className="font-black" style={{ color: "#A78BFA" }}>⌨️ タイピング練習</h3>
          <GamesBackButton onBack={() => setActiveGame("menu")} />
        </div>
        <div
          className="p-4 rounded-xl text-center space-y-3"
          style={{ background: "#0D0D1A", border: "3px solid #A78BFA" }}
        >
          <div className="flex justify-between text-sm px-2">
            <span style={{ color: "#9CA3AF" }}>スコア: <span className="pixel-font text-lg" style={{ color: "#7FFF00" }}>{typingScore}</span></span>
            <span style={{ color: "#9CA3AF" }}>れんぞく: <span className="pixel-font text-lg" style={{ color: "#FCD34D" }}>{typingStreak}</span></span>
          </div>
          <div className="text-4xl font-black py-4" style={{ color: "#5DECF5", letterSpacing: "0.2em" }}>
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
              border: `2px solid ${typedText && currentWord.word.startsWith(typedText.toLowerCase()) ? "#17DD62" : "#EF4444"}`,
              color: "#E8E8E8",
            }}
          />
          <div className="text-xs" style={{ color: "#6B7280" }}>
            問題 {(currentWordIdx % MINECRAFT_WORDS.length) + 1}/{MINECRAFT_WORDS.length}
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
