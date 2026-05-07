'use client';

import { Doughnut } from 'react-chartjs-2';
import {
  ArcElement,
  Chart as ChartJS,
  Tooltip,
  type TooltipItem,
} from 'chart.js';
import type { PortfolioSummary } from '@/lib/types';
import { formatTwd } from '@/lib/format';
import { cn } from '@/lib/utils';

ChartJS.register(ArcElement, Tooltip);

const TYPE_LABELS: Record<string, string> = {
  tw_stock: '台股',
  us_stock: '美股',
  crypto: '加密',
  cash_twd: '台幣',
  cash_usd: '美金',
  trust: '信託',
};

// 對齊 globals.css chart-1~5 + up color。每色都是科技感 oklch palette。
const TYPE_COLORS: Record<string, string> = {
  tw_stock: 'oklch(0.7 0.22 25)',     // 台股紅(配合台灣紅漲)
  us_stock: 'oklch(0.78 0.18 210)',   // teal(品牌色)
  crypto: 'oklch(0.82 0.17 80)',      // amber
  cash_twd: 'oklch(0.78 0.18 195)',   // cyan
  cash_usd: 'oklch(0.65 0.22 290)',   // violet
  trust: 'oklch(0.708 0 0)',          // muted neutral(信託沒市場色)
};

export function AllocationPie({ summary }: { summary: PortfolioSummary }) {
  const entries = Object.entries(summary.byType).filter(
    ([, v]) => v.value > 0,
  );

  if (entries.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-8">
        尚無資產資料
      </div>
    );
  }

  const data = {
    labels: entries.map(([t]) => TYPE_LABELS[t] ?? t),
    datasets: [
      {
        data: entries.map(([, v]) => v.value),
        backgroundColor: entries.map(([t]) => TYPE_COLORS[t] ?? '#000'),
        borderWidth: 0,
        // 環狀外緣留 2px gap,讓區段彼此有呼吸
        spacing: 2,
        // hover 突出
        hoverOffset: 6,
      },
    ],
  };

  return (
    <div className="grid grid-cols-[1fr_auto] gap-4 items-center">
      {/* Donut + 中央大字 */}
      <div className="relative aspect-square w-full max-w-[200px] mx-auto">
        <Doughnut
          data={data}
          options={{
            maintainAspectRatio: true,
            plugins: {
              legend: { display: false }, // 自己畫 legend
              tooltip: {
                backgroundColor: 'oklch(0.205 0 0 / 0.95)',
                titleColor: 'oklch(0.78 0.18 210)',
                bodyColor: 'oklch(0.985 0 0)',
                borderColor: 'oklch(0.78 0.18 210 / 0.4)',
                borderWidth: 1,
                padding: 8,
                cornerRadius: 6,
                displayColors: false,
                bodyFont: {
                  size: 11,
                  family: 'var(--font-display)',
                },
                callbacks: {
                  label: (ctx: TooltipItem<'doughnut'>) => {
                    const value = ctx.parsed;
                    const pct = ((value / summary.totalAssetTwd) * 100).toFixed(1);
                    return `${ctx.label}: ${formatTwd(value)} (${pct}%)`;
                  },
                },
              },
            },
            cutout: '72%',
            // 旋轉起點:從 12 點鐘方向(-90deg)開始,順時針
            rotation: -90,
            animation: {
              animateRotate: true,
              animateScale: false,
              duration: 600,
              easing: 'easeOutCubic',
            },
          }}
        />
        {/* 中央大字 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-[10px] text-muted-foreground tracking-wide uppercase">
            總資產
          </div>
          <div className="text-base font-display font-semibold tabular-nums tracking-tight mt-0.5">
            {formatTwd(summary.totalAssetTwd)}
          </div>
        </div>
      </div>

      {/* 自寫 legend — 對齊截圖二:左邊 dot + 標籤 + 金額 + % */}
      <div className="flex flex-col gap-2 min-w-[100px]">
        {entries.map(([type, v]) => {
          const pct = (v.value / summary.totalAssetTwd) * 100;
          return (
            <div
              key={type}
              className="flex items-center gap-2 text-xs"
            >
              <span
                aria-hidden
                className={cn('h-2 w-2 rounded-full shrink-0')}
                style={{
                  backgroundColor: TYPE_COLORS[type] ?? '#666',
                  boxShadow: `0 0 8px ${TYPE_COLORS[type] ?? '#666'}66`,
                }}
              />
              <div className="min-w-0">
                <div className="font-medium">{TYPE_LABELS[type] ?? type}</div>
                <div className="text-muted-foreground tabular-nums text-[10px]">
                  {pct.toFixed(1)}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
