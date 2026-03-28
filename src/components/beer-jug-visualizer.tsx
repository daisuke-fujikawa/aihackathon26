"use client";

interface BeerJugVisualizerProps {
  volumeLevel: number; // 0.0-1.0
  totalSpeechTime: number; // 秒
}

export function BeerJugVisualizer({
  volumeLevel,
  totalSpeechTime,
}: BeerJugVisualizerProps) {
  // 泡の高さは音量に比例 (10-60%)
  const foamHeight = 10 + volumeLevel * 50;
  // 液面は発話時間に応じて減少（最大300秒で空に）
  const liquidPercent = Math.max(0, 100 - (totalSpeechTime / 300) * 100);

  return (
    <div data-testid="beer-jug" className="relative w-16 h-24 mx-auto">
      {/* ジョッキ外枠 */}
      <div className="absolute inset-0 rounded-b-lg border-2 border-amber-600 bg-zinc-800/50 overflow-hidden">
        {/* ビール液体 */}
        <div
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-amber-700 to-amber-500 transition-all duration-500"
          style={{ height: `${liquidPercent}%` }}
        />
        {/* 泡 */}
        <div
          data-testid="beer-foam"
          className="absolute left-0 right-0 bg-gradient-to-t from-amber-200 to-white rounded-t transition-all duration-300"
          style={{
            height: `${foamHeight}%`,
            bottom: `${liquidPercent}%`,
          }}
        />
      </div>
      {/* 取っ手 */}
      <div className="absolute -right-3 top-2 bottom-4 w-3 rounded-r-full border-2 border-amber-600 border-l-0" />
    </div>
  );
}
