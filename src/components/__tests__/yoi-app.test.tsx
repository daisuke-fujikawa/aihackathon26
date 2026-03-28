import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { YoiApp } from "../yoi-app";

// canvas-confettiモック
vi.mock("canvas-confetti", () => ({
  default: vi.fn(),
}));

// next/imageモック
vi.mock("next/image", () => ({
  default: ({ alt, ...props }: { alt: string; [key: string]: unknown }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
}));

beforeEach(() => {
  // webkitSpeechRecognition モック
  // @ts-expect-error mock
  globalThis.webkitSpeechRecognition = function () {
    return {
      lang: "",
      continuous: false,
      interimResults: false,
      onresult: null,
      onerror: null,
      onend: null,
      onstart: null,
      start: vi.fn(),
      stop: vi.fn(),
      abort: vi.fn(),
    };
  };
});

describe("YoiApp 統合", () => {
  it("初期表示でセットアップ画面が表示される", () => {
    render(<YoiApp />);
    expect(screen.getByText(/AI幹事ヨイさん/)).toBeDefined();
    expect(screen.getByPlaceholderText(/名前/)).toBeDefined();
  });

  it("参加者を追加してセッション開始するとメイン画面に遷移する", () => {
    render(<YoiApp />);

    const input = screen.getByPlaceholderText(/名前/);
    const addBtn = screen.getByRole("button", { name: /追加/ });

    fireEvent.change(input, { target: { value: "太郎" } });
    fireEvent.click(addBtn);

    const startBtn = screen.getByRole("button", { name: /開始/ });
    fireEvent.click(startBtn);

    // メイン画面に遷移
    expect(screen.getByTestId("mic-indicator")).toBeDefined();
    expect(screen.getByText(/太郎/)).toBeDefined();
  });

  it("メイン画面でマイクボタンが表示される", () => {
    render(<YoiApp />);

    // セットアップ完了
    const input = screen.getByPlaceholderText(/名前/);
    const addBtn = screen.getByRole("button", { name: /追加/ });
    fireEvent.change(input, { target: { value: "花子" } });
    fireEvent.click(addBtn);
    fireEvent.click(screen.getByRole("button", { name: /開始/ }));

    // マイクインジケーター
    const mic = screen.getByTestId("mic-indicator");
    expect(mic).toBeDefined();
    expect(mic.textContent).toContain("停止中");
  });
});
