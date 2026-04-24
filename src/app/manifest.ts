import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "こどもサポート-3 | マインクラフト学習アドベンチャー",
    short_name: "こどもサポート-3",
    description: "パーソナル学習支援アプリ",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#1A1A2E",
    theme_color: "#1A1A2E",
    lang: "ja",
    icons: [
      {
        src: "/pwa-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
