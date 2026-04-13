import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

const PROBLEMS_FILE = path.join(process.cwd(), "src", "data", "current_problems.json");

export async function GET() {
  try {
    const raw = await readFile(PROBLEMS_FILE, "utf-8");
    const data = JSON.parse(raw);
    return NextResponse.json(data);
  } catch {
    // ファイルが存在しない or 空の場合は空配列を返す
    return NextResponse.json([]);
  }
}
