'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Plus,
  AlertTriangle,
  Trash2,
  Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  formatTwd,
  formatPct,
  formatUnits,
  formatChange,
  formatPrice,
  formatUsd,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import { usePrivacy, maskMoney } from '@/lib/privacy';
import {
  isUsdNativeType,
  formatPriceForDisplay,
} from '@/components/HoldingEditSheet';
import {
  useHoldings,
  usePrices,
  useUpdateHoldings,
} from '@/lib/api';
import { enrichHolding } from '@/lib/calc';
import type {
  AssetType,
  EnrichedHolding,
  Holding,
  Transaction,
} from '@/lib/types';
import { BuyDialog } from '@/components/BuySellDialogs';
import { EditAvgPriceDialog } from '@/components/EditAvgPriceDialog';
import { toast } from 'sonner';

/** 同 tab 分類 — 現金合併,其餘嚴格相等。 */
function sameTabType(a: AssetType, b: AssetType): boolean {
  if (a === b) return true;
  const isCashA = a === 'cash_twd' || a === 'cash_usd';
  const isCashB = b === 'cash_twd' || b === 'cash_usd';
  return isCashA && isCashB;
}

type Props = { id: string };

/**
 * 完整跳頁版「單一持股資訊」— 取代原本的 HoldingDetailSheet drawer。
 * 不再有雙層 drawer 疊加問題,左上角返回箭頭直接 router.back()。
 * Carousel 切換僅更動本地 currentId,不更動 URL(swipe 太頻繁不該污染 history)。
 */
export function HoldingDetailPage({ id }: Props) {
  const router = useRouter();
  const holdingsQ = useHoldings();
  const pricesQ = usePrices();
  const updateMut = useUpdateHoldings();
  const { privacy } = usePrivacy();
  const carouselRef = useRef<HTMLDivElement>(null);

  const enriched: EnrichedHolding[] = useMemo(() => {
    if (!holdingsQ.data || !pricesQ.data) return [];
    return holdingsQ.data.items.map((h) => enrichHolding(h, pricesQ.data));
  }, [holdingsQ.data, pricesQ.data]);

  // 進來時的 holding(用 URL id 當 anchor),找不到 → 回首頁
  const anchor = enriched.find((h) => h.id === id) ?? null;

  // currentId 是 carousel 當前 visible 卡的 id;用 anchor.id 作為初始
  const [currentId, setCurrentId] = useState<string>(id);
  useEffect(() => {
    setCurrentId(id);
  }, [id]);

  const siblings = anchor
    ? enriched.filter((h) => sameTabType(anchor.type, h.type))
    : [];
  const currentHolding =
    siblings.find((h) => h.id === currentId) ?? anchor ?? null;

  const [buyTarget, setBuyTarget] = useState<Holding | null>(null);
  const [editAvgTarget, setEditAvgTarget] = useState<Holding | null>(null);

  // 進場 + currentId 變動時把對應卡置中
  useEffect(() => {
    if (!currentId || !carouselRef.current) return;
    const carousel = carouselRef.current;
    const card = carousel.querySelector<HTMLElement>(
      `[data-card-id="${CSS.escape(currentId)}"]`,
    );
    if (!card) return;
    requestAnimationFrame(() => {
      const targetLeft =
        card.offsetLeft - (carousel.clientWidth - card.offsetWidth) / 2;
      carousel.scrollTo({ left: targetLeft, behavior: 'auto' });
    });
  }, [currentId, siblings.length]);

  // onScroll debounce 偵測哪張卡離中心最近
  const scrollDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleCarouselScroll = useCallback(() => {
    if (scrollDebounceRef.current) clearTimeout(scrollDebounceRef.current);
    scrollDebounceRef.current = setTimeout(() => {
      const el = carouselRef.current;
      if (!el) return;
      const cards = el.querySelectorAll<HTMLElement>('[data-card-id]');
      if (cards.length === 0) return;
      const containerRect = el.getBoundingClientRect();
      const containerCenter = containerRect.left + containerRect.width / 2;
      let bestId: string | null = null;
      let bestDist = Infinity;
      cards.forEach((card) => {
        const rect = card.getBoundingClientRect();
        const cardCenter = rect.left + rect.width / 2;
        const dist = Math.abs(cardCenter - containerCenter);
        if (dist < bestDist) {
          bestDist = dist;
          bestId = card.dataset.cardId ?? null;
        }
      });
      if (bestId && bestId !== currentId) setCurrentId(bestId);
    }, 80);
  }, [currentId]);

  // Loading
  if (holdingsQ.isLoading || pricesQ.isLoading) {
    return (
      <main
        className="mx-auto w-full max-w-2xl p-4 pb-32"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
      >
        <div className="text-sm text-muted-foreground">載入中…</div>
      </main>
    );
  }

  // 找不到對應 holding(誤打 URL / 已被刪除)→ 回首頁
  if (!anchor || !currentHolding) {
    return (
      <main
        className="mx-auto w-full max-w-2xl p-4 pb-32"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
      >
        <BackBar onBack={() => router.push('/')} />
        <div className="text-sm text-muted-foreground mt-6">
          找不到這筆資產(可能已刪除)。
        </div>
      </main>
    );
  }

  const isUsdNative = isUsdNativeType(currentHolding.type);
  const transactions = [...(currentHolding.transactions ?? [])].sort(
    (a, b) =>
      new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
  const unitTag = unitTagFor(currentHolding.type);

  const replaceHolding = async (next: Holding) => {
    if (!holdingsQ.data) return;
    const items = holdingsQ.data.items.map((h) =>
      h.id === next.id ? next : h,
    );
    try {
      await updateMut.mutateAsync({ ...holdingsQ.data, items });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '存檔失敗');
    }
  };

  const deleteCurrent = async () => {
    if (!holdingsQ.data) return;
    if (!confirm('確定刪除這筆資產?所有交易紀錄會一起消失。')) return;
    const items = holdingsQ.data.items.filter(
      (h) => h.id !== currentHolding.id,
    );
    try {
      await updateMut.mutateAsync({ ...holdingsQ.data, items });
      router.push('/');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '刪除失敗');
    }
  };

  return (
    <main
      className="mx-auto w-full max-w-2xl pb-32 flex flex-col min-h-dvh"
      style={{ paddingTop: 'max(0.25rem, env(safe-area-inset-top))' }}
    >
      <BackBar onBack={() => router.push('/')} />

      {/* 標題列 — 國泰風格「單一持股資訊 / 所有庫存」 */}
      <div className="text-center pt-1 pb-3">
        <div className="text-sm font-medium">單一持股資訊</div>
        <div className="text-[11px] text-muted-foreground">所有庫存</div>
      </div>

      {/* Carousel header */}
      <div
        ref={carouselRef}
        onScroll={handleCarouselScroll}
        className="overflow-x-auto overflow-y-hidden scrollbar-none border-y border-white/5 bg-background/20"
        style={{
          scrollSnapType: 'x mandatory',
          scrollPaddingInline: '10%',
        }}
      >
        <div className="flex gap-3 px-[10%] py-4">
          {siblings.map((h) => (
            <div
              key={h.id}
              data-card-id={h.id}
              className="snap-center shrink-0 w-[80%]"
            >
              <HoldingHeaderCard
                holding={h}
                usdTwd={pricesQ.data?.usdTwd}
                privacy={privacy}
                onEditAvgClick={() => setEditAvgTarget(h)}
              />
            </div>
          ))}
        </div>
        {siblings.length > 1 && (
          <div className="text-[10px] text-muted-foreground/70 text-center pb-2 tabular-nums">
            {siblings.findIndex((h) => h.id === currentHolding.id) + 1} /{' '}
            {siblings.length} · 左右滑動切換
          </div>
        )}
      </div>

      {/* Transactions */}
      <div className="flex-1 px-4 py-3">
        <div className="text-xs text-muted-foreground mb-2 font-medium">
          交易紀錄 {transactions.length > 0 && `(${transactions.length})`}
        </div>
        {transactions.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            還沒有交易紀錄。
            <br />
            下次加買 / 賣出 / 校正都會記錄在這。
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <TransactionRow
                key={tx.id}
                tx={tx}
                unitTag={unitTag}
                isUsdNative={isUsdNative}
                privacy={privacy}
              />
            ))}
          </div>
        )}

        <div className="pt-6 pb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={deleteCurrent}
            className="w-full text-destructive hover:text-destructive hover:bg-destructive/5 gap-1.5"
          >
            <Trash2 className="h-4 w-4" />
            刪除這筆資產
          </Button>
        </div>
      </div>

      {/* Sticky bottom action bar */}
      <div
        className="fixed bottom-0 inset-x-0 border-t border-white/10 bg-popover/85 backdrop-blur-xl p-3 z-30"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto max-w-2xl">
          <Button
            size="lg"
            onClick={() => setBuyTarget(currentHolding)}
            className="w-full gap-1.5"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span className="truncate">新增一筆存款</span>
          </Button>
        </div>
      </div>

      {/* 編輯 dialogs — 單層 drawer,沒有疊層問題 */}
      <BuyDialog
        holding={buyTarget}
        open={!!buyTarget}
        usdTwd={pricesQ.data?.usdTwd}
        onClose={() => setBuyTarget(null)}
        onConfirm={replaceHolding}
      />
      <EditAvgPriceDialog
        holding={editAvgTarget}
        open={!!editAvgTarget}
        onClose={() => setEditAvgTarget(null)}
        onConfirm={replaceHolding}
      />
    </main>
  );
}

function BackBar({ onBack }: { onBack: () => void }) {
  return (
    <div className="px-2 py-1 flex items-center">
      <button
        type="button"
        onClick={onBack}
        aria-label="返回"
        className="inline-flex items-center justify-center h-10 w-10 rounded-full text-foreground hover:bg-accent/30 transition-colors -ml-1"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
    </div>
  );
}

function unitTagFor(type: EnrichedHolding['type']): string {
  if (type === 'crypto') return '顆';
  if (type === 'tw_stock' || type === 'us_stock') return '股';
  if (type === 'cash_usd') return 'USD';
  return 'TWD';
}

function HoldingHeaderCard({
  holding,
  usdTwd,
  privacy,
  onEditAvgClick,
}: {
  holding: EnrichedHolding;
  usdTwd: number | null | undefined;
  privacy: boolean;
  onEditAvgClick: () => void;
}) {
  const fxRate = usdTwd ?? 0;
  const isUsdNative = isUsdNativeType(holding.type);
  const stockOrCrypto =
    holding.type === 'tw_stock' ||
    holding.type === 'us_stock' ||
    holding.type === 'crypto';
  const isCash = holding.type === 'cash_twd' || holding.type === 'cash_usd';
  const unitTag = unitTagFor(holding.type);

  const costUsdView = isUsdNative
    ? holding.costBasisUsd ??
      (fxRate > 0 && holding.costBasisTwd > 0
        ? holding.costBasisTwd / fxRate
        : 0)
    : 0;

  const costStr = isUsdNative
    ? formatUsd(costUsdView)
    : formatTwd(holding.costBasisTwd, 'full');

  const manualAvg = isUsdNative ? holding.avgPriceUsd : holding.avgPriceTwd;
  const showAvg =
    stockOrCrypto &&
    (manualAvg !== undefined ||
      (holding.units > 0 &&
        (isUsdNative ? costUsdView > 0 : holding.costBasisTwd > 0)));
  const avg = !showAvg
    ? 0
    : manualAvg !== undefined
      ? manualAvg
      : isUsdNative
        ? costUsdView / holding.units
        : holding.costBasisTwd / holding.units;
  const numFmtOptions = {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  };
  const avgStr = showAvg ? avg.toLocaleString('en-US', numFmtOptions) : '—';

  const priceVal =
    holding.currentPriceTwd === null
      ? null
      : isUsdNative && fxRate > 0
        ? holding.currentPriceTwd / fxRate
        : holding.currentPriceTwd;
  const priceStr =
    priceVal === null ? '—' : priceVal.toLocaleString('en-US', numFmtOptions);

  void formatPrice;
  void formatPriceForDisplay;

  const pnlPositive = holding.unrealizedPnlTwd >= 0;
  const showPnL = stockOrCrypto && holding.costBasisTwd > 0;
  const showMktValue =
    stockOrCrypto && holding.currentPriceTwd !== null && holding.units > 0;

  const pnlValue = isUsdNative
    ? fxRate > 0
      ? holding.unrealizedPnlTwd / fxRate
      : 0
    : holding.unrealizedPnlTwd;
  const pnlStr = isUsdNative
    ? `${pnlValue >= 0 ? '+' : '−'}${formatUsd(Math.abs(pnlValue))}`
    : formatChange(holding.unrealizedPnlTwd);

  const mktValue = isUsdNative
    ? fxRate > 0
      ? holding.marketValueTwd / fxRate
      : 0
    : holding.marketValueTwd;
  const mktValueStr = isUsdNative
    ? formatUsd(mktValue)
    : formatTwd(holding.marketValueTwd, 'full');

  const currencyTag = isUsdNative ? 'USD' : 'TWD';

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl px-4 py-4',
        'bg-card/55 backdrop-blur-xl',
        'border border-white/10',
        'shadow-[0_8px_32px_rgba(0,0,0,0.3)]',
      )}
    >
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent"
      />
      <div className="text-center pb-3">
        <div className="text-xl font-display font-medium">
          {holding.displayName}
        </div>
        <div className="text-xs text-muted-foreground font-mono mt-1 flex items-center justify-center gap-1.5">
          <span>{holding.symbol}</span>
          {holding.hasPriceFallback && holding.type !== 'trust' && (
            <Badge
              variant="outline"
              className="text-[10px] py-0 h-4 border-warning text-warning gap-0.5"
            >
              <AlertTriangle className="h-2.5 w-2.5" />
              估算
            </Badge>
          )}
        </div>
      </div>

      {stockOrCrypto && (
        <div className="relative grid grid-cols-2 py-3 mb-3 rounded-lg bg-background/30 backdrop-blur-sm border border-white/5">
          <div className="text-center px-2">
            <div className="text-[11px] text-muted-foreground">
              股價 ({currencyTag})
            </div>
            <div className="text-lg font-semibold font-display tabular-nums mt-1">
              {priceStr}
            </div>
          </div>
          <div className="text-center border-l border-white/10 px-2">
            <div className="text-[11px] text-muted-foreground inline-flex items-center justify-center gap-1">
              成交均價 ({currencyTag})
              <button
                type="button"
                onClick={onEditAvgClick}
                aria-label="編輯成交均價"
                className="inline-flex items-center justify-center h-5 w-5 rounded text-muted-foreground/60 hover:text-foreground hover:bg-accent/30 transition-colors"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
            <div className="text-lg font-semibold font-display tabular-nums mt-1">
              {avgStr}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {showPnL && (
          <DetailRow
            label="參考損益"
            value={
              <span
                className={cn(
                  'font-medium tabular-nums',
                  pnlPositive ? 'text-up' : 'text-down',
                )}
              >
                {maskMoney(pnlStr, privacy)}{' '}
                <span className="text-sm">
                  ({formatPct(holding.unrealizedPnlPct)})
                </span>
              </span>
            }
          />
        )}
        {showMktValue && (
          <DetailRow
            label="參考現值"
            value={
              <span className="text-2xl font-bold font-display tabular-nums">
                {maskMoney(mktValueStr, privacy)}
              </span>
            }
          />
        )}
        <DetailRow
          label={isCash ? '餘額' : '成本'}
          value={
            <span className="font-medium tabular-nums">
              {maskMoney(costStr, privacy)}
            </span>
          }
        />
        {!isCash && (
          <DetailRow
            label="總持股數"
            value={
              <span className="font-medium tabular-nums">
                {formatUnits(holding.units, holding.type)} {unitTag}
              </span>
            }
          />
        )}
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

const KIND_LABEL: Record<Transaction['kind'], string> = {
  buy: '加買',
  sell: '賣出',
  monthly_dca: '月扣',
  manual_adjust: '校正',
  initial: '初始',
};

const KIND_COLOR: Record<Transaction['kind'], string> = {
  buy: 'bg-up/10 text-up border-up/20',
  monthly_dca: 'bg-up/10 text-up border-up/20',
  sell: 'bg-down/10 text-down border-down/20',
  manual_adjust: 'bg-muted text-muted-foreground border-border',
  initial: 'bg-muted text-muted-foreground border-border',
};

function TransactionRow({
  tx,
  unitTag,
  isUsdNative,
  privacy,
}: {
  tx: Transaction;
  unitTag: string;
  isUsdNative: boolean;
  privacy: boolean;
}) {
  const positive = tx.unitsDelta > 0 || tx.costDeltaTwd > 0;
  const sign = tx.unitsDelta > 0 ? '+' : tx.unitsDelta < 0 ? '−' : '';
  const costSign = tx.costDeltaTwd > 0 ? '+' : tx.costDeltaTwd < 0 ? '−' : '';

  const date = new Date(tx.occurredAt);
  const dateStr = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
  const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  const showCostUsd =
    isUsdNative && tx.costDeltaUsd != null && tx.costDeltaUsd !== 0;
  const usdAbsStr = showCostUsd
    ? `$ ${Math.abs(tx.costDeltaUsd!).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : '';

  return (
    <div className="rounded-lg border border-white/8 bg-card/40 backdrop-blur-sm p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] h-5 px-1.5 py-0 font-medium',
                KIND_COLOR[tx.kind],
              )}
            >
              {KIND_LABEL[tx.kind]}
            </Badge>
            <span className="text-xs text-muted-foreground tabular-nums">
              {dateStr}
            </span>
            <span className="text-[10px] text-muted-foreground/60 tabular-nums">
              {timeStr}
            </span>
          </div>
          {tx.notes && (
            <div className="text-[11px] text-muted-foreground mt-1">
              {tx.notes}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          {tx.unitsDelta !== 0 && (
            <div
              className={cn(
                'text-sm font-medium tabular-nums',
                positive ? 'text-up' : 'text-down',
              )}
            >
              {sign}
              {formatUnits(Math.abs(tx.unitsDelta), unitsType(tx, isUsdNative))}{' '}
              {unitTag}
            </div>
          )}
          {tx.costDeltaTwd !== 0 && (
            <div
              className={cn(
                'text-xs tabular-nums',
                positive ? 'text-up' : 'text-down',
              )}
            >
              {costSign}
              {showCostUsd
                ? maskMoney(usdAbsStr, privacy)
                : maskMoney(formatTwd(Math.abs(tx.costDeltaTwd)), privacy)}
            </div>
          )}
          {tx.pricePerUnitTwd != null && tx.pricePerUnitTwd > 0 && (
            <div className="text-[10px] text-muted-foreground tabular-nums">
              {formatPrice(tx.pricePerUnitTwd, 'TWD')} / {unitTag}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function unitsType(_tx: Transaction, isUsdNative: boolean): string {
  return isUsdNative ? 'us_stock' : 'tw_stock';
}
