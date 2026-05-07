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
  type TooltipItem,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { EnrichedHolding } from '@/lib/types';
import { formatTwd } from '@/lib/format';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
);

type Props = {
  /** 全部 enriched holdings — 從 transactions 反推累計投入時間線。 */
  enriched: EnrichedHolding[];
  /** 馬賽克模式時隱藏 y 軸刻度 + tooltip 數字。 */
  privacy: boolean;
};

/**
 * 累計資產投入曲線。
 *
 * 從所有 holdings 的 transactions 合併排序,逐筆累加 costDeltaTwd。
 * 不可能還原「歷史市值」(我們只有現在的價),所以畫的是「累計成本(已投入金錢)」+
 * 終點標出當前總市值,讓使用者直觀看到投入 vs 現值的差。
 */
export function AssetGrowthChart({ enriched, privacy }: Props) {
  const series = useMemo(() => buildSeries(enriched), [enriched]);

  if (series.points.length < 2) {
    return (
      <div className="rounded-xl border border-border/50 bg-card/40 backdrop-blur-sm p-6 text-center text-sm text-muted-foreground">
        交易紀錄太少,還畫不出累計曲線。<br />
        多新增幾筆存款後就能看到資產走勢。
      </div>
    );
  }

  const labels = series.points.map((p) => p.label);
  const cumulativeData = series.points.map((p) => p.cumulativeCost);

  // 終點疊一個「目前市值」點,當對照
  const currentValue = series.currentMarketValue;
  const currentValuePoint = labels.map((_, idx) =>
    idx === labels.length - 1 ? currentValue : null,
  );

  const data = {
    labels,
    datasets: [
      {
        label: '累計投入',
        data: cumulativeData,
        borderColor: 'oklch(0.78 0.13 210)', // accent-brand teal
        backgroundColor: 'oklch(0.78 0.13 210 / 0.18)',
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 5,
        borderWidth: 2,
      },
      {
        label: '目前市值',
        data: currentValuePoint,
        borderColor:
          currentValue >= series.totalCost
            ? 'oklch(0.7 0.2 25)'
            : 'oklch(0.7 0.15 165)',
        backgroundColor:
          currentValue >= series.totalCost
            ? 'oklch(0.7 0.2 25)'
            : 'oklch(0.7 0.15 165)',
        pointRadius: 6,
        pointHoverRadius: 8,
        showLine: false,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'oklch(0.205 0 0 / 0.95)',
        titleColor: 'oklch(0.985 0 0)',
        bodyColor: 'oklch(0.985 0 0)',
        borderColor: 'oklch(1 0 0 / 0.1)',
        borderWidth: 1,
        padding: 10,
        boxPadding: 4,
        callbacks: {
          label: (ctx: TooltipItem<'line'>) => {
            const v = ctx.parsed.y;
            if (v === null || v === undefined) return '';
            const label = ctx.dataset.label ?? '';
            return privacy
              ? `${label}: ••••••`
              : `${label}: ${formatTwd(v)}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: 'oklch(0.708 0 0)',
          font: { size: 10 },
          maxRotation: 0,
          autoSkipPadding: 12,
        },
      },
      y: {
        grid: {
          color: 'oklch(1 0 0 / 0.06)',
        },
        ticks: {
          color: 'oklch(0.708 0 0)',
          font: { size: 10 },
          callback: (v: string | number) =>
            privacy ? '•••' : formatTwd(Number(v)),
        },
      },
    },
  };

  return (
    <div className="rounded-xl border border-border/50 bg-card/40 backdrop-blur-sm p-3">
      <div className="h-48">
        <Line data={data} options={options} />
      </div>
      <div className="flex items-center justify-around pt-3 mt-2 border-t border-border/40 text-xs">
        <div className="text-center">
          <div className="text-muted-foreground">累計投入</div>
          <div className="font-medium tabular-nums mt-0.5 text-accent-brand">
            {privacy ? '••••••' : formatTwd(series.totalCost)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-muted-foreground">目前市值</div>
          <div
            className={`font-medium tabular-nums mt-0.5 ${
              currentValue >= series.totalCost ? 'text-up' : 'text-down'
            }`}
          >
            {privacy ? '••••••' : formatTwd(currentValue)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-muted-foreground">未實現損益</div>
          <div
            className={`font-medium tabular-nums mt-0.5 ${
              currentValue - series.totalCost >= 0 ? 'text-up' : 'text-down'
            }`}
          >
            {privacy
              ? '••••••'
              : `${currentValue - series.totalCost >= 0 ? '+' : ''}${formatTwd(currentValue - series.totalCost)}`}
          </div>
        </div>
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
  // 把所有 transactions 收集起來、按時間排
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

  // 按月聚合(同月份的 tx 合成一個點,曲線比較乾淨)
  const monthly = new Map<string, number>(); // key=YYYY-MM, value=cumulative-up-to-this-month
  let running = 0;
  for (const tx of allTx) {
    running += tx.costDeltaTwd;
    const key = `${tx.occurredAt.getFullYear()}/${String(tx.occurredAt.getMonth() + 1).padStart(2, '0')}`;
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
