"use client";

type DeleteProblemModalProps = {
  open: boolean;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** 教材1件削除の確認 */
export function DeleteProblemModal({ open, busy, onConfirm, onCancel }: DeleteProblemModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-confirm-title"
    >
      <div
        className="mc-panel p-6 max-w-sm w-full text-center space-y-4"
        style={{ background: "#2D2D44", border: "3px solid #EF4444" }}
      >
        <p id="delete-confirm-title" className="text-lg font-black" style={{ color: "#F8FAFC" }}>
          削除して良いですか？
        </p>
        <div className="flex gap-3 justify-center">
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="mc-btn mc-btn-red flex-1 py-3 disabled:opacity-50"
          >
            {busy ? "…" : "はい"}
          </button>
          <button type="button" onClick={onCancel} disabled={busy} className="mc-btn mc-btn-gray flex-1 py-3">
            いいえ
          </button>
        </div>
      </div>
    </div>
  );
}
