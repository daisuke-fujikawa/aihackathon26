"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SpeechRecognitionErrorType =
  | "not-allowed"
  | "no-speech"
  | "audio-capture"
  | "network"
  | "service-not-available"
  | "mobile-recovery-failed";

interface SpeechRecognitionState {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  error: SpeechRecognitionErrorType | null;
}

interface UseSpeechRecognitionReturn extends SpeechRecognitionState {
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

const RECONNECT_DELAY_MS = 200;
const MOBILE_RECOVERY_MAX_ATTEMPTS = 3;

// Chrome の webkitSpeechRecognition を取得
function getSpeechRecognitionCtor(): (new () => {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: { length: number; [i: number]: { isFinal: boolean; length: number; [j: number]: { transcript: string } } } }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}) | null {
  if (typeof globalThis !== "undefined" && "webkitSpeechRecognition" in globalThis) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (globalThis as any).webkitSpeechRecognition;
  }
  return null;
}

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [state, setState] = useState<SpeechRecognitionState>({
    isListening: false,
    transcript: "",
    interimTranscript: "",
    error: null,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const desiredListeningRef = useRef(false);
  const isStartedRef = useRef(false);
  const recoveryAttemptsRef = useRef(0);

  const SpeechRecognitionCtor = getSpeechRecognitionCtor();
  const isSupported = SpeechRecognitionCtor !== null;

  useEffect(() => {
    if (!isSupported || !SpeechRecognitionCtor) {
      setState((prev) => ({ ...prev, error: "service-not-available" }));
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "ja-JP";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      isStartedRef.current = true;
    };

    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      setState((prev) => ({
        ...prev,
        ...(finalTranscript
          ? { transcript: prev.transcript + finalTranscript }
          : {}),
        interimTranscript,
      }));
    };

    recognition.onerror = (event) => {
      const errorMap: Record<string, SpeechRecognitionErrorType> = {
        "not-allowed": "not-allowed",
        "no-speech": "no-speech",
        "audio-capture": "audio-capture",
        network: "network",
        "service-not-available": "service-not-available",
      };
      const mappedError = errorMap[event.error] || "network";
      setState((prev) => ({ ...prev, error: mappedError }));

      if (event.error === "not-allowed" || event.error === "audio-capture") {
        desiredListeningRef.current = false;
        setState((prev) => ({ ...prev, isListening: false }));
      }
    };

    recognition.onend = () => {
      isStartedRef.current = false;
      if (desiredListeningRef.current) {
        setTimeout(() => {
          if (desiredListeningRef.current && !isStartedRef.current) {
            try {
              recognition.start();
            } catch {
              // already started
            }
          }
        }, RECONNECT_DELAY_MS);
      }
    };

    recognitionRef.current = recognition;

    // visibilitychange 復帰時にマイクを再起動
    const handleVisibilityChange = () => {
      if (typeof document === "undefined") return;
      if (document.visibilityState !== "visible") return;
      if (!desiredListeningRef.current) return;
      if (isStartedRef.current) return;

      const attemptRestart = (attempt: number): void => {
        if (attempt > MOBILE_RECOVERY_MAX_ATTEMPTS) {
          setState((prev) => ({
            ...prev,
            error: "mobile-recovery-failed",
            isListening: false,
          }));
          desiredListeningRef.current = false;
          return;
        }
        try {
          recognition.start();
          recoveryAttemptsRef.current = 0;
        } catch {
          setTimeout(() => attemptRestart(attempt + 1), RECONNECT_DELAY_MS);
        }
      };
      attemptRestart(1);
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      desiredListeningRef.current = false;
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
      try {
        recognition.abort();
      } catch {
        // ignore
      }
    };
  }, [isSupported, SpeechRecognitionCtor]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || !isSupported) return;
    desiredListeningRef.current = true;
    setState((prev) => ({ ...prev, isListening: true, error: null }));
    try {
      recognitionRef.current.start();
    } catch {
      // already started
    }
  }, [isSupported]);

  const stopListening = useCallback(() => {
    desiredListeningRef.current = false;
    setState((prev) => ({ ...prev, isListening: false }));
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
  }, []);

  const resetTranscript = useCallback(() => {
    setState((prev) => ({
      ...prev,
      transcript: "",
      interimTranscript: "",
    }));
  }, []);

  return {
    ...state,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  };
}
