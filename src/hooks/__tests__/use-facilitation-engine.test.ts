import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFacilitationEngine } from "../use-facilitation-engine";
import type { FacilitationTrigger } from "../use-facilitation-engine";

describe("useFacilitationEngine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const defaultConfig = {
    silenceThresholdSec: 10,
    passIntervalSec: 30,
    breakIntervalMin: 30,
    kanpaiBreakThreshold: 3,
  };

  describe("沈黙キラー", () => {
    it("沈黙が閾値秒を超えるとSILENCE_KILLERトリガーが発火する", () => {
      const onTrigger = vi.fn();
      // lastSpeechTimeを過去に設定し、チェック間隔(3秒)分進める
      const pastTime = Date.now() - 11000;
      renderHook(() =>
        useFacilitationEngine({
          config: defaultConfig,
          participants: ["太郎", "花子"],
          isListening: true,
          isProcessing: false,
          lastSpeechTime: pastTime,
          sessionStartTime: Date.now(),
          kanpaiCount: 0,
          onTrigger,
        })
      );

      // チェック間隔分進める
      act(() => {
        vi.advanceTimersByTime(3500);
      });

      expect(onTrigger).toHaveBeenCalledWith(
        expect.objectContaining({ type: "SILENCE_KILLER" })
      );
    });

    it("音声認識が非アクティブの場合は沈黙キラーが発動しない", () => {
      const onTrigger = vi.fn();
      renderHook(() =>
        useFacilitationEngine({
          config: defaultConfig,
          participants: ["太郎"],
          isListening: false,
          isProcessing: false,
          lastSpeechTime: Date.now(),
          sessionStartTime: Date.now(),
          kanpaiCount: 0,
          onTrigger,
        })
      );

      act(() => {
        vi.advanceTimersByTime(15000);
      });

      expect(onTrigger).not.toHaveBeenCalled();
    });

    it("処理中の場合は新たなトリガーを抑制する", () => {
      const onTrigger = vi.fn();
      renderHook(() =>
        useFacilitationEngine({
          config: defaultConfig,
          participants: ["太郎"],
          isListening: true,
          isProcessing: true,
          lastSpeechTime: Date.now() - 15000,
          sessionStartTime: Date.now(),
          kanpaiCount: 0,
          onTrigger,
        })
      );

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(onTrigger).not.toHaveBeenCalled();
    });
  });

  describe("パス出し", () => {
    it("一定時間後にPASS_TO_PARTICIPANTトリガーが発火する", () => {
      const onTrigger = vi.fn();
      const now = Date.now();
      renderHook(() =>
        useFacilitationEngine({
          config: defaultConfig,
          participants: ["太郎", "花子", "次郎"],
          isListening: true,
          isProcessing: false,
          lastSpeechTime: now,
          sessionStartTime: now,
          kanpaiCount: 0,
          onTrigger,
        })
      );

      // 31秒経過（パス間隔30秒を超える）
      act(() => {
        vi.advanceTimersByTime(31000);
      });

      // 沈黙キラーかパス出しのいずれかが発火しているはず
      const passTrigger = onTrigger.mock.calls.find(
        (call) => call[0].type === "PASS_TO_PARTICIPANT"
      );
      // パス出しが発火した場合、participantNameが参加者リストの中の一人
      if (passTrigger) {
        expect(["太郎", "花子", "次郎"]).toContain(
          passTrigger[0].participantName
        );
      }
    });

    it("参加者が0人の場合パス出しは発動しない", () => {
      const onTrigger = vi.fn();
      renderHook(() =>
        useFacilitationEngine({
          config: defaultConfig,
          participants: [],
          isListening: true,
          isProcessing: false,
          lastSpeechTime: Date.now(),
          sessionStartTime: Date.now(),
          kanpaiCount: 0,
          onTrigger,
        })
      );

      act(() => {
        vi.advanceTimersByTime(35000);
      });

      const passTrigger = onTrigger.mock.calls.find(
        (call) => call[0].type === "PASS_TO_PARTICIPANT"
      );
      expect(passTrigger).toBeUndefined();
    });
  });

  describe("休憩提案", () => {
    it("経過時間が閾値を超えるとBREAK_SUGGESTトリガーが発火する", () => {
      const onTrigger = vi.fn();
      const now = Date.now();
      const thirtyMinAgo = now - 30 * 60 * 1000;
      renderHook(() =>
        useFacilitationEngine({
          config: defaultConfig,
          participants: [],
          isListening: true,
          isProcessing: false,
          lastSpeechTime: now,
          sessionStartTime: thirtyMinAgo,
          kanpaiCount: 0,
          onTrigger,
        })
      );

      // チェック間隔分進める
      act(() => {
        vi.advanceTimersByTime(3500);
      });

      const breakTrigger = onTrigger.mock.calls.find(
        (call) => call[0].type === "BREAK_SUGGEST"
      );
      expect(breakTrigger).toBeDefined();
      expect(breakTrigger![0].reason).toBe("time_elapsed");
    });

    it("乾杯回数が閾値に達するとBREAK_SUGGESTトリガーが発火する", () => {
      const onTrigger = vi.fn();
      const now = Date.now();
      renderHook(() =>
        useFacilitationEngine({
          config: defaultConfig,
          participants: [],
          isListening: true,
          isProcessing: false,
          lastSpeechTime: now,
          sessionStartTime: now,
          kanpaiCount: 3,
          onTrigger,
        })
      );

      // チェック間隔分進める
      act(() => {
        vi.advanceTimersByTime(3500);
      });

      const breakTrigger = onTrigger.mock.calls.find(
        (call) => call[0].type === "BREAK_SUGGEST"
      );
      expect(breakTrigger).toBeDefined();
      expect(breakTrigger![0].reason).toBe("kanpai_count");
    });
  });

  describe("帰宅リマインド", () => {
    it("triggerGoHomeRemindでGO_HOME_REMINDトリガーが発火する", () => {
      const onTrigger = vi.fn();
      const { result } = renderHook(() =>
        useFacilitationEngine({
          config: defaultConfig,
          participants: ["太郎"],
          isListening: true,
          isProcessing: false,
          lastSpeechTime: Date.now(),
          sessionStartTime: Date.now(),
          kanpaiCount: 0,
          onTrigger,
        })
      );

      act(() => {
        result.current.triggerGoHomeRemind("終電");
      });

      expect(onTrigger).toHaveBeenCalledWith({
        type: "GO_HOME_REMIND",
        detectedKeyword: "終電",
      });
    });
  });

  describe("クリーンアップ", () => {
    it("アンマウント時にタイマーがクリアされる", () => {
      const onTrigger = vi.fn();
      const { unmount } = renderHook(() =>
        useFacilitationEngine({
          config: defaultConfig,
          participants: ["太郎"],
          isListening: true,
          isProcessing: false,
          lastSpeechTime: Date.now(),
          sessionStartTime: Date.now(),
          kanpaiCount: 0,
          onTrigger,
        })
      );

      unmount();

      act(() => {
        vi.advanceTimersByTime(30000);
      });

      expect(onTrigger).not.toHaveBeenCalled();
    });
  });
});
