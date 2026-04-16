"use client";
import { useReducer, useState } from "react";
import { SUBJECTS, DEFAULT_LEARNER_PROFILE } from "@/lib/config";
import { mcField, mcFieldRaised } from "@/lib/mc-styles";
import {
  toFinalOutput,
  type OcrGenre,
  type OcrLanguage,
} from "@/lib/ocr-format";
import OcrWorkflowPanel from "@/components/learning/OcrWorkflowPanel";
import { useOcrWorkflow } from "@/components/learning/useOcrWorkflow";
type TaskSaveStatus = { type: "ok" | "err" | "info"; msg: string };
const OCR_SUCCESS_MESSAGE = "✅ 暫定文字起こしを作成しました。内容確認後に確定してください。";
const OCR_FINALIZE_MESSAGE = "✅ 最終確定テキストを反映しました。保存を実行してください。";
const SAVE_SUCCESS_MESSAGE = "✅ クエストを生成しました。学習タブでそのまま挑戦できます。";

interface AdminModeProps {
  defaultTargetName: string;
}

type OcrState = {
  file: File | null;
  draftText: string;
  editableText: string;
  flags: string[];
  approvalMessage: string;
  language: OcrLanguage;
  genre: OcrGenre;
  reviewNote: string;
  finalOutput: string;
};

type OcrAction =
  | { type: "set-file"; file: File | null }
  | {
      type: "apply-result";
      payload: {
        draftText: string;
        flags: string[];
        approvalMessage: string;
        language: OcrLanguage;
        genre: OcrGenre;
      };
    }
  | { type: "set-editable-text"; value: string }
  | { type: "set-review-note"; value: string }
  | { type: "set-final-output"; value: string }
  | { type: "clear-draft" };

const INITIAL_OCR_STATE: OcrState = {
  file: null,
  draftText: "",
  editableText: "",
  flags: [],
  approvalMessage: "",
  language: "日本語",
  genre: "算数",
  reviewNote: "",
  finalOutput: "",
};

function ocrReducer(state: OcrState, action: OcrAction): OcrState {
  switch (action.type) {
    case "set-file":
      return { ...state, file: action.file };
    case "apply-result":
      return {
        ...state,
        draftText: action.payload.draftText,
        editableText: action.payload.draftText,
        flags: action.payload.flags,
        approvalMessage: action.payload.approvalMessage,
        language: action.payload.language,
        genre: action.payload.genre,
        reviewNote: "",
        finalOutput: "",
      };
    case "set-editable-text":
      return { ...state, editableText: action.value };
    case "set-review-note":
      return { ...state, reviewNote: action.value };
    case "set-final-output":
      return { ...state, finalOutput: action.value };
    case "clear-draft":
      return {
        ...state,
        draftText: "",
        editableText: "",
        flags: [],
        approvalMessage: "",
        reviewNote: "",
        finalOutput: "",
      };
    default:
      return state;
  }
}

export default function AdminMode({ defaultTargetName }: AdminModeProps) {
  const [targetName, setTargetName]     = useState(defaultTargetName);
  const [targetProfile, setTargetProfile] = useState(DEFAULT_LEARNER_PROFILE);
  const [subject, setSubject]           = useState(SUBJECTS[0].key);
  const [title, setTitle]               = useState("");
  const [rawText, setRawText]           = useState("");
  const [status, setStatus] = useState<TaskSaveStatus | null>(null);
  const [ocrState, dispatchOcr] = useReducer(ocrReducer, INITIAL_OCR_STATE);
  const { isRunning: isOcrRunning, progress: ocrProgress, progressLabel: ocrProgressLabel, runOcr } =
    useOcrWorkflow();

  const setErrorStatus = (error: unknown) => {
    setStatus({ type: "err", msg: `❌ ${error instanceof Error ? error.message : String(error)}` });
  };

  const clearOcrDraft = () => {
    dispatchOcr({ type: "clear-draft" });
  };

  const selectedSubject = SUBJECTS.find((s) => s.key === subject) ?? SUBJECTS[0];

  const handleRunOcr = async () => {
    if (!ocrState.file) {
      setStatus({ type: "err", msg: "OCRする画像を選択してください" });
      return;
    }

    setStatus({ type: "info", msg: "⏳ OCR実行中..." });
    try {
      const ocrResult = await runOcr(ocrState.file);
      dispatchOcr({
        type: "apply-result",
        payload: {
          draftText: ocrResult.draftText,
          flags: ocrResult.flags,
          approvalMessage: ocrResult.approvalMessage,
          language: ocrResult.language,
          genre: ocrResult.genre,
        },
      });
      setStatus({ type: "ok", msg: OCR_SUCCESS_MESSAGE });
    } catch (e) {
      setErrorStatus(e);
    }
  };

  const finalizeOcr = (userEdited: boolean) => {
    if (!ocrState.editableText.trim()) {
      setStatus({ type: "err", msg: "確定する本文が空です" });
      return;
    }

    const finalText = ocrState.editableText.trim();
    const finalOutput = toFinalOutput({
      finalText,
      language: ocrState.language,
      genre: ocrState.genre,
      userEdited,
    });

    setRawText(finalText);
    if (!title.trim() && ocrState.file) {
      setTitle(ocrState.file.name.replace(/\.[^/.]+$/, ""));
    }
    dispatchOcr({ type: "set-final-output", value: finalOutput });
    setStatus({ type: "ok", msg: OCR_FINALIZE_MESSAGE });
  };

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    const trimmedRawText = rawText.trim();

    if (!trimmedTitle) {
      setStatus({ type: "err", msg: "タイトルを入力してください" });
      return;
    }
    if (!trimmedRawText) {
      setStatus({ type: "err", msg: "テキストを貼り付けてください" });
      return;
    }
    setStatus({ type: "info", msg: "⏳ クエストを生成中..." });
    try {
      const res = await fetch("/api/problems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          subject,
          rawText: trimmedRawText,
        }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(payload.error ?? "クエスト生成に失敗しました");
      }

      clearOcrDraft();
      setTitle("");
      setRawText("");
      setStatus({ type: "ok", msg: SAVE_SUCCESS_MESSAGE });
    } catch (error) {
      setErrorStatus(error);
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
          OCRで読み込んだテキストを確定し、アプリ内で問題作成します
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
            プロフィール <span style={{ color: "#6B7280" }}>（問題生成時に参照）</span>
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

        <OcrWorkflowPanel
          isOcrRunning={isOcrRunning}
          draftText={ocrState.draftText}
          editableText={ocrState.editableText}
          flags={ocrState.flags}
          approvalMessage={ocrState.approvalMessage}
          reviewNote={ocrState.reviewNote}
          finalOutput={ocrState.finalOutput}
          progress={ocrProgress}
          progressLabel={ocrProgressLabel}
          onFileChange={(file) => dispatchOcr({ type: "set-file", file })}
          onRunOcr={handleRunOcr}
          onEditableTextChange={(value) => dispatchOcr({ type: "set-editable-text", value })}
          onReviewNoteChange={(value) => dispatchOcr({ type: "set-review-note", value })}
          onFinalizeOk={() => finalizeOcr(false)}
          onFinalizeEdited={() => finalizeOcr(true)}
        />

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
          className="mc-btn mc-btn-gold w-full py-3 text-base font-black"
        >
          ⚔️ {targetName || defaultTargetName}くんのクエストを生成！
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

    </div>
  );
}
