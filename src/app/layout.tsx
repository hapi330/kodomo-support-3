import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "こどもサポート-3 | マインクラフト学習アドベンチャー",
  description: "パーソナル学習支援アプリ",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" className="h-full">
      <body className="min-h-full" style={{ background: "#1A1A2E", color: "#E8E8E8" }}>
        {children}
      </body>
    </html>
  );
}
