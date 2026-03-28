"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SpeechRecognitionErrorType =
  | "not-allowed"
  | "no-speech"
  | "audio-capture"
  | "network"
  | "service-not-available";

interface SpeechRecognitionState {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  error: SpeechRecognitionErrorType | null;
}

interface UseSpeechRecognitionReturn extends SpeechRecognitionState {
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

const RECONNECT_DELAY_MS = 200;

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

    return () => {
      desiredListeningRef.current = false;
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
    startListening,
    stopListening,
    resetTranscript,
  };
}
