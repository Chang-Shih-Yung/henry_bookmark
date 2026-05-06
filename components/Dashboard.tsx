'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Settings as SettingsIcon,
  AlertCircle,
  BarChart3,
  Eye,
  EyeOff,
} from 'lucide-react';
import { usePrivacy, maskMoney } from '@/lib/privacy';
import { useHoldings, usePrices, useUpdateHoldings } from '@/lib/api';
import { computeSummary, enrichHolding } from '@/lib/calc';
import { defaultConfig } from '@/lib/config';
import type {
  AssetType,
  EnrichedHolding,
  Holding,
  Holdings,
} from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { MoneyDisplay } from '@/components/MoneyDisplay';
import { AllocationPie } from '@/components/AllocationPie';
import { HoldingRow } from '@/components/HoldingRow';
import { BuyDialog, SellDialog } from '@/components/BuySellDialogs';
import { NewHoldingDialog } from '@/components/NewHoldingDialog';
import { formatPct, formatTwd, formatChange } from '@/lib/format';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const TYPE_GROUPS: Array<{ type: AssetType; label: string; icon: string }> = [
  { type: 'tw_stock', label: '台股', icon: '🇹🇼' },
  { type: 'us_stock', label: '美股', icon: '🇺🇸' },
  { type: 'crypto', label: '加密貨幣', icon: '₿' },
  { type: 'cash_twd', label: '台幣', icon: '💵' },
  { type: 'cash_usd', label: '美金', icon: '💵' },
  { type: 'trust', label: '富邦信託', icon: '🏦' },
];

export function Dashboard() {
  const holdingsQ = useHoldings();
  const pricesQ = usePrices();
  const updateMut = useUpdateHoldings();
  const { privacy, toggle: togglePrivacy } = usePrivacy();

  const [buyTarget, setBuyTarget] = useState<Holding | null>(null);
  const [sellTarget, setSellTarget] = useState<Holding | null>(null);
  const [newType, setNewType] = useState<AssetType | null>(null);

  const enriched: EnrichedHolding[] = useMemo(() => {
    if (!holdingsQ.data || !pricesQ.data) return [];
    return holdingsQ.data.items.map((h) => enrichHolding(h, pricesQ.data));
  }, [holdingsQ.data, pricesQ.data]);

  const summary = useMemo(
    () => computeSummary(enriched, defaultConfig.goalTwd),
    [enriched],
  );

  const remainingToGoal = Math.max(
    defaultConfig.goalTwd - summary.totalAssetTwd,
    0,
  );

  const update = async (next: Holdings) => {
    try {
      await updateMut.mutateAsync(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '存檔失敗');
    }
  };

  const updateHolding = (id: string, patch: Partial<Holding>) => {
    if (!holdingsQ.data) return;
    const items = holdingsQ.data.items.map((h) =>
      h.id === id ? { ...h, ...patch, updatedAt: new Date().toISOString() } : h,
    );
    update({ ...holdingsQ.data, items });
  };

  const replaceHolding = (id: string, next: Holding) => {
    if (!holdingsQ.data) return;
    const items = holdingsQ.data.items.map((h) => (h.id === id ? next : h));
    update({ ...holdingsQ.data, items });
  };

  const deleteHolding = (id: string) => {
    if (!holdingsQ.data) return;
    if (!confirm('確定刪除這筆資產?')) return;
    const items = holdingsQ.data.items.filter((h) => h.id !== id);
    update({ ...holdingsQ.data, items });
  };

  const addHolding = (h: Holding) => {
    if (!holdingsQ.data) return;
    const items = [...holdingsQ.data.items, h];
    update({ ...holdingsQ.data, items });
    toast.success(`新增 ${h.displayName}`);
  };

  // ── Loading ──
  if (holdingsQ.isLoading) {
    return <DashboardSkeleton />;
  }
  if (holdingsQ.error) {
    return (
      <div className="p-6 text-center text-sm text-destructive">
        無法載入 holdings: {String(holdingsQ.error)}
      </div>
    );
  }

  const failedSources = pricesQ.data
    ? Object.entries(pricesQ.data._debug.sources)
        .filter(([, v]) => v === 'failed')
        .map(([k]) => k)
    : [];

  return (
    <main className="mx-auto w-full max-w-2xl p-4 pb-24 space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight font-display">
          Henry Bookmark
        </h1>
        <div className="flex items-center gap-1">
          <Link href="/simulate">
            <Button variant="ghost" size="icon" aria-label="長期試算">
              <BarChart3 className="h-5 w-5" />
            </Button>
          </Link>
          <Link href="/settings">
            <Button variant="ghost" size="icon" aria-label="設定">
              <SettingsIcon className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero: total + progress */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>目前總資產</span>
          <button
            type="button"
            onClick={togglePrivacy}
            className="inline-flex items-center justify-center h-6 w-6 rounded-md hover:bg-accent hover:text-foreground transition-colors"
            aria-label={privacy ? '顯示金額' : '隱藏金額'}
          >
            {privacy ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
        <MoneyDisplay
          twd={summary.totalAssetTwd}
          hidden={privacy}
          className="text-5xl font-bold font-display tracking-tight block text-foreground"
        />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm tabular-nums">
          <span
            className={cn(
              summary.totalCostBasisTwd === 0
                ? 'text-muted-foreground'
                : summary.totalUnrealizedPnlTwd >= 0
                  ? 'text-up'
                  : 'text-down',
            )}
          >
            {summary.totalCostBasisTwd === 0
              ? '尚無成本資料'
              : `累計 ${summary.totalUnrealizedPnlTwd >= 0 ? '▲' : '▼'} ${formatPct(summary.totalUnrealizedPnlPct)} (${maskMoney(formatTwd(summary.totalUnrealizedPnlTwd), privacy)})`}
          </span>
          {summary.totalTodayChangeTwd !== 0 && (
            <span
              className={cn(
                'text-xs',
                summary.totalTodayChangeTwd >= 0 ? 'text-up' : 'text-down',
              )}
            >
              今日 {summary.totalTodayChangeTwd >= 0 ? '▲' : '▼'}{' '}
              {formatPct(summary.totalTodayChangePct)} (
              {maskMoney(formatChange(summary.totalTodayChangeTwd), privacy)})
            </span>
          )}
        </div>
        <Progress
          value={Math.min(summary.goalProgressPct * 100, 100)}
          className="h-2"
        />
        <div className="text-xs text-muted-foreground tabular-nums">
          {(summary.goalProgressPct * 100).toFixed(1)}% · 離{' '}
          {maskMoney(formatTwd(defaultConfig.goalTwd), privacy)} 還差{' '}
          <span className="text-foreground">
            {maskMoney(formatTwd(remainingToGoal), privacy)}
          </span>
        </div>
      </section>

      {/* Price source warning */}
      {failedSources.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 p-3 text-xs text-warning">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">部分即時價來源異常</div>
            <div className="text-muted-foreground mt-0.5">
              失敗:{failedSources.join(', ')} · 受影響欄位顯示為「估算」
            </div>
          </div>
        </div>
      )}

      {/* Allocation pie */}
      {summary.totalAssetTwd > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium font-display">資產分布</h2>
          <AllocationPie summary={summary} />
        </section>
      )}

      {/* Holdings groups */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium font-display">持有部位</h2>
        {TYPE_GROUPS.map((g) => {
          const items = enriched.filter((h) => h.type === g.type);
          const subtotal = items.reduce((s, h) => s + h.marketValueTwd, 0);
          const cost = items.reduce((s, h) => s + h.costBasisTwd, 0);
          const pnlPct = cost > 0 ? (subtotal - cost) / cost : 0;
          const positive = subtotal - cost >= 0;
          return (
            <div key={g.type} className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground border-b border-border pb-1">
                <span className="font-medium">
                  {g.icon} {g.label}
                </span>
                <span className="tabular-nums">
                  {maskMoney(formatTwd(subtotal), privacy)}{' '}
                  {cost > 0 && (
                    <span
                      className={cn(
                        'ml-1',
                        positive ? 'text-up' : 'text-down',
                      )}
                    >
                      {formatPct(pnlPct)}
                    </span>
                  )}
                </span>
              </div>
              {items.map((h) => (
                <HoldingRow
                  key={h.id}
                  holding={h}
                  usdTwd={pricesQ.data?.usdTwd}
                  onUpdate={(patch) => updateHolding(h.id, patch)}
                  onDelete={() => deleteHolding(h.id)}
                  onBuyClick={() => setBuyTarget(h)}
                  onSellClick={() => setSellTarget(h)}
                />
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setNewType(g.type)}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> 新增{g.label}
              </Button>
            </div>
          );
        })}
      </section>

      {/* Footer info */}
      <footer className="pt-6 text-center text-xs text-muted-foreground">
        {holdingsQ.data && (
          <div>
            最後修改:{new Date(holdingsQ.data.lastModified).toLocaleString('zh-TW')}
          </div>
        )}
        {pricesQ.data && (
          <div>即時價更新:{new Date(pricesQ.data.fetchedAt).toLocaleTimeString('zh-TW')}</div>
        )}
      </footer>

      {/* Dialogs */}
      <BuyDialog
        holding={buyTarget}
        open={!!buyTarget}
        onClose={() => setBuyTarget(null)}
        onConfirm={(next) => replaceHolding(next.id, next)}
      />
      <SellDialog
        holding={sellTarget}
        open={!!sellTarget}
        onClose={() => setSellTarget(null)}
        onConfirm={(next) => replaceHolding(next.id, next)}
      />
      <NewHoldingDialog
        type={newType}
        open={!!newType}
        onClose={() => setNewType(null)}
        onConfirm={addHolding}
      />
    </main>
  );
}

function DashboardSkeleton() {
  return (
    <main className="mx-auto w-full max-w-2xl p-4 space-y-6">
      <Skeleton className="h-6 w-32" />
      <div className="space-y-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-12 w-48" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-3 w-40" />
      </div>
      <Skeleton className="h-48 w-full max-w-xs mx-auto rounded-full" />
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </main>
  );
}
