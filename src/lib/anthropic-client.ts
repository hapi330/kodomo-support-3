import Anthropic from "@anthropic-ai/sdk";

/** OCR・問題生成などで共通利用する Claude モデル ID */
export const CLAUDE_SONNET_4_5 = "claude-sonnet-4-5";

let cachedClient: Anthropic | null = null;
let cachedApiKey: string | null = null;

export function getAnthropicClient(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return null;

  if (cachedClient && cachedApiKey === key) {
    return cachedClient;
  }

  cachedApiKey = key;
  cachedClient = new Anthropic({ apiKey: key });
  return cachedClient;
}

/** `messages.create` のレスポンスからアシスタントのテキストを連結して返す */
export function assistantTextFromMessage(message: Anthropic.Messages.Message): string {
  const parts: string[] = [];
  for (const block of message.content) {
    if ("text" in block && typeof block.text === "string") {
      parts.push(block.text);
    }
  }
  return parts.join("\n").trim();
}
