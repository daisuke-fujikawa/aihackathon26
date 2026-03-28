import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSpeechRecognition } from "../use-speech-recognition";

// --- Mock webkitSpeechRecognition ---

class MockSpeechRecognition {
  lang = "";
  continuous = false;
  interimResults = false;
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  onstart: (() => void) | null = null;

  start = vi.fn(() => {
    this.onstart?.();
  });
  stop = vi.fn(() => {
    this.onend?.();
  });
  abort = vi.fn();
}

let mockInstance: MockSpeechRecognition;

beforeEach(() => {
  mockInstance = new MockSpeechRecognition();
  // @ts-expect-error mock browser API
  globalThis.webkitSpeechRecognition = function () {
    return mockInstance;
  };
});

afterEach(() => {
  // @ts-expect-error cleanup
  delete globalThis.webkitSpeechRecognition;
});

describe("useSpeechRecognition", () => {
  describe("初期状態", () => {
    it("初期状態でisListeningはfalse", () => {
      const { result } = renderHook(() => useSpeechRecognition());
      expect(result.current.isListening).toBe(false);
    });

    it("初期状態でtranscriptは空文字", () => {
      const { result } = renderHook(() => useSpeechRecognition());
      expect(result.current.transcript).toBe("");
    });

    it("初期状態でinterimTranscriptは空文字", () => {
      const { result } = renderHook(() => useSpeechRecognition());
      expect(result.current.interimTranscript).toBe("");
    });

    it("初期状態でerrorはnull", () => {
      const { result } = renderHook(() => useSpeechRecognition());
      expect(result.current.error).toBeNull();
    });
  });

  describe("startListening", () => {
    it("startListeningでisListeningがtrueになる", () => {
      const { result } = renderHook(() => useSpeechRecognition());
      act(() => {
        result.current.startListening();
      });
      expect(result.current.isListening).toBe(true);
    });

    it("startListeningでrecognition.start()が呼ばれる", () => {
      const { result } = renderHook(() => useSpeechRecognition());
      act(() => {
        result.current.startListening();
      });
      expect(mockInstance.start).toHaveBeenCalled();
    });

    it("lang=ja-JPが設定される", () => {
      renderHook(() => useSpeechRecognition());
      expect(mockInstance.lang).toBe("ja-JP");
    });

    it("continuous=trueが設定される", () => {
      renderHook(() => useSpeechRecognition());
      expect(mockInstance.continuous).toBe(true);
    });

    it("interimResults=trueが設定される", () => {
      renderHook(() => useSpeechRecognition());
      expect(mockInstance.interimResults).toBe(true);
    });
  });

  describe("stopListening", () => {
    it("stopListeningでisListeningがfalseになる", () => {
      const { result } = renderHook(() => useSpeechRecognition());
      act(() => {
        result.current.startListening();
      });
      act(() => {
        result.current.stopListening();
      });
      expect(result.current.isListening).toBe(false);
    });
  });

  describe("音声認識結果", () => {
    it("最終結果でtranscriptが更新される", () => {
      const { result } = renderHook(() => useSpeechRecognition());
      act(() => {
        result.current.startListening();
      });

      act(() => {
        mockInstance.onresult?.({
          resultIndex: 0,
          results: [
            {
              0: { transcript: "こんにちは" },
              isFinal: true,
              length: 1,
            },
          ],
        });
      });

      expect(result.current.transcript).toBe("こんにちは");
    });

    it("中間結果でinterimTranscriptが更新される", () => {
      const { result } = renderHook(() => useSpeechRecognition());
      act(() => {
        result.current.startListening();
      });

      act(() => {
        mockInstance.onresult?.({
          resultIndex: 0,
          results: [
            {
              0: { transcript: "こんに" },
              isFinal: false,
              length: 1,
            },
          ],
        });
      });

      expect(result.current.interimTranscript).toBe("こんに");
    });
  });

  describe("エラーハンドリング", () => {
    it("not-allowedエラーが設定される", () => {
      const { result } = renderHook(() => useSpeechRecognition());
      act(() => {
        result.current.startListening();
      });

      act(() => {
        mockInstance.onerror?.({ error: "not-allowed" });
      });

      expect(result.current.error).toBe("not-allowed");
    });
  });

  describe("自動再接続", () => {
    it("セッション終了時にisListeningがtrueなら自動再開する", async () => {
      vi.useFakeTimers();
      const { result } = renderHook(() => useSpeechRecognition());

      act(() => {
        result.current.startListening();
      });
      mockInstance.start.mockClear();

      // onendを手動発火（タイムアウト等でセッション終了）
      act(() => {
        mockInstance.onend?.();
      });

      // 再接続遅延を待つ
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(mockInstance.start).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe("resetTranscript", () => {
    it("resetTranscriptでtranscriptがクリアされる", () => {
      const { result } = renderHook(() => useSpeechRecognition());
      act(() => {
        result.current.startListening();
      });
      act(() => {
        mockInstance.onresult?.({
          resultIndex: 0,
          results: [
            {
              0: { transcript: "テスト" },
              isFinal: true,
              length: 1,
            },
          ],
        });
      });
      expect(result.current.transcript).toBe("テスト");

      act(() => {
        result.current.resetTranscript();
      });
      expect(result.current.transcript).toBe("");
      expect(result.current.interimTranscript).toBe("");
    });
  });

  describe("ブラウザ非対応", () => {
    it("webkitSpeechRecognitionがない場合はservice-not-availableエラー", () => {
      // @ts-expect-error cleanup
      delete globalThis.webkitSpeechRecognition;
      const { result } = renderHook(() => useSpeechRecognition());
      expect(result.current.error).toBe("service-not-available");
    });
  });
});
