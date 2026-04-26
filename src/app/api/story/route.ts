import { NextResponse } from "next/server";
import {
  assistantTextFromMessage,
  CLAUDE_SONNET_4_5,
  getAnthropicClient,
} from "@/lib/anthropic-client";

type StoryRequest = {
  title?: string;
  words?: string;
  length?: 300 | 500 | 800;
  childName?: string;
  previousStory?: string;
};

function buildSystemPrompt(): string {
  return `あなたは、小学5・6年生向けの音読用ストーリー作家です。
出力は「本文だけ」を返してください。見出し・解説・箇条書き・コードブロックは禁止です。

ルール:
- 物語は楽しく、テンポよく。ダジャレ・なぞなぞ・うんち系の笑いを、ストーリーを邪魔しない程度で自然に混ぜる。
- 漢字は小学5・6年生レベルを中心に使い、初出語には 漢字(よみ) 形式でふりがなを付ける。
- 下品すぎる表現・攻撃的表現は避ける。安心して親子で読める内容にする。
- 指定された文字数におおむね合わせる（±10%程度）。
- 「続編」の場合は前の話の流れを引き継ぐ。
`;
}

function buildUserPrompt(input: Required<Pick<StoryRequest, "title" | "words" | "length">> & {
  childName: string;
  previousStory: string;
}): string {
  const sequel = input.previousStory.trim().length > 0;
  return `タイトル: ${input.title}
キーワード: ${input.words}
対象の子ども名: ${input.childName}
目標文字数: ${input.length} 文字
モード: ${sequel ? "続編" : "新規"}

${sequel ? `前回までの物語:
---
${input.previousStory}
---
` : ""}

上記条件で、音読したくなる楽しい物語を1本作成してください。`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as StoryRequest;
    const title = body.title?.trim() ?? "";
    const words = body.words?.trim() ?? "";
    const length = body.length === 500 || body.length === 800 ? body.length : 300;
    const childName = body.childName?.trim() || "子ども";
    const previousStory = body.previousStory?.trim() ?? "";

    if (!title) {
      return NextResponse.json({ error: "タイトルが必要です" }, { status: 400 });
    }
    if (!words) {
      return NextResponse.json({ error: "キーワードが必要です" }, { status: 400 });
    }

    const anthropic = getAnthropicClient();
    if (!anthropic) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY が未設定です" }, { status: 500 });
    }

    const response = await anthropic.messages.create({
      model: CLAUDE_SONNET_4_5,
      max_tokens: 2500,
      temperature: 0.8,
      system: buildSystemPrompt(),
      messages: [
        {
          role: "user",
          content: buildUserPrompt({ title, words, length, childName, previousStory }),
        },
      ],
    });

    const story = assistantTextFromMessage(response).trim();
    if (!story) {
      return NextResponse.json({ error: "物語を生成できませんでした" }, { status: 502 });
    }
    return NextResponse.json({ story });
  } catch (error) {
    console.error("/api/story POST error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "物語の生成に失敗しました" },
      { status: 500 }
    );
  }
}

