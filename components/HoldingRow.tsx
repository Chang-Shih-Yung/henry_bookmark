'use client';

import { useState } from 'react';
import {
  MoreVertical,
  Plus,
  Minus,
  Trash2,
  AlertTriangle,
  Pencil,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { EnrichedHolding } from '@/lib/types';
import {
  formatTwd,
  formatPct,
  formatUnits,
  formatUsd,
  formatChange,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import { usePrivacy, maskMoney } from '@/lib/privacy';
import {
  HoldingEditSheet,
  isUsdNativeType,
  formatPriceForDisplay,
} from '@/components/HoldingEditSheet';

type Props = {
  holding: EnrichedHolding;
  usdTwd: number | null | undefined;
  onUpdate: (
    next: Parameters<
      React.ComponentProps<typeof HoldingEditSheet>['onUpdate']
    >[0],
  ) => void;
  onDelete: () => void;
  onBuyClick: () => void;
  onSellClick: () => void;
};

export function HoldingRow({
  holding,
  usdTwd,
  onUpdate,
  onDelete,
  onBuyClick,
  onSellClick,
}: Props) {
  const [editing, setEditing] = useState(false);
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
  const priceStr = formatPriceForDisplay(
    holding.currentPriceTwd,
    isUsdNative,
    fxRate,
  );
  const unitTag =
    holding.type === 'crypto'
      ? '/ 顆'
      : holding.type === 'tw_stock' || holding.type === 'us_stock'
        ? '/ 股'
        : '';

  return (
    <div className="rounded-lg border border-border bg-card p-3.5 space-y-3 shadow-sm">
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
                即時 {priceStr} {unitTag}
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-base font-semibold tabular-nums">
            {maskMoney(formatTwd(holding.marketValueTwd), privacy)}
          </div>
        </div>

        {/* Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="h-8 w-7 -mr-1 -mt-1 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            aria-label="更多動作"
          >
            <MoreVertical className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onBuyClick}>
              <Plus className="mr-2 h-4 w-4" />
              加買 / 加值
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onSellClick}>
              <Minus className="mr-2 h-4 w-4" />
              賣出 / 提領
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              刪除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
            {unitLabelShort(holding.type)} · 已投入{' '}
            <span className="text-foreground tabular-nums">
              {maskMoney(costStr, privacy)}
            </span>
          </div>
          {hasMonthly && (
            <div>
              月扣{' '}
              <span className="text-foreground tabular-nums">
                {maskMoney(monthlyStr, privacy)}
              </span>
            </div>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 px-2.5 gap-1.5 text-xs"
          onClick={() => setEditing(true)}
        >
          <Pencil className="h-3.5 w-3.5" />
          編輯
        </Button>
      </div>

      <HoldingEditSheet
        holding={editing ? holding : null}
        open={editing}
        usdTwd={usdTwd}
        onClose={() => setEditing(false)}
        onUpdate={onUpdate}
      />
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
