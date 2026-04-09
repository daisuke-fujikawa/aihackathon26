"use client";

import { useCallback, useRef } from "react";
import {
  SessionStateProvider,
  useSessionState,
} from "@/providers/session-state-provider";
import type {
  FacilitationTriggerType,
  YoiImageKey,
} from "@/providers/session-state-provider";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useAudioAnalyser } from "@/hooks/use-audio-analyser";
import { useAudioPlayer } from "@/hooks/use-audio-player";
import { useKeywordDetector } from "@/hooks/use-keyword-detector";
import type { KeywordEvent } from "@/hooks/use-keyword-detector";
import { useFacilitationEngine } from "@/hooks/use-facilitation-engine";
import type { FacilitationTrigger } from "@/hooks/use-facilitation-engine";
import { SetupScreen } from "./setup-screen";
import { ChatPanel } from "./chat-panel";
import { BeerJugVisualizer } from "./beer-jug-visualizer";
import { MicStatusIndicator } from "./mic-status-indicator";
import { ConfettiEffect } from "./confetti-effect";
import { fetchWithRetry } from "@/lib/retry";

const TRIGGER_IMAGE_MAP: Partial<Record<FacilitationTriggerType, YoiImageKey>> =
  {
    PASS_TO_PARTICIPANT: "pass",
    GO_HOME_REMIND: "clock",
    BREAK_SUGGEST: "restroom",
  };

function YoiAppInner() {
  const {
    state,
    setPhase,
    setParticipants,
    addMessage,
    incrementKanpaiCount,
    startSession,
    updateDrunkLevel,
    setTemporaryYoiImage,
    resetYoiImage,
    updateLastSpeechTime,
  } = useSessionState();

  const isProcessingRef = useRef(false);
  const kanpaiTriggerRef = useRef(false);

  // 音声認識の開始/停止をrefで保持（宣言順序の問題を回避）
  const startListeningRef = useRef<() => void>(() => {});
  const stopListeningRef = useRef<() => void>(() => {});

  // --- 音声再生フック ---
  const { isPlaying, playAudio } = useAudioPlayer({
    onComplete: () => {
      setPhase("LISTENING");
      resetYoiImage();
      // TTS再生完了後にマイク再開
      startListeningRef.current();
    },
  });

  // --- AI応答→TTS→再生 ---
  const generateAndSpeak = useCallback(
    async (
      message: string,
      triggerType?: FacilitationTriggerType,
      triggerContext?: string
    ) => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      setPhase("PROCESSING");

      // TTS再生中にマイクが自分の音声を拾わないよう認識を一時停止
      stopListeningRef.current();

      // トリガーに応じた画像切り替え
      if (triggerType && TRIGGER_IMAGE_MAP[triggerType]) {
        setTemporaryYoiImage(TRIGGER_IMAGE_MAP[triggerType]!);
      }

      try {
        // AI応答生成（3回リトライ、1秒間隔）
        const chatRes = await fetchWithRetry("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            participants: state.participants,
            recentMessages: state.messages.slice(-10),
            triggerType,
            triggerContext,
          }),
        });

        const { text } = await chatRes.json();

        // メッセージ追加
        addMessage({
          role: "yoi",
          content: text,
          triggerType,
          yoiImage: triggerType
            ? TRIGGER_IMAGE_MAP[triggerType]
            : undefined,
        });

        // TTS（3回リトライ、1秒間隔。失敗時はテキストのみ表示にフォールバック）
        setPhase("SPEAKING");
        try {
          const ttsRes = await fetchWithRetry("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
          });

          const audioBuffer = await ttsRes.arrayBuffer();
          await playAudio(audioBuffer);
        } catch {
          // TTS失敗: テキストのみ表示でリカバリ
          console.warn("TTS failed, falling back to text-only");
          setPhase("LISTENING");
          resetYoiImage();
          startListeningRef.current();
        }
      } catch (error) {
        console.error("generateAndSpeak error:", error);
        setPhase("LISTENING");
        resetYoiImage();
        startListeningRef.current();
      } finally {
        isProcessingRef.current = false;
      }
    },
    [
      state.participants,
      state.messages,
      setPhase,
      addMessage,
      playAudio,
      setTemporaryYoiImage,
      resetYoiImage,
    ]
  );

  // --- 音声認識 ---
  const {
    isListening,
    transcript,
    interimTranscript,
    error: speechError,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition();

  // refを最新の関数で更新
  startListeningRef.current = startListening;
  stopListeningRef.current = stopListening;

  // --- 音量計測 ---
  const { volumeLevel, totalSpeechTime } = useAudioAnalyser();

  // --- キーワード検出 ---
  const onKeyword = useCallback(
    (event: KeywordEvent) => {
      if (event.type === "KANPAI") {
        kanpaiTriggerRef.current = true;
        incrementKanpaiCount();
        setPhase("KANPAI");
        setTemporaryYoiImage("kanpai");

        // 乾杯演出後にLISTENINGに復帰
        setTimeout(() => {
          kanpaiTriggerRef.current = false;
          if (state.phase === "KANPAI") {
            setPhase("LISTENING");
            resetYoiImage();
          }
        }, 3000);
      } else if (event.type === "GO_HOME") {
        // ファシリテーションエンジンに委譲
        facilitationRef.current?.triggerGoHomeRemind(event.keyword);
      }
    },
    [incrementKanpaiCount, setPhase, setTemporaryYoiImage, resetYoiImage, state.phase]
  );

  const { processText } = useKeywordDetector({ onKeyword });

  // interimTranscriptの変化を監視してキーワード検出
  const prevInterimRef = useRef("");
  if (interimTranscript !== prevInterimRef.current) {
    prevInterimRef.current = interimTranscript;
    if (interimTranscript) {
      processText(interimTranscript);
    }
  }

  // 最終transcriptの変化を監視してAI応答生成（1.5秒デバウンス）
  const prevTranscriptRef = useRef("");
  const pendingTranscriptRef = useRef("");
  const transcriptDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  if (transcript !== prevTranscriptRef.current && transcript) {
    const newText = transcript.slice(prevTranscriptRef.current.length);
    prevTranscriptRef.current = transcript;
    if (newText.trim()) {
      updateLastSpeechTime();
      pendingTranscriptRef.current += (pendingTranscriptRef.current ? " " : "") + newText.trim();

      if (transcriptDebounceTimerRef.current) {
        clearTimeout(transcriptDebounceTimerRef.current);
      }
      transcriptDebounceTimerRef.current = setTimeout(() => {
        const fullText = pendingTranscriptRef.current.trim();
        pendingTranscriptRef.current = "";
        transcriptDebounceTimerRef.current = null;
        if (fullText) {
          addMessage({ role: "user", content: fullText });
          generateAndSpeak(fullText);
        }
      }, 1500);
    }
  }

  // --- ファシリテーションエンジン ---
  const onFacilitationTrigger = useCallback(
    (trigger: FacilitationTrigger) => {
      switch (trigger.type) {
        case "SILENCE_KILLER":
          generateAndSpeak("", "SILENCE_KILLER");
          break;
        case "PASS_TO_PARTICIPANT":
          generateAndSpeak("", "PASS_TO_PARTICIPANT", trigger.participantName);
          break;
        case "GO_HOME_REMIND":
          generateAndSpeak("", "GO_HOME_REMIND", trigger.detectedKeyword);
          break;
        case "BREAK_SUGGEST":
          generateAndSpeak("", "BREAK_SUGGEST", trigger.reason);
          break;
      }
    },
    [generateAndSpeak]
  );

  const facilitationRef = useRef<{ triggerGoHomeRemind: (kw: string) => void } | null>(null);
  const facilitation = useFacilitationEngine({
    config: state.facilitationConfig,
    participants: state.participants,
    isListening,
    isProcessing: isProcessingRef.current || isPlaying,
    lastSpeechTime: state.lastSpeechTime,
    sessionStartTime: state.sessionStartTime,
    kanpaiCount: state.kanpaiCount,
    onTrigger: onFacilitationTrigger,
  });
  facilitationRef.current = facilitation;

  // --- 酔度レベル自動更新（1分ごと） ---
  const drunkLevelIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  if (state.sessionStartTime > 0 && !drunkLevelIntervalRef.current) {
    drunkLevelIntervalRef.current = setInterval(() => {
      updateDrunkLevel();
    }, 60000);
  }

  // --- イベントハンドラ ---
  const handleStart = useCallback(
    (participants: string[]) => {
      setParticipants(participants);
      startSession();
    },
    [setParticipants, startSession]
  );

  const handleMicToggle = useCallback(() => {
    if (isListening) {
      stopListening();
      setPhase("IDLE");
    } else {
      startListening();
      setPhase("LISTENING");
      updateLastSpeechTime();
    }
  }, [isListening, startListening, stopListening, setPhase, updateLastSpeechTime]);

  // --- SETUP画面 ---
  if (state.phase === "SETUP") {
    return <SetupScreen onStart={handleStart} />;
  }

  // --- メイン画面 ---
  return (
    <div className="flex flex-1 flex-col h-screen">
      {/* ヘッダー */}
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/yoi/${state.currentYoiImage}.png`}
            alt="ヨイさん"
            width={56}
            height={56}
            className="rounded-full"
          />
          <span className="text-sm font-medium text-amber-400">
            ヨイさん
          </span>
        </div>
        <BeerJugVisualizer
          volumeLevel={volumeLevel}
          totalSpeechTime={totalSpeechTime}
        />
      </header>

      {/* チャットエリア */}
      <ChatPanel
        messages={state.messages}
        currentYoiImage={state.currentYoiImage}
      />

      {/* マイクエラー表示 */}
      {speechError === "not-allowed" && (
        <div className="bg-red-900/50 px-4 py-2 text-center text-sm text-red-200">
          マイクの使用を許可してください
        </div>
      )}
      {speechError === "service-not-available" && (
        <div className="bg-red-900/50 px-4 py-2 text-center text-sm text-red-200">
          Google Chromeで開いてください
        </div>
      )}

      {/* 中間認識テキスト表示 */}
      {interimTranscript && (
        <div className="border-t border-zinc-800 px-4 py-1 text-xs text-zinc-500">
          {interimTranscript}
        </div>
      )}

      {/* フッター */}
      <footer className="flex items-center justify-center gap-4 border-t border-zinc-800 px-4 py-3">
        <MicStatusIndicator phase={state.phase} onToggle={handleMicToggle} />
        <div className="text-xs text-zinc-600">
          参加者: {state.participants.join(", ")}
        </div>
      </footer>

      {/* 乾杯演出 */}
      <ConfettiEffect trigger={state.phase === "KANPAI"} />
    </div>
  );
}

export function YoiApp() {
  return (
    <SessionStateProvider>
      <YoiAppInner />
    </SessionStateProvider>
  );
}
