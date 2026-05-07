'use client';

import { useCallback, useEffect, useRef } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, AlertTriangle, Trash2, Pencil } from 'lucide-react';
import type { EnrichedHolding, Transaction } from '@/lib/types';
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

type Props = {
  /** 同分類的所有 holdings — 構成水平 carousel 的清單。 */
  holdings: EnrichedHolding[];
  /** 當前 visible card 的 id。 */
  currentId: string | null;
  open: boolean;
  usdTwd: number | null | undefined;
  onClose: () => void;
  /** 滑動切換 / scroll snap 結束時通知 parent 更新 currentId。 */
  onChangeCurrentId: (id: string) => void;
  /** 新增一筆存款 — 輸入「買後累計總量、累計總額」,系統算這筆 delta。 */
  onAddDepositClick: () => void;
  /** 單獨編輯成交均價 */
  onEditAvgClick: (id: string) => void;
  onDeleteClick: () => void;
};

export function HoldingDetailSheet({
  holdings,
  currentId,
  open,
  usdTwd,
  onClose,
  onChangeCurrentId,
  onAddDepositClick,
  onEditAvgClick,
  onDeleteClick,
}: Props) {
  const { privacy } = usePrivacy();
  const carouselRef = useRef<HTMLDivElement>(null);

  const currentHolding =
    (currentId && holdings.find((h) => h.id === currentId)) || null;

  // 開啟 / currentId 變動時,精準把對應 card 中心對齊容器中心
  useEffect(() => {
    if (!open || !currentId || !carouselRef.current) return;
    const carousel = carouselRef.current;
    const card = carousel.querySelector<HTMLElement>(
      `[data-card-id="${CSS.escape(currentId)}"]`,
    );
    if (!card) return;
    // 等下一個 frame 確保布局完成
    requestAnimationFrame(() => {
      const targetLeft =
        card.offsetLeft - (carousel.clientWidth - card.offsetWidth) / 2;
      carousel.scrollTo({ left: targetLeft, behavior: 'auto' });
    });
  }, [open, currentId]);

  // onScroll 偵測哪張卡距離容器中心最近 → debounce 後才通知 parent
  // 不 debounce 的話 scroll 進行中會狂閃 transactions list
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
      if (bestId && bestId !== currentId) {
        onChangeCurrentId(bestId);
      }
    }, 80);
  }, [currentId, onChangeCurrentId]);

  if (!currentHolding) return null;

  const isUsdNative = isUsdNativeType(currentHolding.type);
  const transactions = [...(currentHolding.transactions ?? [])].sort(
    (a, b) =>
      new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
  const unitTag = unitTagFor(currentHolding.type);

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => !o && onClose()}
      // 關閉背景 scale-down(預設 true 會造成內部 carousel scroll 抖動)
      shouldScaleBackground={false}
      // 控制拖動關閉的 threshold
      closeThreshold={0.25}
      // modal=true 鎖背景 scroll(BuyDialog 改用 NestedDrawer 後不再有 inert 衝突)
    >
      <DrawerContent className="!h-[90vh] p-0 flex flex-col gap-0 bg-popover border-t border-white/10">
        {/* DrawerTitle 給 a11y,視覺隱藏 — 真正的標題在每張 card 上 */}
        <DrawerTitle className="sr-only">{currentHolding.displayName}</DrawerTitle>

        {/* ── Top bar:vaul 自動加 drag handle 在這個位置(by default in DrawerContent),視覺一致 ── */}
        <div className="shrink-0">
          {/* drag handle lozenge(vaul 監聽整個 DrawerContent 拖動,這只是視覺) */}
          <div className="h-11 flex items-center justify-center">
            <div className="h-1.5 w-12 rounded-full bg-foreground/25" />
          </div>

          {/* 標題列 — 國泰風格「單一持股資訊 / 所有庫存」 */}
          <div className="text-center pb-2">
            <div className="text-sm font-medium">單一持股資訊</div>
            <div className="text-[11px] text-muted-foreground">所有庫存</div>
          </div>
        </div>

        {/* ── Carousel header — 水平 swipe 切換不同 holding ── */}
        <div
          ref={carouselRef}
          onScroll={handleCarouselScroll}
          className="overflow-x-auto overflow-y-hidden scrollbar-none border-b border-white/5 shrink-0 bg-background/20 backdrop-blur-md"
          style={{
            scrollSnapType: 'x mandatory',
            scrollPaddingInline: '6%',
          }}
        >
          <div className="flex gap-3 px-[6%] py-4">
            {holdings.map((h) => (
              <div
                key={h.id}
                data-card-id={h.id}
                className="snap-center shrink-0 w-[88%]"
              >
                <HoldingHeaderCard
                  holding={h}
                  usdTwd={usdTwd}
                  privacy={privacy}
                  onEditAvgClick={() => onEditAvgClick(h.id)}
                />
              </div>
            ))}
          </div>
          {holdings.length > 1 && (
            <div className="text-[10px] text-muted-foreground/70 text-center pb-2 tabular-nums">
              {(() => {
                const idx = holdings.findIndex((h) => h.id === currentHolding.id);
                return `${idx + 1} / ${holdings.length} · 左右滑動切換`;
              })()}
            </div>
          )}
        </div>

        {/* ── Scrollable transaction list — 跟著 currentHolding ── */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
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

          {/* 刪除(離主動作遠,避免誤觸) */}
          <div className="pt-6 pb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onDeleteClick}
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/5 gap-1.5"
            >
              <Trash2 className="h-4 w-4" />
              刪除這筆資產
            </Button>
          </div>
        </div>

        {/* ── Sticky bottom action bar — 單一「新增一筆存款」 ── */}
        <div
          className="border-t border-white/10 bg-popover/60 backdrop-blur-xl shrink-0 p-3"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <Button
            size="lg"
            onClick={onAddDepositClick}
            className="w-full gap-1.5"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span className="truncate">新增一筆存款</span>
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function unitTagFor(type: EnrichedHolding['type']): string {
  if (type === 'crypto') return '顆';
  if (type === 'tw_stock' || type === 'us_stock') return '股';
  if (type === 'cash_usd') return 'USD';
  return 'TWD';
}

/**
 * 單張 holding header 卡 — carousel 裡每個 snap 點。
 * 對齊國泰證券 app 單一持股版面:標題 → 股價/成交均價雙欄 → 損益/現值/成本/持股數 列表。
 */
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

  // 成交均價:優先抄國泰原值,沒抄就 fallback cost ÷ units
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
  // 只顯示數字(label 已標 TWD/USD,不再前綴 NT$ / $)
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

  // 保留原始 formatted 版(含 NT$ / $)給其他地方用
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
      {/* 玻璃卡上緣高光 */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent"
      />
      {/* 標題列 */}
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

      {/* 股價 / 成交均價 — 僅 stock/crypto;字體 text-lg 不跳行,純數字不重複前綴 */}
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

      {/* 列表 — 國泰風格 */}
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
  // crypto 顯示 8 位,否則 5 位
  return isUsdNative ? 'us_stock' : 'tw_stock';
}
