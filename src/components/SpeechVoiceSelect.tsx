"use client";

import { useEffect, useState } from "react";
import { getJapaneseSpeechVoices, setSpeechVoiceURI } from "@/lib/sounds";
import { mcField } from "@/lib/mc-styles";

type Props = {
  value: string | null | undefined;
  onChange: (voiceURI: string | null) => void;
};

/**
 * Web Speech API の日本語声を一覧表示。Safari は初回 `voiceschanged` まで空のことがある。
 */
export default function SpeechVoiceSelect({ value, onChange }: Props) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const refresh = () => setVoices(getJapaneseSpeechVoices());
    refresh();
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.addEventListener("voiceschanged", refresh);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", refresh);
  }, []);

  const selValue = value ?? "";

  return (
    <select
      className="w-full p-3 rounded text-base"
      style={mcField}
      aria-label="読み上げの声"
      value={selValue}
      onChange={(e) => {
        const v = e.target.value;
        const uri = v === "" ? null : v;
        setSpeechVoiceURI(uri);
        onChange(uri);
      }}
    >
      <option value="">おまかせ（ブラウザの既定・日本語）</option>
      {voices.map((v) => (
        <option key={v.voiceURI} value={v.voiceURI}>
          {v.name} ({v.lang})
        </option>
      ))}
    </select>
  );
}
