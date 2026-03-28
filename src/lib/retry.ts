interface RetryOptions {
  maxRetries?: number;
  delayMs?: number;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  options?: RetryOptions
): Promise<Response> {
  const { maxRetries = 3, delayMs = 1000 } = options ?? {};

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, init);
      if (response.ok) {
        return response;
      }

      // 最後の試行なら失敗レスポンスでエラー
      if (attempt === maxRetries) {
        throw new Error(`Request failed after ${maxRetries + 1} attempts: ${response.status}`);
      }

      // リトライ前に待つ
      await delay(delayMs);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries) {
        throw lastError;
      }

      await delay(delayMs);
    }
  }

  throw lastError ?? new Error("Unexpected retry failure");
}
