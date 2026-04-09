import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import {
  BeerJugVisualizer,
  computeDrain,
  MAX_DURATION,
  KANPAI_DRAIN,
} from "../beer-jug-visualizer";

// --- computeDrain 単体テスト ---
describe("computeDrain", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sessionStartTime <= 0 の場合は0を返す", () => {
    expect(computeDrain(0, 0)).toBe(0);
    expect(computeDrain(-1, 5)).toBe(0);
  });

  it("経過時間0秒・乾杯0回で0を返す", () => {
    const now = Date.now();
    expect(computeDrain(now, 0)).toBeCloseTo(0, 1);
  });

  it("5分経過で1杯分（1.0）のドレインになる", () => {
    const now = Date.now();
    const startTime = now - MAX_DURATION * 1000; // 5分前
    expect(computeDrain(startTime, 0)).toBeCloseTo(1.0, 1);
  });

  it("10分経過で2杯分のドレインになる", () => {
    const now = Date.now();
    const startTime = now - MAX_DURATION * 2 * 1000;
    expect(computeDrain(startTime, 0)).toBeCloseTo(2.0, 1);
  });

  it("2.5分経過で0.5杯分のドレインになる", () => {
    const now = Date.now();
    const startTime = now - (MAX_DURATION / 2) * 1000;
    expect(computeDrain(startTime, 0)).toBeCloseTo(0.5, 1);
  });

  it("乾杯1回で0.3のドレインが追加される", () => {
    const now = Date.now();
    expect(computeDrain(now, 1)).toBeCloseTo(KANPAI_DRAIN, 1);
  });

  it("乾杯4回で1.2のドレインになる（経過時間0）", () => {
    const now = Date.now();
    expect(computeDrain(now, 4)).toBeCloseTo(4 * KANPAI_DRAIN, 1);
  });

  it("時間経過と乾杯の合算が正しい", () => {
    const now = Date.now();
    const startTime = now - MAX_DURATION * 1000; // 5分前 → 1.0
    // 1.0 (時間) + 0.9 (乾杯3回) = 1.9
    expect(computeDrain(startTime, 3)).toBeCloseTo(1.9, 1);
  });
});

// --- BeerJugVisualizer コンポーネントテスト ---
describe("BeerJugVisualizer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("アクティブジョッキ（canvas）が表示される", () => {
    render(
      <BeerJugVisualizer
        volumeLevel={0}
        kanpaiCount={0}
        sessionStartTime={Date.now()}
      />
    );
    expect(screen.getByTestId("beer-jug")).toBeDefined();
  });

  it("コンテナ要素が表示される", () => {
    render(
      <BeerJugVisualizer
        volumeLevel={0}
        kanpaiCount={0}
        sessionStartTime={Date.now()}
      />
    );
    expect(screen.getByTestId("beer-jug-container")).toBeDefined();
  });

  it("セッション未開始時（sessionStartTime=0）は空ジョッキが0個", () => {
    const { container } = render(
      <BeerJugVisualizer
        volumeLevel={0}
        kanpaiCount={0}
        sessionStartTime={0}
      />
    );
    const allCanvases = container.querySelectorAll("canvas");
    // アクティブジョッキ1個のみ
    expect(allCanvases.length).toBe(1);
  });

  it("乾杯4回で空ジョッキが1個表示される", () => {
    // 4 * 0.3 = 1.2 → floor(1.2) = 1
    const { container } = render(
      <BeerJugVisualizer
        volumeLevel={0}
        kanpaiCount={4}
        sessionStartTime={Date.now()}
      />
    );
    const allCanvases = container.querySelectorAll("canvas");
    // 空ジョッキ1個 + アクティブ1個 = 2個
    expect(allCanvases.length).toBe(2);
  });

  it("乾杯7回で空ジョッキが2個表示される", () => {
    // 7 * 0.3 = 2.1 → floor(2.1) = 2
    const { container } = render(
      <BeerJugVisualizer
        volumeLevel={0}
        kanpaiCount={7}
        sessionStartTime={Date.now()}
      />
    );
    const allCanvases = container.querySelectorAll("canvas");
    // 空ジョッキ2個 + アクティブ1個 = 3個
    expect(allCanvases.length).toBe(3);
  });

  it("乾杯10回で空ジョッキが3個表示される", () => {
    // 10 * 0.3 = 3.0 → floor(3.0) = 3
    const { container } = render(
      <BeerJugVisualizer
        volumeLevel={0}
        kanpaiCount={10}
        sessionStartTime={Date.now()}
      />
    );
    const allCanvases = container.querySelectorAll("canvas");
    expect(allCanvases.length).toBe(4);
  });

  it("5分経過で空ジョッキが1個表示される", () => {
    const fiveMinutesAgo = Date.now() - MAX_DURATION * 1000;
    const { container } = render(
      <BeerJugVisualizer
        volumeLevel={0}
        kanpaiCount={0}
        sessionStartTime={fiveMinutesAgo}
      />
    );
    const allCanvases = container.querySelectorAll("canvas");
    expect(allCanvases.length).toBe(2);
  });

  it("15分経過で空ジョッキが3個表示される", () => {
    const fifteenMinutesAgo = Date.now() - MAX_DURATION * 3 * 1000;
    const { container } = render(
      <BeerJugVisualizer
        volumeLevel={0}
        kanpaiCount={0}
        sessionStartTime={fifteenMinutesAgo}
      />
    );
    const allCanvases = container.querySelectorAll("canvas");
    expect(allCanvases.length).toBe(4);
  });

  it("時間経過と乾杯の組み合わせで空ジョッキが正しく表示される", () => {
    // 5分経過(1.0) + 乾杯4回(1.2) = 2.2 → floor = 2
    const fiveMinutesAgo = Date.now() - MAX_DURATION * 1000;
    const { container } = render(
      <BeerJugVisualizer
        volumeLevel={0}
        kanpaiCount={4}
        sessionStartTime={fiveMinutesAgo}
      />
    );
    const allCanvases = container.querySelectorAll("canvas");
    expect(allCanvases.length).toBe(3);
  });

  it("時間経過でインターバルにより空ジョッキが増える", () => {
    // 4分59秒前にスタート → まだ空ジョッキ0個
    const almostFiveMinutesAgo = Date.now() - (MAX_DURATION - 1) * 1000;
    const { container } = render(
      <BeerJugVisualizer
        volumeLevel={0}
        kanpaiCount={0}
        sessionStartTime={almostFiveMinutesAgo}
      />
    );
    expect(container.querySelectorAll("canvas").length).toBe(1);

    // 2秒進める → 5分超え → 空ジョッキ1個
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(container.querySelectorAll("canvas").length).toBe(2);
  });

  it("kanpaiCountの変更で即座に空ジョッキが更新される", () => {
    const { container, rerender } = render(
      <BeerJugVisualizer
        volumeLevel={0}
        kanpaiCount={0}
        sessionStartTime={Date.now()}
      />
    );
    expect(container.querySelectorAll("canvas").length).toBe(1);

    // 乾杯4回に更新 → 空ジョッキ1個追加
    rerender(
      <BeerJugVisualizer
        volumeLevel={0}
        kanpaiCount={4}
        sessionStartTime={Date.now()}
      />
    );
    expect(container.querySelectorAll("canvas").length).toBe(2);
  });
});
