'use client';

import { Doughnut } from 'react-chartjs-2';
import {
  ArcElement,
  Chart as ChartJS,
  Legend,
  Tooltip,
  type TooltipItem,
} from 'chart.js';
import type { PortfolioSummary } from '@/lib/types';
import { formatTwd } from '@/lib/format';

ChartJS.register(ArcElement, Tooltip, Legend);

const TYPE_LABELS: Record<string, string> = {
  tw_stock: '台股',
  us_stock: '美股',
  crypto: '加密貨幣',
  cash_twd: '台幣',
  cash_usd: '美金',
  trust: '信託',
};

const TYPE_COLORS: Record<string, string> = {
  tw_stock: '#dc2626', // red-600
  us_stock: '#2563eb', // blue-600
  crypto: '#f59e0b', // amber-500
  cash_twd: '#6b7280', // gray-500
  cash_usd: '#a3a3a3', // gray-400
  trust: '#7c3aed', // violet-600
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
      },
    ],
  };

  return (
    <div className="relative h-48 w-full max-w-xs mx-auto">
      <Doughnut
        data={data}
        options={{
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: { boxWidth: 12, padding: 8, font: { size: 11 } },
            },
            tooltip: {
              callbacks: {
                label: (ctx: TooltipItem<'doughnut'>) => {
                  const value = ctx.parsed;
                  const pct = ((value / summary.totalAssetTwd) * 100).toFixed(1);
                  return `${ctx.label}: ${formatTwd(value)} (${pct}%)`;
                },
              },
            },
          },
          cutout: '65%',
        }}
      />
    </div>
  );
}
