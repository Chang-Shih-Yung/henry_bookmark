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
  ChevronRight,
  LayoutGrid,
  Building2,
  Globe,
  Bitcoin,
  Wallet,
  Landmark,
  type LucideIcon,
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
import { HoldingDetailSheet } from '@/components/HoldingDetailSheet';
import { HoldingEditSheet } from '@/components/HoldingEditSheet';
import { BuyDialog, SellDialog } from '@/components/BuySellDialogs';
import { NewHoldingDialog } from '@/components/NewHoldingDialog';
import { formatPct, formatTwd, formatChange } from '@/lib/format';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type TabValue =
  | 'all'
  | 'tw_stock'
  | 'us_stock'
  | 'crypto'
  | 'cash'
  | 'trust';

const TABS: Array<{ value: TabValue; label: string; Icon: LucideIcon }> = [
  { value: 'all', label: '全部', Icon: LayoutGrid },
  { value: 'tw_stock', label: '台股', Icon: Building2 },
  { value: 'us_stock', label: '美股', Icon: Globe },
  { value: 'crypto', label: '加密', Icon: Bitcoin },
  { value: 'cash', label: '現金', Icon: Wallet },
  { value: 'trust', label: '信託', Icon: Landmark },
];

/** 「全部」分頁 → 點分類卡可跳到對應 tab。 */
const TAB_SUMMARIES: Array<{
  tab: Exclude<TabValue, 'all'>;
  label: string;
  Icon: LucideIcon;
  types: AssetType[];
}> = [
  { tab: 'tw_stock', label: '台股', Icon: Building2, types: ['tw_stock'] },
  { tab: 'us_stock', label: '美股', Icon: Globe, types: ['us_stock'] },
  { tab: 'crypto', label: '加密貨幣', Icon: Bitcoin, types: ['crypto'] },
  {
    tab: 'cash',
    label: '現金',
    Icon: Wallet,
    types: ['cash_twd', 'cash_usd'],
  },
  { tab: 'trust', label: '富邦信託', Icon: Landmark, types: ['trust'] },
];

function tabMatches(tab: TabValue, type: AssetType): boolean {
  if (tab === 'all') return true;
  if (tab === 'cash') return type === 'cash_twd' || type === 'cash_usd';
  return tab === type;
}

export function Dashboard() {
  const holdingsQ = useHoldings();
  const pricesQ = usePrices();
  const updateMut = useUpdateHoldings();
  const { privacy, toggle: togglePrivacy } = usePrivacy();

  const [buyTarget, setBuyTarget] = useState<Holding | null>(null);
  const [sellTarget, setSellTarget] = useState<Holding | null>(null);
  const [detailTarget, setDetailTarget] = useState<EnrichedHolding | null>(
    null,
  );
  const [editTarget, setEditTarget] = useState<EnrichedHolding | null>(null);
  const [newType, setNewType] = useState<AssetType | null>(null);
  const [tab, setTab] = useState<TabValue>('all');

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

  const deleteHolding = (id: string): boolean => {
    if (!holdingsQ.data) return false;
    if (!confirm('確定刪除這筆資產?所有交易紀錄會一起消失。')) return false;
    const items = holdingsQ.data.items.filter((h) => h.id !== id);
    update({ ...holdingsQ.data, items });
    return true;
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
              ? '尚未投入'
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

      {/* Sticky tab bar */}
      <div className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
          {TABS.map((t) => {
            const count =
              t.value === 'all'
                ? enriched.length
                : enriched.filter((h) => tabMatches(t.value, h.type)).length;
            const active = tab === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setTab(t.value)}
                className={cn(
                  'shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                  active
                    ? 'bg-foreground text-background'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70',
                )}
              >
                <t.Icon className="h-3.5 w-3.5" />
                <span>{t.label}</span>
                {count > 0 && (
                  <span
                    className={cn(
                      'tabular-nums text-[10px]',
                      active ? 'text-background/70' : 'text-muted-foreground/60',
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      {tab === 'all' ? (
        <>
          {summary.totalAssetTwd > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-medium font-display">資產分布</h2>
              <AllocationPie summary={summary} />
            </section>
          )}
          <section className="space-y-2">
            <h2 className="text-sm font-medium font-display">分類</h2>
            <div className="space-y-2">
              {TAB_SUMMARIES.map((s) => {
                const items = enriched.filter((h) => s.types.includes(h.type));
                const subtotal = items.reduce(
                  (sum, h) => sum + h.marketValueTwd,
                  0,
                );
                const cost = items.reduce((sum, h) => sum + h.costBasisTwd, 0);
                const pnlPct = cost > 0 ? (subtotal - cost) / cost : 0;
                const positive = subtotal - cost >= 0;
                return (
                  <button
                    key={s.tab}
                    type="button"
                    onClick={() => setTab(s.tab)}
                    className="w-full flex items-center justify-between rounded-lg border border-border bg-card p-3.5 hover:bg-accent/30 active:bg-accent/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-muted inline-flex items-center justify-center text-muted-foreground">
                        <s.Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">{s.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {items.length} 筆
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="text-sm font-semibold tabular-nums">
                          {maskMoney(formatTwd(subtotal), privacy)}
                        </div>
                        {cost > 0 && (
                          <div
                            className={cn(
                              'text-xs tabular-nums',
                              positive ? 'text-up' : 'text-down',
                            )}
                          >
                            {positive ? '▲' : '▼'} {formatPct(pnlPct)}
                          </div>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </>
      ) : (
        <section className="space-y-2">
          {enriched.filter((h) => tabMatches(tab, h.type)).length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              這個分類還沒有資產。
              <br />
              用下面的按鈕新增第一筆。
            </div>
          ) : (
            enriched
              .filter((h) => tabMatches(tab, h.type))
              .map((h) => (
                <HoldingRow
                  key={h.id}
                  holding={h}
                  usdTwd={pricesQ.data?.usdTwd}
                  onCardClick={() => setDetailTarget(h)}
                />
              ))
          )}
          <NewButtons tab={tab} onNew={(type) => setNewType(type)} />
        </section>
      )}

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
      <HoldingDetailSheet
        holding={detailTarget}
        open={!!detailTarget}
        usdTwd={pricesQ.data?.usdTwd}
        onClose={() => setDetailTarget(null)}
        onBuyClick={() => {
          if (detailTarget) {
            setBuyTarget(detailTarget);
            setDetailTarget(null);
          }
        }}
        onSellClick={() => {
          if (detailTarget) {
            setSellTarget(detailTarget);
            setDetailTarget(null);
          }
        }}
        onEditClick={() => {
          if (detailTarget) {
            setEditTarget(detailTarget);
            setDetailTarget(null);
          }
        }}
        onDeleteClick={() => {
          if (detailTarget && deleteHolding(detailTarget.id)) {
            setDetailTarget(null);
          }
        }}
      />
      <HoldingEditSheet
        holding={editTarget}
        open={!!editTarget}
        usdTwd={pricesQ.data?.usdTwd}
        onClose={() => setEditTarget(null)}
        onUpdate={(patch) => {
          if (editTarget) updateHolding(editTarget.id, patch);
        }}
      />
    </main>
  );
}

/** 分頁底部的「+ 新增」按鈕。現金分頁顯示兩顆(台幣 / 美金),其他單顆。 */
function NewButtons({
  tab,
  onNew,
}: {
  tab: Exclude<TabValue, 'all'>;
  onNew: (type: AssetType) => void;
}) {
  if (tab === 'cash') {
    return (
      <div className="grid grid-cols-2 gap-2 pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNew('cash_twd')}
          className="gap-1"
        >
          <Plus className="h-3.5 w-3.5" /> 新增台幣
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNew('cash_usd')}
          className="gap-1"
        >
          <Plus className="h-3.5 w-3.5" /> 新增美金
        </Button>
      </div>
    );
  }
  const labels: Record<Exclude<TabValue, 'all' | 'cash'>, string> = {
    tw_stock: '台股',
    us_stock: '美股',
    crypto: '加密貨幣',
    trust: '信託',
  };
  const types: Record<Exclude<TabValue, 'all' | 'cash'>, AssetType> = {
    tw_stock: 'tw_stock',
    us_stock: 'us_stock',
    crypto: 'crypto',
    trust: 'trust',
  };
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => onNew(types[tab])}
      className="w-full gap-1 mt-2"
    >
      <Plus className="h-3.5 w-3.5" /> 新增{labels[tab]}
    </Button>
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
