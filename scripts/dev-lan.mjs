#!/usr/bin/env node
/**
 * 同一 Wi‑Fi の iPad から接続するための dev 起動。
 * Next.js はログに localhost と出すことが多いが、iPad では LAN の IP が必要なので
 * 起動前・起動直後に URL を明示する。
 */

import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import os from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

function lanIpv4Addresses() {
  const out = [];
  for (const nets of Object.values(os.networkInterfaces())) {
    if (!nets) continue;
    for (const net of nets) {
      if (net.family === "IPv4" && !net.internal) {
        out.push(net.address);
      }
    }
  }
  return [...new Set(out)];
}

function printLanBanner({ reminder = false } = {}) {
  const port = process.env.PORT ?? "3000";
  const ips = lanIpv4Addresses();
  const b = "\x1b[1m";
  const y = "\x1b[33m";
  const g = "\x1b[32m";
  const c = "\x1b[36m";
  const dim = "\x1b[2m";
  const reset = "\x1b[0m";

  console.log("");
  console.log(
    `${b}${y}${reminder ? "【再掲】" : ""} iPad / 同一 Wi-Fi では「localhost」では開けません。次の URL を使ってください。${reset}`
  );
  console.log(
    `${dim}（Next のログに ${c}Local: http://localhost:${port}${dim} と出ても、iPad の Safari では使えません）${reset}`
  );
  console.log("");
  if (ips.length === 0) {
    console.log(`${b}  （LAN の IPv4 が見つかりません。Wi-Fi 接続を確認してください）${reset}`);
  } else {
    for (const ip of ips) {
      console.log(`  ${b}${g}http://${ip}:${port}${reset}`);
    }
  }
  console.log("");
  console.log(
    `${dim}  Mac のブラウザだけなら http://localhost:${port} でも開けます。ファイアウォールで Node をブロックしていないかも確認してください。${reset}`
  );
  console.log(
    `${dim}  ※ XP・設定は端末ごとのブラウザ保存のため、iPad と Mac で共有されません（問題APIは共通）。${reset}`
  );
  console.log("");
}

const stable = process.argv.includes("--stable");

const ensure = spawnSync(process.execPath, [join(__dirname, "ensure-next-dev-clean.mjs")], {
  cwd: PROJECT_ROOT,
  stdio: "inherit",
});
if (ensure.status !== 0) {
  process.exit(ensure.status ?? 1);
}

printLanBanner({ reminder: false });

const nextCli = join(PROJECT_ROOT, "node_modules/next/dist/bin/next");
const args = ["dev", "--hostname", "0.0.0.0"];
if (stable) {
  args.push("--webpack");
}

const env = { ...process.env };
if (stable) {
  env.WATCHPACK_POLLING = "true";
}

const child = spawn(process.execPath, [nextCli, ...args], {
  cwd: PROJECT_ROOT,
  stdio: "inherit",
  env,
});

// Next の「Local: localhost」表示の直後に目を向けられるよう、少し遅れて再掲
setTimeout(() => printLanBanner({ reminder: true }), 4000);

child.on("exit", (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code ?? 0);
});
