import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  APPROVAL_MESSAGE,
  buildLabeledFlags,
  detectGenre,
  detectLanguage,
  normalizeDraftText,
} from "@/lib/ocr-format";

export const runtime = "nodejs";

const OCR_MODEL = "claude-sonnet-4-20250514";
const OCR_MAX_TOKENS = 4096;
const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const OCR_PROMPT = `この画像に含まれる文字をすべて正確に抽出してください。

指示：
- 算数・国語などの学習プリントの文字を読み取る
- 問題番号、問題文、選択肢をすべて含める
- 分数は「6/5」のように表記する
- 図や表は「[図]」「[表]」と記載する
- 読み取った文字のみを返し、説明や前置きは不要
- 改行や段落構造を元の画像に合わせて再現する`;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

type SupportedMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "画像ファイルが見つかりません" }, { status: 400 });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY が未設定です" }, { status: 500 });
    }

    const mediaType = resolveMediaType(file.type);
    const imageBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const draftText = normalizeDraftText(await extractTextByClaude({ imageBase64, mediaType }));

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
    return NextResponse.json(
      { error: "OCR処理でエラーが発生しました", detail: String(error) },
      { status: 500 }
    );
  }
}

async function extractTextByClaude(params: {
  imageBase64: string;
  mediaType: SupportedMediaType;
}): Promise<string> {
  const response = await anthropic.messages.create({
    model: OCR_MODEL,
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

  const texts: string[] = [];
  for (const item of response.content) {
    if ("text" in item && typeof item.text === "string") {
      texts.push(item.text);
    }
  }
  return texts.join("\n").trim();
}

function resolveMediaType(raw: string): SupportedMediaType {
  if (SUPPORTED_IMAGE_TYPES.has(raw)) {
    return raw as SupportedMediaType;
  }
  return "image/jpeg";
}