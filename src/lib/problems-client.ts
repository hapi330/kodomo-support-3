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

/** GET /api/problems */
export async function fetchProblems(): Promise<UploadedContent[]> {
  const res = await fetch("/api/problems");
  if (!res.ok) throw new Error(await parseJsonError(res));
  const data = (await res.json()) as unknown;
  return Array.isArray(data) ? (data as UploadedContent[]) : [];
}

/** PATCH /api/problems */
export async function saveProblemContent(content: UploadedContent): Promise<void> {
  const res = await fetch("/api/problems", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(content),
  });
  if (!res.ok) throw new Error(await parseJsonError(res));
}

/** POST /api/problems/enrich-inserted — 差し込み問題のヒント・三択を AI 補完 */
export async function enrichInsertedProblemsAfterSave(contentId: string): Promise<EnrichInsertedResult> {
  const res = await fetch("/api/problems/enrich-inserted", {
    method: "POST",
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
  const res = await fetch("/api/problems", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) throw new Error(await parseJsonError(res));
}
