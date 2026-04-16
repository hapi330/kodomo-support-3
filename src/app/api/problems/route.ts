import { NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { buildUploadedContent } from "@/lib/problem-generator";
import type { UploadedContent } from "@/lib/storage";

const PROBLEMS_FILE = path.join(process.cwd(), "src", "data", "current_problems.json");

export async function GET() {
  return NextResponse.json(await readProblems());
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

    const nextContent = buildUploadedContent({ title, subject, rawText });
    const current = await readProblems();
    const nextProblems = [nextContent, ...current];

    await mkdir(path.dirname(PROBLEMS_FILE), { recursive: true });
    await writeFile(PROBLEMS_FILE, JSON.stringify(nextProblems, null, 2), "utf-8");

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

async function readProblems(): Promise<UploadedContent[]> {
  try {
    const raw = await readFile(PROBLEMS_FILE, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as UploadedContent[]) : [];
  } catch {
    return [];
  }
}
