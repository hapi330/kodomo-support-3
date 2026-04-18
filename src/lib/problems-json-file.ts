import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { UploadedContent } from "@/lib/storage";

const PROBLEMS_FILE = path.join(process.cwd(), "src", "data", "current_problems.json");

export async function readProblemsJson(): Promise<UploadedContent[]> {
  try {
    const raw = await readFile(PROBLEMS_FILE, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as UploadedContent[]) : [];
  } catch {
    return [];
  }
}

export async function writeProblemsJson(items: UploadedContent[]): Promise<void> {
  await mkdir(path.dirname(PROBLEMS_FILE), { recursive: true });
  await writeFile(PROBLEMS_FILE, JSON.stringify(items, null, 2), "utf-8");
}
