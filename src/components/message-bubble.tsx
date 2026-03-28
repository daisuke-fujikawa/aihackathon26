"use client";

import type { ChatMessage, YoiImageKey } from "@/providers/session-state-provider";

const YOI_IMAGE_MAP: Record<YoiImageKey, string> = {
  drunk_1: "/yoi/drunk_1.png",
  drunk_2: "/yoi/drunk_2.png",
  drunk_3: "/yoi/drunk_3.png",
  kanpai: "/yoi/kanpai.png",
  pass: "/yoi/pass.png",
  clock: "/yoi/clock.png",
  restroom: "/yoi/restroom.png",
};

interface MessageBubbleProps {
  message: ChatMessage;
  currentYoiImage?: YoiImageKey;
}

export function MessageBubble({ message, currentYoiImage }: MessageBubbleProps) {
  const isYoi = message.role === "yoi";
  const imageKey = message.yoiImage || currentYoiImage || "drunk_1";

  return (
    <div className={`flex gap-2 ${isYoi ? "flex-row" : "flex-row-reverse"}`}>
      {isYoi && (
        <div className="flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={YOI_IMAGE_MAP[imageKey]}
            alt="ヨイさん"
            width={40}
            height={40}
            className="rounded-full"
          />
        </div>
      )}
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 ${
          isYoi
            ? "bg-amber-900/60 text-amber-100 rotate-[0.5deg]"
            : "bg-zinc-700 text-white"
        }`}
      >
        <p className="text-sm leading-relaxed">{message.content}</p>
      </div>
    </div>
  );
}
