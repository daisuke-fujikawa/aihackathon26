"use client";

import { useCallback, useRef } from "react";

export type KeywordEvent =
  | { type: "KANPAI" }
  | { type: "GO_HOME"; keyword: string };

interface KeywordDetectorOptions {
  onKeyword: (event: KeywordEvent) => void;
  cooldownMs?: number;
}

const KANPAI_KEYWORDS = ["乾杯", "かんぱい", "カンパイ"];
const GO_HOME_KEYWORDS = ["終電", "明日", "何時", "駅"];
const DEFAULT_COOLDOWN_MS = 5000;

export function useKeywordDetector(options: KeywordDetectorOptions) {
  const { onKeyword, cooldownMs = DEFAULT_COOLDOWN_MS } = options;
  const onKeywordRef = useRef(onKeyword);
  onKeywordRef.current = onKeyword;

  const lastKanpaiTimeRef = useRef(0);
  const lastGoHomeTimeRef = useRef(0);

  const processText = useCallback(
    (text: string) => {
      if (!text) return;

      const now = Date.now();

      // 乾杯検出
      if (now - lastKanpaiTimeRef.current >= cooldownMs) {
        for (const keyword of KANPAI_KEYWORDS) {
          if (text.includes(keyword)) {
            lastKanpaiTimeRef.current = now;
            onKeywordRef.current({ type: "KANPAI" });
            break;
          }
        }
      }

      // 帰宅キーワード検出
      if (now - lastGoHomeTimeRef.current >= cooldownMs) {
        for (const keyword of GO_HOME_KEYWORDS) {
          if (text.includes(keyword)) {
            lastGoHomeTimeRef.current = now;
            onKeywordRef.current({ type: "GO_HOME", keyword });
            break;
          }
        }
      }
    },
    [cooldownMs]
  );

  return { processText };
}
