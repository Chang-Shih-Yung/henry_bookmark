'use client';

import { useMemo, useState } from 'react';
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
import { Progress } from '@/components/ui/progress';
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
import { useHoldings, usePrices } from '@/lib/api';
import { computeSummary, enrichHolding, simulate } from '@/lib/calc';
import { defaultConfig } from '@/lib/config';
import { formatTwd } from '@/lib/format';
import { usePrivacy } from '@/lib/privacy';
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
  const pricesQ = usePrices();
  const { privacy } = usePrivacy();
  const [scenario, setScenario] = useState<Scenario>('neutral');

  const result = useMemo(() => {
    if (!holdingsQ.data) return [];
    return simulate(holdingsQ.data.items, defaultConfig, scenario, 10);
  }, [holdingsQ.data, scenario]);

  // 「達成 / 還差」從 Dashboard hero 搬過來:用當下實際 marketValueTwd 算 progress,
  // 配合下方試算「未來 10 年走勢」很有 context — 看到目前 X% + 預估幾年達成。
  const currentSummary = useMemo(() => {
    if (!holdingsQ.data || !pricesQ.data) return null;
    const enriched = holdingsQ.data.items.map((h) =>
      enrichHolding(h, pricesQ.data!),
    );
    return computeSummary(enriched, defaultConfig.goalTwd);
  }, [holdingsQ.data, pricesQ.data]);

  const remainingToGoal = currentSummary
    ? Math.max(defaultConfig.goalTwd - currentSummary.totalAssetTwd, 0)
    : 0;

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
      {/* 試算是底部 BottomNav 的一個 tab,沒有「上一頁」可返回 — 拿掉左上 ArrowLeft */}
      <header className="pt-2">
        <h1 className="text-lg font-semibold tracking-tight font-display">
          長期試算 · 10 年
        </h1>
      </header>

      {/* 從 Dashboard hero 搬來的「達成 / 還差」row — 試算頁面看著「目前進度 + 預估走勢」更直覺
          privacy 跟首頁的眼睛 toggle 共用同一個 Context,自動同步 */}
      {currentSummary && (
        <section className="space-y-2">
          <Progress
            value={Math.min(currentSummary.goalProgressPct * 100, 100)}
            className="h-2"
          />
          <div
            key={`sim-goal-${privacy ? 'm' : 's'}`}
            className="flex items-baseline justify-between gap-3 text-xs tabular-nums"
          >
            <div className="font-display">
              <span className="text-base font-semibold text-foreground">
                {(currentSummary.goalProgressPct * 100).toFixed(1)}%
              </span>
              <span className="ml-1.5 text-[11px] text-muted-foreground">
                達成
              </span>
            </div>
            <div className="text-muted-foreground text-right">
              還差{' '}
              <span className="text-foreground font-medium">
                {privacy ? '••••' : formatTwd(remainingToGoal)}
              </span>
              <span className="text-muted-foreground/50">
                {' '}
                / {privacy ? '••••' : formatTwd(defaultConfig.goalTwd)}
              </span>
            </div>
          </div>
        </section>
      )}

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
