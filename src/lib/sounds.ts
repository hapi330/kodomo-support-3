// Sound effects using Web Audio API (Minecraft-style)

import { prepareJapaneseSpeechText } from "@/lib/speech-text-ja";

let audioCtx: AudioContext | null = null;

/** 効果音・BGMで共有（Web Audio） */
export function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return audioCtx;
}

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = "square",
  volume = 0.3,
  delay = 0
): void {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration);
  } catch (e) {
    console.warn("Audio error:", e);
  }
}

// Minecraft level-up sound (ascending arpeggio)
export function playLevelUp(): void {
  const notes = [523, 659, 784, 1047, 1319];
  notes.forEach((freq, i) => {
    playTone(freq, 0.15, "square", 0.25, i * 0.12);
  });
}

// Correct answer - pleasant chime
export function playCorrect(): void {
  playTone(523, 0.1, "sine", 0.3, 0);
  playTone(659, 0.1, "sine", 0.3, 0.1);
  playTone(784, 0.2, "sine", 0.3, 0.2);
}

/** クイズのヒント段階・国語向け：短い「ピンポン」2音 */
export function playPingPong(): void {
  playTone(1319, 0.07, "sine", 0.28, 0);
  playTone(988, 0.09, "sine", 0.26, 0.08);
}

// Wrong answer - Minecraft hurt sound
export function playWrong(): void {
  playTone(200, 0.1, "sawtooth", 0.2, 0);
  playTone(150, 0.2, "sawtooth", 0.2, 0.1);
}

// Explosion sound (for wrong answer fun effect)
export function playExplosion(): void {
  try {
    const ctx = getAudioContext();
    const bufferSize = ctx.sampleRate * 0.5;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.1));
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  } catch (e) {
    console.warn("Audio error:", e);
  }
}

// Click sound
export function playClick(): void {
  playTone(880, 0.05, "square", 0.15);
}

// Homework timer alert - villager-like fanfare
export function playHomeworkAlert(): void {
  const melody = [
    [523, 0.15], [523, 0.15], [523, 0.15],
    [659, 0.3], [784, 0.15], [784, 0.15],
    [784, 0.15], [880, 0.4],
  ];
  let delay = 0;
  melody.forEach(([freq, dur]) => {
    playTone(freq as number, dur as number, "square", 0.25, delay);
    delay += (dur as number) + 0.02;
  });
}

// XP gain sound
export function playXPGain(): void {
  playTone(440, 0.08, "sine", 0.2, 0);
  playTone(550, 0.08, "sine", 0.2, 0.08);
}

// --- Speech synthesis（Web Speech API。設定の声は setSpeechVoiceURI で指定） ---

let preferredSpeechVoiceURI: string | null = null;

/** 読み上げに使う声（`getJapaneseSpeechVoices()` の `voiceURI`）。null でブラウザ既定。 */
export function setSpeechVoiceURI(uri: string | null): void {
  const t = uri?.trim();
  preferredSpeechVoiceURI = t ? t : null;
}

export function getSpeechVoiceURI(): string | null {
  return preferredSpeechVoiceURI;
}

function langMatchesJapanese(lang: string): boolean {
  const l = lang.toLowerCase().replace(/_/g, "-");
  return l.startsWith("ja") || l === "jp";
}

/** 日本語向けに使える声一覧（設定 UI 用）。Safari では初回空のことがあるので `voiceschanged` で再取得すること。 */
export function getJapaneseSpeechVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  return window.speechSynthesis.getVoices().filter((v) => langMatchesJapanese(v.lang));
}

function pickVoiceForUtterance(): SpeechSynthesisVoice | null {
  if (!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (preferredSpeechVoiceURI) {
    const found = voices.find((v) => v.voiceURI === preferredSpeechVoiceURI);
    if (found) return found;
  }
  return voices.find((v) => langMatchesJapanese(v.lang)) ?? null;
}

export function speak(text: string, rate = 0.9, pitch = 1.1): void {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(prepareJapaneseSpeechText(text));
  utterance.lang = "ja-JP";
  utterance.rate = rate;
  utterance.pitch = pitch;
  utterance.volume = 0.9;
  const voice = pickVoiceForUtterance();
  if (voice) {
    utterance.voice = voice;
    if (voice.lang) utterance.lang = voice.lang;
  }
  window.speechSynthesis.speak(utterance);
}
