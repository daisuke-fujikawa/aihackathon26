"use client";

import { useState, type FormEvent } from "react";
import type { UnlockResult } from "@/hooks/use-audio-player";

interface SetupScreenProps {
  onStart: (participants: string[]) => void;
  onUnlockAudio?: () => Promise<UnlockResult>;
  isMobile?: boolean;
}

export function SetupScreen({
  onStart,
  onUnlockAudio,
  isMobile,
}: SetupScreenProps) {
  const [name, setName] = useState("");
  const [participants, setParticipants] = useState<string[]>([]);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const addParticipant = () => {
    const trimmed = name.trim();
    if (trimmed && !participants.includes(trimmed)) {
      setParticipants((prev) => [...prev, trimmed]);
      setName("");
    }
  };

  const removeParticipant = (target: string) => {
    setParticipants((prev) => prev.filter((p) => p !== target));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (participants.length === 0) return;

    // ユーザージェスチャー同期コールスタックで AudioContext unlock を起動。
    // 内部で resume() 等の await が走るが、AudioContext 生成自体は同期的に
    // 実行されるため iOS Safari でもジェスチャー要件を満たす。
    // 失敗時は useAudioPlayer.lastError 経由でバナーに通知される。
    if (onUnlockAudio) {
      onUnlockAudio()
        .then((result) => {
          if (result.status === "failed" && result.reason === "resume-rejected") {
            setUnlockError(
              "音声の有効化に失敗しました。画面をタップしてから再試行してください。"
            );
          }
        })
        .catch(() => {
          // errors surfaced via banner lastError
        });
    }

    setUnlockError(null);
    onStart(participants);
  };

  return (
    <div className="flex flex-1 items-center justify-center p-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-[max(env(safe-area-inset-top),1rem)]">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/yoi/drunk_1.png"
            alt="ヨイさん"
            width={120}
            height={120}
            className="mx-auto mb-4 rounded-full"
          />
          <h1 className="text-3xl font-bold text-amber-400">AI幹事ヨイさん</h1>
          <p className="mt-2 text-zinc-400">飲み会の参加者を入力してね</p>
          {isMobile && (
            <p className="mt-2 text-xs text-amber-300/80">
              「開始する」をタップすると音声が有効になります
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="名前を入力"
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-white placeholder:text-zinc-500 focus:border-amber-500 focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addParticipant();
                }
              }}
            />
            <button
              type="button"
              onClick={addParticipant}
              className="min-h-11 min-w-11 rounded-lg bg-zinc-700 px-4 py-2 text-white hover:bg-zinc-600"
            >
              追加
            </button>
          </div>

          {participants.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {participants.map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center gap-1 rounded-full bg-amber-900/50 px-3 py-1 text-sm text-amber-200"
                >
                  {p}
                  <button
                    type="button"
                    onClick={() => removeParticipant(p)}
                    className="text-amber-400 hover:text-amber-200"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {unlockError && (
            <div
              role="alert"
              className="rounded-md border border-red-700 bg-red-900/60 px-3 py-2 text-sm text-red-100"
            >
              {unlockError}
            </div>
          )}

          <button
            type="submit"
            disabled={participants.length === 0}
            className="min-h-12 w-full rounded-lg bg-amber-600 py-3 text-lg font-bold text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            🍻 飲み会を開始する
          </button>
        </form>
      </div>
    </div>
  );
}
