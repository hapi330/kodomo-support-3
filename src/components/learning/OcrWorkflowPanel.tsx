"use client";

import { mcField, mcFieldRaised } from "@/lib/mc-styles";

interface OcrWorkflowPanelProps {
  isOcrRunning: boolean;
  progress: number;
  progressLabel: string;
  draftText: string;
  editableText: string;
  flags: string[];
  approvalMessage: string;
  reviewNote: string;
  finalOutput: string;
  onFileChange: (file: File | null) => void;
  onRunOcr: () => void;
  onEditableTextChange: (value: string) => void;
  onReviewNoteChange: (value: string) => void;
  onFinalizeOk: () => void;
  onFinalizeEdited: () => void;
}

export default function OcrWorkflowPanel({
  isOcrRunning,
  progress,
  progressLabel,
  draftText,
  editableText,
  flags,
  approvalMessage,
  reviewNote,
  finalOutput,
  onFileChange,
  onRunOcr,
  onEditableTextChange,
  onReviewNoteChange,
  onFinalizeOk,
  onFinalizeEdited,
}: OcrWorkflowPanelProps) {
  return (
    <>
      <div>
        <label className="text-xs mb-1 block" style={{ color: "#9CA3AF" }}>
          画像アップロード（OCR）
        </label>
        <div className="space-y-2">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            className="w-full p-2 rounded text-sm"
            style={mcField}
          />
          <button
            type="button"
            onClick={onRunOcr}
            disabled={isOcrRunning}
            className="mc-btn mc-btn-blue w-full py-2 disabled:opacity-50"
          >
            {isOcrRunning ? "⏳ OCR実行中..." : "📸 画像を文字起こし"}
          </button>
          {isOcrRunning && (
            <div className="rounded p-2" style={{ background: "#0D0D1A", border: "1px solid #4A4A6A" }}>
              <div className="flex items-center justify-between text-xs mb-1" style={{ color: "#A0C878" }}>
                <span>{progressLabel}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 rounded" style={{ background: "#1A1A2E" }}>
                <div
                  className="h-2 rounded transition-all duration-200"
                  style={{
                    width: `${progress}%`,
                    background: "linear-gradient(90deg, #17DD62, #7FFF00)",
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {draftText && (
        <div className="space-y-3 p-3 rounded" style={{ background: "#0D0D1A", border: "2px solid #4A4A6A" }}>
          <div className="text-xs font-bold" style={{ color: "#7DC53D" }}>
            1. 【暫定文字起こし】
          </div>
          <textarea
            value={editableText}
            onChange={(e) => onEditableTextChange(e.target.value)}
            rows={8}
            className="w-full p-3 rounded text-sm resize-y"
            style={{ ...mcField, fontFamily: "monospace", lineHeight: 1.7 }}
          />

          <div className="text-xs font-bold" style={{ color: "#FCD34D" }}>
            2. 【自己検品とフラグ立て】
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto text-xs" style={{ color: "#FCA5A5" }}>
            {flags.length > 0 ? (
              flags.map((flag, idx) => <div key={`${flag}-${idx}`}>{flag}</div>)
            ) : (
              <div>[要確認] 特記事項はありません</div>
            )}
          </div>

          <div className="text-xs font-bold" style={{ color: "#A0C878" }}>
            3. 【ユーザー承認待ち】
          </div>
          <div className="text-xs" style={{ color: "#9CA3AF" }}>
            {approvalMessage || "上記内容で間違いがないか、修正が必要な箇所があれば教えてください"}
          </div>
          <textarea
            value={reviewNote}
            onChange={(e) => onReviewNoteChange(e.target.value)}
            rows={2}
            placeholder="修正メモ（任意）"
            className="w-full p-2 rounded text-xs resize-y"
            style={{ ...mcFieldRaised, fontFamily: "monospace" }}
          />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={onFinalizeOk} className="mc-btn mc-btn-green py-2">
              OKで確定
            </button>
            <button type="button" onClick={onFinalizeEdited} className="mc-btn mc-btn-gold py-2">
              修正ありで確定
            </button>
          </div>
        </div>
      )}

      {finalOutput && (
        <div className="p-3 rounded" style={{ background: "#1A1A2E", border: "2px solid #17DD62" }}>
          <div className="text-xs font-bold mb-1" style={{ color: "#17DD62" }}>
            4. 【最終確定】
          </div>
          <pre
            className="text-xs whitespace-pre-wrap"
            style={{ color: "#E8E8E8", fontFamily: "monospace", lineHeight: 1.7 }}
          >
            {finalOutput}
          </pre>
        </div>
      )}
    </>
  );
}
