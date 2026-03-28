"use client";

import { useState, type FormEvent } from "react";

interface SetupScreenProps {
  onStart: (participants: string[]) => void;
}

export function SetupScreen({ onStart }: SetupScreenProps) {
  const [name, setName] = useState("");
  const [participants, setParticipants] = useState<string[]>([]);

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
    if (participants.length > 0) {
      onStart(participants);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-amber-400">🍺 Yo-i Facilitator</h1>
          <p className="mt-2 text-zinc-400">飲み会の参加者を入力してね</p>
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
              className="rounded-lg bg-zinc-700 px-4 py-2 text-white hover:bg-zinc-600"
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

          <button
            type="submit"
            disabled={participants.length === 0}
            className="w-full rounded-lg bg-amber-600 py-3 text-lg font-bold text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            🍻 飲み会を開始する
          </button>
        </form>
      </div>
    </div>
  );
}
