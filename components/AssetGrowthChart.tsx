'use client';

import { useMemo } from 'react';
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartOptions,
  type TooltipItem,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { EnrichedHolding } from '@/lib/types';
import { formatTwd } from '@/lib/format';
import { cn } from '@/lib/utils';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
);

type Props = {
  enriched: EnrichedHolding[];
  privacy: boolean;
  height?: number;
};

/**
 * 累計資產投入曲線 — Chart.js 深度客製,風格對齊參考截圖:
 * 漸層 stroke + 漸層 fill + 隱藏 grid/y-ticks + 終點 dot + tooltip pill
 */
export function AssetGrowthChart({ enriched, privacy, height = 140 }: Props) {
  const series = useMemo(() => buildSeries(enriched), [enriched]);

  if (series.points.length < 2) {
    return (
      <div className="rounded-2xl border border-white/10 bg-card/40 backdrop-blur-xl p-6 text-center text-sm text-muted-foreground">
        交易紀錄太少,還畫不出累計曲線。
        <br />
        多新增幾筆存款後就能看到資產走勢。
      </div>
    );
  }

  const labels = series.points.map((p) => p.label);
  const values = series.points.map((p) => p.cumulativeCost);
  const lastIdx = values.length - 1;
  const positive = series.currentMarketValue >= series.totalCost;

  const data = {
    labels,
    datasets: [
      {
        label: '累計投入',
        data: values,
        borderWidth: 2,
        // 平滑曲線
        tension: 0.4,
        // 漸層 stroke(teal → cyan)
        borderColor: (ctx: { chart: ChartJS }) => {
          const { chart } = ctx;
          if (!chart.chartArea) return 'oklch(0.78 0.18 210)';
          const gradient = chart.ctx.createLinearGradient(
            chart.chartArea.left,
            0,
            chart.chartArea.right,
            0,
          );
          gradient.addColorStop(0, 'oklch(0.7 0.18 195)');
          gradient.addColorStop(1, 'oklch(0.78 0.2 210)');
          return gradient;
        },
        // 漸層 fill(teal 35% → transparent)
        backgroundColor: (ctx: { chart: ChartJS }) => {
          const { chart } = ctx;
          if (!chart.chartArea) return 'oklch(0.78 0.18 210 / 0.2)';
          const gradient = chart.ctx.createLinearGradient(
            0,
            chart.chartArea.top,
            0,
            chart.chartArea.bottom,
          );
          gradient.addColorStop(0, 'oklch(0.78 0.18 210 / 0.4)');
          gradient.addColorStop(1, 'oklch(0.78 0.18 210 / 0)');
          return gradient;
        },
        fill: true,
        // 預設不顯示 point,只在最後一點 + hover 才顯示
        pointRadius: (ctx: { dataIndex: number }) =>
          ctx.dataIndex === lastIdx ? 5 : 0,
        pointHoverRadius: 6,
        pointBackgroundColor: 'oklch(0.205 0 0)',
        pointBorderColor: 'oklch(0.78 0.18 210)',
        pointBorderWidth: 2,
        pointHitRadius: 24,
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'oklch(0.205 0 0 / 0.95)',
        titleColor: 'oklch(0.78 0.18 210)',
        bodyColor: 'oklch(0.985 0 0)',
        borderColor: 'oklch(0.78 0.18 210 / 0.4)',
        borderWidth: 1,
        padding: 8,
        boxPadding: 0,
        cornerRadius: 6,
        displayColors: false,
        titleFont: {
          size: 10,
          weight: 'normal',
        },
        bodyFont: {
          size: 12,
          weight: 600,
          family: 'var(--font-display)',
        },
        callbacks: {
          title: (items: TooltipItem<'line'>[]) => items[0]?.label ?? '',
          label: (ctx: TooltipItem<'line'>) => {
            const v = ctx.parsed.y;
            return privacy || v === null ? '••••••' : formatTwd(v);
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: {
          color: 'oklch(0.708 0 0)',
          font: {
            size: 10,
            family: 'var(--font-display)',
          },
          maxRotation: 0,
          autoSkip: true,
          autoSkipPadding: 24,
        },
      },
      y: {
        // 完全隱藏 y 軸 — 純 sparkline 視覺
        display: false,
        grid: { display: false },
        beginAtZero: false,
        // 留一點 padding 不讓線貼底
        suggestedMin: Math.min(...values) - (Math.max(...values) - Math.min(...values)) * 0.15,
        suggestedMax: Math.max(...values) + (Math.max(...values) - Math.min(...values)) * 0.1,
      },
    },
    elements: {
      line: {
        // CSS filter 透過 Chart.js 不直接支援,改用 shadowBlur(在 plugin 加)
      },
    },
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-card/40 backdrop-blur-xl p-4">
      {/* 上方數字概覽 */}
      <div className="flex items-end justify-between mb-3">
        <div>
          <div className="text-[11px] text-muted-foreground tracking-wide uppercase">
            累計投入
          </div>
          <div className="text-2xl font-display font-semibold tabular-nums tracking-tight mt-0.5">
            {privacy ? '••••••' : formatTwd(series.totalCost)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-muted-foreground tracking-wide uppercase">
            目前市值
          </div>
          <div
            className={cn(
              'text-2xl font-display font-semibold tabular-nums tracking-tight mt-0.5',
              positive ? 'text-up' : 'text-down',
            )}
          >
            {privacy ? '••••••' : formatTwd(series.currentMarketValue)}
          </div>
        </div>
      </div>

      {/* Chart.js 容器:加 drop-shadow 讓線條發 teal 光 */}
      <div
        style={{
          height,
          filter: 'drop-shadow(0 0 6px oklch(0.78 0.18 210 / 0.4))',
        }}
      >
        <Line data={data} options={options} />
      </div>
    </div>
  );
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
