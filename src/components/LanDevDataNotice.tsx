"use client";

import { useEffect, useState } from "react";

/**
 * `http://192.168.x.x:3000` のように LAN の IP で dev を開いたときだけ表示。
 * Mac と iPad で localStorage が別であることによる「反映されない」誤解を減らす。
 */
export default function LanDevDataNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const h = window.location.hostname;
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return;
    queueMicrotask(() => setVisible(true));
  }, []);

  if (!visible) return null;

  return (
    <div
      className="px-3 py-2 text-center text-xs sm:text-sm leading-snug"
      style={{ background: "#2E1065", borderBottom: "2px solid #7C3AED", color: "#E9D5FF" }}
      role="status"
    >
      <strong>開発中・LAN 接続</strong>
      ：XP や設定は<strong>この端末のブラウザだけ</strong>に保存されます（Mac とは共有されません）。
      問題データはサーバー共通なので、<strong>再読み込み</strong>で最新を取得できます。
    </div>
  );
}
