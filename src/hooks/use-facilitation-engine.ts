"use client";

import { useCallback, useEffect, useRef } from "react";
import type { FacilitationConfig } from "@/providers/session-state-provider";

export type FacilitationTrigger =
  | { type: "SILENCE_KILLER"; silenceDurationSec: number }
  | { type: "PASS_TO_PARTICIPANT"; participantName: string }
  | { type: "GO_HOME_REMIND"; detectedKeyword: string }
  | {
      type: "BREAK_SUGGEST";
      reason: "time_elapsed" | "kanpai_count" | "natural_pause";
    };

interface FacilitationEngineOptions {
  config: FacilitationConfig;
  participants: string[];
  isListening: boolean;
  isProcessing: boolean;
  lastSpeechTime: number;
  sessionStartTime: number;
  kanpaiCount: number;
  onTrigger: (trigger: FacilitationTrigger) => void;
}

const CHECK_INTERVAL_MS = 3000;

export function useFacilitationEngine(options: FacilitationEngineOptions) {
  const {
    config,
    participants,
    isListening,
    isProcessing,
    lastSpeechTime,
    sessionStartTime,
    kanpaiCount,
    onTrigger,
  } = options;

  const onTriggerRef = useRef(onTrigger);
  onTriggerRef.current = onTrigger;

  const lastPassTimeRef = useRef(0);
  const breakSuggestedRef = useRef(false);
  const kanpaiBreakSuggestedRef = useRef(false);
  const lastSilenceTriggeredRef = useRef(0);

  // メインチェックループ
  useEffect(() => {
    if (!isListening || isProcessing) return;

    const interval = setInterval(() => {
      const now = Date.now();

      // 沈黙キラー: 最終発話から閾値秒超過
      const silenceSec = (now - lastSpeechTime) / 1000;
      if (
        silenceSec > config.silenceThresholdSec &&
        now - lastSilenceTriggeredRef.current > config.silenceThresholdSec * 1000
      ) {
        lastSilenceTriggeredRef.current = now;
        onTriggerRef.current({
          type: "SILENCE_KILLER",
          silenceDurationSec: Math.floor(silenceSec),
        });
        return; // 一度に1トリガーのみ
      }

      // パス出し: 一定間隔で参加者に振る
      if (
        participants.length > 0 &&
        now - lastPassTimeRef.current > config.passIntervalSec * 1000
      ) {
        lastPassTimeRef.current = now;
        const randomIdx = Math.floor(Math.random() * participants.length);
        onTriggerRef.current({
          type: "PASS_TO_PARTICIPANT",
          participantName: participants[randomIdx],
        });
        return;
      }

      // 休憩提案 (時間経過): セッション開始からの経過時間
      if (sessionStartTime > 0 && !breakSuggestedRef.current) {
        const elapsedMin = (now - sessionStartTime) / 1000 / 60;
        if (elapsedMin >= config.breakIntervalMin) {
          breakSuggestedRef.current = true;
          onTriggerRef.current({
            type: "BREAK_SUGGEST",
            reason: "time_elapsed",
          });
          return;
        }
      }

      // 休憩提案 (乾杯回数)
      if (
        kanpaiCount >= config.kanpaiBreakThreshold &&
        !kanpaiBreakSuggestedRef.current
      ) {
        kanpaiBreakSuggestedRef.current = true;
        onTriggerRef.current({
          type: "BREAK_SUGGEST",
          reason: "kanpai_count",
        });
        return;
      }
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [
    isListening,
    isProcessing,
    lastSpeechTime,
    sessionStartTime,
    kanpaiCount,
    participants,
    config,
  ]);

  const triggerGoHomeRemind = useCallback((keyword: string) => {
    onTriggerRef.current({
      type: "GO_HOME_REMIND",
      detectedKeyword: keyword,
    });
  }, []);

  return { triggerGoHomeRemind };
}
