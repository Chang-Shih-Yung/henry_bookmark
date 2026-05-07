'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type TooltipItem,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useHoldings } from '@/lib/api';
import { simulate } from '@/lib/calc';
import { defaultConfig } from '@/lib/config';
import { formatTwd } from '@/lib/format';
import type { Scenario } from '@/lib/types';
import {
  ACCENT_BRAND,
  accentBrandAlpha,
  FOREGROUND,
  MUTED,
  POPOVER_BG,
} from '@/lib/colors';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
);

export function SimulatePage() {
  const holdingsQ = useHoldings();
  const [scenario, setScenario] = useState<Scenario>('neutral');

  const result = useMemo(() => {
    if (!holdingsQ.data) return [];
    return simulate(holdingsQ.data.items, defaultConfig, scenario, 10);
  }, [holdingsQ.data, scenario]);

  if (holdingsQ.isLoading) {
    return (
      <main className="mx-auto w-full max-w-2xl p-4 space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </main>
    );
  }

  const labels = result.map((r) => String(r.year));
  const data = {
    labels,
    datasets: [
      {
        label: '名目總資產',
        data: result.map((r) => r.totalAssetTwd),
        borderColor: ACCENT_BRAND,
        backgroundColor: accentBrandAlpha(0.15),
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointBackgroundColor: 'oklch(0.205 0 0)',
        pointBorderColor: ACCENT_BRAND,
        pointBorderWidth: 2,
      },
    ],
  };

  const goalYearIdx = result.findIndex(
    (r) => r.totalAssetTwd >= defaultConfig.goalTwd,
  );

  return (
    <main className="mx-auto w-full max-w-2xl p-4 pb-24 space-y-6">
      <header className="flex items-center gap-2">
        <Link href="/">
          <Button variant="ghost" size="icon" aria-label="返回">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-lg font-semibold tracking-tight font-display">
          長期試算 · 10 年
        </h1>
      </header>

      <Tabs
        value={scenario}
        onValueChange={(v) => setScenario(v as Scenario)}
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="conservative">保守</TabsTrigger>
          <TabsTrigger value="neutral">中性</TabsTrigger>
          <TabsTrigger value="optimistic">樂觀</TabsTrigger>
        </TabsList>
      </Tabs>

      <section className="rounded-md border border-border p-3 text-sm space-y-1">
        <div>
          {goalYearIdx >= 0 ? (
            <>
              預估 <strong>{result[goalYearIdx].year}</strong> 年達成 1000 萬目標
              {goalYearIdx === 0 ? '(已達成)' : ''}
            </>
          ) : (
            <>10 年內未達成 1000 萬目標,最終 {formatTwd(result[result.length - 1]?.totalAssetTwd ?? 0)}</>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          報酬假設(年化):股票 {(defaultConfig.returns[scenario].stock * 100).toFixed(1)}% ·
          加密 {(defaultConfig.returns[scenario].btc * 100).toFixed(1)}% ·
          現金 {(defaultConfig.returns[scenario].cash * 100).toFixed(1)}% ·
          通膨 {(defaultConfig.inflation * 100).toFixed(1)}%
        </div>
      </section>

      <section
        className="h-64 rounded-2xl border border-white/10 bg-card/40 backdrop-blur-xl p-3"
        style={{ filter: `drop-shadow(0 0 6px ${accentBrandAlpha(0.25)})` }}
      >
        <Line
          data={data}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
              y: {
                grid: { color: 'oklch(1 0 0 / 0.06)' },
                border: { display: false },
                ticks: {
                  callback: (v) => formatTwd(Number(v)),
                  font: { size: 10, family: 'var(--font-display)' },
                  color: MUTED,
                },
              },
              x: {
                grid: { display: false },
                border: { display: false },
                ticks: {
                  font: { size: 10, family: 'var(--font-display)' },
                  color: MUTED,
                },
              },
            },
            plugins: {
              tooltip: {
                backgroundColor: POPOVER_BG,
                titleColor: ACCENT_BRAND,
                bodyColor: FOREGROUND,
                borderColor: accentBrandAlpha(0.4),
                borderWidth: 1,
                padding: 8,
                cornerRadius: 6,
                bodyFont: {
                  size: 11,
                  family: 'var(--font-display)',
                },
                callbacks: {
                  label: (ctx: TooltipItem<'line'>) =>
                    `${ctx.dataset.label}: ${formatTwd(ctx.parsed.y ?? 0)}`,
                },
              },
              legend: {
                labels: {
                  font: { size: 11, family: 'var(--font-body)' },
                  color: FOREGROUND,
                  boxWidth: 12,
                  boxHeight: 2,
                  padding: 12,
                },
              },
            },
          }}
        />
      </section>

      <section>
        <h2 className="text-sm font-medium font-display mb-2">逐年</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>年份</TableHead>
              <TableHead className="text-right">名目</TableHead>
              <TableHead className="text-right">實質</TableHead>
              <TableHead className="text-right">月薪</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.map((r) => (
              <TableRow key={r.year}>
                <TableCell>{r.year}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatTwd(r.totalAssetTwd)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatTwd(r.totalRealTwd)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatTwd(r.monthlySalary)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </main>
  );
}
