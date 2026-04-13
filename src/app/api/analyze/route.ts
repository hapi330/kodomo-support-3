import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const PENDING_DIR = path.join(process.cwd(), "public", "uploads", "pending");

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { base64, mimeType, title, subject } = body as {
      base64: string;
      mimeType: string;
      title: string;
      subject: string;
    };

    if (!base64 || !mimeType) {
      return NextResponse.json({ error: "base64 と mimeType は必須です" }, { status: 400 });
    }

    await mkdir(PENDING_DIR, { recursive: true });

    const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
    const timestamp = Date.now();
    const imageFilename = `${timestamp}.${ext}`;
    const metaFilename = `${timestamp}.json`;

    const imageBuffer = Buffer.from(base64, "base64");
    await writeFile(path.join(PENDING_DIR, imageFilename), imageBuffer);

    const meta = {
      title: title || "（タイトルなし）",
      subject: subject || "その他",
      imagePath: `/uploads/pending/${imageFilename}`,
      uploadedAt: new Date().toISOString(),
    };
    await writeFile(
      path.join(PENDING_DIR, metaFilename),
      JSON.stringify(meta, null, 2),
      "utf-8"
    );

    return NextResponse.json({
      message: "画像を保存しました",
      filename: imageFilename,
      meta,
    });
  } catch (err) {
    console.error("/api/analyze error:", err);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました", detail: String(err) },
      { status: 500 }
    );
  }
}
