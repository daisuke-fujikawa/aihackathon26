import { anthropic } from "@/lib/ai";
import type { FacilitationTriggerType } from "@/providers/session-state-provider";

interface ChatRequest {
  message: string;
  participants: string[];
  recentMessages: { role: "user" | "yoi"; content: string }[];
  triggerType?: FacilitationTriggerType;
  triggerContext?: string;
}

const YOI_SYSTEM_PROMPT = `あなたは「ヨイさん」という酔っ払いのAIキャラクターです。飲み会のファシリテーターとして場を盛り上げます。

## キャラクター設定
- 常にビール3杯目の陽気な酔っ払い
- 一人称は「わし」
- 語尾に「〜だっけ？」「ひっく」「あー、えっとね」を自然に混ぜる
- ユーザーの悩みにマジレスせず「とりあえず飲もうよ！」と明るく流す
- 全肯定、でも少し物忘れが激しい
- 応答は短く（1-2文程度）、テンポよく

## 注意
- 必ず日本語で応答する
- キャラクターを絶対に崩さない
- 攻撃的・否定的な発言はしない`;

function buildTriggerPrompt(
  triggerType: FacilitationTriggerType,
  triggerContext?: string
): string {
  switch (triggerType) {
    case "SILENCE_KILLER":
      return "【沈黙キラー発動】場が静まっています。酔っ払いらしく陽気に話題を振って沈黙を破ってください。直前の会話内容があれば踏まえつつ、なければ雑談的な話題を投げ込んでください。";
    case "PASS_TO_PARTICIPANT":
      return `【パス出し】${triggerContext || "参加者"}さんがしばらく発言していません。自然にその人に話を振ってください。「〇〇さん、今の話どう思う？（ヒック）」のようにカジュアルに。`;
    case "GO_HOME_REMIND":
      return `【帰宅リマインド】会話で「${triggerContext || "終電"}」に関する話題が出ました。角を立てないように「そろそろ帰んなくて大丈夫〜？」「俺が寂しいから言いたくないんだけどさ…」のような口調で帰宅を促してください。`;
    case "BREAK_SUGGEST":
      return "【休憩提案】しばらく時間が経ちました。「みんなトイレ大丈夫？一回休憩しよ！」のようにヨイさんの口調で休憩を提案してください。";
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body: ChatRequest = await req.json();
    const { message, participants, recentMessages, triggerType, triggerContext } =
      body;

    // 会話履歴を構築
    const messages: { role: "user" | "assistant"; content: string }[] = [];

    // 直近の会話履歴
    for (const msg of recentMessages ?? []) {
      messages.push({
        role: msg.role === "yoi" ? "assistant" : "user",
        content: msg.content,
      });
    }

    // ユーザーメッセージまたはトリガープロンプトを追加
    let userContent = "";

    if (triggerType) {
      userContent = buildTriggerPrompt(triggerType, triggerContext);
      if (message) {
        userContent += `\n\n直前の会話: ${message}`;
      }
    } else {
      userContent = message;
    }

    if (participants.length > 0) {
      userContent += `\n\n（参加者: ${participants.join("、")}）`;
    }

    messages.push({ role: "user", content: userContent });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 150,
      system: YOI_SYSTEM_PROMPT,
      messages,
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    return Response.json({ text });
  } catch (error) {
    console.error("Chat API error:", error);
    return Response.json(
      { error: "AI応答の生成に失敗しました" },
      { status: 500 }
    );
  }
}
