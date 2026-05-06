'use client';

import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { EnrichedHolding } from '@/lib/types';
import {
  formatTwd,
  formatPct,
  formatUnits,
  formatUsd,
  formatChange,
  formatUpdatedAt,
  formatPrice,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import { usePrivacy, maskMoney } from '@/lib/privacy';
import {
  isUsdNativeType,
  formatPriceForDisplay,
} from '@/components/HoldingEditSheet';

type Props = {
  holding: EnrichedHolding;
  usdTwd: number | null | undefined;
  /** 點 card 本體 → 開詳情 sheet。所有編輯 / 加買賣 / 刪除都在那裡。 */
  onCardClick: () => void;
};

export function HoldingRow({ holding, usdTwd, onCardClick }: Props) {
  const { privacy } = usePrivacy();

  const isUsdNative = isUsdNativeType(holding.type);
  const fxRate = usdTwd ?? 0;

  // 顯示用的成本(USD-native:USD;其他:TWD)
  const costUsdView = isUsdNative
    ? holding.costBasisUsd ??
      (fxRate > 0 && holding.costBasisTwd > 0
        ? holding.costBasisTwd / fxRate
        : 0)
    : 0;

  // 顯示用的月扣
  const monthlyTwd = holding.monthlyAutoBuyTwd ?? 0;
  const monthlyUsdView = isUsdNative
    ? holding.monthlyAutoBuyUsd ??
      (fxRate > 0 && monthlyTwd > 0 ? monthlyTwd / fxRate : 0)
    : 0;
  const monthlyAmount = isUsdNative ? monthlyUsdView : monthlyTwd;
  const hasMonthly = monthlyAmount > 0;

  const pnlPositive = holding.unrealizedPnlTwd >= 0;
  const hasTodayChange = holding.todayChangePct !== null;
  const todayPositive = (holding.todayChangePct ?? 0) >= 0;

  const costStr = isUsdNative
    ? formatUsd(costUsdView)
    : formatTwd(holding.costBasisTwd);
  const monthlyStr = isUsdNative
    ? formatUsd(monthlyAmount)
    : formatTwd(monthlyAmount);

  // 成交均價 = 累計實付 ÷ 數量;只對股票 / 加密 才有意義
  const showAvg =
    (holding.type === 'tw_stock' ||
      holding.type === 'us_stock' ||
      holding.type === 'crypto') &&
    holding.units > 0 &&
    (isUsdNative ? costUsdView > 0 : holding.costBasisTwd > 0);
  const avgBuyPrice = showAvg
    ? isUsdNative
      ? costUsdView / holding.units
      : holding.costBasisTwd / holding.units
    : 0;
  const avgStr = formatPrice(avgBuyPrice, isUsdNative ? 'USD' : 'TWD');
  const unitTag =
    holding.type === 'crypto' ? '顆' : '股';
  const priceStr = formatPriceForDisplay(
    holding.currentPriceTwd,
    isUsdNative,
    fxRate,
  );
  const priceUnitTag =
    holding.type === 'crypto'
      ? '/ 顆'
      : holding.type === 'tw_stock' || holding.type === 'us_stock'
        ? '/ 股'
        : '';

  return (
    <div
      className="rounded-lg border border-border bg-card p-3.5 space-y-3 shadow-sm cursor-pointer active:bg-accent/30 transition-colors"
      onClick={onCardClick}
    >
      {/* Header: name + market value */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium truncate">{holding.displayName}</span>
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
          <div className="text-xs text-muted-foreground tabular-nums mt-0.5">
            <span className="font-mono">{holding.symbol}</span>
            {holding.currentPriceTwd !== null && (
              <span className="ml-2">
                即時 {priceStr} {priceUnitTag}
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-base font-semibold tabular-nums">
            {maskMoney(formatTwd(holding.marketValueTwd), privacy)}
          </div>
        </div>
      </div>

      {/* PnL pair: today + cumulative */}
      {(hasTodayChange || holding.costBasisTwd > 0) && (
        <div className="grid grid-cols-2 gap-2">
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

      {/* Position summary */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="space-y-0.5">
          <div>
            <span className="text-foreground font-medium tabular-nums">
              {formatUnits(holding.units, holding.type)}
            </span>{' '}
            {unitLabelShort(holding.type)}
            {showAvg && (
              <>
                {' · 成交均價 '}
                <span className="text-foreground tabular-nums">
                  {avgStr} / {unitTag}
                </span>
              </>
            )}
          </div>
          <div>
            已投入{' '}
            <span className="text-foreground tabular-nums">
              {maskMoney(costStr, privacy)}
            </span>
            {hasMonthly && (
              <>
                {' · 月扣 '}
                <span className="text-foreground tabular-nums">
                  {maskMoney(monthlyStr, privacy)}
                </span>
              </>
            )}
          </div>
        </div>
        <span className="text-[10px] text-muted-foreground/70 tabular-nums shrink-0 self-end">
          上次更新 {formatUpdatedAt(holding.updatedAt)}
        </span>
      </div>
    </div>
  );
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

function unitLabelShort(type: EnrichedHolding['type']): string {
  switch (type) {
    case 'tw_stock':
    case 'us_stock':
      return '股';
    case 'crypto':
      return '顆';
    case 'cash_twd':
    case 'trust':
      return 'TWD';
    case 'cash_usd':
      return 'USD';
  }
}
