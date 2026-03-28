"use client";

import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";

interface ConfettiEffectProps {
  trigger: boolean;
}

export function ConfettiEffect({ trigger }: ConfettiEffectProps) {
  const prevTriggerRef = useRef(false);

  useEffect(() => {
    if (trigger && !prevTriggerRef.current) {
      confetti({
        particleCount: 150,
        spread: 90,
        origin: { y: 0.6 },
        colors: ["#f59e0b", "#d97706", "#fbbf24", "#ffffff", "#92400e"],
      });
    }
    prevTriggerRef.current = trigger;
  }, [trigger]);

  return null;
}
