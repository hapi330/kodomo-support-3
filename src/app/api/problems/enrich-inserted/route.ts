import { NextResponse } from "next/server";
import { enrichInsertedQuestionsInContent } from "@/lib/enrich-inserted-questions";
import { hasPendingChoiceHintEnrichment } from "@/lib/inserted-enrichment-gate";
import { readProblemsJson, writeProblemsJson } from "@/lib/problems-json-file";

/** 差し込み問題のヒント・三択を AI で補完して再保存 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { id?: string };
    const id = body?.id?.trim();
    if (!id) {
      return NextResponse.json({ error: "id が必要です" }, { status: 400 });
    }

    const current = await readProblemsJson();
    const idx = current.findIndex((c) => c.id === id);
    if (idx < 0) {
      return NextResponse.json({ error: "データが見つかりません" }, { status: 404 });
    }

    const item = current[idx];
    if (!hasPendingChoiceHintEnrichment(item)) {
      return NextResponse.json({
        message: "差し込みの未生成はありません",
        content: item,
        skipped: true,
        enrichmentFailures: [],
      });
    }

    const { content: enriched, failures } = await enrichInsertedQuestionsInContent(item);
    const next = [...current];
    next[idx] = enriched;
    await writeProblemsJson(next);

    return NextResponse.json({
      message:
        failures.length > 0
          ? `一部の問題で生成に失敗しました（${failures.length}件）`
          : "ヒント・選択肢を生成しました",
      content: enriched,
      skipped: false,
      enrichmentFailures: failures,
    });
  } catch (error) {
    console.error("/api/problems/enrich-inserted POST error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "自動生成に失敗しました",
        detail: String(error),
      },
      { status: 500 }
    );
  }
}
