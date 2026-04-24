import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "こどもサポート-3 | マインクラフト学習アドベンチャー",
  description: "パーソナル学習支援アプリ",
  applicationName: "こどもサポート-3",
  icons: {
    icon: [{ url: "/pwa-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/pwa-192.png", sizes: "192x192", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "こどもサポート-3",
    statusBarStyle: "black-translucent",
  },
};

/** iPad / スマホでも幅に合わせて表示し、必要ならピンチで拡大できるようにする */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#1A1A2E",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" className="h-full overflow-hidden">
      <body className="h-full overflow-hidden" style={{ background: "#1A1A2E", color: "#E8E8E8" }}>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
