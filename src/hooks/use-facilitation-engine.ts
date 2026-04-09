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
  /** 直近のヨイさん発話時刻（unix ms）。0 は未発話。 */
  lastYoiSpeakAt?: number;
  /** ヨイさんの発話クールダウン秒数。 */
  aiCooldownSec?: number;
}

const CHECK_INTERVAL_MS = 3000;

/** 直近にユーザー発話があれば「会話が弾んでいる」と判定する猶予秒数。 */
const BALANCED_RECENT_SPEECH_WINDOW_MS = 5000;
/** バランス良好時の pass 閾値の引き上げ倍率。 */
const BALANCED_PASS_INTERVAL_MULTIPLIER = 1.5;

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
    lastYoiSpeakAt = 0,
    aiCooldownSec = 0,
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

      // クールダウン中は自動介入を一切発火しない
      if (
        aiCooldownSec > 0 &&
        lastYoiSpeakAt > 0 &&
        now - lastYoiSpeakAt < aiCooldownSec * 1000
      ) {
        console.info("yoi.facilitation.cooldown", {
          sinceLastSpeakMs: now - lastYoiSpeakAt,
        });
        return;
      }

      // 会話が弾んでいるか（直近 5 秒以内に発話があるか）
      const isConversationBalanced =
        now - lastSpeechTime < BALANCED_RECENT_SPEECH_WINDOW_MS;

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
      // 会話が弾んでいる場合は閾値を引き上げて控えめに
      const effectivePassIntervalMs =
        config.passIntervalSec *
        1000 *
        (isConversationBalanced ? BALANCED_PASS_INTERVAL_MULTIPLIER : 1);
      if (
        participants.length > 0 &&
        now - lastPassTimeRef.current > effectivePassIntervalMs
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
    lastYoiSpeakAt,
    aiCooldownSec,
  ]);

  const triggerGoHomeRemind = useCallback((keyword: string) => {
    onTriggerRef.current({
      type: "GO_HOME_REMIND",
      detectedKeyword: keyword,
    });
  }, []);

  return { triggerGoHomeRemind };
}
