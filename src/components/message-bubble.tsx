"use client";

import Image from "next/image";
import type { ChatMessage, YoiImageKey } from "@/providers/session-state-provider";

const YOI_IMAGE_MAP: Record<YoiImageKey, string> = {
  drunk_1: "/yoi/drunk-1.svg",
  drunk_2: "/yoi/drunk-2.svg",
  drunk_3: "/yoi/drunk-3.svg",
  kanpai: "/yoi/kanpai.svg",
  pass: "/yoi/pass.svg",
  clock: "/yoi/clock.svg",
  restroom: "/yoi/restroom.svg",
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
          <Image
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
