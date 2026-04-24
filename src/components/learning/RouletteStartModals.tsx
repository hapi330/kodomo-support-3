"use client";

import { MAX_ROULETTE_SPINS, type BgmRouletteResult } from "@/lib/bgm-roulette";

const SCRIM = "fixed inset-0 z-50 flex items-center justify-center px-4";

/** ▶ 直後：ルーレットする／しない */
export function RouletteChooseModal({
  onSkipDefaultNine,
  onStartSpin,
  onCancel,
}: {
  onSkipDefaultNine: () => void;
  onStartSpin: () => void;
  onCancel: () => void;
}) {
  return (
    <div className={SCRIM} style={{ background: "rgba(0,0,0,0.75)" }}>
      <div
        className="w-full max-w-md p-5 rounded-2xl space-y-4 animate-slide-up"
        style={{ background: "#101422", border: "3px solid #3B82F6" }}
        role="dialog"
        aria-label="ルーレットするか選ぶ"
      >
        <div className="text-center space-y-2">
          <div className="text-xl font-black" style={{ color: "#93C5FD" }}>
            勉強スタート
          </div>
          <div className="text-lg font-black" style={{ color: "#E8E8E8" }}>
            ルーレットする？しない？
          </div>
          <div className="text-xs leading-relaxed" style={{ color: "#A0C878" }}>
            「しない」は <strong style={{ color: "#BBF7D0" }}>12分</strong>・
            <strong style={{ color: "#BBF7D0" }}>けいけんち ×1.0</strong>
            でそのままはじまります。「する」で時間と倍率をルーレットします。
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button type="button" onClick={onSkipDefaultNine} className="mc-btn mc-btn-gray">
            しない（12分でスタート）
          </button>
          <button type="button" onClick={onStartSpin} className="mc-btn mc-btn-green">
            する（ルーレット）
          </button>
        </div>
        <button type="button" onClick={onCancel} className="mc-btn mc-btn-gray w-full">
          キャンセル
        </button>
      </div>
    </div>
  );
}

/** ストップ・再抽選・勉強スタート */
export function BgmRouletteSpinModal({
  result,
  rouletteStopped,
  rouletteSpinCount,
  onStop,
  onConfirmStudyStart,
  onReroll,
  onCancel,
}: {
  result: BgmRouletteResult;
  rouletteStopped: boolean;
  rouletteSpinCount: number;
  onStop: () => void;
  onConfirmStudyStart: () => void;
  onReroll: () => void;
  onCancel: () => void;
}) {
  const canReroll = rouletteStopped && rouletteSpinCount < MAX_ROULETTE_SPINS;
  const spinsLabel =
    rouletteSpinCount >= MAX_ROULETTE_SPINS
      ? "3回目なので再抽選なし"
      : `再抽選 ${rouletteSpinCount}/3（あと${MAX_ROULETTE_SPINS - rouletteSpinCount}回）`;

  return (
    <div className={SCRIM} style={{ background: "rgba(0,0,0,0.7)" }}>
      <div
        className="w-full max-w-md p-5 rounded-2xl space-y-4 animate-slide-up"
        style={{ background: "#101422", border: "3px solid #17DD62" }}
        role="dialog"
        aria-label="BGMルーレット"
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
            {result.minutes}分
          </div>
          <div className="text-lg font-bold mt-1" style={{ color: "#BBF7D0" }}>
            XP ×{result.xpMultiplier.toFixed(1)}
          </div>
          <div className="text-xs mt-2" style={{ color: "#A0C878" }}>
            {rouletteStopped ? "確定済み" : "回転中..."}
          </div>
        </div>
        <div className="text-xs text-center" style={{ color: "#A0C878" }}>
          {spinsLabel}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {!rouletteStopped ? (
            <button type="button" onClick={onStop} className="mc-btn mc-btn-red col-span-2">
              ストップ！
            </button>
          ) : (
            <button type="button" onClick={onConfirmStudyStart} className="mc-btn mc-btn-green col-span-2">
              この条件で勉強スタート
            </button>
          )}
          {canReroll && (
            <button type="button" onClick={onReroll} className="mc-btn mc-btn-blue">
              もう一回まわす
            </button>
          )}
          <button type="button" onClick={onCancel} className="mc-btn mc-btn-gray">
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
