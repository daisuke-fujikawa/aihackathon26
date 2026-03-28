import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SetupScreen } from "../setup-screen";
import { ChatPanel } from "../chat-panel";
import { MessageBubble } from "../message-bubble";
import { BeerJugVisualizer } from "../beer-jug-visualizer";
import { MicStatusIndicator } from "../mic-status-indicator";
import { ConfettiEffect } from "../confetti-effect";
import type { ChatMessage } from "@/providers/session-state-provider";

describe("SetupScreen", () => {
  it("参加者名入力フォームが表示される", () => {
    render(<SetupScreen onStart={vi.fn()} />);
    expect(screen.getByPlaceholderText(/名前/)).toBeDefined();
  });

  it("名前を追加して開始ボタンを押すとonStartが呼ばれる", () => {
    const onStart = vi.fn();
    render(<SetupScreen onStart={onStart} />);

    const input = screen.getByPlaceholderText(/名前/);
    const addButton = screen.getByRole("button", { name: /追加/ });

    fireEvent.change(input, { target: { value: "太郎" } });
    fireEvent.click(addButton);

    const startButton = screen.getByRole("button", { name: /開始/ });
    fireEvent.click(startButton);

    expect(onStart).toHaveBeenCalledWith(["太郎"]);
  });

  it("参加者が0人の場合開始ボタンが無効", () => {
    render(<SetupScreen onStart={vi.fn()} />);
    const startButton = screen.getByRole("button", { name: /開始/ });
    expect(startButton).toBeDisabled();
  });
});

describe("MessageBubble", () => {
  it("userロールのメッセージが表示される", () => {
    const msg: ChatMessage = {
      id: "1",
      role: "user",
      content: "こんにちは",
      timestamp: Date.now(),
    };
    render(<MessageBubble message={msg} />);
    expect(screen.getByText("こんにちは")).toBeDefined();
  });

  it("yoiロールのメッセージにアバターが表示される", () => {
    const msg: ChatMessage = {
      id: "2",
      role: "yoi",
      content: "わしはヨイじゃ！",
      timestamp: Date.now(),
      yoiImage: "drunk_1",
    };
    render(<MessageBubble message={msg} currentYoiImage="drunk_1" />);
    expect(screen.getByText("わしはヨイじゃ！")).toBeDefined();
    expect(screen.getByAltText(/ヨイさん/)).toBeDefined();
  });
});

describe("ChatPanel", () => {
  it("メッセージリストを表示する", () => {
    const messages: ChatMessage[] = [
      { id: "1", role: "user", content: "やあ", timestamp: Date.now() },
      {
        id: "2",
        role: "yoi",
        content: "ひっく",
        timestamp: Date.now(),
        yoiImage: "drunk_1",
      },
    ];
    render(<ChatPanel messages={messages} currentYoiImage="drunk_1" />);
    expect(screen.getByText("やあ")).toBeDefined();
    expect(screen.getByText("ひっく")).toBeDefined();
  });

  it("メッセージが空の場合もエラーなく表示される", () => {
    render(<ChatPanel messages={[]} currentYoiImage="drunk_1" />);
  });
});

describe("BeerJugVisualizer", () => {
  it("ビールジョッキが表示される", () => {
    render(
      <BeerJugVisualizer volumeLevel={0.5} totalSpeechTime={30} />
    );
    expect(screen.getByTestId("beer-jug")).toBeDefined();
  });

  it("音量レベルに応じて泡のスタイルが変化する", () => {
    const { rerender } = render(
      <BeerJugVisualizer volumeLevel={0} totalSpeechTime={0} />
    );
    const foam = screen.getByTestId("beer-foam");
    const initialHeight = foam.style.height;

    rerender(
      <BeerJugVisualizer volumeLevel={0.8} totalSpeechTime={10} />
    );
    // 音量が高いと泡の高さが変わる
    expect(foam.style.height).not.toBe(initialHeight);
  });
});

describe("MicStatusIndicator", () => {
  it("停止中状態が表示される", () => {
    render(
      <MicStatusIndicator phase="IDLE" onToggle={vi.fn()} />
    );
    expect(screen.getByTestId("mic-indicator")).toBeDefined();
  });

  it("クリックでonToggleが呼ばれる", () => {
    const onToggle = vi.fn();
    render(
      <MicStatusIndicator phase="IDLE" onToggle={onToggle} />
    );
    fireEvent.click(screen.getByTestId("mic-indicator"));
    expect(onToggle).toHaveBeenCalled();
  });

  it("LISTENING状態で録音中表示になる", () => {
    render(
      <MicStatusIndicator phase="LISTENING" onToggle={vi.fn()} />
    );
    const indicator = screen.getByTestId("mic-indicator");
    expect(indicator.textContent).toContain("録音中");
  });

  it("PROCESSING状態で処理中表示になる", () => {
    render(
      <MicStatusIndicator phase="PROCESSING" onToggle={vi.fn()} />
    );
    const indicator = screen.getByTestId("mic-indicator");
    expect(indicator.textContent).toContain("処理中");
  });

  it("SPEAKING状態で発話中表示になる", () => {
    render(
      <MicStatusIndicator phase="SPEAKING" onToggle={vi.fn()} />
    );
    const indicator = screen.getByTestId("mic-indicator");
    expect(indicator.textContent).toContain("発話中");
  });
});

describe("ConfettiEffect", () => {
  it("triggerがtrueの場合にconfettiが発火する", async () => {
    // canvas-confettiをモック
    vi.mock("canvas-confetti", () => ({
      default: vi.fn(),
    }));
    const confetti = await import("canvas-confetti");
    const mockConfetti = vi.mocked(confetti.default);

    render(<ConfettiEffect trigger={true} />);

    expect(mockConfetti).toHaveBeenCalled();
  });

  it("triggerがfalseの場合はconfettiが発火しない", async () => {
    vi.mock("canvas-confetti", () => ({
      default: vi.fn(),
    }));
    const confetti = await import("canvas-confetti");
    const mockConfetti = vi.mocked(confetti.default);
    mockConfetti.mockClear();

    render(<ConfettiEffect trigger={false} />);

    expect(mockConfetti).not.toHaveBeenCalled();
  });
});
