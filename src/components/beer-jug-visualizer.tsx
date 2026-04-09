"use client";

import { useEffect, useRef, useMemo, useState } from "react";

interface BeerJugVisualizerProps {
  volumeLevel: number; // 0.0-1.0
  kanpaiCount: number; // 乾杯回数
  sessionStartTime: number; // セッション開始時刻 (Date.now())
}

// 泡粒の型
interface Bubble {
  x: number;
  y: number;
  r: number;
  speed: number;
  wobbleOffset: number;
  wobbleSpeed: number;
  opacity: number;
}

export const MAX_DURATION = 300; // 5分で1杯空になる
export const KANPAI_DRAIN = 0.3; // 乾杯1回で3/10減る

export function computeDrain(sessionStartTime: number, kanpaiCount: number): number {
  if (sessionStartTime <= 0) return 0;
  const elapsed = (Date.now() - sessionStartTime) / 1000;
  return elapsed / MAX_DURATION + kanpaiCount * KANPAI_DRAIN;
}

// --- 空ジョッキコンポーネント ---
function EmptyBeerMug() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const W = 38;
  const H = 52;
  const JUG_W = 30;
  const JUG_H = 44;
  const HANDLE_W = 6;
  const BORDER_R = 3;

  const dpr = useMemo(
    () => (typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1),
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    // ジョッキ背景
    ctx.beginPath();
    roundedRect(ctx, 1, 2, JUG_W, JUG_H, BORDER_R);
    ctx.fillStyle = "rgba(30, 25, 15, 0.4)";
    ctx.fill();

    // 枠線
    ctx.beginPath();
    roundedRect(ctx, 1, 2, JUG_W, JUG_H, BORDER_R);
    ctx.strokeStyle = "rgba(212, 135, 14, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 取っ手
    ctx.beginPath();
    ctx.moveTo(JUG_W + 1, 8);
    ctx.quadraticCurveTo(
      JUG_W + HANDLE_W + 1,
      8,
      JUG_W + HANDLE_W + 1,
      16
    );
    ctx.lineTo(JUG_W + HANDLE_W + 1, JUG_H - 8);
    ctx.quadraticCurveTo(
      JUG_W + HANDLE_W + 1,
      JUG_H - 2,
      JUG_W + 1,
      JUG_H - 2
    );
    ctx.strokeStyle = "rgba(212, 135, 14, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, [dpr]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: W, height: H }}
      className="flex-shrink-0 opacity-60"
    />
  );
}

// --- アクティブジョッキ (アニメーション付き) ---
export function BeerJugVisualizer({
  volumeLevel,
  kanpaiCount,
  sessionStartTime,
}: BeerJugVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bubblesRef = useRef<Bubble[]>([]);
  const rafRef = useRef<number>(0);
  const volumeRef = useRef(volumeLevel);
  const kanpaiCountRef = useRef(kanpaiCount);
  const sessionStartTimeRef = useRef(sessionStartTime);
  const [emptyMugCount, setEmptyMugCount] = useState(0);

  // refs を最新値で更新
  volumeRef.current = volumeLevel;
  kanpaiCountRef.current = kanpaiCount;
  sessionStartTimeRef.current = sessionStartTime;

  // 泡粒の初期生成
  const MAX_BUBBLES = 30;

  // 波形オフセット用
  const waveOffsetRef = useRef(0);

  // 揺れの強さ
  const prevVolumeRef = useRef(0);
  const shakeRef = useRef(0);

  // 定数
  const JUG_W = 80;
  const JUG_H = 120;
  const HANDLE_W = 14;
  const CANVAS_W = JUG_W + HANDLE_W + 4;
  const CANVAS_H = JUG_H + 8;
  const BORDER_R = 8;

  // DPR対応
  const dpr = useMemo(
    () => (typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1),
    []
  );

  // 空ジョッキ数を1秒ごとに更新
  useEffect(() => {
    if (sessionStartTime <= 0) return;
    const update = () => {
      const totalDrain = computeDrain(
        sessionStartTimeRef.current,
        kanpaiCountRef.current
      );
      setEmptyMugCount(Math.floor(totalDrain));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [sessionStartTime]);

  // kanpaiCount変更時も即座に更新
  useEffect(() => {
    const totalDrain = computeDrain(
      sessionStartTimeRef.current,
      kanpaiCountRef.current
    );
    setEmptyMugCount(Math.floor(totalDrain));
  }, [kanpaiCount]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Canvas DPR設定
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    ctx.scale(dpr, dpr);

    const draw = () => {
      const vol = volumeRef.current;

      // ドレイン計算 (時間経過 + 乾杯)
      const totalDrain = computeDrain(
        sessionStartTimeRef.current,
        kanpaiCountRef.current
      );
      const liquidPct = Math.max(0, 1 - (totalDrain - Math.floor(totalDrain)));

      // 揺れ計算
      const volDelta = Math.abs(vol - prevVolumeRef.current);
      shakeRef.current += (volDelta * 8 - shakeRef.current) * 0.1;
      prevVolumeRef.current = vol;

      // 波オフセット更新
      waveOffsetRef.current += 0.04 + vol * 0.08;

      // 液面パーセント
      const liquidH = liquidPct * (JUG_H - 8);
      const liquidTop = JUG_H - 4 - liquidH;

      // キャンバスクリア
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      // --- ジョッキ外枠 (背景) ---
      ctx.save();
      ctx.beginPath();
      roundedRect(ctx, 2, 4, JUG_W, JUG_H, BORDER_R);
      ctx.fillStyle = "rgba(30, 25, 15, 0.6)";
      ctx.fill();
      ctx.restore();

      // --- クリップ領域 (ジョッキ内部) ---
      ctx.save();
      ctx.beginPath();
      roundedRect(ctx, 4, 6, JUG_W - 4, JUG_H - 4, BORDER_R - 2);
      ctx.clip();

      // --- ビール液体 ---
      if (liquidH > 0) {
        const beerGrad = ctx.createLinearGradient(0, JUG_H, 0, liquidTop);
        beerGrad.addColorStop(0, "#b8620a");
        beerGrad.addColorStop(0.3, "#d4890e");
        beerGrad.addColorStop(0.7, "#e8a817");
        beerGrad.addColorStop(1, "#f0c040");

        ctx.beginPath();

        // 上部の波形
        const waveAmp = 2 + shakeRef.current * 4 + vol * 3;
        ctx.moveTo(0, JUG_H + 4);
        ctx.lineTo(0, liquidTop + waveAmp);

        for (let x = 0; x <= JUG_W; x += 2) {
          const wave1 =
            Math.sin(waveOffsetRef.current + x * 0.08) * waveAmp * 0.6;
          const wave2 =
            Math.sin(waveOffsetRef.current * 1.3 + x * 0.12) * waveAmp * 0.4;
          ctx.lineTo(x, liquidTop + wave1 + wave2);
        }
        ctx.lineTo(JUG_W + 4, JUG_H + 4);
        ctx.closePath();
        ctx.fillStyle = beerGrad;
        ctx.fill();

        // ビールのハイライト (透明感)
        const highlightGrad = ctx.createLinearGradient(
          10,
          0,
          JUG_W * 0.4,
          0
        );
        highlightGrad.addColorStop(0, "rgba(255, 240, 180, 0.15)");
        highlightGrad.addColorStop(0.5, "rgba(255, 240, 180, 0.05)");
        highlightGrad.addColorStop(1, "rgba(255, 240, 180, 0)");
        ctx.fillStyle = highlightGrad;
        ctx.fillRect(6, liquidTop, JUG_W * 0.4, liquidH);
      }

      // --- 泡 (気泡) ---
      const bubbles = bubblesRef.current;

      // 音量に応じて泡を追加
      const spawnRate = vol > 0.05 ? Math.floor(vol * 5) + 1 : 0;
      for (let i = 0; i < spawnRate && bubbles.length < MAX_BUBBLES; i++) {
        bubbles.push({
          x: 8 + Math.random() * (JUG_W - 16),
          y: JUG_H - 4,
          r: 1 + Math.random() * 2.5 + vol * 1.5,
          speed: 0.5 + Math.random() * 1.5 + vol * 2,
          wobbleOffset: Math.random() * Math.PI * 2,
          wobbleSpeed: 0.02 + Math.random() * 0.04,
          opacity: 0.4 + Math.random() * 0.4,
        });
      }

      // 泡の更新と描画
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        b.y -= b.speed;
        b.wobbleOffset += b.wobbleSpeed;
        b.x += Math.sin(b.wobbleOffset) * 0.5;

        // 液面より上 or 画面外で消滅
        if (b.y < liquidTop - 5) {
          bubbles.splice(i, 1);
          continue;
        }

        // 液体内の泡のみ描画
        if (b.y > liquidTop) {
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 245, 200, ${b.opacity * 0.5})`;
          ctx.fill();
          ctx.strokeStyle = `rgba(255, 250, 220, ${b.opacity * 0.3})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }

      // --- フォーム (泡の層) ---
      if (liquidH > 0) {
        const foamBaseH = 8 + vol * 20;
        const foamTop = liquidTop - foamBaseH * 0.3;
        const foamBottom = liquidTop + foamBaseH * 0.7;

        const foamGrad = ctx.createLinearGradient(0, foamTop, 0, foamBottom);
        foamGrad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
        foamGrad.addColorStop(0.3, "rgba(255, 250, 230, 0.9)");
        foamGrad.addColorStop(0.7, "rgba(245, 230, 180, 0.7)");
        foamGrad.addColorStop(1, "rgba(240, 200, 100, 0.3)");

        ctx.beginPath();
        ctx.moveTo(0, foamBottom + 4);

        // 泡の上部 (もこもこ)
        for (let x = 0; x <= JUG_W; x += 2) {
          const foam1 =
            Math.sin(waveOffsetRef.current * 0.7 + x * 0.1) *
            (3 + vol * 4);
          const foam2 =
            Math.sin(waveOffsetRef.current * 1.1 + x * 0.18) *
            (2 + vol * 2);
          const foam3 =
            Math.cos(waveOffsetRef.current * 0.5 + x * 0.06) *
            (1.5 + vol * 1.5);
          ctx.lineTo(x, foamTop + foam1 + foam2 + foam3);
        }

        ctx.lineTo(JUG_W + 4, foamBottom + 4);
        ctx.closePath();
        ctx.fillStyle = foamGrad;
        ctx.fill();

        // 泡の丸い凹凸感
        for (let x = 6; x < JUG_W - 4; x += 10 + Math.random() * 6) {
          const blobR = 4 + Math.sin(waveOffsetRef.current + x) * 2 + vol * 3;
          const blobY =
            foamTop +
            Math.sin(waveOffsetRef.current * 0.8 + x * 0.15) * 3;
          ctx.beginPath();
          ctx.arc(x, blobY, blobR, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
          ctx.fill();
        }
      }

      ctx.restore(); // クリップ解除

      // --- ジョッキ枠線 ---
      ctx.beginPath();
      roundedRect(ctx, 2, 4, JUG_W, JUG_H, BORDER_R);
      ctx.strokeStyle = "#d4870e";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // ガラスのハイライト
      ctx.beginPath();
      ctx.moveTo(8, 12);
      ctx.lineTo(8, JUG_H - 8);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // --- 取っ手 ---
      ctx.beginPath();
      ctx.moveTo(JUG_W + 2, 18);
      ctx.quadraticCurveTo(JUG_W + HANDLE_W + 2, 18, JUG_W + HANDLE_W + 2, 40);
      ctx.lineTo(JUG_W + HANDLE_W + 2, JUG_H - 20);
      ctx.quadraticCurveTo(
        JUG_W + HANDLE_W + 2,
        JUG_H - 6,
        JUG_W + 2,
        JUG_H - 6
      );
      ctx.strokeStyle = "#d4870e";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // 取っ手ハイライト
      ctx.beginPath();
      ctx.moveTo(JUG_W + 4, 22);
      ctx.quadraticCurveTo(JUG_W + HANDLE_W - 2, 22, JUG_W + HANDLE_W - 2, 40);
      ctx.lineTo(JUG_W + HANDLE_W - 2, JUG_H - 22);
      ctx.strokeStyle = "rgba(255, 200, 50, 0.15)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // --- 音量に応じたグロー効果 ---
      if (vol > 0.2) {
        ctx.save();
        ctx.globalAlpha = (vol - 0.2) * 0.4;
        ctx.shadowColor = "#f0a020";
        ctx.shadowBlur = 15 + vol * 20;
        ctx.beginPath();
        roundedRect(ctx, 2, 4, JUG_W, JUG_H, BORDER_R);
        ctx.strokeStyle = "#f0a020";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [dpr]);

  return (
    <div className="flex items-end gap-1 overflow-x-auto" data-testid="beer-jug-container">
      {Array.from({ length: emptyMugCount }).map((_, i) => (
        <EmptyBeerMug key={i} />
      ))}
      <canvas
        ref={canvasRef}
        data-testid="beer-jug"
        style={{ width: CANVAS_W, height: CANVAS_H }}
        className="flex-shrink-0"
      />
    </div>
  );
}

// 角丸矩形ヘルパー
function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
