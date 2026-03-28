import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useKeywordDetector } from "../use-keyword-detector";
import type { KeywordEvent } from "../use-keyword-detector";

describe("useKeywordDetector", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("乾杯検出", () => {
    it("「乾杯」を検出してKANPAIイベントを発火する", () => {
      const onKeyword = vi.fn();
      const { result } = renderHook(() => useKeywordDetector({ onKeyword }));

      act(() => {
        result.current.processText("みんな乾杯しよう");
      });

      expect(onKeyword).toHaveBeenCalledWith({ type: "KANPAI" });
    });

    it("「かんぱい」を検出してKANPAIイベントを発火する", () => {
      const onKeyword = vi.fn();
      const { result } = renderHook(() => useKeywordDetector({ onKeyword }));

      act(() => {
        result.current.processText("かんぱい！");
      });

      expect(onKeyword).toHaveBeenCalledWith({ type: "KANPAI" });
    });

    it("「カンパイ」（カタカナ）を検出してKANPAIイベントを発火する", () => {
      const onKeyword = vi.fn();
      const { result } = renderHook(() => useKeywordDetector({ onKeyword }));

      act(() => {
        result.current.processText("カンパイ！");
      });

      expect(onKeyword).toHaveBeenCalledWith({ type: "KANPAI" });
    });
  });

  describe("帰宅キーワード検出", () => {
    it("「終電」を検出してGO_HOMEイベントを発火する", () => {
      const onKeyword = vi.fn();
      const { result } = renderHook(() => useKeywordDetector({ onKeyword }));

      act(() => {
        result.current.processText("終電何時だっけ");
      });

      expect(onKeyword).toHaveBeenCalledWith({
        type: "GO_HOME",
        keyword: "終電",
      });
    });

    it("「明日」を検出してGO_HOMEイベントを発火する", () => {
      const onKeyword = vi.fn();
      const { result } = renderHook(() => useKeywordDetector({ onKeyword }));

      act(() => {
        result.current.processText("明日早いんだよね");
      });

      expect(onKeyword).toHaveBeenCalledWith({
        type: "GO_HOME",
        keyword: "明日",
      });
    });

    it("「何時」を検出してGO_HOMEイベントを発火する", () => {
      const onKeyword = vi.fn();
      const { result } = renderHook(() => useKeywordDetector({ onKeyword }));

      act(() => {
        result.current.processText("今何時かな");
      });

      expect(onKeyword).toHaveBeenCalledWith({
        type: "GO_HOME",
        keyword: "何時",
      });
    });

    it("「駅」を検出してGO_HOMEイベントを発火する", () => {
      const onKeyword = vi.fn();
      const { result } = renderHook(() => useKeywordDetector({ onKeyword }));

      act(() => {
        result.current.processText("駅まで歩こう");
      });

      expect(onKeyword).toHaveBeenCalledWith({
        type: "GO_HOME",
        keyword: "駅",
      });
    });
  });

  describe("クールダウン", () => {
    it("同じキーワードが5秒以内に再検出されても重複発火しない", () => {
      const onKeyword = vi.fn();
      const { result } = renderHook(() => useKeywordDetector({ onKeyword }));

      act(() => {
        result.current.processText("乾杯！");
      });
      expect(onKeyword).toHaveBeenCalledTimes(1);

      act(() => {
        result.current.processText("乾杯！もう一回！");
      });
      // クールダウン中なので発火しない
      expect(onKeyword).toHaveBeenCalledTimes(1);
    });

    it("5秒経過後は再検出される", () => {
      const onKeyword = vi.fn();
      const { result } = renderHook(() => useKeywordDetector({ onKeyword }));

      act(() => {
        result.current.processText("乾杯！");
      });
      expect(onKeyword).toHaveBeenCalledTimes(1);

      // 5秒経過
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      act(() => {
        result.current.processText("もう一回乾杯！");
      });
      expect(onKeyword).toHaveBeenCalledTimes(2);
    });

    it("乾杯と帰宅は別のクールダウンで管理される", () => {
      const onKeyword = vi.fn();
      const { result } = renderHook(() => useKeywordDetector({ onKeyword }));

      act(() => {
        result.current.processText("乾杯！");
      });
      expect(onKeyword).toHaveBeenCalledTimes(1);

      act(() => {
        result.current.processText("終電大丈夫？");
      });
      // 別カテゴリなので発火する
      expect(onKeyword).toHaveBeenCalledTimes(2);
    });
  });

  describe("キーワードなし", () => {
    it("キーワードが含まれないテキストではイベントが発火しない", () => {
      const onKeyword = vi.fn();
      const { result } = renderHook(() => useKeywordDetector({ onKeyword }));

      act(() => {
        result.current.processText("今日はいい天気ですね");
      });

      expect(onKeyword).not.toHaveBeenCalled();
    });

    it("空文字列ではイベントが発火しない", () => {
      const onKeyword = vi.fn();
      const { result } = renderHook(() => useKeywordDetector({ onKeyword }));

      act(() => {
        result.current.processText("");
      });

      expect(onKeyword).not.toHaveBeenCalled();
    });
  });
});
