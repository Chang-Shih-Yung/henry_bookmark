'use client';

import { useMemo, useState } from 'react';
import type { EnrichedHolding } from '@/lib/types';
import { formatTwd } from '@/lib/format';
import { cn } from '@/lib/utils';

type Props = {
  /** 全部 enriched holdings — 從 transactions 反推累計投入時間線。 */
  enriched: EnrichedHolding[];
  /** 馬賽克模式時隱藏 y 軸刻度 + tooltip 數字。 */
  privacy: boolean;
  /** 圖表高度,預設 120px(sparkline 風格)。 */
  height?: number;
};

/**
 * 累計資產投入曲線 — 自寫 SVG sparkline,對齊參考圖風格:
 * 純線條 + 漸層 fill 曲線下緣 + dotted gridline 標當前點 + 高亮的當前點 dot
 *
 * 從 transactions 累加 costDeltaTwd 取得時間線,按月聚合避免線條鋸齒。
 * 不可能還原歷史市值(只有現在的價),畫的是「累計成本投入」(已投入金錢的曲線)。
 */
export function AssetGrowthChart({
  enriched,
  privacy,
  height = 120,
}: Props) {
  const series = useMemo(() => buildSeries(enriched), [enriched]);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (series.points.length < 2) {
    return (
      <div className="rounded-2xl border border-white/10 bg-card/40 backdrop-blur-xl p-6 text-center text-sm text-muted-foreground">
        交易紀錄太少,還畫不出累計曲線。
        <br />
        多新增幾筆存款後就能看到資產走勢。
      </div>
    );
  }

  const W = 320; // viewBox 寬,實際 SVG 用 100% width 拉伸
  const H = height;
  const PAD_X = 16;
  const PAD_TOP = 16;
  const PAD_BOTTOM = 24; // 給 month label

  const values = series.points.map((p) => p.cumulativeCost);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;

  // 把 (idx, value) 映射到 SVG 座標
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_TOP - PAD_BOTTOM;
  const xAt = (i: number) =>
    PAD_X + (i / Math.max(series.points.length - 1, 1)) * innerW;
  const yAt = (v: number) =>
    PAD_TOP + (1 - (v - minV) / range) * innerH;

  // 平滑曲線(用 catmull-rom → bezier,sparkline 不需太複雜,簡單線性也 OK)
  const linePath = series.points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${yAt(p.cumulativeCost)}`)
    .join(' ');
  const fillPath = `${linePath} L ${xAt(series.points.length - 1)} ${PAD_TOP + innerH} L ${PAD_X} ${PAD_TOP + innerH} Z`;

  // 預設高亮終點(最新),hover 時移動
  const focusIdx = hoverIdx ?? series.points.length - 1;
  const focusPoint = series.points[focusIdx];
  const focusX = xAt(focusIdx);
  const focusY = yAt(focusPoint.cumulativeCost);

  // 顯示 hover 點上方的小標籤
  const labelOffset = 18;
  const labelX = Math.min(Math.max(focusX, PAD_X + 30), W - PAD_X - 30);
  const labelY = Math.max(focusY - labelOffset, PAD_TOP + 4);

  // 取代表性 month labels(首、中、尾)
  const monthLabels = series.points.length <= 6
    ? series.points.map((_, i) => i)
    : [0, Math.floor(series.points.length / 2), series.points.length - 1];

  const positive = series.currentMarketValue >= series.totalCost;

  return (
    <div className="rounded-2xl border border-white/10 bg-card/40 backdrop-blur-xl p-4">
      {/* 上方數字概覽 */}
      <div className="flex items-end justify-between mb-1">
        <div>
          <div className="text-xs text-muted-foreground">累計投入</div>
          <div className="text-2xl font-display font-semibold tabular-nums tracking-tight">
            {privacy ? '••••••' : formatTwd(series.totalCost)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">目前市值</div>
          <div
            className={cn(
              'text-2xl font-display font-semibold tabular-nums tracking-tight',
              positive ? 'text-up' : 'text-down',
            )}
          >
            {privacy ? '••••••' : formatTwd(series.currentMarketValue)}
          </div>
        </div>
      </div>

      {/* SVG sparkline */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full mt-2"
        style={{ height }}
        onMouseLeave={() => setHoverIdx(null)}
        onTouchEnd={() => setHoverIdx(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const xRel = ((e.clientX - rect.left) / rect.width) * W;
          handlePointer(xRel);
        }}
        onTouchMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const xRel =
            ((e.touches[0].clientX - rect.left) / rect.width) * W;
          handlePointer(xRel);
        }}
      >
        <defs>
          <linearGradient id="agc-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.78 0.18 210)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="oklch(0.78 0.18 210)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="agc-stroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="oklch(0.7 0.18 195)" />
            <stop offset="100%" stopColor="oklch(0.78 0.2 210)" />
          </linearGradient>
        </defs>

        {/* 漸層 fill 區域 */}
        <path d={fillPath} fill="url(#agc-fill)" />

        {/* 主曲線 */}
        <path
          d={linePath}
          fill="none"
          stroke="url(#agc-stroke)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: 'drop-shadow(0 0 6px oklch(0.78 0.18 210 / 0.4))' }}
        />

        {/* hover dotted vertical line */}
        <line
          x1={focusX}
          y1={PAD_TOP}
          x2={focusX}
          y2={PAD_TOP + innerH}
          stroke="oklch(1 0 0 / 0.15)"
          strokeWidth="1"
          strokeDasharray="3 3"
        />

        {/* hover dot:中心點 + 外圈 halo */}
        <circle
          cx={focusX}
          cy={focusY}
          r="8"
          fill="oklch(0.78 0.18 210)"
          fillOpacity="0.15"
        />
        <circle
          cx={focusX}
          cy={focusY}
          r="4"
          fill="oklch(0.205 0 0)"
          stroke="oklch(0.78 0.18 210)"
          strokeWidth="2"
        />

        {/* 上方小標籤(顯示 hover 點的金額) */}
        <g transform={`translate(${labelX}, ${labelY})`}>
          <rect
            x="-30"
            y="-12"
            width="60"
            height="14"
            rx="3"
            fill="oklch(0.205 0 0 / 0.85)"
            stroke="oklch(1 0 0 / 0.1)"
          />
          <text
            x="0"
            y="-2"
            textAnchor="middle"
            fontSize="9"
            fontFamily="var(--font-display)"
            fill="oklch(0.985 0 0)"
            className="tabular-nums"
          >
            {privacy
              ? '•••••'
              : formatTwd(focusPoint.cumulativeCost).replace('NT$ ', '')}
          </text>
        </g>

        {/* 月份 labels */}
        {monthLabels.map((i) => (
          <text
            key={i}
            x={xAt(i)}
            y={H - 6}
            textAnchor="middle"
            fontSize="9"
            fill="oklch(0.708 0 0)"
            className="tabular-nums"
            fontFamily="var(--font-display)"
          >
            {series.points[i].label}
          </text>
        ))}
      </svg>
    </div>
  );

  function handlePointer(svgX: number) {
    // svgX 是 viewBox 座標(0 ~ W)
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < series.points.length; i++) {
      const dist = Math.abs(xAt(i) - svgX);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    setHoverIdx(bestIdx);
  }
}

type SeriesPoint = { label: string; cumulativeCost: number };
type Series = {
  points: SeriesPoint[];
  totalCost: number;
  currentMarketValue: number;
};

function buildSeries(enriched: EnrichedHolding[]): Series {
  const allTx: { occurredAt: Date; costDeltaTwd: number }[] = [];
  for (const h of enriched) {
    for (const tx of h.transactions ?? []) {
      const d = new Date(tx.occurredAt);
      if (!isNaN(d.getTime())) {
        allTx.push({ occurredAt: d, costDeltaTwd: tx.costDeltaTwd });
      }
    }
  }
  allTx.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

  const monthly = new Map<string, number>();
  let running = 0;
  for (const tx of allTx) {
    running += tx.costDeltaTwd;
    const mm = String(tx.occurredAt.getMonth() + 1).padStart(2, '0');
    const yy = String(tx.occurredAt.getFullYear()).slice(2);
    const key = `${yy}/${mm}`;
    monthly.set(key, running);
  }

  const points: SeriesPoint[] = Array.from(monthly.entries()).map(
    ([label, cumulativeCost]) => ({ label, cumulativeCost }),
  );

  const totalCost = enriched.reduce((sum, h) => sum + h.costBasisTwd, 0);
  const currentMarketValue = enriched.reduce(
    (sum, h) => sum + h.marketValueTwd,
    0,
  );

  return { points, totalCost, currentMarketValue };
}
