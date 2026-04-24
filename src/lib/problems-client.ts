import type { QuestionEnrichFailure } from "@/lib/enrich-inserted-questions";
import type { UploadedContent } from "@/lib/storage";

export type { QuestionEnrichFailure } from "@/lib/enrich-inserted-questions";

export type EnrichInsertedResult = {
  content: UploadedContent;
  skipped: boolean;
  enrichmentFailures: QuestionEnrichFailure[];
};

async function parseJsonError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

function problemsRequestInit(): RequestInit {
  return {
    credentials: "same-origin",
    cache: "no-store",
  };
}

/** PWA / モバイル Safari で相対 URL の fetch が不安定なときに使う */
export function clientApiUrl(path: string): string {
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.origin).href;
}

/** GET /api/problems（モバイル Safari 向けに絶対 URL・no-store・短い再試行） */
export async function fetchProblems(): Promise<UploadedContent[]> {
  const url = clientApiUrl("/api/problems");
  const init = problemsRequestInit();
  const maxAttempts = 3;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(url, init);
      if (!res.ok) throw new Error(await parseJsonError(res));
      const data = (await res.json()) as unknown;
      return Array.isArray(data) ? (data as UploadedContent[]) : [];
    } catch (e) {
      lastError = e;
      if (attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, 280 * (attempt + 1)));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/** PATCH /api/problems */
export async function saveProblemContent(content: UploadedContent): Promise<void> {
  const res = await fetch(clientApiUrl("/api/problems"), {
    method: "PATCH",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(content),
  });
  if (!res.ok) throw new Error(await parseJsonError(res));
}

/** POST /api/problems/enrich-inserted — 差し込み問題のヒント・三択を AI 補完 */
export async function enrichInsertedProblemsAfterSave(contentId: string): Promise<EnrichInsertedResult> {
  const res = await fetch(clientApiUrl("/api/problems/enrich-inserted"), {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: contentId }),
  });
  if (!res.ok) throw new Error(await parseJsonError(res));
  const data = (await res.json()) as {
    content?: UploadedContent;
    skipped?: boolean;
    enrichmentFailures?: QuestionEnrichFailure[];
  };
  if (!data.content) throw new Error("応答が不正です");
  return {
    content: data.content,
    skipped: Boolean(data.skipped),
    enrichmentFailures: Array.isArray(data.enrichmentFailures) ? data.enrichmentFailures : [],
  };
}

/** DELETE /api/problems */
export async function deleteProblemContent(id: string): Promise<void> {
  const res = await fetch(clientApiUrl("/api/problems"), {
    method: "DELETE",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) throw new Error(await parseJsonError(res));
}
