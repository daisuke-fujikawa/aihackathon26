"use client";

import type { PlatformCapabilities } from "@/hooks/use-platform-capabilities";
import type { PlaybackError } from "@/hooks/use-audio-player";
import type { SpeechRecognitionErrorType } from "@/hooks/use-speech-recognition";

interface MobileReadinessBannerProps {
  capabilities: PlatformCapabilities;
  playbackError: PlaybackError | null;
  speechError: SpeechRecognitionErrorType | null;
  showGuidance?: boolean;
  onRetryPlayback?: () => void;
  onDismissGuidance?: () => void;
}

type BannerKind = "playback" | "speech" | "guidance" | "unsupported";

interface BannerContent {
  kind: BannerKind;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  tone: "error" | "info";
}

function resolveBanner(
  props: MobileReadinessBannerProps
): BannerContent | null {
  const {
    capabilities,
    playbackError,
    speechError,
    showGuidance,
    onRetryPlayback,
    onDismissGuidance,
  } = props;

  // Priority 1: Web Audio / Web Speech の未サポート通知
  if (!capabilities.webAudioSupported) {
    return {
      kind: "unsupported",
      message:
        "このブラウザは音声再生に未対応です。Chrome または Safari でご利用ください。",
      tone: "error",
    };
  }

  // Priority 2: playback error
  if (playbackError) {
    let message = "音声の再生に失敗しました。";
    if (playbackError.type === "decode-failed") {
      message = "音声のデコードに失敗しました。もう一度お試しください。";
    } else if (playbackError.type === "context-suspended") {
      message = "画面をタップして音声を有効にしてください。";
    } else if (playbackError.type === "playback-failed") {
      message =
        "音声の再生に失敗しました。端末のサイレントモードを解除するか、再試行してください。";
    }
    return {
      kind: "playback",
      message,
      actionLabel: "再試行",
      onAction: onRetryPlayback,
      tone: "error",
    };
  }

  // Priority 3: speech error
  if (speechError) {
    if (speechError === "service-not-available" || !capabilities.webSpeechSupported) {
      return {
        kind: "speech",
        message:
          "このブラウザは音声認識に未対応です。Google Chrome で開いてください。",
        tone: "error",
      };
    }
    if (speechError === "not-allowed") {
      return {
        kind: "speech",
        message: "マイクの使用を許可してください",
        tone: "error",
      };
    }
    if (speechError === "mobile-recovery-failed") {
      return {
        kind: "speech",
        message: "マイクが停止しました。画面をタップして再開してください。",
        tone: "error",
      };
    }
  }

  // Priority 4: モバイルの初回ガイダンス
  if (showGuidance && capabilities.isMobile) {
    return {
      kind: "guidance",
      message: "画面をタップすると音声が有効になります",
      actionLabel: "閉じる",
      onAction: onDismissGuidance,
      tone: "info",
    };
  }

  return null;
}

export function MobileReadinessBanner(props: MobileReadinessBannerProps) {
  const banner = resolveBanner(props);
  if (!banner) return null;

  const toneClass =
    banner.tone === "error"
      ? "bg-red-900/70 text-red-100 border-red-700"
      : "bg-amber-900/60 text-amber-100 border-amber-700";

  return (
    <div
      role={banner.tone === "error" ? "alert" : "status"}
      className={`flex items-center justify-between gap-3 border-b px-4 py-2 text-sm ${toneClass}`}
    >
      <span className="flex-1">{banner.message}</span>
      {banner.actionLabel && banner.onAction && (
        <button
          type="button"
          onClick={banner.onAction}
          className="min-h-11 min-w-11 rounded-md border border-current px-3 py-1 text-xs font-semibold hover:bg-white/10"
        >
          {banner.actionLabel}
        </button>
      )}
    </div>
  );
}
