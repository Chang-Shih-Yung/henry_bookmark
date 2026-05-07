'use client';

import { useMemo, useState } from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
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

type Range = '3m' | '6m' | '12m' | '18m' | 'all';
const RANGES: Array<{ value: Range; label: string; months: number | null }> = [
  { value: '3m', label: '3M', months: 3 },
  { value: '6m', label: '6M', months: 6 },
  { value: '12m', label: '12M', months: 12 },
  { value: '18m', label: '18M', months: 18 },
  { value: 'all', label: 'All', months: null },
];

/**
 * 累計資產投入曲線(Chart.js + 客製樣式)。
 * 線條顏色按趨勢方向變:漲 = 藍紫 / 平 = 白 / 跌 = 淺橘紅。
 */
export function AssetGrowthChart({ enriched, privacy, height = 140 }: Props) {
  const [range, setRange] = useState<Range>('12m');
  const series = useMemo(() => buildSeries(enriched), [enriched]);

  // 依範圍展開 points:從今天往前推 N 個月,每個月都要顯示(即使該月沒交易、累計仍是上一筆值)
  // 之前是 .slice(-N) 只看實際有資料的最後 N 筆,不是 calendar-based,Henry 抱怨「0 就當不存在」
  const months = RANGES.find((r) => r.value === range)?.months ?? null;
  const visiblePoints = useMemo(
    () => expandToCalendarMonths(series.points, months),
    [series.points, months],
  );

  if (series.points.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-card/40 backdrop-blur-xl p-6 text-center text-sm text-muted-foreground">
        還沒有交易紀錄。新增第一筆存款後就會看到曲線。
      </div>
    );
  }

  // 一筆 → 補虛擬零起點
  const augmented =
    visiblePoints.length === 1
      ? [
          (() => {
            const [yy, mm] = visiblePoints[0].label.split('/').map(Number);
            const prevYY = mm === 1 ? yy - 1 : yy;
            const prevMM = mm === 1 ? 12 : mm - 1;
            return {
              label: `${String(prevYY).padStart(2, '0')}/${String(prevMM).padStart(2, '0')}`,
              cumulativeCost: 0,
            };
          })(),
          ...visiblePoints,
        ]
      : visiblePoints;

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
            const formatted =
              privacy || v === null ? '••••••' : formatTwd(v);
            return `累計投入 ${formatted}`;
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

      {/* 區間選擇 — 5 顆 segmented control,iOS 原生感 */}
      <ToggleGroup
        value={[range]}
        onValueChange={(v) => {
          if (v.length > 0) setRange(v[0] as Range);
        }}
        className="mt-3 w-full h-9"
      >
        {RANGES.map((r) => (
          <ToggleGroupItem
            key={r.value}
            value={r.value}
            className="flex-1 px-0 text-xs"
          >
            {r.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

type SeriesPoint = { label: string; cumulativeCost: number };
type Series = {
  points: SeriesPoint[];
  totalCost: number;
  currentMarketValue: number;
};

/**
 * 把實際有交易的 monthly points 展開成「從今天往前 N 個月」的完整月曆。
 *  - 沒交易的月填上一筆累計值(carry-forward)
 *  - 第一筆交易之前的月填 0(代表還沒投入)
 *  - months === null 表示 All:回傳原始 points,不做展開
 */
function expandToCalendarMonths(
  points: SeriesPoint[],
  months: number | null,
): SeriesPoint[] {
  if (months === null) return points;
  if (points.length === 0) return [];

  // 用 yy/mm 當 key,O(1) 查月份
  const lookup = new Map<string, number>();
  for (const p of points) lookup.set(p.label, p.cumulativeCost);

  // 從今天往回推 N 個月,生 N+1 個月的 label(包含當月)
  const today = new Date();
  const labels: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const yy = String(d.getFullYear()).slice(2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    labels.push(`${yy}/${mm}`);
  }

  // 第一個 label 之前的累計初始值:找 ≤ 第一個 label 的最近一筆,若沒有則 0
  const firstLabel = labels[0];
  let running = 0;
  for (const p of points) {
    if (p.label <= firstLabel) running = p.cumulativeCost;
    else break;
  }
  // 注意:如果第一個 label 本身就有交易,running 已經被設成那筆累計值;下面 lookup 會再覆蓋

  // 沿著 labels 走,有 lookup 用 lookup,沒有就 carry forward
  return labels.map((label) => {
    const v = lookup.get(label);
    if (v !== undefined) running = v;
    return { label, cumulativeCost: running };
  });
}

function buildSeries(enriched: EnrichedHolding[]): Series {
  // 累積投入的真實值來自 holding.costBasisTwd(總成本),
  // 但 transactions 只是「有記錄到的」交易 — 早期既有持倉沒記錄交易時,
  // sum(tx.costDeltaTwd) < costBasisTwd → 圖會嚴重低估
  // (Henry 看到 26/05 = 4500 而非實際的 28k 就是這 bug)
  //
  // 修法:每個 holding 的 costBasisTwd 減 sum(tx) = baseline(交易紀錄前的既有成本),
  // 把 baseline 當成「最早一筆 tx 之前」的零點,加進該 holding 的最早 tx 月份(或 holding.updatedAt)
  const allTx: { occurredAt: Date; costDeltaTwd: number }[] = [];
  for (const h of enriched) {
    const txs = (h.transactions ?? []).filter(
      (t) => !isNaN(new Date(t.occurredAt).getTime()),
    );
    const txSum = txs.reduce((s, t) => s + t.costDeltaTwd, 0);
    const baseline = h.costBasisTwd - txSum;

    if (txs.length === 0) {
      // 完全沒有交易紀錄 → 用 holding.updatedAt 當作這筆 cost 的時間
      // (假設 user 是在那個時點建立 holding 的)
      if (h.costBasisTwd > 0) {
        const d = new Date(h.updatedAt);
        if (!isNaN(d.getTime())) {
          allTx.push({ occurredAt: d, costDeltaTwd: h.costBasisTwd });
        }
      }
    } else {
      // 有交易,但 baseline 可能 > 0(早期既有持倉)→ 把 baseline 塞最早 tx 之前一秒
      if (Math.abs(baseline) >= 1) {
        const earliest = txs.reduce(
          (e, t) => {
            const d = new Date(t.occurredAt);
            return d.getTime() < e.getTime() ? d : e;
          },
          new Date(txs[0].occurredAt),
        );
        const beforeEarliest = new Date(earliest.getTime() - 1000);
        allTx.push({ occurredAt: beforeEarliest, costDeltaTwd: baseline });
      }
      for (const tx of txs) {
        allTx.push({
          occurredAt: new Date(tx.occurredAt),
          costDeltaTwd: tx.costDeltaTwd,
        });
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
