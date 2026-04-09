"use client";

import type { SessionPhase } from "@/providers/session-state-provider";

interface MicStatusIndicatorProps {
  phase: SessionPhase;
  onToggle: () => void;
}

const PHASE_CONFIG: Record<
  string,
  { label: string; icon: string; color: string; pulse: boolean }
> = {
  IDLE: { label: "停止中", icon: "🎤", color: "bg-zinc-700", pulse: false },
  LISTENING: {
    label: "録音中",
    icon: "🔴",
    color: "bg-red-900/60",
    pulse: true,
  },
  PROCESSING: {
    label: "処理中",
    icon: "⏳",
    color: "bg-amber-900/60",
    pulse: true,
  },
  SPEAKING: {
    label: "発話中",
    icon: "🔊",
    color: "bg-green-900/60",
    pulse: true,
  },
  SETUP: { label: "停止中", icon: "🎤", color: "bg-zinc-700", pulse: false },
  KANPAI: {
    label: "🎉 乾杯！",
    icon: "🍻",
    color: "bg-amber-600",
    pulse: true,
  },
};

export function MicStatusIndicator({ phase, onToggle }: MicStatusIndicatorProps) {
  const config = PHASE_CONFIG[phase] || PHASE_CONFIG.IDLE;

  return (
    <button
      data-testid="mic-indicator"
      onClick={onToggle}
      className={`flex min-h-11 min-w-11 items-center gap-2 rounded-full px-4 py-2 text-white transition ${config.color} ${
        config.pulse ? "animate-pulse" : ""
      } hover:opacity-80`}
    >
      <span className="text-lg">{config.icon}</span>
      <span className="text-sm font-medium">{config.label}</span>
    </button>
  );
}
