"use client";

import { useState } from "react";

export type PlatformKind =
  | "ios-safari"
  | "android-chrome"
  | "desktop"
  | "unknown";

export interface PlatformCapabilities {
  kind: PlatformKind;
  isMobile: boolean;
  webAudioSupported: boolean;
  webSpeechSupported: boolean;
  requiresUserGestureUnlock: boolean;
}

export interface UsePlatformCapabilitiesReturn {
  capabilities: PlatformCapabilities;
}

const DEFAULT_CAPABILITIES: PlatformCapabilities = {
  kind: "unknown",
  isMobile: false,
  webAudioSupported: true,
  webSpeechSupported: true,
  requiresUserGestureUnlock: false,
};

function detectPlatform(): PlatformCapabilities {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return DEFAULT_CAPABILITIES;
  }

  const ua = navigator.userAgent;
  // iOS Safari: iPhone/iPad/iPod, includes iPadOS which reports as MacIntel + touch
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" &&
      typeof navigator.maxTouchPoints === "number" &&
      navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);

  let kind: PlatformKind = "desktop";
  if (isIOS) kind = "ios-safari";
  else if (isAndroid) kind = "android-chrome";

  const isMobile = isIOS || isAndroid;

  const webAudioSupported =
    typeof window.AudioContext !== "undefined" ||
    typeof (window as unknown as { webkitAudioContext?: unknown })
      .webkitAudioContext !== "undefined";

  const webSpeechSupported =
    "webkitSpeechRecognition" in window || "SpeechRecognition" in window;

  return {
    kind,
    isMobile,
    webAudioSupported,
    webSpeechSupported,
    requiresUserGestureUnlock: isMobile,
  };
}

export function usePlatformCapabilities(): UsePlatformCapabilitiesReturn {
  // Lazy initializer: detect once on mount. SSR-safe because detectPlatform()
  // returns defaults when `window` is undefined.
  const [capabilities] = useState<PlatformCapabilities>(() => detectPlatform());

  return { capabilities };
}
