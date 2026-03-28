"use client";

import { useCallback, useRef, useState } from "react";

export interface AudioAnalyserState {
  volumeLevel: number; // 0.0-1.0 正規化音量
  totalSpeechTime: number; // 累積発話時間（秒）
  isSpeaking: boolean; // 現在発話中か
}

export interface UseAudioAnalyserReturn extends AudioAnalyserState {
  startAnalysing: () => Promise<void>;
  stopAnalysing: () => void;
}

const SPEECH_THRESHOLD = 0.15;

export function useAudioAnalyser(): UseAudioAnalyserReturn {
  const [state, setState] = useState<AudioAnalyserState>({
    volumeLevel: 0,
    totalSpeechTime: 0,
    isSpeaking: false,
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);

  const analyse = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);

    // 音量を正規化 (0.0-1.0)
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const average = sum / dataArray.length / 255;

    const now = performance.now();
    const deltaMs = lastFrameTimeRef.current
      ? now - lastFrameTimeRef.current
      : 0;
    lastFrameTimeRef.current = now;

    const speaking = average > SPEECH_THRESHOLD;

    setState((prev) => ({
      volumeLevel: average,
      isSpeaking: speaking,
      totalSpeechTime:
        prev.totalSpeechTime + (speaking ? deltaMs / 1000 : 0),
    }));

    rafRef.current = requestAnimationFrame(analyse);
  }, []);

  const startAnalysing = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;

    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    sourceRef.current = source;

    lastFrameTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(analyse);
  }, [analyse]);

  const stopAnalysing = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }

    sourceRef.current?.disconnect();
    sourceRef.current = null;

    analyserRef.current?.disconnect();
    analyserRef.current = null;

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    audioContextRef.current?.close();
    audioContextRef.current = null;
  }, []);

  return {
    ...state,
    startAnalysing,
    stopAnalysing,
  };
}
