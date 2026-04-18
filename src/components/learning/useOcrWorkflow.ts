import { useState } from "react";
import {
  type OcrApiResponse,
  type OcrLanguage,
  type OcrGenre,
} from "@/lib/ocr-format";

interface OcrWorkflowResult {
  draftText: string;
  flags: string[];
  approvalMessage: string;
  language: OcrLanguage;
  genre: OcrGenre;
}

const OCR_REQUEST_TIMEOUT_MS = 90_000;
const MAX_IMAGE_SIDE = 2400;
const MIN_RESIZE_SIDE = 2200;

export function useOcrWorkflow() {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("準備中");

  const runOcr = async (file: File): Promise<OcrWorkflowResult> => {
    setIsRunning(true);
    setProgress(0);
    setProgressLabel("画像を読み込み中");

    try {
      setProgress(10);
      setProgressLabel("画像を最適化中");
      const optimizedFile = await optimizeImageForOcr(file);

      setProgress(20);
      setProgressLabel("画像を送信中");
      const formData = new FormData();
      formData.append("file", optimizedFile);

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), OCR_REQUEST_TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch("/api/ocr", {
          method: "POST",
          body: formData,
          signal: controller.signal,
        });
      } finally {
        window.clearTimeout(timeoutId);
      }

      setProgress(75);
      setProgressLabel("認識結果を整形中");

      const payload = await parseOcrResponse(res);
      if (!res.ok) {
        throw new Error(payload.error ?? "OCR処理に失敗しました");
      }

      if (!payload.draftText) {
        throw new Error("文字を抽出できませんでした。画像を変更して再実行してください。");
      }

      setProgress(100);
      setProgressLabel("完了");

      return {
        draftText: payload.draftText,
        flags: (payload.flags ?? []).map((flag) => flag.label),
        approvalMessage:
          payload.approvalMessage ??
          "上記内容で間違いがないか、修正が必要な箇所があれば教えてください",
        language: payload.language ?? "混合",
        genre: payload.genre ?? "専門書",
      };
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error("OCR処理がタイムアウトしました。画像を小さくして再実行してください。");
      }
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("OCR処理に失敗しました");
    } finally {
      setIsRunning(false);
      setProgress(0);
      setProgressLabel("準備中");
    }
  };

  return {
    isRunning,
    progress,
    progressLabel,
    runOcr,
  };
}

async function optimizeImageForOcr(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(sourceUrl);
    const maxSide = Math.max(image.naturalWidth, image.naturalHeight);
    if (maxSide <= MIN_RESIZE_SIDE && file.size <= 4 * 1024 * 1024) return file;

    const ratio = maxSide > MAX_IMAGE_SIDE ? MAX_IMAGE_SIDE / maxSide : 1;
    const width = Math.max(1, Math.round(image.naturalWidth * ratio));
    const height = Math.max(1, Math.round(image.naturalHeight * ratio));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(image, 0, 0, width, height);

    // OCR向けに軽く白黒強調して、にじみや背景色の影響を減らす
    const imageData = context.getImageData(0, 0, width, height);
    const pixels = imageData.data;
    for (let i = 0; i < pixels.length; i += 4) {
      const gray = Math.round(pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114);
      const boosted = gray > 190 ? 255 : gray < 80 ? 0 : gray;
      pixels[i] = boosted;
      pixels[i + 1] = boosted;
      pixels[i + 2] = boosted;
    }
    context.putImageData(imageData, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png")
    );
    if (!blob) return file;

    const baseName = file.name.replace(/\.[^/.]+$/, "");
    return new File([blob], `${baseName}.png`, { type: "image/png" });
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
    image.src = src;
  });
}

async function parseOcrResponse(res: Response): Promise<Partial<OcrApiResponse> & { error?: string }> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      return (await res.json()) as Partial<OcrApiResponse> & { error?: string };
    } catch {
      return { error: "OCRレスポンスの解析に失敗しました" };
    }
  }

  try {
    const text = await res.text();
    return { error: text.trim() || "OCR処理に失敗しました" };
  } catch {
    return { error: "OCR処理に失敗しました" };
  }
}
