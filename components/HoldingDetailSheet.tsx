'use client';

import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Minus, Pencil, AlertTriangle, Trash2 } from 'lucide-react';
import type { EnrichedHolding, Transaction } from '@/lib/types';
import {
  formatTwd,
  formatPct,
  formatUnits,
  formatChange,
  formatPrice,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import { usePrivacy, maskMoney } from '@/lib/privacy';
import {
  isUsdNativeType,
  formatPriceForDisplay,
} from '@/components/HoldingEditSheet';

type Props = {
  holding: EnrichedHolding | null;
  open: boolean;
  usdTwd: number | null | undefined;
  onClose: () => void;
  onBuyClick: () => void;
  onSellClick: () => void;
  onEditClick: () => void;
  onDeleteClick: () => void;
};

export function HoldingDetailSheet({
  holding,
  open,
  usdTwd,
  onClose,
  onBuyClick,
  onSellClick,
  onEditClick,
  onDeleteClick,
}: Props) {
  const { privacy } = usePrivacy();

  if (!holding) return null;

  const isUsdNative = isUsdNativeType(holding.type);
  const fxRate = usdTwd ?? 0;
  const stockOrCrypto =
    holding.type === 'tw_stock' ||
    holding.type === 'us_stock' ||
    holding.type === 'crypto';

  const costUsdView = isUsdNative
    ? holding.costBasisUsd ??
      (fxRate > 0 && holding.costBasisTwd > 0
        ? holding.costBasisTwd / fxRate
        : 0)
    : 0;

  const costStr = isUsdNative
    ? `$ ${costUsdView.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
    : formatTwd(holding.costBasisTwd);

  const showAvg =
    stockOrCrypto &&
    holding.units > 0 &&
    (isUsdNative ? costUsdView > 0 : holding.costBasisTwd > 0);
  const avg = showAvg
    ? isUsdNative
      ? costUsdView / holding.units
      : holding.costBasisTwd / holding.units
    : 0;
  const avgStr = formatPrice(avg, isUsdNative ? 'USD' : 'TWD');

  const priceStr = formatPriceForDisplay(
    holding.currentPriceTwd,
    isUsdNative,
    fxRate,
  );

  const unitTag =
    holding.type === 'crypto'
      ? '顆'
      : holding.type === 'tw_stock' || holding.type === 'us_stock'
        ? '股'
        : holding.type === 'cash_usd'
          ? 'USD'
          : 'TWD';

  const pnlPositive = holding.unrealizedPnlTwd >= 0;
  const todayPositive = (holding.todayChangePct ?? 0) >= 0;
  const hasTodayChange = holding.todayChangePct !== null;

  const transactions = [...(holding.transactions ?? [])].sort(
    (a, b) =>
      new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl !h-[90vh] p-0 flex flex-col"
        initialFocus={false}
      >
        {/* ── Header (sticky top) ── */}
        <div className="px-4 pt-5 pb-3 border-b shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <SheetTitle className="text-lg">
                {holding.displayName}
              </SheetTitle>
              <div className="text-xs text-muted-foreground tabular-nums mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span className="font-mono">{holding.symbol}</span>
                {holding.currentPriceTwd !== null && (
                  <span>
                    · 即時 {priceStr} / {unitTag}
                  </span>
                )}
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
          </div>

          {/* Big total: 累積扣款 */}
          <div className="mt-3">
            <div className="text-xs text-muted-foreground">累積扣款</div>
            <div className="text-3xl font-bold font-display tabular-nums tracking-tight mt-0.5">
              {maskMoney(costStr, privacy)}
            </div>
            <div className="text-xs text-muted-foreground tabular-nums mt-1">
              <span className="text-foreground font-medium">
                {formatUnits(holding.units, holding.type)}
              </span>{' '}
              {unitTag}
              {showAvg && (
                <>
                  {' · 成交均價 '}
                  <span className="text-foreground">
                    {avgStr} / {unitTag}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* PnL pair */}
          {(hasTodayChange || holding.costBasisTwd > 0) && (
            <div className="grid grid-cols-2 gap-2 mt-3">
              <PnLCell
                label="今日"
                pct={holding.todayChangePct}
                twd={holding.todayChangeTwd}
                positive={todayPositive}
                disabled={!hasTodayChange}
                privacy={privacy}
              />
              <PnLCell
                label="自買進累計"
                pct={
                  holding.costBasisTwd > 0 ? holding.unrealizedPnlPct : null
                }
                twd={holding.unrealizedPnlTwd}
                positive={pnlPositive}
                disabled={holding.costBasisTwd === 0}
                privacy={privacy}
              />
            </div>
          )}
        </div>

        {/* ── Scrollable transaction list ── */}
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

          {/* Power-user actions: 校正 + 刪除(離主動作遠,避免誤觸) */}
          <div className="pt-6 pb-2 space-y-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onEditClick}
              className="w-full gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-4 w-4" />
              校正總數(對不起來時手動修)
            </Button>
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

        {/* ── Sticky bottom action bar ── */}
        <div
          className="border-t bg-popover shrink-0 grid grid-cols-3 gap-2 p-3"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <Button
            size="lg"
            onClick={onBuyClick}
            className="gap-1.5 col-span-2"
          >
            <Plus className="h-4 w-4" />
            新增一筆
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={onSellClick}
            className="gap-1.5"
            disabled={holding.units <= 0}
          >
            <Minus className="h-4 w-4" />
            賣出
          </Button>
        </div>
      </SheetContent>
    </Sheet>
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
        maximumFractionDigits: 2,
      })}`
    : '';

  return (
    <div className="rounded-md border border-border bg-card p-3">
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

function PnLCell({
  label,
  pct,
  twd,
  positive,
  disabled,
  privacy,
}: {
  label: string;
  pct: number | null;
  twd: number;
  positive: boolean;
  disabled: boolean;
  privacy: boolean;
}) {
  return (
    <div className="rounded-md border border-border/50 bg-muted/30 px-3 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      {disabled || pct === null ? (
        <div className="text-sm text-muted-foreground tabular-nums mt-0.5">—</div>
      ) : (
        <>
          <div
            className={cn(
              'text-sm font-medium tabular-nums mt-0.5',
              positive ? 'text-up' : 'text-down',
            )}
          >
            {positive ? '▲' : '▼'} {formatPct(pct)}
          </div>
          <div
            className={cn(
              'text-[11px] tabular-nums',
              positive ? 'text-up' : 'text-down',
            )}
          >
            {maskMoney(formatChange(twd), privacy)}
          </div>
        </>
      )}
    </div>
  );
}
