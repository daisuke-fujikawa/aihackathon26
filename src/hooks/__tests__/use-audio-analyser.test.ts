import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAudioAnalyser } from "../use-audio-analyser";

// --- Mock Web Audio API ---

const mockAnalyserNode = {
  fftSize: 0,
  frequencyBinCount: 128,
  getByteFrequencyData: vi.fn((array: Uint8Array) => {
    // デフォルトは無音
    array.fill(0);
  }),
  connect: vi.fn(),
  disconnect: vi.fn(),
};

const mockSourceNode = {
  connect: vi.fn(),
  disconnect: vi.fn(),
};

const mockAudioContext = {
  createAnalyser: vi.fn(() => mockAnalyserNode),
  createMediaStreamSource: vi.fn(() => mockSourceNode),
  close: vi.fn(),
  state: "running",
};

const mockMediaStream = {
  getTracks: vi.fn(() => [{ stop: vi.fn() }]),
};

beforeEach(() => {
  // @ts-expect-error mock
  globalThis.AudioContext = function () {
    return mockAudioContext;
  };
  // @ts-expect-error mock
  globalThis.navigator.mediaDevices = {
    getUserMedia: vi.fn(() => Promise.resolve(mockMediaStream)),
  };

  // requestAnimationFrame mock
  let rafId = 0;
  vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
    rafId++;
    setTimeout(() => cb(performance.now()), 16);
    return rafId;
  });
  vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useAudioAnalyser", () => {
  describe("初期状態", () => {
    it("初期���態でvolumeLevel=0", () => {
      const { result } = renderHook(() => useAudioAnalyser());
      expect(result.current.volumeLevel).toBe(0);
    });

    it("初期状態でtotalSpeechTime=0", () => {
      const { result } = renderHook(() => useAudioAnalyser());
      expect(result.current.totalSpeechTime).toBe(0);
    });

    it("初期状態でisSpeaking=false", () => {
      const { result } = renderHook(() => useAudioAnalyser());
      expect(result.current.isSpeaking).toBe(false);
    });
  });

  describe("startAnalysing", () => {
    it("startAnalysingでgetUserMediaが呼ばれる", async () => {
      const { result } = renderHook(() => useAudioAnalyser());
      await act(async () => {
        await result.current.startAnalysing();
      });
      expect(globalThis.navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(
        { audio: true }
      );
    });

    it("startAnalysingでAnalyserNodeが作成される", async () => {
      const { result } = renderHook(() => useAudioAnalyser());
      await act(async () => {
        await result.current.startAnalysing();
      });
      expect(mockAudioContext.createAnalyser).toHaveBeenCalled();
    });
  });

  describe("stopAnalysing", () => {
    it("stopAnalysingでリソースが解放される", async () => {
      const { result } = renderHook(() => useAudioAnalyser());
      await act(async () => {
        await result.current.startAnalysing();
      });
      act(() => {
        result.current.stopAnalysing();
      });
      expect(mockAudioContext.close).toHaveBeenCalled();
    });
  });

  describe("音量計測", () => {
    it("音量がある場合volumeLevelが0より大きくなる", async () => {
      vi.useFakeTimers();
      mockAnalyserNode.getByteFrequencyData.mockImplementation(
        (array: Uint8Array) => {
          // 高い音量をシミュレート
          array.fill(200);
        }
      );

      const { result } = renderHook(() => useAudioAnalyser());
      await act(async () => {
        await result.current.startAnalysing();
      });

      // rAFの実行を待つ
      await act(async () => {
        vi.advanceTimersByTime(50);
      });

      expect(result.current.volumeLevel).toBeGreaterThan(0);
      vi.useRealTimers();
    });
  });
});
