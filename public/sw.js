/* Minimal service worker so the app can be installed as a PWA (Chrome installability). */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// 明示的にネットワークへ委譲する（空リスナーのままだと iOS Safari / Web App で API 取得が失敗することがある）
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
