import { NextResponse } from "next/server";
import {
  assistantTextFromMessage,
  CLAUDE_SONNET_4_5,
  getAnthropicClient,
} from "@/lib/anthropic-client";
import {
  APPROVAL_MESSAGE,
  buildLabeledFlags,
  detectGenre,
  detectLanguage,
  normalizeDraftText,
} from "@/lib/ocr-format";

export const runtime = "nodejs";

const OCR_MAX_TOKENS = 4096;
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const OCR_PROMPT = `この画像に含まれる文字をすべて正確に抽出してください。

指示：
- 算数・国語などの学習プリントの文字を読み取る
- 問題番号・大問小問の見出し・「〜しなさい」などの指示文・問題本文・（）や下線・選択肢を**省略せず**すべて含める（正解だけ抜き出すなどの要約はしない）
- 分数は「6/5」のように表記する
- 図や表は「[図]」「[表]」と記載する
- 読み取った文字のみを返し、説明や前置きは不要
- 改行や段落構造を元の画像に合わせて再現する`;

type SupportedMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

export async function POST(req: Request) {
  try {
    const validation = await validateOcrUpload(req);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }

    const { file, mediaType } = validation;
    const anthropic = getAnthropicClient();
    if (!anthropic) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY が未設定です" }, { status: 500 });
    }

    const imageBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const draftText = normalizeDraftText(
      await extractTextByClaude({ anthropic, imageBase64, mediaType })
    );

    if (!draftText) {
      return NextResponse.json(
        { error: "文字を抽出できませんでした。画像を変更して再実行してください。" },
        { status: 422 }
      );
    }

    return NextResponse.json({
      draftText,
      flags: buildLabeledFlags(draftText, []),
      language: detectLanguage(draftText),
      genre: detectGenre(draftText),
      approvalMessage: APPROVAL_MESSAGE,
    });
  } catch (error) {
    console.error("/api/ocr error:", error);
    const mapped = mapOcrError(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

async function extractTextByClaude(params: {
  anthropic: NonNullable<ReturnType<typeof getAnthropicClient>>;
  imageBase64: string;
  mediaType: SupportedMediaType;
}): Promise<string> {
  const response = await params.anthropic.messages.create({
    model: CLAUDE_SONNET_4_5,
    max_tokens: OCR_MAX_TOKENS,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: params.mediaType,
              data: params.imageBase64,
            },
          },
          { type: "text", text: OCR_PROMPT },
        ],
      },
    ],
  });

  return assistantTextFromMessage(response);
}

type UploadValidationResult =
  | { ok: true; file: File; mediaType: SupportedMediaType }
  | { ok: false; error: string; status: number };

async function validateOcrUpload(req: Request): Promise<UploadValidationResult> {
  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "画像ファイルが見つかりません", status: 400 };
  }
  if (file.size === 0) {
    return { ok: false, error: "画像ファイルが空です", status: 400 };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      error: "画像サイズが大きすぎます。8MB以下の画像で再実行してください。",
      status: 413,
    };
  }
  const mediaType = resolveMediaType(file.type);
  if (!mediaType) {
    return {
      ok: false,
      error: "未対応の画像形式です。JPEG/PNG/GIF/WebP を使用してください。",
      status: 415,
    };
  }
  return { ok: true, file, mediaType };
}

function mapOcrError(error: unknown): { status: number; error: string } {
  const detail = String(error ?? "");
  const authFailed =
    detail.includes("authentication_error") ||
    detail.includes("invalid x-api-key") ||
    detail.toLowerCase().includes("unauthorized");
  if (authFailed) {
    return {
      status: 401,
      error: "Claude APIキーが無効です。.env.local の ANTHROPIC_API_KEY を確認してください。",
    };
  }
  return {
    status: 500,
    error: "OCR処理でエラーが発生しました。時間をおいて再実行してください。",
  };
}

function resolveMediaType(raw: string): SupportedMediaType | null {
  if (SUPPORTED_IMAGE_TYPES.has(raw)) {
    return raw as SupportedMediaType;
  }
  return null;
}