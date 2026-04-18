import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

/**
 * 開発時、同一 LAN の iPad などから `http://192.168.x.x:3000` で開くと
 * `/_next/*` へのリクエストが「別オリジン」としてブロックされることがある。
 * 公式: https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins
 *
 * 起動時点の PC の IPv4 を列挙して許可する（IP が変わったら dev サーバーを再起動）。
 */
function allowedDevOriginsFromLan(): string[] {
  const origins = new Set<string>(["localhost", "127.0.0.1", "::1"]);
  try {
    for (const nets of Object.values(networkInterfaces())) {
      if (!nets) continue;
      for (const net of nets) {
        if (net.family === "IPv4" && !net.internal) {
          origins.add(net.address);
        }
      }
    }
  } catch {
    // 一部環境（サンドボックス等）では networkInterfaces が失敗する
  }
  return [...origins];
}

const nextConfig: NextConfig = {
  allowedDevOrigins: allowedDevOriginsFromLan(),
};

export default nextConfig;
