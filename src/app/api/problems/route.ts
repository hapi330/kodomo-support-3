import { NextResponse } from "next/server";
import { buildUploadedContent } from "@/lib/problem-generator";
import { readProblemsJson, writeProblemsJson } from "@/lib/problems-json-file";
import type { UploadedContent } from "@/lib/storage";

export async function GET() {
  return NextResponse.json(await readProblemsJson());
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      title?: string;
      subject?: string;
      rawText?: string;
    };

    const title = body.title?.trim() ?? "";
    const rawText = body.rawText?.trim() ?? "";
    const subject = body.subject?.trim() ?? "その他";

    if (!title) {
      return NextResponse.json({ error: "タイトルを入力してください" }, { status: 400 });
    }
    if (!rawText) {
      return NextResponse.json({ error: "テキストを貼り付けてください" }, { status: 400 });
    }

    const nextContent = await buildUploadedContent({ title, subject, rawText });
    const current = await readProblemsJson();
    const nextProblems = [nextContent, ...current];

    await writeProblemsJson(nextProblems);

    return NextResponse.json({
      message: "問題データを保存しました",
      content: nextContent,
      total: nextProblems.length,
    });
  } catch (error) {
    console.error("/api/problems POST error:", error);
    return NextResponse.json(
      { error: "問題データの保存に失敗しました", detail: String(error) },
      { status: 500 }
    );
  }
}

/** 教材1件を上書き保存（学習タブ「編集」から） */
export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as UploadedContent | null;
    const id = body?.id?.trim();
    if (!id) {
      return NextResponse.json({ error: "id が必要です" }, { status: 400 });
    }
    if (!body?.title?.trim()) {
      return NextResponse.json({ error: "タイトルを入力してください" }, { status: 400 });
    }
    if (!Array.isArray(body.questions)) {
      return NextResponse.json({ error: "questions が不正です" }, { status: 400 });
    }

    const current = await readProblemsJson();
    const idx = current.findIndex((c) => c.id === id);
    if (idx < 0) {
      return NextResponse.json({ error: "データが見つかりません" }, { status: 404 });
    }

    const next = [...current];
    const prev = current[idx];
    next[idx] = {
      ...body,
      id,
      title: body.title.trim(),
      subject: body.subject?.trim() ?? "その他",
      rawText: body.rawText ?? "",
      editedText: body.editedText ?? "",
      uploadDate: body.uploadDate ?? prev.uploadDate,
      questions: body.questions,
      studyCleared:
        typeof body.studyCleared === "boolean" ? body.studyCleared : Boolean(prev.studyCleared),
    };

    await writeProblemsJson(next);
    return NextResponse.json({ message: "更新しました", content: next[idx] });
  } catch (error) {
    console.error("/api/problems PATCH error:", error);
    return NextResponse.json(
      { error: "更新に失敗しました", detail: String(error) },
      { status: 500 }
    );
  }
}

/** 教材1件を削除 */
export async function DELETE(req: Request) {
  try {
    let id: string | undefined;
    try {
      const body = (await req.json()) as { id?: string };
      id = body?.id?.trim();
    } catch {
      id = new URL(req.url).searchParams.get("id")?.trim();
    }
    if (!id) {
      return NextResponse.json({ error: "id が必要です" }, { status: 400 });
    }

    const current = await readProblemsJson();
    const next = current.filter((c) => c.id !== id);
    if (next.length === current.length) {
      return NextResponse.json({ error: "データが見つかりません" }, { status: 404 });
    }

    await writeProblemsJson(next);
    return NextResponse.json({ message: "削除しました", total: next.length });
  } catch (error) {
    console.error("/api/problems DELETE error:", error);
    return NextResponse.json(
      { error: "削除に失敗しました", detail: String(error) },
      { status: 500 }
    );
  }
}
