import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, readFile } from "fs/promises";
import path from "path";
import type { PendingTask } from "@/lib/pending-task";

const TASK_FILE = path.join(process.cwd(), "src", "data", "pending_task.json");

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as PendingTask;

    if (!body.rawText?.trim()) {
      return NextResponse.json({ error: "テキストが空です" }, { status: 400 });
    }
    if (!body.title?.trim()) {
      return NextResponse.json({ error: "タイトルが空です" }, { status: 400 });
    }

    await mkdir(path.dirname(TASK_FILE), { recursive: true });
    await writeFile(TASK_FILE, JSON.stringify({ ...body, savedAt: new Date().toISOString() }, null, 2), "utf-8");

    return NextResponse.json({ message: "タスクを保存しました" });
  } catch (err) {
    console.error("/api/save-task error:", err);
    return NextResponse.json({ error: "サーバーエラー", detail: String(err) }, { status: 500 });
  }
}

export async function GET() {
  try {
    const raw = await readFile(TASK_FILE, "utf-8");
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json(null);
  }
}
