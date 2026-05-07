'use client';

import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, AlertTriangle, Trash2 } from 'lucide-react';
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
  holding: EnrichedHolding | null;
  open: boolean;
  usdTwd: number | null | undefined;
  onClose: () => void;
  /** 新增一筆存款 — 輸入「買後累計總量、累計總額」,系統算這筆 delta。 */
  onAddDepositClick: () => void;
  onDeleteClick: () => void;
};

export function HoldingDetailSheet({
  holding,
  open,
  usdTwd,
  onClose,
  onAddDepositClick,
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
        {/* ── Header (sticky top) — 對齊國泰 app 版面 ── */}
        <HoldingHeader
          holding={holding}
          fxRate={fxRate}
          isUsdNative={isUsdNative}
          stockOrCrypto={stockOrCrypto}
          unitTag={unitTag}
          priceStr={priceStr}
          avgStr={avgStr}
          showAvg={showAvg}
          costStr={costStr}
          pnlPositive={pnlPositive}
          privacy={privacy}
        />

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
          className="border-t bg-popover shrink-0 p-3"
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

/**
 * Detail header — 對齊國泰證券 app 單一持股版面:
 * 標題 → 股價/成交均價雙欄區塊 → 參考損益 / 參考現值 / 成本 / 總持股數 列表
 */
function HoldingHeader({
  holding,
  fxRate,
  isUsdNative,
  stockOrCrypto,
  unitTag,
  priceStr,
  avgStr,
  showAvg,
  costStr,
  pnlPositive,
  privacy,
}: {
  holding: EnrichedHolding;
  fxRate: number;
  isUsdNative: boolean;
  stockOrCrypto: boolean;
  unitTag: string;
  priceStr: string;
  avgStr: string;
  showAvg: boolean;
  costStr: string;
  pnlPositive: boolean;
  privacy: boolean;
}) {
  const isCash = holding.type === 'cash_twd' || holding.type === 'cash_usd';
  const showPnL = stockOrCrypto && holding.costBasisTwd > 0;
  const showMktValue =
    stockOrCrypto && holding.currentPriceTwd !== null && holding.units > 0;

  // PnL / 現值 顯示用幣別(美股/加密 → USD,其他 → TWD)
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
    <div className="px-4 pt-5 pb-4 border-b shrink-0">
      {/* 標題列 */}
      <div className="text-center pb-3">
        <SheetTitle className="text-xl font-display">
          {holding.displayName}
        </SheetTitle>
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

      {/* 股價 / 成交均價 — 僅 stock/crypto */}
      {stockOrCrypto && (
        <div className="grid grid-cols-2 gap-2 py-3 mb-3 rounded-md bg-muted/40">
          <div className="text-center">
            <div className="text-xs text-muted-foreground">
              股價 ({currencyTag})
            </div>
            <div className="text-2xl font-bold font-display tabular-nums mt-1">
              {holding.currentPriceTwd !== null ? priceStr : '—'}
            </div>
          </div>
          <div className="text-center border-l border-border/60">
            <div className="text-xs text-muted-foreground">
              成交均價 ({currencyTag})
            </div>
            <div className="text-2xl font-bold font-display tabular-nums mt-1">
              {showAvg ? avgStr : '—'}
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
