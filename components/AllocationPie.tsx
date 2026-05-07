'use client';

import { useMemo } from 'react';
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
import {
  accentBrandAlpha,
  ACCENT_BRAND,
  FOREGROUND,
  POPOVER_BG,
} from '@/lib/colors';

ChartJS.register(ArcElement, Tooltip);

const TYPE_LABELS: Record<string, string> = {
  tw_stock: '台股',
  us_stock: '美股',
  crypto: '加密',
  cash_twd: '台幣',
  cash_usd: '美金',
  trust: '信託',
};

// 科技感 oklch palette,主品牌色 violet 給「美股」(英文資產),其他依視覺辨識度分配。
const TYPE_COLORS: Record<string, string> = {
  tw_stock: 'oklch(0.7 0.22 25)',     // 台股紅(配合台灣紅漲)
  us_stock: ACCENT_BRAND,              // violet 品牌色
  crypto: 'oklch(0.82 0.17 80)',       // amber
  cash_twd: 'oklch(0.78 0.18 195)',    // cyan
  cash_usd: 'oklch(0.65 0.22 320)',    // magenta
  trust: 'oklch(0.708 0 0)',           // muted neutral(信託沒市場色)
};

export function AllocationPie({
  summary,
  privacy = false,
}: {
  summary: PortfolioSummary;
  /** 跟 hero 區眼睛 toggle 同步:打開時中央金額顯示 ••• */
  privacy?: boolean;
}) {
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

  // useMemo:data 不依賴 privacy,純靠 byType 數值。
  // 之前每次 render 都重建 data 物件 → react-chartjs-2 偵測 prop ref 變化 →
  // chart.update() 重觸發 600ms 動畫 → 跟 privacy 切換時的 React re-render
  // 撞在一起,iOS Safari compositor 看到中央 absolute div 在動畫期間
  // 「半遮半顯」,Henry 看到的「蓋一半」就是這種症狀。
  const data = useMemo(
    () => ({
      labels: entries.map(([t]) => TYPE_LABELS[t] ?? t),
      datasets: [
        {
          data: entries.map(([, v]) => v.value),
          backgroundColor: entries.map(([t]) => TYPE_COLORS[t] ?? '#000'),
          borderWidth: 0,
          // 環狀外緣留 6px gap,給每段呼吸感
          spacing: 6,
          // 兩端做圓角(Chart.js v4 ArcElement 支援 borderRadius)
          borderRadius: 8,
          // hover 突出
          hoverOffset: 6,
        },
      ],
    }),
    // 依賴只看 entries 內容,privacy / 其他 prop 不會觸發 chart 重繪
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(entries)],
  );

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
                backgroundColor: POPOVER_BG,
                titleColor: ACCENT_BRAND,
                bodyColor: FOREGROUND,
                borderColor: accentBrandAlpha(0.4),
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
                    // privacy mask 直接 inline,避免 chart.js callbacks closure 抓到舊的 maskMoney
                    const amount = privacy ? '••••' : formatTwd(value);
                    return `${ctx.label}: ${amount} (${pct}%)`;
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
        {/* 中央大字 — privacy 直接 inline 三元,key 包 privacy 強制 remount
            避免 chart.js 周邊任何 portal / closure 把 div 留在舊 render */}
        <div
          key={`pie-center-${privacy ? 'masked' : 'shown'}`}
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
        >
          <div className="text-[10px] text-muted-foreground tracking-wide uppercase">
            總資產
          </div>
          <div className="text-base font-display font-semibold tabular-nums tracking-tight mt-0.5">
            {privacy ? '••••' : formatTwd(summary.totalAssetTwd)}
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
