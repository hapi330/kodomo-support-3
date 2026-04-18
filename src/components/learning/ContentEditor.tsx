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
import { hasPendingChoiceHintEnrichment } from "@/lib/inserted-enrichment-gate";
import type { UploadedContent } from "@/lib/storage";
import { validateUploadedContent } from "@/lib/validate-study-content";

interface ContentEditorProps {
  draft: UploadedContent;
  onDraftChange: (next: UploadedContent) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  /** ヒント・三択の AI 生成（保存→API→下書き更新）。未設定ならボタンを出さない */
  onAiEnrichHintChoices?: () => void | Promise<void>;
  aiEnrichBusy?: boolean;
}

export default function ContentEditor({
  draft,
  onDraftChange,
  onSave,
  onCancel,
  saving,
  onAiEnrichHintChoices,
  aiEnrichBusy = false,
}: ContentEditorProps) {
  const busy = saving || aiEnrichBusy;
  const showAiEnrich = Boolean(onAiEnrichHintChoices) && hasPendingChoiceHintEnrichment(draft);
  const [checkResult, setCheckResult] = useState<ReturnType<typeof validateUploadedContent> | null>(
    null
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onCancel} className="mc-btn mc-btn-gray text-sm px-3 py-2">
            ← もどる
          </button>
          <span className="text-sm font-black" style={{ color: "#A0C878" }}>
            問題の編集
          </span>
        </div>
        <button
          type="button"
          onClick={() => setCheckResult(validateUploadedContent(draft))}
          className="mc-btn mc-btn-blue text-sm px-3 py-2 font-black shrink-0"
        >
          構成をチェック
        </button>
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
            勉強のクリア状態
          </div>
          <p className="text-xs leading-relaxed" style={{ color: "#9CA3AF" }}>
            クリア済みの教材は、最後まで終えても完了 +100 XP はもらえません。動作確認のあと、もう一度ボーナスを有効にするには解除してください。
          </p>
          <button
            type="button"
            onClick={() => onDraftChange({ ...draft, studyCleared: false })}
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
            ヒント・三択がまだ空、または不正な問題があります
          </div>
          <p className="text-xs leading-relaxed" style={{ color: "#9CA3AF" }}>
            問題文があれば対象です（正解が空でも AI が正解・ヒント・三択を推測します）。下のボタンでいつでも AI
            生成できます（先に現在の内容をサーバーに保存してから実行します）。
          </p>
          <button
            type="button"
            onClick={() => void onAiEnrichHintChoices?.()}
            disabled={busy}
            className="mc-btn mc-btn-green w-full py-3 text-sm font-black disabled:opacity-50"
          >
            {aiEnrichBusy ? "AI 生成中…" : "ヒント・三択を AI で生成（後から実行）"}
          </button>
        </div>
      )}

      <p className="text-xs leading-relaxed" style={{ color: "#9CA3AF" }}>
        途中に空の問題を差し込めます。「先頭」「各問題の直下」のボタンで位置を選び、差し込み分は見出しに番号が付きます。問題文を入れたら、保存時または上の「後から実行」でヒントと三択を AI
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
              {[0, 1, 2].map((hi) => (
                <div key={hi}>
                  <label className="block text-xs font-bold" style={{ color: "#9CA3AF" }}>
                    ヒント {hi + 1}
                  </label>
                  <textarea
                    value={nq.hints[hi] ?? ""}
                    onChange={(e) => {
                      const nextHints = [...padHints(nq.hints)];
                      nextHints[hi] = e.target.value;
                      onDraftChange(
                        updateQuestionAt(draft, qi, (x) => ({ ...x, hints: nextHints }))
                      );
                    }}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ background: "#0D0D1A", border: "2px solid #4A4A6A", color: "#E8E8E8" }}
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

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={busy || !draft.title.trim() || draft.questions.length === 0}
          className="mc-btn mc-btn-green flex-1 min-w-[8rem] py-3 disabled:opacity-50"
        >
          {saving ? "保存中…" : "保存する"}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className="mc-btn mc-btn-gray py-3 px-6">
          キャンセル
        </button>
      </div>
    </div>
  );
}
