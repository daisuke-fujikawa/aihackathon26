"use client";

import { useEffect, useRef } from "react";
import { MessageBubble } from "./message-bubble";
import type { ChatMessage, YoiImageKey } from "@/providers/session-state-provider";

interface ChatPanelProps {
  messages: ChatMessage[];
  currentYoiImage: YoiImageKey;
}

export function ChatPanel({ messages, currentYoiImage }: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-20"
        style={{ backgroundImage: "url(/bg/backgroung.png)" }}
      />
      <div className="relative h-full overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            currentYoiImage={currentYoiImage}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
