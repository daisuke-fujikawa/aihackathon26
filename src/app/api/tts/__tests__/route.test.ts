import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// テスト前にモジュールをインポート
import { POST } from "../route";

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/tts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "test-key";
  });

  it("テキストを音声に変換してaudio/mpegで返す", async () => {
    const audioData = new ArrayBuffer(100);
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(audioData),
    });

    const res = await POST(makeRequest({ text: "こんにちは" }));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("audio/mpeg");
  });

  it("OpenAI TTS APIにmodel=tts-1, voice=onyx, speed=0.8で呼び出す", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
    });

    await POST(makeRequest({ text: "テスト" }));

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("audio/speech");

    const body = JSON.parse(options.body);
    expect(body.model).toBe("tts-1");
    expect(body.voice).toBe("onyx");
    expect(body.speed).toBe(0.8);
    expect(body.response_format).toBe("mp3");
  });

  it("カスタムspeedパラメータを受け付ける", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
    });

    await POST(makeRequest({ text: "テスト", speed: 0.6 }));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.speed).toBe(0.6);
  });

  it("textが空の場合400エラーを返す", async () => {
    const res = await POST(makeRequest({ text: "" }));
    expect(res.status).toBe(400);
  });

  it("OpenAI API失敗時に503エラーを返す", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    const res = await POST(makeRequest({ text: "テスト" }));
    expect(res.status).toBe(503);
  });

  it("ネットワークエラー時に500エラーを返す", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const res = await POST(makeRequest({ text: "テスト" }));
    expect(res.status).toBe(500);
  });
});
