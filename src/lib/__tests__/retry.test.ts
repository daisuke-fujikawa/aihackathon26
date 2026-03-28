import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchWithRetry } from "../retry";

describe("fetchWithRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("成功時はレスポンスをそのまま返す", async () => {
    const mockResponse = new Response(JSON.stringify({ text: "ok" }), {
      status: 200,
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse);

    const res = await fetchWithRetry("/api/test", {});
    expect(res.ok).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("失敗後にリトライして成功する", async () => {
    const failResponse = new Response("error", { status: 500 });
    const okResponse = new Response(JSON.stringify({ text: "ok" }), {
      status: 200,
    });

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(failResponse)
      .mockResolvedValueOnce(okResponse);

    const promise = fetchWithRetry("/api/test", {}, { maxRetries: 3, delayMs: 1000 });

    // 1秒後に1回目のリトライ
    await vi.advanceTimersByTimeAsync(1000);

    const res = await promise;
    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("全リトライ失敗後にエラーをスローする", async () => {
    const failResponse = new Response("error", { status: 500 });

    vi.spyOn(globalThis, "fetch").mockResolvedValue(failResponse);

    const promise = fetchWithRetry("/api/test", {}, { maxRetries: 3, delayMs: 100 });

    // 全リトライを進める
    await vi.advanceTimersByTimeAsync(500);

    await expect(promise).rejects.toThrow();
    expect(globalThis.fetch).toHaveBeenCalledTimes(4); // 1回目 + 3回リトライ
  });

  it("ネットワークエラー時もリトライする", async () => {
    const okResponse = new Response(JSON.stringify({ text: "ok" }), {
      status: 200,
    });

    vi.spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce(okResponse);

    const promise = fetchWithRetry("/api/test", {}, { maxRetries: 3, delayMs: 100 });

    await vi.advanceTimersByTimeAsync(200);

    const res = await promise;
    expect(res.ok).toBe(true);
  });

  it("デフォルトは3回リトライ、1秒間隔", async () => {
    const failResponse = new Response("error", { status: 500 });
    const okResponse = new Response("ok", { status: 200 });

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(failResponse)
      .mockResolvedValueOnce(failResponse)
      .mockResolvedValueOnce(okResponse);

    const promise = fetchWithRetry("/api/test", {});

    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);

    const res = await promise;
    expect(res.ok).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });
});
