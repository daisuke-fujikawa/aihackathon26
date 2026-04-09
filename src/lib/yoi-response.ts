/**
 * ヨイさんの応答を自然な文末で最大 N 文字に切り詰める純粋関数。
 * - サロゲートペア（絵文字）は 1 文字としてカウントする。
 * - 句点「。」感嘆符「！」疑問符「？」波ダッシュ「〜」の直後で切り詰めを試みる。
 * - 句読点が見つからない場合は末尾に「…」を付与して必ず maxChars 以内に収める。
 */

export interface ClampResult {
  text: string;
  truncated: boolean;
  originalLength: number;
}

const DEFAULT_MAX_CHARS = 40;
const SENTENCE_TERMINATORS = ["。", "！", "？", "!", "?", "〜"] as const;

export function clampYoiResponse(
  text: string,
  maxChars: number
): ClampResult {
  const effectiveMax =
    Number.isFinite(maxChars) && maxChars >= 10 ? maxChars : DEFAULT_MAX_CHARS;

  const chars = Array.from(text);
  const originalLength = chars.length;

  if (originalLength <= effectiveMax) {
    return { text, truncated: false, originalLength };
  }

  // maxChars 以内の範囲で最後の文末記号を探す
  const window = chars.slice(0, effectiveMax);
  let cutIndex = -1;
  for (let i = window.length - 1; i >= 0; i--) {
    if ((SENTENCE_TERMINATORS as readonly string[]).includes(window[i])) {
      cutIndex = i;
      break;
    }
  }

  if (cutIndex >= 0) {
    return {
      text: chars.slice(0, cutIndex + 1).join(""),
      truncated: true,
      originalLength,
    };
  }

  // 句読点が無い → 末尾に「…」を付与（maxChars を超えないように 1 文字分詰める）
  const truncated = chars.slice(0, effectiveMax - 1).join("") + "…";
  return { text: truncated, truncated: true, originalLength };
}

/**
 * `generateAndSpeak` の発話ゲート判定（純粋関数）。
 * 抑制すべき場合は理由を返し、通過時は null を返す。
 */
export type SpeakSkipReason = "processing" | "speaking" | "cooldown";

export interface SpeakGateInput {
  isProcessing: boolean;
  isPlaying: boolean;
  lastYoiSpeakAt: number;
  now: number;
  aiCooldownSec: number;
}

export function shouldSkipGenerate(
  input: SpeakGateInput
): SpeakSkipReason | null {
  if (input.isProcessing) return "processing";
  if (input.isPlaying) return "speaking";
  if (
    input.lastYoiSpeakAt > 0 &&
    input.now - input.lastYoiSpeakAt < input.aiCooldownSec * 1000
  ) {
    return "cooldown";
  }
  return null;
}

