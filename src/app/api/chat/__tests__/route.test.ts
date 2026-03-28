import { describe, it, expect, vi, beforeEach } from "vitest";

// Anthropic SDK をモック
vi.mock("@/lib/ai", () => ({
  anthropic: {
    messages: {
      create: vi.fn(),
    },
  },
}));

import { POST } from "../route";
import { anthropic } from "@/lib/ai";

const mockCreate = vi.mocked(anthropic.messages.create);

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ヨイさんのキャラクターでAI応答を返す", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "わしはヨイじゃ！ひっく" }],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const res = await POST(
      makeRequest({
        message: "こんにちは",
        participants: ["太郎"],
        recentMessages: [],
      })
    );
    const data = await res.json();

    expect(data.text).toBe("わしはヨイじゃ！ひっく");
  });

  it("Claude APIにシステムプロンプトが含まれる", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "テスト" }],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    await POST(
      makeRequest({
        message: "テスト",
        participants: ["太郎"],
        recentMessages: [],
      })
    );

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.system).toBeDefined();
    expect(callArgs.system).toContain("ヨイ");
    expect(callArgs.system).toContain("わし");
  });

  it("max_tokensが200に制限される", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "テスト" }],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    await POST(
      makeRequest({
        message: "テスト",
        participants: [],
        recentMessages: [],
      })
    );

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.max_tokens).toBe(200);
  });

  it("triggerTypeがSILENCE_KILLERの場合プロンプトに沈黙キラーの指示が含まれる", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "静かだね〜" }],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    await POST(
      makeRequest({
        message: "",
        participants: ["太郎", "花子"],
        recentMessages: [],
        triggerType: "SILENCE_KILLER",
      })
    );

    const callArgs = mockCreate.mock.calls[0][0];
    const userMessage = callArgs.messages.find(
      (m: { role: string }) => m.role === "user"
    );
    expect(userMessage?.content).toContain("沈黙");
  });

  it("triggerTypeがPASS_TO_PARTICIPANTの場合パス出しの指示が含まれる", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "太郎くん、どう思う？" }],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    await POST(
      makeRequest({
        message: "",
        participants: ["太郎"],
        recentMessages: [],
        triggerType: "PASS_TO_PARTICIPANT",
        triggerContext: "太郎",
      })
    );

    const callArgs = mockCreate.mock.calls[0][0];
    const userMessage = callArgs.messages.find(
      (m: { role: string }) => m.role === "user"
    );
    expect(userMessage?.content).toContain("太郎");
  });

  it("triggerTypeがGO_HOME_REMINDの場合帰宅リマインドの指示が含まれる", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "そろそろ帰んなくて大丈夫？" }],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    await POST(
      makeRequest({
        message: "",
        participants: [],
        recentMessages: [],
        triggerType: "GO_HOME_REMIND",
        triggerContext: "終電",
      })
    );

    const callArgs = mockCreate.mock.calls[0][0];
    const userMessage = callArgs.messages.find(
      (m: { role: string }) => m.role === "user"
    );
    expect(userMessage?.content).toContain("帰");
  });

  it("triggerTypeがBREAK_SUGGESTの場合休憩提案の指示が含まれる", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "トイレ休憩！" }],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    await POST(
      makeRequest({
        message: "",
        participants: [],
        recentMessages: [],
        triggerType: "BREAK_SUGGEST",
      })
    );

    const callArgs = mockCreate.mock.calls[0][0];
    const userMessage = callArgs.messages.find(
      (m: { role: string }) => m.role === "user"
    );
    expect(userMessage?.content).toContain("休憩");
  });

  it("API失敗時に500エラーを返す", async () => {
    mockCreate.mockRejectedValue(new Error("API Error"));

    const res = await POST(
      makeRequest({
        message: "テスト",
        participants: [],
        recentMessages: [],
      })
    );

    expect(res.status).toBe(500);
  });

  it("recentMessagesが会話履歴としてClaude APIに渡される", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "テスト" }],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    await POST(
      makeRequest({
        message: "最新の発言",
        participants: [],
        recentMessages: [
          { role: "user", content: "前の発言" },
          { role: "yoi", content: "わしの返事" },
        ],
      })
    );

    const callArgs = mockCreate.mock.calls[0][0];
    // システムプロンプト以外に会話履歴が含まれる
    expect(callArgs.messages.length).toBeGreaterThan(1);
  });
});
