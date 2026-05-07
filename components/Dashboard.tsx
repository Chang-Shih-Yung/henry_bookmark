'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  AlertCircle,
  Eye,
  EyeOff,
  LayoutGrid,
  Building2,
  Globe,
  Bitcoin,
  Wallet,
  Landmark,
  Hash,
  TrendingUp,
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
import { NewHoldingDialog } from '@/components/NewHoldingDialog';
import { AssetGrowthChart } from '@/components/AssetGrowthChart';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
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

function tabMatches(tab: TabValue, type: AssetType): boolean {
  if (tab === 'all') return true;
  if (tab === 'cash') return type === 'cash_twd' || type === 'cash_usd';
  return tab === type;
}

export function Dashboard() {
  const router = useRouter();
  const holdingsQ = useHoldings();
  const pricesQ = usePrices();
  const updateMut = useUpdateHoldings();
  const { privacy, toggle: togglePrivacy } = usePrivacy();

  const [newType, setNewType] = useState<AssetType | null>(null);
  const [tab, setTab] = useState<TabValue>('all');
  const [heroView, setHeroView] = useState<'text' | 'chart'>('text');

  const enriched: EnrichedHolding[] = useMemo(() => {
    if (!holdingsQ.data || !pricesQ.data) return [];
    return holdingsQ.data.items.map((h) => enrichHolding(h, pricesQ.data));
  }, [holdingsQ.data, pricesQ.data]);

  const summary = useMemo(
    () => computeSummary(enriched, defaultConfig.goalTwd),
    [enriched],
  );

  // 當前 tab 過濾後的 holdings — 集中 useMemo,避免 render 中 .filter 跑三次
  const filteredEnriched = useMemo(
    () => enriched.filter((h) => tabMatches(tab, h.type)),
    [enriched, tab],
  );

  // dnd-kit sensors — 長按 200ms 觸發拖動,放開內保留點擊行為(進 detail)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !holdingsQ.data) return;
    // 在 全 holdings 順序中找到 from / to,移動後寫回
    const items = holdingsQ.data.items;
    const oldIdx = items.findIndex((h) => h.id === active.id);
    const newIdx = items.findIndex((h) => h.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = {
      ...holdingsQ.data,
      items: arrayMove(items, oldIdx, newIdx),
      lastModified: new Date().toISOString(),
    };
    update(next);
  };

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
    <main
      className="mx-auto w-full max-w-2xl p-4 pb-32 space-y-6"
      style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
    >
      {/* Header — 主導航在底部,header 只留品牌名 */}
      <header className="pt-2">
        <h1 className="text-base font-semibold tracking-tight font-display text-muted-foreground">
          Henry Bookmark
        </h1>
      </header>

      {/* Hero: total + progress(數字 / 圖表 兩種視圖) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>目前總資產</span>
            <button
              type="button"
              onClick={togglePrivacy}
              className="inline-flex items-center justify-center h-6 w-6 rounded-md hover:bg-accent/30 hover:text-foreground transition-colors"
              aria-label={privacy ? '顯示金額' : '隱藏金額'}
            >
              {privacy ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
          {/* 文字 / 圖表 切換 — shadcn ToggleGroup,藥丸樣式 */}
          <ToggleGroup
            value={[heroView]}
            onValueChange={(v) => {
              if (v.length > 0) setHeroView(v[0] as 'text' | 'chart');
            }}
            className="h-9 rounded-full"
          >
            <ToggleGroupItem
              value="text"
              aria-label="文字模式"
              className="rounded-full w-10 px-0"
            >
              <Hash className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="chart"
              aria-label="圖表模式"
              className="rounded-full w-10 px-0"
            >
              <TrendingUp className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {heroView === 'text' ? (
          <>
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
          </>
        ) : (
          <AssetGrowthChart enriched={enriched} privacy={privacy} />
        )}

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

      {/* Sticky tab bar — 鎖橫向 scroll(touch-action: pan-x),不滿版,不上底色,沒數字 count */}
      <div className="sticky top-0 z-10 py-3">
        <div
          className="flex gap-6 overflow-x-auto overflow-y-hidden scrollbar-none"
          style={{ touchAction: 'pan-x' }}
        >
          {TABS.map((t) => {
            const active = tab === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setTab(t.value)}
                className={cn(
                  'shrink-0 relative pb-1.5 text-[15px] transition-colors',
                  active
                    ? 'text-foreground font-medium'
                    : 'text-muted-foreground/70 hover:text-foreground',
                )}
              >
                <span>{t.label}</span>
                {active && (
                  <span
                    aria-hidden
                    className="absolute left-0 right-0 -bottom-0.5 h-[2px] rounded-full bg-foreground"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content — 統一邏輯:每個 tab 都是「TabSummary + holdings list」,全部 tab 加 AllocationPie */}
      <section className="space-y-3">
        {tab === 'all' && summary.totalAssetTwd > 0 && (
          <div className="rounded-2xl border border-white/10 bg-card/40 backdrop-blur-xl p-4">
            <h2 className="text-xs text-muted-foreground mb-2">資產分布</h2>
            <AllocationPie summary={summary} />
          </div>
        )}
        <TabSummary items={filteredEnriched} privacy={privacy} />
        {filteredEnriched.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            {tab === 'all'
              ? '還沒有任何資產 — 切換到下方分頁新增第一筆。'
              : '這個分類還沒有資產。'}
          </div>
        ) : (
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <SortableContext
              items={filteredEnriched.map((h) => h.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {filteredEnriched.map((h) => (
                  <HoldingRow
                    key={h.id}
                    holding={h}
                    usdTwd={pricesQ.data?.usdTwd}
                    onCardClick={() => router.push(`/holding/${h.id}`)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
        {tab !== 'all' && (
          <NewButtons tab={tab} onNew={(type) => setNewType(type)} />
        )}
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

      {/* Dialogs — 詳情編輯都搬到 /holding/[id] 子頁,首頁只剩新增 */}
      <NewHoldingDialog
        type={newType}
        open={!!newType}
        onClose={() => setNewType(null)}
        onConfirm={addHolding}
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

/**
 * 分類 tab 的小計 — 對齊國泰證券 app「敦南分公司 5705016」那層。
 * 顯示:參考總現值 / 成本 / 參考損益(金額 + %)。
 * 全幣別統一用 TWD canonical(跟全站總資產口徑一致)。
 */
function TabSummary({
  items,
  privacy,
}: {
  items: EnrichedHolding[];
  privacy: boolean;
}) {
  if (items.length === 0) return null;
  const total = items.reduce((sum, h) => sum + h.marketValueTwd, 0);
  const cost = items.reduce((sum, h) => sum + h.costBasisTwd, 0);
  const pnl = total - cost;
  const pnlPct = cost > 0 ? pnl / cost : 0;
  const positive = pnl >= 0;
  const showPnL = cost > 0 && pnl !== 0;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl p-4 space-y-3',
        'bg-card/40 backdrop-blur-xl',
        'border border-white/10',
        'shadow-[0_4px_24px_rgba(0,0,0,0.25)]',
      )}
    >
      {/* 內部微微的高光,讓玻璃質感更立體 */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent"
      />
      <div className="relative">
        <div className="text-xs text-muted-foreground">參考總現值 (TWD)</div>
        <div className="text-3xl font-bold font-display tabular-nums mt-1">
          {maskMoney(formatTwd(total), privacy)}
        </div>
      </div>
      <div className="relative grid grid-cols-2 gap-3 pt-3 border-t border-white/8">
        <div>
          <div className="text-xs text-muted-foreground">成本 (TWD)</div>
          <div className="text-lg font-medium tabular-nums mt-0.5">
            {maskMoney(formatTwd(cost), privacy)}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">參考損益 (TWD)</div>
          {showPnL ? (
            <div
              className={cn(
                'text-lg font-medium tabular-nums mt-0.5',
                positive ? 'text-up' : 'text-down',
              )}
            >
              {maskMoney(formatChange(pnl), privacy)}{' '}
              <span className="text-sm">({formatPct(pnlPct)})</span>
            </div>
          ) : (
            <div className="text-lg text-muted-foreground tabular-nums mt-0.5">
              —
            </div>
          )}
        </div>
      </div>
    </div>
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
