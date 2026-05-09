#!/usr/bin/env node
/**
 * 同一 Wi-Fi の iPad 用: LAN URL がタップできる HTML をプロジェクト直下に書き出す。
 * AirDrop で iPad の「ファイル」に送り、タップ → Safari でリンクを開く運用向け。
 */
import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const OUTPUT_NAME = "ipad-open-dev.html";

export function getLanIpv4Addresses() {
  const out = [];
  try {
    for (const nets of Object.values(os.networkInterfaces())) {
      if (!nets) continue;
      for (const net of nets) {
        if (net.family === "IPv4" && !net.internal) {
          out.push(net.address);
        }
      }
    }
  } catch {
    // サンドボックス等で networkInterfaces が失敗することがある
  }
  return [...new Set(out)];
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {string} projectRoot
 * @param {{ port?: string }} [opts]
 * @returns {{ path: string; ips: string[] }}
 */
export function writeIpadOpenDevHtml(projectRoot, opts = {}) {
  const port = opts.port ?? process.env.PORT ?? "3000";
  const ips = getLanIpv4Addresses();

  const linkRows =
    ips.length === 0
      ? `<p><strong>LAN の IPv4 が見つかりません。</strong> Mac の Wi-Fi を確認し、このスクリプトをもう一度実行してください。</p>`
      : `<ol style="padding-left:1.25rem;margin:0.75rem 0 0">${ips
          .map((ip) => {
            const href = `http://${ip}:${port}/`;
            return `<li style="margin:0.5rem 0"><a href="${href}" style="color:#86efac;font-weight:700;font-size:1.1rem">${escapeHtml(
              href
            )}</a></li>`;
          })
          .join("")}</ol>`;

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>こどもサポート-3（開発・iPad起動）</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; padding: 1.25rem; background: #1a1a2e; color: #e8e8e8; line-height: 1.5; }
    main { max-width: 26rem; margin: 0 auto; }
    h1 { font-size: 1.15rem; margin: 0 0 0.75rem; color: #a3e635; }
    p, li { font-size: 0.95rem; color: #d4d4d8; }
    code { background: #2d2d44; padding: 0.1rem 0.35rem; border-radius: 4px; font-size: 0.85em; }
    .note { font-size: 0.8rem; color: #a1a1aa; margin-top: 1.25rem; }
  </style>
</head>
<body>
  <main>
    <h1>こどもサポート-3（ローカル開発）</h1>
    <p>Mac で <code>npm run dev:lan</code> を起動したまま、下のリンクをタップしてください（<strong>同一 Wi-Fi</strong>）。</p>
    ${linkRows}
    <p class="note">
      この HTML は Mac のプロジェクトフォルダにあります。Finder で <strong>${escapeHtml(OUTPUT_NAME)}</strong> を選び、
      共有 → AirDrop で iPad に送ってください。iPad の「ファイル」でタップし、Safari で開いてからリンクをタップします。
    </p>
  </main>
</body>
</html>
`;

  const path = join(projectRoot, OUTPUT_NAME);
  writeFileSync(path, html, "utf8");
  return { path, ips };
}

export function printAirDropConsoleHint(absolutePath) {
  const b = "\x1b[1m";
  const g = "\x1b[32m";
  const dim = "\x1b[2m";
  const reset = "\x1b[0m";
  console.log(
    `${dim}  AirDrop 用の起動ページを書き出しました: ${b}${g}${absolutePath}${reset}`
  );
  console.log(
    `${dim}  Finder でこのファイルを iPad に AirDrop → iPad「ファイル」で開く → 表示された URL をタップ${reset}`
  );
  console.log("");
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const isDirectRun =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  const projectRoot = join(__dirname, "..");
  const { path, ips } = writeIpadOpenDevHtml(projectRoot);
  printAirDropConsoleHint(path);
  if (ips.length === 0) {
    process.exitCode = 1;
  }
}
