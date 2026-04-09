import { describe, it, expect } from "vitest";
import { clampYoiResponse, shouldSkipGenerate } from "../yoi-response";

describe("clampYoiResponse", () => {
  it("maxChars 以内ならそのまま返す", () => {
    const result = clampYoiResponse("わしはヨイじゃ！", 40);
    expect(result.text).toBe("わしはヨイじゃ！");
    expect(result.truncated).toBe(false);
    expect(result.originalLength).toBe(8);
  });

  it("句点（。）で自然に切り詰める", () => {
    const input =
      "今日はいい天気だね。とりあえず飲もうよ！わしはビール3杯目じゃ。";
    const result = clampYoiResponse(input, 12);
    expect(result.truncated).toBe(true);
    expect(result.text).toBe("今日はいい天気だね。");
    expect(Array.from(result.text).length).toBeLessThanOrEqual(12);
  });

  it("感嘆符・疑問符でも切り詰められる", () => {
    const input = "本当に？そうかもね。でも飲もう！まじで？";
    const result = clampYoiResponse(input, 10);
    expect(result.truncated).toBe(true);
    expect(result.text).toBe("本当に？そうかもね。");
  });

  it("句読点が無い場合は末尾に「…」を付与し maxChars を超えない", () => {
    const input = "あいうえおかきくけこさしすせそたちつてと";
    const result = clampYoiResponse(input, 10);
    expect(result.truncated).toBe(true);
    expect(result.text.endsWith("…")).toBe(true);
    expect(Array.from(result.text).length).toBeLessThanOrEqual(10);
  });

  it("絵文字（サロゲートペア）混在でも文字数が破綻しない", () => {
    const input = "🍺🍺🍺🍺🍺かんぱい！🍻🍻🍻🍻";
    const result = clampYoiResponse(input, 10);
    expect(Array.from(result.text).length).toBeLessThanOrEqual(10);
    expect(result.truncated).toBe(true);
    expect(result.text).toBe("🍺🍺🍺🍺🍺かんぱい！");
  });

  it("maxChars が不正（10未満）の場合は既定値 40 にフォールバック", () => {
    const input = "あいうえお";
    const result = clampYoiResponse(input, 0);
    expect(result.text).toBe("あいうえお");
    expect(result.truncated).toBe(false);
  });

  it("波ダッシュ（〜）でも切り詰められる", () => {
    const input = "なるほどね〜そうなんだ〜まじで飲もう〜";
    const result = clampYoiResponse(input, 12);
    expect(result.truncated).toBe(true);
    expect(result.text).toBe("なるほどね〜そうなんだ〜");
  });
});

describe("shouldSkipGenerate", () => {
  const base = {
    isProcessing: false,
    isPlaying: false,
    lastYoiSpeakAt: 0,
    now: 100_000,
    aiCooldownSec: 15,
  };

  it("処理中なら processing を返す", () => {
    expect(shouldSkipGenerate({ ...base, isProcessing: true })).toBe(
      "processing"
    );
  });

  it("再生中なら speaking を返す", () => {
    expect(shouldSkipGenerate({ ...base, isPlaying: true })).toBe("speaking");
  });

  it("クールダウン中なら cooldown を返す", () => {
    expect(
      shouldSkipGenerate({ ...base, lastYoiSpeakAt: base.now - 5_000 })
    ).toBe("cooldown");
  });

  it("クールダウンが明けていれば通過する", () => {
    expect(
      shouldSkipGenerate({ ...base, lastYoiSpeakAt: base.now - 16_000 })
    ).toBeNull();
  });

  it("lastYoiSpeakAt が 0（初回）なら通過する", () => {
    expect(shouldSkipGenerate(base)).toBeNull();
  });

  it("processing が最優先で判定される", () => {
    expect(
      shouldSkipGenerate({
        ...base,
        isProcessing: true,
        isPlaying: true,
        lastYoiSpeakAt: base.now - 1_000,
      })
    ).toBe("processing");
  });
});
