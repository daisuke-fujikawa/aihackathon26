"use client";

import { useCallback, useRef, useState } from "react";

export interface AudioPlayerState {
  isPlaying: boolean;
  progress: number; // 0.0-1.0
}

interface UseAudioPlayerOptions {
  onComplete?: () => void;
}

export interface UseAudioPlayerReturn extends AudioPlayerState {
  playAudio: (audioBuffer: ArrayBuffer) => Promise<void>;
  stopAudio: () => void;
  initAudioContext: () => Promise<void>;
}

export function useAudioPlayer(
  options?: UseAudioPlayerOptions
): UseAudioPlayerReturn {
  const [state, setState] = useState<AudioPlayerState>({
    isPlaying: false,
    progress: 0,
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const onCompleteRef = useRef(options?.onComplete);
  onCompleteRef.current = options?.onComplete;

  // ユーザーのジェスチャー中に呼ぶことでブラウザの自動再生ポリシーをアンロック
  const initAudioContext = useCallback(async () => {
    const ctx = audioContextRef.current ?? new AudioContext();
    audioContextRef.current = ctx;
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
  }, []);

  const stopAudio = useCallback(() => {
    try {
      sourceRef.current?.stop();
    } catch {
      // ignore if already stopped
    }
    sourceRef.current = null;
    setState({ isPlaying: false, progress: 0 });
  }, []);

  const playAudio = useCallback(
    async (arrayBuffer: ArrayBuffer) => {
      // 前の再生を停止
      stopAudio();

      const audioContext =
        audioContextRef.current ?? new AudioContext();
      audioContextRef.current = audioContext;

      // ブラウザの自動再生ポリシーで suspended になっている場合に再開
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      // ArrayBuffer → AudioBuffer
      const audioBuffer = await audioContext.decodeAudioData(
        arrayBuffer.slice(0)
      );

      // エフェクトチェーン: Source → BiquadFilter → Gain → Destination
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;

      // 酔っ払い風の揺らぎ: playbackRate を 0.95-1.05 のランダム値に
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
        setState({ isPlaying: false, progress: 0 });
        onCompleteRef.current?.();
      };

      sourceRef.current = source;
      setState({ isPlaying: true, progress: 0 });
      source.start();
    },
    [stopAudio]
  );

  return {
    ...state,
    playAudio,
    stopAudio,
    initAudioContext,
  };
}
