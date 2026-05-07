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
import {
  accentBrandAlpha,
  FOREGROUND,
  MUTED,
  POPOVER_BG,
  POPOVER_BORDER,
  TREND_DOWN,
  TREND_FLAT,
  TREND_UP,
  trendDownAlpha,
  trendFlatAlpha,
  trendUpAlpha,
} from '@/lib/colors';
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
 * 累計資產投入曲線(Chart.js + 客製樣式)。
 * 線條顏色按趨勢方向變:漲 = 藍紫 / 平 = 白 / 跌 = 淺橘紅。
 */
export function AssetGrowthChart({ enriched, privacy, height = 140 }: Props) {
  const series = useMemo(() => buildSeries(enriched), [enriched]);

  if (series.points.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-card/40 backdrop-blur-xl p-6 text-center text-sm text-muted-foreground">
        還沒有交易紀錄。新增第一筆存款後就會看到曲線。
      </div>
    );
  }

  // 一筆 → 補虛擬零起點
  const augmented =
    series.points.length === 1
      ? [
          (() => {
            const [yy, mm] = series.points[0].label.split('/').map(Number);
            const prevYY = mm === 1 ? yy - 1 : yy;
            const prevMM = mm === 1 ? 12 : mm - 1;
            return {
              label: `${String(prevYY).padStart(2, '0')}/${String(prevMM).padStart(2, '0')}`,
              cumulativeCost: 0,
            };
          })(),
          ...series.points,
        ]
      : series.points;

  const labels = augmented.map((p) => p.label);
  const values = augmented.map((p) => p.cumulativeCost);
  const positive = series.currentMarketValue >= series.totalCost;

  // 趨勢方向:看曲線最後一段比首段升 / 平 / 跌(用相對變化判斷)
  const first = values[0] ?? 0;
  const last = values[values.length - 1] ?? 0;
  const delta = last - first;
  const denom = Math.max(Math.abs(first), 1);
  const relative = delta / denom;
  const trend: 'up' | 'flat' | 'down' =
    relative > 0.02 ? 'up' : relative < -0.02 ? 'down' : 'flat';

  const trendColor =
    trend === 'up' ? TREND_UP : trend === 'down' ? TREND_DOWN : TREND_FLAT;
  const trendAlpha =
    trend === 'up' ? trendUpAlpha : trend === 'down' ? trendDownAlpha : trendFlatAlpha;

  const data = {
    labels,
    datasets: [
      {
        label: '累計投入',
        data: values,
        borderWidth: 2,
        tension: 0.4,
        // 漸層 stroke:左端柔色 → 右端飽和趨勢色,給「最新方向」視覺提示
        borderColor: (ctx: { chart: ChartJS }) => {
          const { chart } = ctx;
          if (!chart.chartArea) return trendColor;
          const g = chart.ctx.createLinearGradient(
            chart.chartArea.left,
            0,
            chart.chartArea.right,
            0,
          );
          g.addColorStop(0, trendAlpha(0.5));
          g.addColorStop(1, trendColor);
          return g;
        },
        // 漸層 fill 條件化(同色但下方淡)
        backgroundColor: (ctx: { chart: ChartJS }) => {
          const { chart } = ctx;
          if (!chart.chartArea) return trendAlpha(0.18);
          const g = chart.ctx.createLinearGradient(
            0,
            chart.chartArea.top,
            0,
            chart.chartArea.bottom,
          );
          g.addColorStop(0, trendAlpha(0.4));
          g.addColorStop(1, trendAlpha(0));
          return g;
        },
        fill: true,
        pointRadius: (ctx: { dataIndex: number }) =>
          ctx.dataIndex === values.length - 1 ? 5 : 0,
        pointHoverRadius: 6,
        pointBackgroundColor: 'oklch(0.205 0 0)',
        pointBorderColor: trendColor,
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
        backgroundColor: POPOVER_BG,
        titleColor: trendColor,
        bodyColor: FOREGROUND,
        borderColor: trendAlpha(0.4),
        borderWidth: 1,
        padding: 8,
        boxPadding: 0,
        cornerRadius: 6,
        displayColors: false,
        titleFont: { size: 10, weight: 'normal' },
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
          color: MUTED,
          font: { size: 10, family: 'var(--font-display)' },
          maxRotation: 0,
          autoSkip: true,
          autoSkipPadding: 24,
        },
      },
      y: {
        display: false,
        grid: { display: false },
        beginAtZero: false,
        suggestedMin:
          Math.min(...values) -
          (Math.max(...values) - Math.min(...values)) * 0.15,
        suggestedMax:
          Math.max(...values) +
          (Math.max(...values) - Math.min(...values)) * 0.1,
      },
    },
  };

  // 用 amount/100k 級別自適應字體,避免大數字破版
  const fontClass = (amount: number) => {
    const digits = Math.abs(Math.round(amount)).toString().length;
    if (digits >= 9) return 'text-base'; // > 1 億
    if (digits >= 8) return 'text-lg'; // > 1000 萬
    return 'text-xl'; // 1000 萬以下
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-card/40 backdrop-blur-xl p-4">
      {/* 上方數字概覽(自適應字體大小) */}
      <div className="flex items-end justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] text-muted-foreground tracking-wide uppercase">
            累計投入
          </div>
          <div
            className={cn(
              'font-display font-semibold tabular-nums tracking-tight mt-0.5 truncate',
              fontClass(series.totalCost),
            )}
          >
            {privacy ? '••••••' : formatTwd(series.totalCost)}
          </div>
        </div>
        <div className="min-w-0 flex-1 text-right">
          <div className="text-[10px] text-muted-foreground tracking-wide uppercase">
            目前市值
          </div>
          <div
            className={cn(
              'font-display font-semibold tabular-nums tracking-tight mt-0.5 truncate',
              fontClass(series.currentMarketValue),
              positive ? 'text-up' : 'text-down',
            )}
          >
            {privacy ? '••••••' : formatTwd(series.currentMarketValue)}
          </div>
        </div>
      </div>

      <div
        style={{
          height,
          filter: `drop-shadow(0 0 6px ${accentBrandAlpha(0.3)})`,
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
