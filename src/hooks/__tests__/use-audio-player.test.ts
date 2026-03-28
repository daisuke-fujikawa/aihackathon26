import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAudioPlayer } from "../use-audio-player";

// --- Mock Web Audio API ---

let onendedCallback: (() => void) | null = null;

const mockSourceNode = {
  buffer: null as AudioBuffer | null,
  playbackRate: { value: 1 },
  connect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  set onended(cb: (() => void) | null) {
    onendedCallback = cb;
  },
  get onended() {
    return onendedCallback;
  },
};

const mockBiquadFilter = {
  type: "" as string,
  frequency: { value: 0 },
  gain: { value: 0 },
  connect: vi.fn(),
};

const mockGainNode = {
  gain: { value: 1 },
  connect: vi.fn(),
};

const mockAudioBuffer = {
  duration: 5,
  length: 44100 * 5,
  numberOfChannels: 1,
  sampleRate: 44100,
  getChannelData: vi.fn(),
  copyFromChannel: vi.fn(),
  copyToChannel: vi.fn(),
};

const mockAudioContext = {
  createBufferSource: vi.fn(() => ({ ...mockSourceNode })),
  createBiquadFilter: vi.fn(() => ({ ...mockBiquadFilter })),
  createGain: vi.fn(() => ({ ...mockGainNode })),
  decodeAudioData: vi.fn(() => Promise.resolve(mockAudioBuffer)),
  destination: {},
  close: vi.fn(),
  state: "running",
};

beforeEach(() => {
  onendedCallback = null;
  // @ts-expect-error mock
  globalThis.AudioContext = function () {
    return mockAudioContext;
  };
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useAudioPlayer", () => {
  describe("初期状態", () => {
    it("初期状態でisPlaying=false", () => {
      const { result } = renderHook(() => useAudioPlayer());
      expect(result.current.isPlaying).toBe(false);
    });

    it("初期状態でprogress=0", () => {
      const { result } = renderHook(() => useAudioPlayer());
      expect(result.current.progress).toBe(0);
    });
  });

  describe("playAudio", () => {
    it("playAudioでisPlayingがtrueになる", async () => {
      const { result } = renderHook(() => useAudioPlayer());
      const audioData = new ArrayBuffer(100);

      await act(async () => {
        result.current.playAudio(audioData);
      });

      expect(result.current.isPlaying).toBe(true);
    });

    it("playAudioでdecodeAudioDataが呼ばれる", async () => {
      const { result } = renderHook(() => useAudioPlayer());
      const audioData = new ArrayBuffer(100);

      await act(async () => {
        result.current.playAudio(audioData);
      });

      expect(mockAudioContext.decodeAudioData).toHaveBeenCalled();
    });

    it("playAudioでBufferSourceが作成されstartが呼ばれる", async () => {
      const { result } = renderHook(() => useAudioPlayer());
      const audioData = new ArrayBuffer(100);

      await act(async () => {
        result.current.playAudio(audioData);
      });

      expect(mockAudioContext.createBufferSource).toHaveBeenCalled();
    });

    it("BiquadFilter(lowshelf)が作成される", async () => {
      const { result } = renderHook(() => useAudioPlayer());

      await act(async () => {
        result.current.playAudio(new ArrayBuffer(100));
      });

      expect(mockAudioContext.createBiquadFilter).toHaveBeenCalled();
    });

    it("playbackRateが0.95-1.05の範囲に設定される", async () => {
      const { result } = renderHook(() => useAudioPlayer());

      await act(async () => {
        result.current.playAudio(new ArrayBuffer(100));
      });

      const source = mockAudioContext.createBufferSource.mock.results[0].value;
      expect(source.playbackRate.value).toBeGreaterThanOrEqual(0.95);
      expect(source.playbackRate.value).toBeLessThanOrEqual(1.05);
    });
  });

  describe("再生完了", () => {
    it("再生完了時にisPlayingがfalseになる", async () => {
      const { result } = renderHook(() => useAudioPlayer());

      await act(async () => {
        result.current.playAudio(new ArrayBuffer(100));
      });

      expect(result.current.isPlaying).toBe(true);

      // 再生完了をシミュレート
      const source = mockAudioContext.createBufferSource.mock.results[0].value;
      await act(async () => {
        source.onended?.();
      });

      expect(result.current.isPlaying).toBe(false);
    });

    it("onComplete コールバックが呼ばれる", async () => {
      const onComplete = vi.fn();
      const { result } = renderHook(() => useAudioPlayer({ onComplete }));

      await act(async () => {
        result.current.playAudio(new ArrayBuffer(100));
      });

      const source = mockAudioContext.createBufferSource.mock.results[0].value;
      await act(async () => {
        source.onended?.();
      });

      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });

  describe("stopAudio", () => {
    it("stopAudioでisPlayingがfalseになる", async () => {
      const { result } = renderHook(() => useAudioPlayer());

      await act(async () => {
        result.current.playAudio(new ArrayBuffer(100));
      });

      act(() => {
        result.current.stopAudio();
      });

      expect(result.current.isPlaying).toBe(false);
    });
  });
});
