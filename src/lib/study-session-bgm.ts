/**
 * 勉強セッション用 BGM（オリジナルの 8bit 風ループ）
 * - 同一メロディで、5/7/9 分を 1 サイクルとして繰り返す（セッション終了まで）
 * - 各サイクル内: 0〜60% 通常テンポ → 60〜80% やや速め → 80%〜残り30秒 さらに速め → 残り30秒 超絶テンポ
 * - サイクル終端ごとに onCycleEndPulse（爆発音・画面は呼び出し側）
 */
import { getAudioContext } from "@/lib/sounds";

const MINUTE_MS = 60 * 1000;

/** テンポのみ変化（メロは共通） */
const TICK_MS_BASE = 148;
const TICK_MS_PHASE2 = 128;
const TICK_MS_PHASE3 = 104;
const TICK_MS_PHASE4 = 72;

const MELODY: number[] = [
  659, 659, 784, 523, 659, 523, 784, 659,
  698, 784, 880, 784, 659, 523, 587, 523,
];

const BASS: number[] = [130, 0, 146, 0, 164, 0, 174, 0, 130, 0, 146, 0, 196, 0, 174, 0];

export type StudySessionBgmOptions = {
  /** 1サイクルの分数（5/7/9） */
  cycleMinutes?: 5 | 7 | 9;
  /** サイクル終端のたび（2 回目以降のサイクル境界）。爆発音・画面演出はここで行う */
  onCycleEndPulse?: () => void;
};

let timeoutId: number | null = null;
let stopped = true;
let tickIndex = 0;
let sessionStartedAt = 0;
let lastCycleIndex = -1;
let optsRef: StudySessionBgmOptions = {};
let cycleMsRef = 5 * MINUTE_MS;

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

function tickMsForPhase(tInCycle: number): number {
  if (tInCycle < cycleMsRef * 0.6) return TICK_MS_BASE;
  if (tInCycle < cycleMsRef * 0.8) return TICK_MS_PHASE2;
  if (tInCycle < cycleMsRef - 30_000) return TICK_MS_PHASE3;
  return TICK_MS_PHASE4;
}

function noteDurationForPhase(tInCycle: number): number {
  if (tInCycle < cycleMsRef * 0.8) return 0.1;
  if (tInCycle < cycleMsRef - 30_000) return 0.085;
  return 0.065;
}

function bassDurationForPhase(tInCycle: number): number {
  if (tInCycle < cycleMsRef * 0.8) return 0.12;
  if (tInCycle < cycleMsRef - 30_000) return 0.095;
  return 0.075;
}

function bassBeatModuloForPhase(tInCycle: number): number {
  if (tInCycle < cycleMsRef * 0.8) return 2;
  if (tInCycle < cycleMsRef - 30_000) return 2;
  return 1;
}

function bassVolumeForPhase(tInCycle: number): number {
  if (tInCycle < cycleMsRef * 0.8) return 0.032;
  if (tInCycle < cycleMsRef - 30_000) return 0.034;
  return 0.038;
}

function melodyTypeForPhase(tInCycle: number): OscillatorType {
  if (tInCycle < cycleMsRef - 30_000) return "square";
  return "sawtooth";
}

function bassTypeForPhase(tInCycle: number): OscillatorType {
  if (tInCycle < cycleMsRef - 30_000) return "triangle";
  return "sawtooth";
}

function volumeForPhase(tInCycle: number): number {
  if (tInCycle < cycleMsRef * 0.6) return 0.048;
  if (tInCycle < cycleMsRef * 0.8) return 0.052;
  return 0.055;
}

function scheduleTick(): void {
  if (stopped) return;

  const elapsed = Date.now() - sessionStartedAt;
  const cycleIndex = Math.floor(elapsed / cycleMsRef);

  if (cycleIndex > lastCycleIndex) {
    if (cycleIndex >= 1) {
      optsRef.onCycleEndPulse?.();
    }
    tickIndex = 0;
    lastCycleIndex = cycleIndex;
  }

  const tInCycle = elapsed % cycleMsRef;
  const tickMs = tickMsForPhase(tInCycle);
  const vol = volumeForPhase(tInCycle);
  const noteDur = noteDurationForPhase(tInCycle);
  const bassDur = bassDurationForPhase(tInCycle);
  const bassModulo = bassBeatModuloForPhase(tInCycle);
  const bassVol = bassVolumeForPhase(tInCycle);
  const melType = melodyTypeForPhase(tInCycle);
  const bType = bassTypeForPhase(tInCycle);

  const mi = tickIndex % MELODY.length;
  const bi = tickIndex % BASS.length;
  const m = MELODY[mi];
  if (m > 0) {
    playChipNote(m, noteDur, vol, melType);
  }
  const b = BASS[bi];
  if (b > 0 && tickIndex % bassModulo === 0) {
    playChipNote(b, bassDur, bassVol, bType);
  }

  tickIndex += 1;
  timeoutId = window.setTimeout(scheduleTick, tickMs) as number;
}

export function startStudySessionBgm(options?: StudySessionBgmOptions): void {
  stopStudySessionBgm();
  optsRef = options ?? {};
  cycleMsRef = (optsRef.cycleMinutes ?? 5) * MINUTE_MS;
  stopped = false;
  tickIndex = 0;
  lastCycleIndex = -1;
  sessionStartedAt = Date.now();

  try {
    const ctx = getAudioContext();
    void ctx.resume();
  } catch {
    /* ignore */
  }

  timeoutId = window.setTimeout(scheduleTick, 80) as number;
}

export function stopStudySessionBgm(): void {
  stopped = true;
  optsRef = {};
  lastCycleIndex = -1;
  if (timeoutId !== null) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
}
