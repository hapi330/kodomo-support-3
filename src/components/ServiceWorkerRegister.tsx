"use client";

import { useEffect } from "react";

/**
 * Registers the PWA service worker in production so Chrome can offer
 * “インストール” / Add to Dock / home screen install.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return null;
}
