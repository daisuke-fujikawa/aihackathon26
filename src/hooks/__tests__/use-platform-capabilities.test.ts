import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePlatformCapabilities } from "../use-platform-capabilities";

const originalUA = navigator.userAgent;
const originalPlatform = navigator.platform;

function setUserAgent(ua: string, platform = "Win32", maxTouchPoints = 0) {
  Object.defineProperty(navigator, "userAgent", {
    value: ua,
    configurable: true,
  });
  Object.defineProperty(navigator, "platform", {
    value: platform,
    configurable: true,
  });
  Object.defineProperty(navigator, "maxTouchPoints", {
    value: maxTouchPoints,
    configurable: true,
  });
}

beforeEach(() => {
  // Provide AudioContext & webkitSpeechRecognition shims
  // @ts-expect-error mock
  globalThis.AudioContext = function () {};
  // @ts-expect-error mock
  globalThis.webkitSpeechRecognition = function () {};
});

afterEach(() => {
  setUserAgent(originalUA, originalPlatform, 0);
  // @ts-expect-error cleanup
  delete globalThis.AudioContext;
  // @ts-expect-error cleanup
  delete globalThis.webkitSpeechRecognition;
});

describe("usePlatformCapabilities", () => {
  it("iPhone Safari を ios-safari として分類する", () => {
    setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
    );
    const { result } = renderHook(() => usePlatformCapabilities());
    expect(result.current.capabilities.kind).toBe("ios-safari");
    expect(result.current.capabilities.isMobile).toBe(true);
    expect(result.current.capabilities.requiresUserGestureUnlock).toBe(true);
  });

  it("Android Chrome を android-chrome として分類する", () => {
    setUserAgent(
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      "Linux armv8l"
    );
    const { result } = renderHook(() => usePlatformCapabilities());
    expect(result.current.capabilities.kind).toBe("android-chrome");
    expect(result.current.capabilities.isMobile).toBe(true);
    expect(result.current.capabilities.requiresUserGestureUnlock).toBe(true);
  });

  it("デスクトップ Chrome を desktop として分類する", () => {
    setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "MacIntel",
      0
    );
    const { result } = renderHook(() => usePlatformCapabilities());
    expect(result.current.capabilities.kind).toBe("desktop");
    expect(result.current.capabilities.isMobile).toBe(false);
    expect(result.current.capabilities.requiresUserGestureUnlock).toBe(false);
  });

  it("Web Audio / Web Speech のサポートを検知する", () => {
    setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0"
    );
    const { result } = renderHook(() => usePlatformCapabilities());
    expect(result.current.capabilities.webAudioSupported).toBe(true);
    expect(result.current.capabilities.webSpeechSupported).toBe(true);
  });
});
