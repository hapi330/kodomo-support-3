/**
 * 勉強セッション用 BGM（オリジナルの 8bit 風ループ）
 * - 3（予習）/ 8 / 10 / 12 分を 1 サイクルとして繰り返す（セッション終了まで）
 * - 1 サイクル内の構成:
 *   - 先頭 1/3: オープニング（勇ましい・前向きなイメージ）
 *   - 中央 1/3: 中盤（テンポ・音量を抑えめに）
 *   - 最後の 1/3 〜 終了 1 分前: 終盤・エンディングへ向けた盛り上がり
 *   - 残り 1 分未満 〜 残り 30 秒: テンポアップ
 *   - 残り 30 秒: 最速テンポ
 * - サイクル終端で onCycleEndPulse（爆発音・画面は呼び出し側）
 */
import { getAudioContext } from "@/lib/sounds";
import type { BgmCycleMinutes } from "@/lib/bgm-roulette";

const MINUTE_MS = 60 * 1000;

/** 区間ごとのテンポ（tick 間隔 ms・小さいほど速い） */
const TICK_OPEN = 130;
const TICK_MID = 168;
const TICK_END = 118;
const TICK_LAST_MINUTE = 86;
const TICK_LAST_30S = 62;

const MELODY: number[] = [
  659, 659, 784, 523, 659, 523, 784, 659,
  698, 784, 880, 784, 659, 523, 587, 523,
];

const BASS: number[] = [130, 0, 146, 0, 164, 0, 174, 0, 130, 0, 146, 0, 196, 0, 174, 0];

type BgmSection = "open" | "mid" | "end" | "lastMin" | "last30";

function sectionAt(tInCycle: number, cycleMs: number): BgmSection {
  if (tInCycle >= cycleMs - 30_000) return "last30";
  if (tInCycle >= cycleMs - 60_000) return "lastMin";
  const t1 = cycleMs / 3;
  const t2 = (2 * cycleMs) / 3;
  if (tInCycle < t1) return "open";
  if (tInCycle < t2) return "mid";
  return "end";
}

function paramsForSection(section: BgmSection): {
  tickMs: number;
  pitchScale: number;
  vol: number;
  noteDur: number;
  bassDur: number;
  bassModulo: number;
  bassVol: number;
  melType: OscillatorType;
  bassType: OscillatorType;
} {
  switch (section) {
    case "open":
      return {
        tickMs: TICK_OPEN,
        pitchScale: 1,
        vol: 0.052,
        noteDur: 0.1,
        bassDur: 0.11,
        bassModulo: 2,
        bassVol: 0.036,
        melType: "square",
        bassType: "triangle",
      };
    case "mid":
      return {
        tickMs: TICK_MID,
        pitchScale: 0.93,
        vol: 0.038,
        noteDur: 0.11,
        bassDur: 0.13,
        bassModulo: 3,
        bassVol: 0.028,
        melType: "triangle",
        bassType: "triangle",
      };
    case "end":
      return {
        tickMs: TICK_END,
        pitchScale: 1,
        vol: 0.048,
        noteDur: 0.095,
        bassDur: 0.1,
        bassModulo: 2,
        bassVol: 0.034,
        melType: "square",
        bassType: "triangle",
      };
    case "lastMin":
      return {
        tickMs: TICK_LAST_MINUTE,
        pitchScale: 1.02,
        vol: 0.053,
        noteDur: 0.085,
        bassDur: 0.09,
        bassModulo: 2,
        bassVol: 0.036,
        melType: "square",
        bassType: "sawtooth",
      };
    case "last30":
      return {
        tickMs: TICK_LAST_30S,
        pitchScale: 1.04,
        vol: 0.056,
        noteDur: 0.068,
        bassDur: 0.078,
        bassModulo: 1,
        bassVol: 0.04,
        melType: "sawtooth",
        bassType: "sawtooth",
      };
  }
}

export type StudySessionBgmOptions = {
  /** 1サイクルの分数（9/12/15） */
  cycleMinutes?: BgmCycleMinutes;
  /** サイクル終端のたび（2 回目以降のサイクル境界）。爆発音・画面演出はここで行う */
  onCycleEndPulse?: () => void;
  /** 開始時のミュート状態を明示（UI状態とのズレ防止） */
  muted?: boolean;
};

type BgmRuntimeState = {
  timeoutId: number | null;
  stopped: boolean;
  tickIndex: number;
  sessionStartedAt: number;
  lastCycleIndex: number;
  opts: StudySessionBgmOptions;
  cycleMs: number;
  lastResumeAttemptAt: number;
};

const bgmState: BgmRuntimeState = {
  timeoutId: null,
  stopped: true,
  tickIndex: 0,
  sessionStartedAt: 0,
  lastCycleIndex: -1,
  opts: {},
  cycleMs: 12 * MINUTE_MS,
  lastResumeAttemptAt: 0,
};
/** 勉強中の UI から切り替え（ノートは鳴らさない） */
let bgmMuted = false;

export function setStudySessionBgmMuted(muted: boolean): void {
  bgmMuted = muted;
}

export function getStudySessionBgmMuted(): boolean {
  return bgmMuted;
}

function playChipNote(
  frequency: number,
  duration: number,
  volume: number,
  type: OscillatorType = "square"
): void {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.value = frequency;
    const t0 = ctx.currentTime;
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.start(t0);
    osc.stop(t0 + duration);
  } catch {
    /* ignore */
  }
}

function requestAudioContextResume(force = false): void {
  const now = Date.now();
  // Safari で resume が不安定なことがあるため、一定間隔で再試行する
  if (!force && now - bgmState.lastResumeAttemptAt < 1200) return;
  bgmState.lastResumeAttemptAt = now;
  try {
    const ctx = getAudioContext();
    if (ctx.state !== "running") {
      void ctx.resume();
    }
  } catch {
    /* ignore */
  }
}

function scheduleTick(): void {
  if (bgmState.stopped) return;

  const elapsed = Date.now() - bgmState.sessionStartedAt;
  const cycleIndex = Math.floor(elapsed / bgmState.cycleMs);

  if (cycleIndex > bgmState.lastCycleIndex) {
    if (cycleIndex >= 1) {
      bgmState.opts.onCycleEndPulse?.();
    }
    bgmState.tickIndex = 0;
    bgmState.lastCycleIndex = cycleIndex;
  }

  const tInCycle = elapsed % bgmState.cycleMs;
  const section = sectionAt(tInCycle, bgmState.cycleMs);
  const p = paramsForSection(section);

  const tickMs = p.tickMs;
  const mi = bgmState.tickIndex % MELODY.length;
  const bi = bgmState.tickIndex % BASS.length;
  const melFreq = MELODY[mi] * p.pitchScale;
  const bassFreq = BASS[bi] * p.pitchScale;

  if (!bgmMuted) {
    requestAudioContextResume(false);
    if (melFreq > 0) {
      playChipNote(melFreq, p.noteDur, p.vol, p.melType);
    }
    if (bassFreq > 0 && bgmState.tickIndex % p.bassModulo === 0) {
      playChipNote(bassFreq, p.bassDur, p.bassVol, p.bassType);
    }
  }

  bgmState.tickIndex += 1;
  bgmState.timeoutId = window.setTimeout(scheduleTick, tickMs) as number;
}

function resetRuntimeState(options?: StudySessionBgmOptions): void {
  bgmState.opts = options ?? {};
  bgmState.cycleMs = (bgmState.opts.cycleMinutes ?? 12) * MINUTE_MS;
  bgmState.stopped = false;
  bgmState.tickIndex = 0;
  bgmState.lastCycleIndex = -1;
  bgmState.sessionStartedAt = Date.now();
  bgmState.lastResumeAttemptAt = 0;
}

export function startStudySessionBgm(options?: StudySessionBgmOptions): void {
  const startMuted = options?.muted;
  stopStudySessionBgm();
  if (typeof startMuted === "boolean") {
    bgmMuted = startMuted;
  }
  resetRuntimeState(options);

  try {
    requestAudioContextResume(true);
  } catch {
    /* ignore */
  }

  bgmState.timeoutId = window.setTimeout(scheduleTick, 80) as number;
}

export function stopStudySessionBgm(): void {
  bgmState.stopped = true;
  bgmState.opts = {};
  bgmState.lastCycleIndex = -1;
  if (bgmState.timeoutId !== null) {
    clearTimeout(bgmState.timeoutId);
    bgmState.timeoutId = null;
  }
}
