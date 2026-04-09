import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  SessionStateProvider,
  useSessionState,
} from "../session-state-provider";
import type {
  SessionPhase,
  YoiDrunkLevel,
  YoiImageKey,
  FacilitationTrigger,
} from "../session-state-provider";

function wrapper({ children }: { children: React.ReactNode }) {
  return <SessionStateProvider>{children}</SessionStateProvider>;
}

describe("SessionStateProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("初期状態", () => {
    it("初期フェーズはSETUPである", () => {
      const { result } = renderHook(() => useSessionState(), { wrapper });
      expect(result.current.state.phase).toBe("SETUP");
    });

    it("参加者リストは空配列である", () => {
      const { result } = renderHook(() => useSessionState(), { wrapper });
      expect(result.current.state.participants).toEqual([]);
    });

    it("メッセージ履歴は空配列である", () => {
      const { result } = renderHook(() => useSessionState(), { wrapper });
      expect(result.current.state.messages).toEqual([]);
    });

    it("乾杯回数は0である", () => {
      const { result } = renderHook(() => useSessionState(), { wrapper });
      expect(result.current.state.kanpaiCount).toBe(0);
    });

    it("酔度レベルは1である", () => {
      const { result } = renderHook(() => useSessionState(), { wrapper });
      expect(result.current.state.drunkLevel).toBe(1);
    });

    it("ヨイさん画像キーはdrunk_1である", () => {
      const { result } = renderHook(() => useSessionState(), { wrapper });
      expect(result.current.state.currentYoiImage).toBe("drunk_1");
    });

    it("ファシリテーション設定のデフォルト値が定義されている", () => {
      const { result } = renderHook(() => useSessionState(), { wrapper });
      const config = result.current.state.facilitationConfig;
      expect(config.silenceThresholdSec).toBe(30);
      expect(config.passIntervalSec).toBe(60);
      expect(config.breakIntervalMin).toBe(30);
      expect(config.kanpaiBreakThreshold).toBe(3);
      expect(config.maxResponseChars).toBe(80);
      expect(config.aiCooldownSec).toBe(15);
      expect(config.transcriptDebounceMs).toBe(1500);
    });
  });

  describe("フェーズ遷移", () => {
    it("setPhaseでフェーズを変更できる", () => {
      const { result } = renderHook(() => useSessionState(), { wrapper });
      act(() => {
        result.current.setPhase("IDLE");
      });
      expect(result.current.state.phase).toBe("IDLE");
    });

    it("SETUP→IDLEに遷移できる", () => {
      const { result } = renderHook(() => useSessionState(), { wrapper });
      act(() => {
        result.current.setPhase("IDLE");
      });
      expect(result.current.state.phase).toBe("IDLE");
    });

    it("全てのフェーズ値を設定できる", () => {
      const phases: SessionPhase[] = [
        "SETUP",
        "IDLE",
        "LISTENING",
        "PROCESSING",
        "SPEAKING",
        "KANPAI",
      ];
      const { result } = renderHook(() => useSessionState(), { wrapper });
      for (const phase of phases) {
        act(() => {
          result.current.setPhase(phase);
        });
        expect(result.current.state.phase).toBe(phase);
      }
    });
  });

  describe("参加者管理", () => {
    it("setParticipantsで参加者リストを設定できる", () => {
      const { result } = renderHook(() => useSessionState(), { wrapper });
      act(() => {
        result.current.setParticipants(["太郎", "花子", "次郎"]);
      });
      expect(result.current.state.participants).toEqual([
        "太郎",
        "花子",
        "次郎",
      ]);
    });
  });

  describe("メッセージ管理", () => {
    it("addMessageでメッセージを追加できる", () => {
      const { result } = renderHook(() => useSessionState(), { wrapper });
      act(() => {
        result.current.addMessage({
          role: "user",
          content: "こんにちは",
        });
      });
      expect(result.current.state.messages).toHaveLength(1);
      expect(result.current.state.messages[0].role).toBe("user");
      expect(result.current.state.messages[0].content).toBe("こんにちは");
      expect(result.current.state.messages[0].id).toBeDefined();
      expect(result.current.state.messages[0].timestamp).toBeDefined();
    });

    it("yoiロールのメッセージにyoiImageを付与できる", () => {
      const { result } = renderHook(() => useSessionState(), { wrapper });
      act(() => {
        result.current.addMessage({
          role: "yoi",
          content: "わしはヨイじゃ！",
          yoiImage: "kanpai",
        });
      });
      expect(result.current.state.messages[0].yoiImage).toBe("kanpai");
    });

    it("triggerTypeを付与できる", () => {
      const { result } = renderHook(() => useSessionState(), { wrapper });
      act(() => {
        result.current.addMessage({
          role: "yoi",
          content: "静かだね〜",
          triggerType: "SILENCE_KILLER",
        });
      });
      expect(result.current.state.messages[0].triggerType).toBe(
        "SILENCE_KILLER"
      );
    });
  });

  describe("乾杯カウント", () => {
    it("incrementKanpaiCountで乾杯回数をインクリメントできる", () => {
      const { result } = renderHook(() => useSessionState(), { wrapper });
      act(() => {
        result.current.incrementKanpaiCount();
      });
      expect(result.current.state.kanpaiCount).toBe(1);
      act(() => {
        result.current.incrementKanpaiCount();
      });
      expect(result.current.state.kanpaiCount).toBe(2);
    });
  });

  describe("酔度レベルの自動更新", () => {
    it("セッション開始から1/3経過で酔度レベル2になる", () => {
      const { result } = renderHook(() => useSessionState(), { wrapper });
      // セッションを開始（sessionStartTimeが設定される）
      act(() => {
        result.current.startSession();
      });
      expect(result.current.state.drunkLevel).toBe(1);

      // 40分経過（デフォルト2時間セッションの1/3 = 40分）
      act(() => {
        vi.advanceTimersByTime(40 * 60 * 1000);
      });
      // updateDrunkLevelを呼ぶ
      act(() => {
        result.current.updateDrunkLevel();
      });
      expect(result.current.state.drunkLevel).toBe(2);
    });

    it("セッション開始から2/3経過で酔度レベル3になる", () => {
      const { result } = renderHook(() => useSessionState(), { wrapper });
      act(() => {
        result.current.startSession();
      });

      // 80分経過
      act(() => {
        vi.advanceTimersByTime(80 * 60 * 1000);
      });
      act(() => {
        result.current.updateDrunkLevel();
      });
      expect(result.current.state.drunkLevel).toBe(3);
    });
  });

  describe("ヨイさん画像キー切り替え", () => {
    it("酔度レベルに応じてベース画像が変わる", () => {
      const { result } = renderHook(() => useSessionState(), { wrapper });
      expect(result.current.state.currentYoiImage).toBe("drunk_1");

      act(() => {
        result.current.startSession();
      });
      act(() => {
        vi.advanceTimersByTime(40 * 60 * 1000);
      });
      act(() => {
        result.current.updateDrunkLevel();
      });
      expect(result.current.state.currentYoiImage).toBe("drunk_2");
    });

    it("setTemporaryYoiImageでトリガー専用画像に一時切り替えできる", () => {
      const { result } = renderHook(() => useSessionState(), { wrapper });
      act(() => {
        result.current.setTemporaryYoiImage("kanpai");
      });
      expect(result.current.state.currentYoiImage).toBe("kanpai");
    });

    it("resetYoiImageで酔度レベルベースの画像に復帰できる", () => {
      const { result } = renderHook(() => useSessionState(), { wrapper });
      act(() => {
        result.current.setTemporaryYoiImage("kanpai");
      });
      expect(result.current.state.currentYoiImage).toBe("kanpai");
      act(() => {
        result.current.resetYoiImage();
      });
      expect(result.current.state.currentYoiImage).toBe("drunk_1");
    });
  });

  describe("lastSpeechTime", () => {
    it("updateLastSpeechTimeで最終発話時間を更新できる", () => {
      const { result } = renderHook(() => useSessionState(), { wrapper });
      const now = Date.now();
      act(() => {
        result.current.updateLastSpeechTime();
      });
      expect(result.current.state.lastSpeechTime).toBeGreaterThanOrEqual(now);
    });
  });

  describe("セッション開始", () => {
    it("startSessionでsessionStartTimeが設定される", () => {
      const { result } = renderHook(() => useSessionState(), { wrapper });
      expect(result.current.state.sessionStartTime).toBe(0);
      const now = Date.now();
      act(() => {
        result.current.startSession();
      });
      expect(result.current.state.sessionStartTime).toBeGreaterThanOrEqual(
        now
      );
    });

    it("startSessionでフェーズがIDLEになる", () => {
      const { result } = renderHook(() => useSessionState(), { wrapper });
      act(() => {
        result.current.startSession();
      });
      expect(result.current.state.phase).toBe("IDLE");
    });
  });
});
