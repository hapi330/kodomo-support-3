"use client";

import { mcField } from "@/lib/mc-styles";

type EditPasswordModalProps = {
  open: boolean;
  password: string;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

/** 学習クエスト「編集」前の管理者パスワード確認 */
export function EditPasswordModal({
  open,
  password,
  onPasswordChange,
  onSubmit,
  onCancel,
}: EditPasswordModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-password-title"
    >
      <div
        className="mc-panel p-6 w-full max-w-sm space-y-4 animate-slide-up"
        style={{ background: "#2D2D44", border: "3px solid #6366F1" }}
      >
        <h3 id="edit-password-title" className="font-black text-lg" style={{ color: "#FCD34D" }}>
          🔐 編集するにはパスワード
        </h3>
        <p className="text-sm" style={{ color: "#9CA3AF" }}>
          設置（おとな）で設定したパスワードと同じものを入力してください。
        </p>
        <input
          type="password"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          autoFocus
          placeholder="パスワードを入力"
          className="w-full p-3 rounded text-base"
          style={mcField}
        />
        <div className="flex gap-2">
          <button type="button" onClick={onSubmit} className="mc-btn mc-btn-green flex-1 py-3">
            編集へ
          </button>
          <button type="button" onClick={onCancel} className="mc-btn mc-btn-gray flex-1 py-3">
            もどる
          </button>
        </div>
      </div>
    </div>
  );
}
