"use client";

import { Fragment, useState } from "react";
import { SUBJECTS } from "@/lib/config";
import {
  formatQuestionBlockTitle,
  insertQuestionAt,
  normalizeQuestion,
  padChoices,
  padHints,
  removeQuestionAt,
  updateQuestionAt,
} from "@/lib/question-draft";
import { hasPendingChoiceEnrichment } from "@/lib/inserted-enrichment-gate";
import type { UploadedContent } from "@/lib/storage";
import { validateUploadedContent } from "@/lib/validate-study-content";
import { formatJaDateTime } from "@/lib/format-ja-datetime";
import { XP_FIRST_CONTENT_CLEAR_BONUS } from "@/lib/xp-economy";

interface ContentEditorProps {
  draft: UploadedContent;
  onDraftChange: (next: UploadedContent) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  /** 三択の AI 生成（保存→API→下書き更新）。未設定ならボタンを出さない */
  onAiEnrichChoices?: () => void | Promise<void>;
  aiEnrichBusy?: boolean;
}

function stringifyHotspots(
  hotspots: { label: string; x: number; y: number; w: number; h: number }[] | undefined
): string {
  if (!hotspots || hotspots.length === 0) return "";
  return JSON.stringify(hotspots, null, 2);
}

function parseHotspotsJson(
  raw: string
): { hotspots: { label: string; x: number; y: number; w: number; h: number }[]; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { hotspots: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch {
    return { hotspots: [], error: "注目ポイントJSONの形式が不正です。保存形式を確認してください。" };
  }

  if (!Array.isArray(parsed)) {
    return { hotspots: [], error: "注目ポイントJSONは配列形式で入力してください。" };
  }

  const hotspots = parsed
    .map((v) => ({
      label: String((v as { label?: unknown }).label ?? "").trim(),
      x: Number((v as { x?: unknown }).x ?? 0),
      y: Number((v as { y?: unknown }).y ?? 0),
      w: Number((v as { w?: unknown }).w ?? 0),
      h: Number((v as { h?: unknown }).h ?? 0),
    }))
    .filter(
      (v) =>
        v.label &&
        Number.isFinite(v.x) &&
        Number.isFinite(v.y) &&
        Number.isFinite(v.w) &&
        Number.isFinite(v.h)
    );
  return { hotspots };
}

export default function ContentEditor({
  draft,
  onDraftChange,
  onSave,
  onCancel,
  saving,
  onAiEnrichChoices,
  aiEnrichBusy = false,
}: ContentEditorProps) {
  const busy = saving || aiEnrichBusy;
  const showAiEnrich = Boolean(onAiEnrichChoices) && hasPendingChoiceEnrichment(draft);
  const [checkResult, setCheckResult] = useState<ReturnType<typeof validateUploadedContent> | null>(
    null
  );

  return (
    <div className="space-y-4">
      {/* 長いフォームでも Mac / iPad で「保存」に届くよう、スクロールに追従するツールバー */}
      <div
        className="sticky top-0 z-20 -mx-1 px-1 py-2 mb-1 rounded-lg"
        style={{
          background: "rgba(26, 26, 46, 0.96)",
          borderBottom: "2px solid rgba(74, 74, 106, 0.85)",
          backdropFilter: "blur(10px)",
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <button type="button" onClick={onCancel} className="mc-btn mc-btn-gray text-sm px-3 py-2 shrink-0">
              ← もどる
            </button>
            <span className="text-sm font-black truncate" style={{ color: "#A0C878" }}>
              問題の編集
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setCheckResult(validateUploadedContent(draft))}
              className="mc-btn mc-btn-blue text-sm px-3 py-2 font-black"
            >
              構成をチェック
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={busy || !draft.title.trim() || draft.questions.length === 0}
              className="mc-btn mc-btn-green text-sm px-4 py-2 font-black disabled:opacity-50 [touch-action:manipulation]"
            >
              {saving ? "保存中…" : "保存する"}
            </button>
          </div>
        </div>
      </div>

      <div
        className="p-4 rounded-xl space-y-3"
        style={{ background: "#0D0D1A", border: "3px solid #4A4A6A" }}
      >
        <label className="block text-xs font-bold" style={{ color: "#9CA3AF" }}>
          教材タイトル
        </label>
        <input
          type="text"
          value={draft.title}
          onChange={(e) => onDraftChange({ ...draft, title: e.target.value })}
          className="w-full px-3 py-2 rounded-lg text-base font-bold"
          style={{ background: "#1A1A2E", border: "2px solid #4A4A6A", color: "#E8E8E8" }}
        />
        <label className="block text-xs font-bold mt-2" style={{ color: "#9CA3AF" }}>
          教科
        </label>
        <select
          value={draft.subject}
          onChange={(e) => onDraftChange({ ...draft, subject: e.target.value })}
          className="w-full px-3 py-2 rounded-lg text-base font-bold"
          style={{ background: "#1A1A2E", border: "2px solid #4A4A6A", color: "#E8E8E8" }}
        >
          {SUBJECTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div
        className="p-4 rounded-xl flex flex-wrap items-start justify-between gap-3"
        style={{ background: "#0D1A14", border: "2px solid #5D9E2F" }}
      >
        <div className="min-w-0 flex-1">
          <div className="text-xs font-black mb-1" style={{ color: "#86EFAC" }}>
            まなぶ一覧のタブ（自動）
          </div>
          <p className="text-xs leading-relaxed" style={{ color: "#9CA3AF" }}>
            勉強で<strong style={{ color: "#BBF7D0" }}>最後まで終える</strong>と「クリア済み」へ移動します。下の「勉強のクリア状態」から
            <strong style={{ color: "#FCD34D" }}> クリア解除</strong>
            すると「チャレンジ！」に戻ります。
          </p>
        </div>
        <span
          className="text-xs font-black px-3 py-2 rounded-lg shrink-0 text-center leading-tight"
          style={{
            background: draft.studyCleared ? "#14532D" : "#1F2937",
            color: draft.studyCleared ? "#86EFAC" : "#9CA3AF",
            border: `2px solid ${draft.studyCleared ? "#22C55E" : "#4B5563"}`,
          }}
        >
          {draft.studyCleared ? "✅ クリア済み" : "⚔️ チャレンジ！"}
        </span>
      </div>

      {checkResult && (
        <div
          className="p-4 rounded-xl space-y-2 max-h-64 overflow-y-auto"
          style={{
            background: checkResult.ok ? "#0D1A0D" : "#3A0D0D",
            border: `2px solid ${checkResult.ok ? "#17DD62" : "#EF4444"}`,
          }}
        >
          <div className="text-sm font-black" style={{ color: checkResult.ok ? "#86EFAC" : "#FCA5A5" }}>
            {checkResult.ok && !checkResult.issues.some((i) => i.severity === "warning")
              ? "チェック結果: 問題なし（この内容で学習できます）"
              : checkResult.ok
                ? "チェック結果: 注意あり（下記を確認してください）"
                : "チェック結果: 要修正（エラーを直してから保存してください）"}
          </div>
          <p className="text-[10px]" style={{ color: "#9CA3AF" }}>
            編集を続けたあと、内容が変わっていれば再度「構成をチェック」を押してください。
          </p>
          <ul className="space-y-1.5 text-xs list-none">
            {checkResult.issues.map((issue, i) => (
              <li
                key={i}
                className="leading-snug pl-3 border-l-2"
                style={{
                  borderColor: issue.severity === "error" ? "#EF4444" : "#F59E0B",
                  color: issue.severity === "error" ? "#FECACA" : "#FDE68A",
                }}
              >
                {issue.severity === "error" ? "【要修正】" : "【注意】"}
                {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {draft.studyCleared && (
        <div
          className="p-4 rounded-xl space-y-2"
          style={{ background: "#1A0D0D", border: "2px solid #92400E" }}
        >
          <div className="text-xs font-bold" style={{ color: "#FCD34D" }}>
            勉強のクリア状態（一覧タブと連動）
          </div>
          <p className="text-xs leading-relaxed" style={{ color: "#9CA3AF" }}>
            クリア済みの教材は一覧の「クリア済み」に表示され、最後まで終えても完了 +{XP_FIRST_CONTENT_CLEAR_BONUS}{" "}
            XP はもらえません。動作確認のあと、もう一度ボーナスを有効にするには解除してください（「チャレンジ！」に戻ります）。
          </p>
          {draft.studyClearedAt && (
            <p className="text-xs" style={{ color: "#86EFAC" }}>
              初回クリア: {formatJaDateTime(draft.studyClearedAt)}
            </p>
          )}
          <button
            type="button"
            onClick={() => onDraftChange({ ...draft, studyCleared: false, studyClearedAt: undefined })}
            className="mc-btn mc-btn-gray text-sm px-3 py-2"
          >
            （勉強）クリア解除
          </button>
        </div>
      )}

      {showAiEnrich && (
        <div
          className="p-4 rounded-xl space-y-3"
          style={{ background: "#0D1A14", border: "2px solid #17DD62" }}
        >
          <div className="text-xs font-bold" style={{ color: "#86EFAC" }}>
            三択・解き方ステップが未設定、または不正な問題があります
          </div>
          <p className="text-xs leading-relaxed" style={{ color: "#9CA3AF" }}>
            問題文があれば対象です（正解が空でも AI が正解・三択・解き方ステップを推測します）。下のボタンでいつでも AI
            生成できます（先に現在の内容をサーバーに保存してから実行します）。
          </p>
          <button
            type="button"
            onClick={() => void onAiEnrichChoices?.()}
            disabled={busy}
            className="mc-btn mc-btn-green w-full py-3 text-sm font-black disabled:opacity-50"
          >
            {aiEnrichBusy ? "AI 生成中…" : "三択・解き方ステップを AI で生成（後から実行）"}
          </button>
        </div>
      )}

      <p className="text-xs leading-relaxed" style={{ color: "#9CA3AF" }}>
        途中に空の問題を差し込めます。「先頭」「各問題の直下」のボタンで位置を選び、差し込み分は見出しに番号が付きます。問題文を入れたら、保存時または上の「後から実行」で三択・解き方ステップを AI
        が作ります（正解が空でも AI が推測します）。
      </p>

      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => onDraftChange(insertQuestionAt(draft, 0))}
            className="mc-btn mc-btn-blue text-xs px-3 py-2 font-bold"
          >
            ↑ 先頭に差し込む
          </button>
        </div>

        {draft.questions.map((q, qi) => {
          const nq = normalizeQuestion(q);
          const blockTitle = formatQuestionBlockTitle(draft, qi);
          return (
            <Fragment key={nq.id ?? `qi-${qi}`}>
              <div
                className="p-4 rounded-xl space-y-2"
                style={{ background: "#1A1A2E", border: "2px solid #5D9E2F" }}
              >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-black" style={{ color: "#7FFF00" }}>
                  {blockTitle}
                </div>
                {draft.questions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        !window.confirm(
                          `「${blockTitle}」を削除しますか？（ほかの問題番号が繰り上がります）`
                        )
                      ) {
                        return;
                      }
                      onDraftChange(removeQuestionAt(draft, qi));
                    }}
                    className="mc-btn mc-btn-red text-xs px-2 py-1"
                  >
                    この問題を削除
                  </button>
                )}
              </div>
              <label className="block text-xs font-bold" style={{ color: "#9CA3AF" }}>
                問題文
              </label>
              <textarea
                value={nq.question}
                onChange={(e) =>
                  onDraftChange(
                    updateQuestionAt(draft, qi, (x) => ({ ...x, question: e.target.value }))
                  )
                }
                rows={4}
                className="w-full px-3 py-2 rounded-lg text-base leading-relaxed"
                style={{ background: "#0D0D1A", border: "2px solid #4A4A6A", color: "#E8E8E8" }}
              />
              <label className="block text-xs font-bold" style={{ color: "#9CA3AF" }}>
                問題のふりがな（任意）
              </label>
              <input
                type="text"
                value={nq.questionFurigana ?? ""}
                onChange={(e) =>
                  onDraftChange(
                    updateQuestionAt(draft, qi, (x) => ({ ...x, questionFurigana: e.target.value }))
                  )
                }
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: "#0D0D1A", border: "2px solid #4A4A6A", color: "#E8E8E8" }}
              />
              <label className="block text-xs font-bold mt-2" style={{ color: "#9CA3AF" }}>
                読解の本文・資料（任意・国語）
              </label>
              <p className="text-[11px] leading-relaxed mb-1" style={{ color: "#6B7280" }}>
                プリントの読み取り文章を貼ると、勉強画面に「本文・資料」として表示されます。段落分けしない場合はこの欄だけでOKです。
              </p>
              <textarea
                value={nq.readingPassage ?? ""}
                onChange={(e) =>
                  onDraftChange(
                    updateQuestionAt(draft, qi, (x) => ({ ...x, readingPassage: e.target.value }))
                  )
                }
                rows={8}
                placeholder="（長文をここに貼り付け）"
                className="w-full px-3 py-2 rounded-lg text-base leading-relaxed"
                style={{ background: "#0D0D1A", border: "2px solid #3B82F6", color: "#E8E8E8" }}
              />
              <div className="mt-2 space-y-2">
                <div className="text-xs font-bold" style={{ color: "#93C5FD" }}>
                  段落ごとに読み上げボタンを付ける（任意）
                </div>
                {(nq.readingBlocks ?? []).map((block, bi) => (
                  <div
                    key={bi}
                    className="p-3 rounded-lg space-y-2"
                    style={{ background: "#111827", border: "1px solid #4B5563" }}
                  >
                    <div className="flex flex-wrap gap-2 items-center">
                      <input
                        type="text"
                        value={block.label}
                        placeholder="見出し（例: 状況説明）"
                        onChange={(e) => {
                          const next = [...(nq.readingBlocks ?? [])];
                          next[bi] = { ...next[bi], label: e.target.value };
                          onDraftChange(updateQuestionAt(draft, qi, (x) => ({ ...x, readingBlocks: next })));
                        }}
                        className="flex-1 min-w-[8rem] px-2 py-1.5 rounded text-sm"
                        style={{ background: "#0D0D1A", border: "1px solid #6B7280", color: "#E8E8E8" }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const next = (nq.readingBlocks ?? []).filter((_, j) => j !== bi);
                          onDraftChange(
                            updateQuestionAt(draft, qi, (x) => ({
                              ...x,
                              readingBlocks: next.length ? next : undefined,
                            }))
                          );
                        }}
                        className="mc-btn mc-btn-red text-xs px-2 py-1"
                      >
                        削除
                      </button>
                    </div>
                    <textarea
                      value={block.text}
                      onChange={(e) => {
                        const next = [...(nq.readingBlocks ?? [])];
                        next[bi] = { ...next[bi], text: e.target.value };
                        onDraftChange(updateQuestionAt(draft, qi, (x) => ({ ...x, readingBlocks: next })));
                      }}
                      rows={5}
                      className="w-full px-2 py-2 rounded text-base leading-relaxed"
                      style={{ background: "#0D0D1A", border: "1px solid #4A4A6A", color: "#E8E8E8" }}
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    onDraftChange(
                      updateQuestionAt(draft, qi, (x) => ({
                        ...x,
                        readingBlocks: [
                          ...(x.readingBlocks ?? []),
                          {
                            label: `パート${(x.readingBlocks?.length ?? 0) + 1}`,
                            text: "",
                          },
                        ],
                      }))
                    )
                  }
                  className="mc-btn mc-btn-blue text-xs px-3 py-2"
                >
                  ＋ 段落を追加
                </button>
              </div>
              <label className="block text-xs font-bold mt-2" style={{ color: "#9CA3AF" }}>
                図式問題: 図画像URL（任意）
              </label>
              <input
                type="text"
                value={nq.diagramImageUrl ?? ""}
                onChange={(e) =>
                  onDraftChange(
                    updateQuestionAt(draft, qi, (x) => ({ ...x, diagramImageUrl: e.target.value }))
                  )
                }
                placeholder="/problems/math/fig-001.png"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: "#0D0D1A", border: "2px solid #3B82F6", color: "#E8E8E8" }}
              />
              <label className="block text-xs font-bold" style={{ color: "#9CA3AF" }}>
                図の説明（任意）
              </label>
              <input
                type="text"
                value={nq.diagramAlt ?? ""}
                onChange={(e) =>
                  onDraftChange(
                    updateQuestionAt(draft, qi, (x) => ({ ...x, diagramAlt: e.target.value }))
                  )
                }
                placeholder="例: 三角形。底辺6cm、高さ3cm"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: "#0D0D1A", border: "2px solid #4A4A6A", color: "#E8E8E8" }}
              />
              <label className="block text-xs font-bold" style={{ color: "#9CA3AF" }}>
                単位（任意）
              </label>
              <input
                type="text"
                value={nq.answerUnit ?? ""}
                onChange={(e) =>
                  onDraftChange(
                    updateQuestionAt(draft, qi, (x) => ({ ...x, answerUnit: e.target.value }))
                  )
                }
                placeholder="cm²"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: "#0D0D1A", border: "2px solid #4A4A6A", color: "#E8E8E8" }}
              />
              <label className="block text-xs font-bold" style={{ color: "#9CA3AF" }}>
                注目ポイント（任意・JSON）
              </label>
              <p className="text-[11px] leading-relaxed mb-1" style={{ color: "#6B7280" }}>
                座標は画像全体の0-100%で指定します。例:
                [{`{"label":"底辺","x":18,"y":72,"w":58,"h":12}`}]。
              </p>
              <textarea
                key={`hotspots-${nq.id}`}
                defaultValue={stringifyHotspots(nq.diagramHotspots)}
                onBlur={(e) => {
                  const { hotspots, error } = parseHotspotsJson(e.target.value);
                  if (error) {
                    window.alert(error);
                    return;
                  }
                  if (hotspots.length === 0) {
                    onDraftChange(
                      updateQuestionAt(draft, qi, (x) => ({ ...x, diagramHotspots: undefined }))
                    );
                    return;
                  }
                  onDraftChange(updateQuestionAt(draft, qi, (x) => ({ ...x, diagramHotspots: hotspots })));
                }}
                rows={5}
                placeholder='[{"label":"高さ","x":43,"y":26,"w":10,"h":42}]'
                className="w-full px-3 py-2 rounded-lg text-xs"
                style={{ background: "#0D0D1A", border: "2px solid #4A4A6A", color: "#E8E8E8", fontFamily: "monospace" }}
              />
              <label className="block text-xs font-bold" style={{ color: "#9CA3AF" }}>
                正解
              </label>
              <textarea
                value={nq.answer}
                onChange={(e) =>
                  onDraftChange(
                    updateQuestionAt(draft, qi, (x) => ({ ...x, answer: e.target.value }))
                  )
                }
                rows={2}
                className="w-full px-3 py-2 rounded-lg text-base"
                style={{ background: "#0D0D1A", border: "2px solid #4A4A6A", color: "#E8E8E8" }}
              />
              <label className="block text-xs font-bold" style={{ color: "#9CA3AF" }}>
                正解のふりがな（任意）
              </label>
              <input
                type="text"
                value={nq.answerFurigana ?? ""}
                onChange={(e) =>
                  onDraftChange(
                    updateQuestionAt(draft, qi, (x) => ({ ...x, answerFurigana: e.target.value }))
                  )
                }
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: "#0D0D1A", border: "2px solid #4A4A6A", color: "#E8E8E8" }}
              />
              {[0, 1, 2].map((si) => (
                <div key={`step-${si}`}>
                  <label className="block text-xs font-bold" style={{ color: "#9CA3AF" }}>
                    解き方ステップ {si + 1}（任意）
                  </label>
                  <textarea
                    value={nq.hints[si] ?? ""}
                    onChange={(e) => {
                      const nextSteps = [...padHints(nq.hints)];
                      nextSteps[si] = e.target.value;
                      onDraftChange(updateQuestionAt(draft, qi, (x) => ({ ...x, hints: nextSteps })));
                    }}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ background: "#0D0D1A", border: "2px solid #3B82F6", color: "#E8E8E8" }}
                    placeholder="例: 0.45 = 9/20"
                  />
                </div>
              ))}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[0, 1, 2].map((ci) => (
                  <div key={ci}>
                    <label className="block text-xs font-bold" style={{ color: "#9CA3AF" }}>
                      選択肢 {["A", "B", "C"][ci]}
                    </label>
                    <textarea
                      value={nq.choices[ci] ?? ""}
                      onChange={(e) => {
                        const nextChoices = [...padChoices(nq.choices)];
                        nextChoices[ci] = e.target.value;
                        onDraftChange(
                          updateQuestionAt(draft, qi, (x) => ({ ...x, choices: nextChoices }))
                        );
                      }}
                      rows={2}
                      className="w-full px-2 py-2 rounded-lg text-sm"
                      style={{ background: "#0D0D1A", border: "2px solid #4A4A6A", color: "#E8E8E8" }}
                    />
                  </div>
                ))}
              </div>
              <label className="block text-xs font-bold" style={{ color: "#9CA3AF" }}>
                正解の選択肢
              </label>
              <select
                value={nq.correctIndex}
                onChange={(e) =>
                  onDraftChange(
                    updateQuestionAt(draft, qi, (x) => ({
                      ...x,
                      correctIndex: Number(e.target.value) as 0 | 1 | 2,
                    }))
                  )
                }
                className="w-full px-3 py-2 rounded-lg text-base font-bold"
                style={{ background: "#0D0D1A", border: "2px solid #4A4A6A", color: "#E8E8E8" }}
              >
                <option value={0}>A</option>
                <option value={1}>B</option>
                <option value={2}>C</option>
              </select>
              </div>

              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  onClick={() => onDraftChange(insertQuestionAt(draft, qi + 1))}
                  className="mc-btn mc-btn-blue text-xs px-3 py-2 font-bold max-w-full text-center leading-snug"
                >
                  問題{qi + 1}の下に差し込む（この位置に新しい問題）
                </button>
              </div>
            </Fragment>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 pt-1 border-t border-[#4A4A6A]/60">
        <p className="w-full text-xs mb-1" style={{ color: "#6B7280" }}>
          上のバーからも保存できます。下は一覧の最後まで編集したあと用です。
        </p>
        <button
          type="button"
          onClick={onSave}
          disabled={busy || !draft.title.trim() || draft.questions.length === 0}
          className="mc-btn mc-btn-green flex-1 min-w-[8rem] py-3 disabled:opacity-50 [touch-action:manipulation]"
        >
          {saving ? "保存中…" : "保存する"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="mc-btn mc-btn-gray py-3 px-6 [touch-action:manipulation]"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
