"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type UnlockResult =
  | { status: "unlocked" }
  | {
      status: "failed";
      reason: "not-supported" | "resume-rejected" | "unknown";
      error?: Error;
    };

export type PlaybackError =
  | { type: "decode-failed"; error: Error }
  | { type: "playback-failed"; error: Error }
  | { type: "context-suspended" };

export interface AudioPlayerState {
  isPlaying: boolean;
  progress: number; // 0.0-1.0
  isUnlocked: boolean;
  lastError: PlaybackError | null;
}

interface UseAudioPlayerOptions {
  onComplete?: () => void;
}

export interface UseAudioPlayerReturn extends AudioPlayerState {
  unlock: () => Promise<UnlockResult>;
  playAudio: (audioBuffer: ArrayBuffer) => Promise<void>;
  stopAudio: () => void;
  clearError: () => void;
}

function getAudioContextCtor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  if (typeof window.AudioContext !== "undefined") {
    return window.AudioContext;
  }
  const webkitCtor = (window as unknown as { webkitAudioContext?: typeof AudioContext })
    .webkitAudioContext;
  return webkitCtor ?? null;
}

function debugLog(...args: unknown[]) {
  if (process.env.NODE_ENV !== "production") {
    console.debug("[useAudioPlayer]", ...args);
  }
}

export function useAudioPlayer(
  options?: UseAudioPlayerOptions
): UseAudioPlayerReturn {
  const [state, setState] = useState<AudioPlayerState>({
    isPlaying: false,
    progress: 0,
    isUnlocked: false,
    lastError: null,
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const onCompleteRef = useRef(options?.onComplete);
  onCompleteRef.current = options?.onComplete;
  const recoveryAttemptedRef = useRef(false);

  const stopAudio = useCallback(() => {
    const source = sourceRef.current;
    if (source) {
      try {
        source.onended = null;
        source.stop();
      } catch {
        // already stopped
      }
      try {
        source.disconnect();
      } catch {
        // ignore
      }
    }
    sourceRef.current = null;
    setState((prev) => ({ ...prev, isPlaying: false, progress: 0 }));
  }, []);

  const unlock = useCallback(async (): Promise<UnlockResult> => {
    const Ctor = getAudioContextCtor();
    if (!Ctor) {
      debugLog("unlock: AudioContext not supported");
      return { status: "failed", reason: "not-supported" };
    }

    try {
      // Reuse existing context if already unlocked
      if (audioContextRef.current && audioContextRef.current.state === "running") {
        setState((prev) => ({ ...prev, isUnlocked: true }));
        return { status: "unlocked" };
      }

      const ctx = audioContextRef.current ?? new Ctor({ latencyHint: "playback" });
      audioContextRef.current = ctx;

      if (ctx.state === "suspended") {
        try {
          await ctx.resume();
        } catch (error) {
          debugLog("unlock: resume rejected", error);
          return {
            status: "failed",
            reason: "resume-rejected",
            error: error as Error,
          };
        }
      }

      // Play a 1-sample silent buffer synchronously to fully unlock on iOS
      try {
        const silentBuffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = silentBuffer;
        source.connect(ctx.destination);
        source.start(0);
      } catch (error) {
        debugLog("unlock: silent buffer play failed", error);
        // Non-fatal; state may still be running
      }

      if (ctx.state !== "running") {
        debugLog("unlock: context not running after unlock", ctx.state);
        return { status: "failed", reason: "resume-rejected" };
      }

      setState((prev) => ({ ...prev, isUnlocked: true, lastError: null }));
      debugLog("unlock: success, state=", ctx.state);
      return { status: "unlocked" };
    } catch (error) {
      debugLog("unlock: unknown failure", error);
      return {
        status: "failed",
        reason: "unknown",
        error: error as Error,
      };
    }
  }, []);

  const playInternal = useCallback(
    async (arrayBuffer: ArrayBuffer): Promise<void> => {
      stopAudio();

      const Ctor = getAudioContextCtor();
      if (!Ctor) {
        throw new Error("AudioContext not supported");
      }

      // Prefer reusing unlocked context; create only as fallback (desktop)
      const audioContext =
        audioContextRef.current ?? new Ctor({ latencyHint: "playback" });
      audioContextRef.current = audioContext;

      // If suspended, attempt a best-effort resume (context may have been
      // suspended by backgrounding); do not create a new context here.
      if (audioContext.state === "suspended") {
        try {
          await audioContext.resume();
        } catch {
          throw new Error("AudioContext suspended");
        }
      }

      // ArrayBuffer → AudioBuffer
      let audioBuffer: AudioBuffer;
      try {
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        setState((prev) => ({
          ...prev,
          lastError: { type: "decode-failed", error: err },
        }));
        throw err;
      }

      // エフェクトチェーン: Source → BiquadFilter → Gain → Destination
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;

      // 酔っ払い風の揺らぎ
      source.playbackRate.value = 0.95 + Math.random() * 0.1;

      const biquadFilter = audioContext.createBiquadFilter();
      biquadFilter.type = "lowshelf";
      biquadFilter.frequency.value = 300;
      biquadFilter.gain.value = 3;

      const gainNode = audioContext.createGain();
      gainNode.gain.value = 1;

      source.connect(biquadFilter);
      biquadFilter.connect(gainNode);
      gainNode.connect(audioContext.destination);

      source.onended = () => {
        sourceRef.current = null;
        setState((prev) => ({ ...prev, isPlaying: false, progress: 0 }));
        onCompleteRef.current?.();
      };

      sourceRef.current = source;
      setState((prev) => ({
        ...prev,
        isPlaying: true,
        progress: 0,
        lastError: null,
      }));
      try {
        source.start();
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        setState((prev) => ({
          ...prev,
          isPlaying: false,
          lastError: { type: "playback-failed", error: err },
        }));
        throw err;
      }
    },
    [stopAudio]
  );

  const playAudio = useCallback(
    async (arrayBuffer: ArrayBuffer): Promise<void> => {
      try {
        await playInternal(arrayBuffer);
        recoveryAttemptedRef.current = false;
      } catch (error) {
        debugLog("playAudio failed", error);
        // 初回失敗時に限り、AudioContext 再生成で 1 度だけ自動リカバリ
        if (!recoveryAttemptedRef.current) {
          recoveryAttemptedRef.current = true;
          debugLog("attempting recovery by recreating AudioContext");
          try {
            audioContextRef.current?.close?.();
          } catch {
            // ignore
          }
          audioContextRef.current = null;
          const Ctor = getAudioContextCtor();
          if (Ctor) {
            try {
              const ctx = new Ctor({ latencyHint: "playback" });
              audioContextRef.current = ctx;
              if (ctx.state === "suspended") {
                await ctx.resume().catch(() => undefined);
              }
              await playInternal(arrayBuffer);
              return;
            } catch (recoveryError) {
              debugLog("recovery failed", recoveryError);
            }
          }
        }
        throw error;
      }
    },
    [playInternal]
  );

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, lastError: null }));
  }, []);

  useEffect(() => {
    return () => {
      stopAudio();
      try {
        audioContextRef.current?.close?.();
      } catch {
        // ignore
      }
      audioContextRef.current = null;
    };
  }, [stopAudio]);

  return {
    ...state,
    unlock,
    playAudio,
    stopAudio,
    clearError,
  };
}
