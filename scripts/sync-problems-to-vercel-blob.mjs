import { list, put } from "@vercel/blob";
import { readFile } from "fs/promises";
import path from "path";
import process from "process";

const DEFAULT_SOURCE = path.join(process.cwd(), "src", "data", "current_problems.json");
const DEFAULT_BLOB_PATHNAME = "kodomo-support/current_problems.json";

function parseArgs(argv) {
  const options = {
    source: DEFAULT_SOURCE,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--source") {
      options.source = path.resolve(argv[i + 1] ?? "");
      i += 1;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function unquoteEnvValue(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

async function loadEnvFile(filePath) {
  let raw = "";
  try {
    raw = await readFile(filePath, "utf-8");
  } catch {
    return false;
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, value] = match;
    if (process.env[key] === undefined) {
      process.env[key] = unquoteEnvValue(value);
    }
  }

  return true;
}

async function readJsonArray(filePath, label) {
  const raw = await readFile(filePath, "utf-8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON array.`);
  }
  return parsed;
}

async function readRemoteProblems(pathname, token) {
  const listData = await list({ prefix: pathname, limit: 1, token });
  const blob = listData.blobs.find((item) => item.pathname === pathname);
  if (!blob?.url) return [];

  const response = await fetch(blob.url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to read remote Blob: ${response.status} ${response.statusText}`);
  }

  const parsed = await response.json();
  if (!Array.isArray(parsed)) {
    throw new Error("Remote Blob content must be a JSON array.");
  }
  return parsed;
}

function mergeById(localItems, remoteItems) {
  const seen = new Set();
  const merged = [];

  for (const item of localItems) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }

  for (const item of remoteItems) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }

  return merged;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await loadEnvFile(path.join(process.cwd(), ".env.local"));

  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  const pathname = process.env.PROBLEMS_BLOB_PATHNAME?.trim() || DEFAULT_BLOB_PATHNAME;

  if (!token) {
    throw new Error(
      [
        "BLOB_READ_WRITE_TOKEN is missing.",
        "Run `vercel env pull .env.local --environment=production --yes` first,",
        "or add the Blob token to .env.local.",
      ].join(" ")
    );
  }

  const localItems = await readJsonArray(options.source, "Local problems file");
  const remoteItems = await readRemoteProblems(pathname, token);
  const mergedItems = mergeById(localItems, remoteItems);
  const addedFromLocal = mergedItems.filter((item) =>
    localItems.some((localItem) => localItem?.id === item?.id) &&
    !remoteItems.some((remoteItem) => remoteItem?.id === item?.id)
  ).length;

  console.log(`Local file: ${path.relative(process.cwd(), options.source)}`);
  console.log(`Blob path: ${pathname}`);
  console.log(`Local items: ${localItems.length}`);
  console.log(`Remote items before sync: ${remoteItems.length}`);
  console.log(`Remote items after sync: ${mergedItems.length}`);
  console.log(`New local items to add: ${addedFromLocal}`);

  if (options.dryRun) {
    console.log("Dry run only. Blob was not updated.");
    return;
  }

  await put(pathname, JSON.stringify(mergedItems, null, 2), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json; charset=utf-8",
    token,
  });

  console.log("Synced problems to Vercel Blob.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
