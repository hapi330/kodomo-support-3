"use client";
import { useEffect, useState } from "react";
import { SUBJECTS, DEFAULT_LEARNER_PROFILE } from "@/lib/config";
import type { PendingTask } from "@/lib/pending-task";
import { mcField, mcFieldRaised } from "@/lib/mc-styles";

interface AdminModeProps {
  defaultTargetName: string;
}

export default function AdminMode({ defaultTargetName }: AdminModeProps) {
  const [targetName, setTargetName]     = useState(defaultTargetName);
  const [targetProfile, setTargetProfile] = useState(DEFAULT_LEARNER_PROFILE);
  const [subject, setSubject]           = useState(SUBJECTS[0].key);
  const [title, setTitle]               = useState("");
  const [rawText, setRawText]           = useState("");
  const [isSaving, setIsSaving]         = useState(false);
  const [status, setStatus]             = useState<{ type: "ok" | "err" | "info"; msg: string } | null>(null);
  const [savedTask, setSavedTask]       = useState<PendingTask | null>(null);

  // 既存の保存済みタスクをロード
  useEffect(() => {
    fetch("/api/save-task")
      .then((r) => r.json())
      .then((data) => { if (data) setSavedTask(data); })
      .catch(() => {});
  }, []);

  const selectedSubject = SUBJECTS.find((s) => s.key === subject) ?? SUBJECTS[0];

  const handleSave = async () => {
    if (!title.trim()) { setStatus({ type: "err", msg: "タイトルを入力してください" }); return; }
    if (!rawText.trim()) { setStatus({ type: "err", msg: "テキストを貼り付けてください" }); return; }

    setIsSaving(true);
    setStatus({ type: "info", msg: "⏳ 保存中..." });
    try {
      const task: Omit<PendingTask, "savedAt"> = {
        targetName: targetName.trim() || defaultTargetName,
        targetProfile: targetProfile.trim(),
        subject,
        title: title.trim(),
        rawText: rawText.trim(),
      };
      const res = await fetch("/api/save-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(task),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "保存失敗");

      setSavedTask({ ...task, savedAt: new Date().toISOString() });
      setTitle("");
      setRawText("");
      setStatus({ type: "ok", msg: "✅ クエストデータを保存しました！あとは Claude に「問題を作って」と伝えるだけです。" });
    } catch (e) {
      setStatus({ type: "err", msg: `❌ ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5">

      {/* ── ヘッダー ── */}
      <div
        className="p-3 rounded-lg text-sm"
        style={{ background: "#1E1E3A", border: "2px solid #D97706", color: "#FCD34D" }}
      >
        <div className="font-black text-base mb-1">⚔️ クエスト作成モード</div>
        <div style={{ color: "#9CA3AF" }}>
          テキストを貼り付けて保存 → Claude に問題生成を依頼
        </div>
      </div>

      {/* ── 対象者設定 ── */}
      <section
        className="p-4 rounded-lg space-y-3"
        style={{ background: "#0D0D1A", border: "2px solid #4A4A6A" }}
      >
        <div className="text-xs font-bold" style={{ color: "#A0C878" }}>👤 対象者設定</div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs mb-1 block" style={{ color: "#9CA3AF" }}>名前</label>
            <input
              type="text"
              value={targetName}
              onChange={(e) => setTargetName(e.target.value)}
              placeholder="例: かんた"
              className="w-full p-2 rounded text-sm"
              style={mcFieldRaised}
            />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: "#9CA3AF" }}>教科</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full p-2 rounded text-sm"
              style={mcFieldRaised}
            >
              {SUBJECTS.map((s) => (
                <option key={s.key} value={s.key}>{s.mcIcon} {s.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs mb-1 block" style={{ color: "#9CA3AF" }}>
            プロフィール <span style={{ color: "#6B7280" }}>（Claude が問題生成時に参照）</span>
          </label>
          <textarea
            value={targetProfile}
            onChange={(e) => setTargetProfile(e.target.value)}
            rows={2}
            className="w-full p-2 rounded text-xs resize-none"
            style={{ ...mcFieldRaised, color: "#9CA3AF", fontFamily: "monospace" }}
          />
        </div>
      </section>

      {/* ── 教科タブ（ビジュアル） ── */}
      <div className="flex gap-2 flex-wrap">
        {SUBJECTS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSubject(s.key)}
            className="px-3 py-2 rounded-lg text-sm font-bold transition-all"
            style={{
              background: subject === s.key ? s.color + "33" : "#1A1A2E",
              border: `2px solid ${subject === s.key ? s.color : "#4A4A6A"}`,
              color: subject === s.key ? s.color : "#6B7280",
            }}
          >
            {s.mcIcon} {s.label}
          </button>
        ))}
      </div>

      {/* ── 問題入力フォーム ── */}
      <section
        className="p-4 rounded-lg space-y-3"
        style={{
          background: "#0D1A0D",
          border: `2px solid ${selectedSubject.color}66`,
        }}
      >
        <div className="flex items-center gap-2 text-sm font-bold" style={{ color: selectedSubject.color }}>
          <span className="text-xl">{selectedSubject.mcIcon}</span>
          {selectedSubject.label} のクエストデータを入力
        </div>

        <div>
          <label className="text-xs mb-1 block" style={{ color: "#9CA3AF" }}>タイトル</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例：漢字テスト 第3回 / 10−30 分数と小数"
            className="w-full p-2 rounded text-sm"
            style={mcField}
          />
        </div>

        <div>
          <label className="text-xs mb-1 block" style={{ color: "#9CA3AF" }}>
            本文テキスト
            <span style={{ color: "#6B7280" }}> （スマホのOCRや手打ちで抽出したテキストを貼り付けてください）</span>
          </label>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={8}
            placeholder={"例:\n問1. 次の漢字の読み方を書きましょう。\n(1) 宿題\n(2) 計算\n..."}
            className="w-full p-3 rounded text-sm resize-y"
            style={{
              background: "#0D0D1A",
              border: "2px solid #4A4A6A",
              color: "#E8E8E8",
              fontFamily: "monospace",
              lineHeight: 1.7,
            }}
          />
          <div className="text-xs mt-1 text-right" style={{ color: "#6B7280" }}>
            {rawText.length} 文字
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="mc-btn mc-btn-gold w-full py-3 text-base font-black disabled:opacity-50"
        >
          {isSaving ? "⏳ 保存中..." : `⚔️ ${targetName || defaultTargetName}くんのクエストを生成！`}
        </button>
      </section>

      {/* ── ステータス表示 ── */}
      {status && (
        <div
          className="p-3 rounded-lg text-sm"
          style={{
            background: status.type === "ok" ? "#0D3A0D" : status.type === "err" ? "#3A0D0D" : "#1A1A2E",
            border: `2px solid ${status.type === "ok" ? "#17DD62" : status.type === "err" ? "#EF4444" : "#4A4A6A"}`,
            color: status.type === "ok" ? "#A0C878" : status.type === "err" ? "#FCA5A5" : "#9CA3AF",
          }}
        >
          {status.msg}
        </div>
      )}

      {/* ── 保存済みタスクのプレビュー ── */}
      {savedTask && (
        <section
          className="p-4 rounded-lg space-y-2"
          style={{ background: "#1A1A2E", border: "2px solid #4A4A6A" }}
        >
          <div className="text-xs font-bold" style={{ color: "#A78BFA" }}>
            📋 直近の保存済みタスク
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span style={{ color: "#6B7280" }}>対象者: </span>
              <span style={{ color: "#E8E8E8" }}>{savedTask.targetName}</span>
            </div>
            <div>
              <span style={{ color: "#6B7280" }}>教科: </span>
              <span style={{ color: "#E8E8E8" }}>{savedTask.subject}</span>
            </div>
            <div className="col-span-2">
              <span style={{ color: "#6B7280" }}>タイトル: </span>
              <span style={{ color: "#E8E8E8" }}>{savedTask.title}</span>
            </div>
            <div className="col-span-2">
              <span style={{ color: "#6B7280" }}>保存日時: </span>
              <span style={{ color: "#E8E8E8" }}>
                {new Date(savedTask.savedAt).toLocaleString("ja-JP")}
              </span>
            </div>
          </div>
          <div
            className="p-2 rounded text-xs"
            style={{ background: "#0D0D1A", color: "#6B7280", fontFamily: "monospace", maxHeight: 80, overflowY: "auto" }}
          >
            {savedTask.rawText.slice(0, 200)}{savedTask.rawText.length > 200 ? "…" : ""}
          </div>
          <div
            className="p-2 rounded text-xs text-center"
            style={{ background: "#1E2E1E", border: "1px solid #17DD62", color: "#17DD62" }}
          >
            ターミナルで Claude に「pending_task.json から問題を作って」と伝えてください
          </div>
        </section>
      )}
    </div>
  );
}
