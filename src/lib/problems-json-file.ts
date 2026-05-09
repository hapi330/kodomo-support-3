import { list, put } from "@vercel/blob";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { UploadedContent } from "@/lib/storage";

const PROBLEMS_FILE = path.join(process.cwd(), "src", "data", "current_problems.json");
const PROBLEMS_BLOB_PATHNAME = process.env.PROBLEMS_BLOB_PATHNAME ?? "kodomo-support/current_problems.json";
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const IS_VERCEL = process.env.VERCEL === "1";

function shouldUseBlobStorage(): boolean {
  return typeof BLOB_TOKEN === "string" && BLOB_TOKEN.trim().length > 0;
}

function assertStorageConfigForRuntime() {
  if (IS_VERCEL && !shouldUseBlobStorage()) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN が未設定です。Vercel本番では problems 保存に Blob 設定が必要です。"
    );
  }
}

async function readFromBlob(): Promise<UploadedContent[]> {
  const token = BLOB_TOKEN?.trim();
  if (!token) return [];

  const listData = await list({ prefix: PROBLEMS_BLOB_PATHNAME, limit: 1, token });
  const blob = listData.blobs.find((item) => item.pathname === PROBLEMS_BLOB_PATHNAME);
  if (!blob?.url) return [];

  const bodyRes = await fetch(blob.url, { cache: "no-store" });
  if (!bodyRes.ok) return [];

  const parsed = (await bodyRes.json()) as unknown;
  return Array.isArray(parsed) ? (parsed as UploadedContent[]) : [];
}

export async function readProblemsJson(): Promise<UploadedContent[]> {
  assertStorageConfigForRuntime();
  if (shouldUseBlobStorage()) {
    try {
      return await readFromBlob();
    } catch {
      return [];
    }
  }
  try {
    const raw = await readFile(PROBLEMS_FILE, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as UploadedContent[]) : [];
  } catch {
    return [];
  }
}

export async function writeProblemsJson(items: UploadedContent[]): Promise<void> {
  assertStorageConfigForRuntime();
  if (shouldUseBlobStorage()) {
    await put(PROBLEMS_BLOB_PATHNAME, JSON.stringify(items, null, 2), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json; charset=utf-8",
      token: BLOB_TOKEN,
    });
    return;
  }

  await mkdir(path.dirname(PROBLEMS_FILE), { recursive: true });
  await writeFile(PROBLEMS_FILE, JSON.stringify(items, null, 2), "utf-8");
}
