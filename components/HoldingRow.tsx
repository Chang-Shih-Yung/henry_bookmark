'use client';

import { useState } from 'react';
import { MoreVertical, Plus, Minus, Trash2, AlertTriangle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import type { EnrichedHolding, Holding } from '@/lib/types';
import { formatTwd, formatPct, formatUnits, formatUsd } from '@/lib/format';
import { cn } from '@/lib/utils';

type Props = {
  holding: EnrichedHolding;
  /** 即時 USD/TWD 匯率;USD-native 類型編輯成本/月扣時用來轉 TWD canonical。 */
  usdTwd: number | null | undefined;
  onUpdate: (
    next: Partial<
      Pick<
        Holding,
        | 'units'
        | 'costBasisTwd'
        | 'costBasisUsd'
        | 'monthlyAutoBuyTwd'
        | 'monthlyAutoBuyUsd'
      >
    >,
  ) => void;
  onDelete: () => void;
  onBuyClick: () => void;
  onSellClick: () => void;
};

/** us_stock / crypto 用 USD 原貨幣編輯與顯示;其他類型用 TWD。 */
function isUsdNativeType(type: Holding['type']): boolean {
  return type === 'us_stock' || type === 'crypto';
}

export function HoldingRow({
  holding,
  usdTwd,
  onUpdate,
  onDelete,
  onBuyClick,
  onSellClick,
}: Props) {
  const [editingUnits, setEditingUnits] = useState(false);
  const [editingCost, setEditingCost] = useState(false);
  const [editingMonthly, setEditingMonthly] = useState(false);

  const isUsdNative = isUsdNativeType(holding.type);
  const fxRate = usdTwd ?? 0;
  const sourceHint = holding.type === 'crypto' ? '幣安' : '銀行';

  // ── Cost view (USD-native types prefer Usd field; fallback to TWD/FX) ──
  const costUsdView = isUsdNative
    ? holding.costBasisUsd ??
      (fxRate > 0 && holding.costBasisTwd > 0
        ? holding.costBasisTwd / fxRate
        : 0)
    : 0;

  // ── Monthly view ──
  const monthlyTwd = holding.monthlyAutoBuyTwd ?? 0;
  const monthlyUsdView = isUsdNative
    ? holding.monthlyAutoBuyUsd ??
      (fxRate > 0 && monthlyTwd > 0 ? monthlyTwd / fxRate : 0)
    : 0;
  const monthlyAmount = isUsdNative ? monthlyUsdView : monthlyTwd;
  const hasMonthly = monthlyAmount > 0;

  // ── Editor inputs (default = current display value) ──
  const [unitsInput, setUnitsInput] = useState(String(holding.units));
  const [costInput, setCostInput] = useState(
    isUsdNative ? (costUsdView > 0 ? costUsdView.toFixed(2) : '') : String(holding.costBasisTwd),
  );
  const [monthlyInput, setMonthlyInput] = useState(
    hasMonthly ? String(monthlyAmount) : '',
  );

  const pnlPositive = holding.unrealizedPnlTwd >= 0;

  const commitUnits = () => {
    const parsed = Number(unitsInput);
    if (!isFinite(parsed) || parsed < 0) {
      setUnitsInput(String(holding.units));
    } else if (parsed !== holding.units) {
      onUpdate({ units: parsed });
    }
    setEditingUnits(false);
  };

  const commitCost = () => {
    const parsed = Number(costInput);
    if (!isFinite(parsed) || parsed < 0) {
      setCostInput(
        isUsdNative
          ? costUsdView > 0
            ? costUsdView.toFixed(2)
            : ''
          : String(holding.costBasisTwd),
      );
      setEditingCost(false);
      return;
    }
    if (isUsdNative) {
      if (fxRate <= 0) {
        // 沒匯率時不能正確存,放棄這次編輯
        setEditingCost(false);
        return;
      }
      const newTwd = Math.round(parsed * fxRate);
      const changed =
        Math.abs(newTwd - holding.costBasisTwd) > 0.5 ||
        (holding.costBasisUsd ?? -1) !== parsed;
      if (changed) {
        onUpdate({ costBasisTwd: newTwd, costBasisUsd: parsed });
      }
    } else {
      if (Math.abs(parsed - holding.costBasisTwd) > 0.5) {
        onUpdate({ costBasisTwd: parsed });
      }
    }
    setEditingCost(false);
  };

  const commitMonthly = () => {
    const trimmed = monthlyInput.trim();
    if (trimmed === '' || Number(trimmed) === 0) {
      // 清除月扣
      if (
        holding.monthlyAutoBuyTwd != null ||
        holding.monthlyAutoBuyUsd != null
      ) {
        onUpdate({
          monthlyAutoBuyTwd: undefined,
          monthlyAutoBuyUsd: undefined,
        });
      }
      setEditingMonthly(false);
      return;
    }
    const parsed = Number(trimmed);
    if (!isFinite(parsed) || parsed < 0) {
      setMonthlyInput(hasMonthly ? String(monthlyAmount) : '');
      setEditingMonthly(false);
      return;
    }
    if (isUsdNative) {
      if (fxRate <= 0) {
        setEditingMonthly(false);
        return;
      }
      onUpdate({
        monthlyAutoBuyUsd: parsed,
        monthlyAutoBuyTwd: Math.round(parsed * fxRate),
      });
    } else {
      onUpdate({ monthlyAutoBuyTwd: parsed });
    }
    setEditingMonthly(false);
  };

  // ── Display strings ──
  const costDisplay = isUsdNative
    ? `成本 ${formatUsd(costUsdView)}`
    : `成本 ${formatTwd(holding.costBasisTwd)}`;

  const monthlyDisplay = hasMonthly
    ? isUsdNative
      ? `月扣 ${formatUsd(monthlyAmount)}`
      : `月扣 ${formatTwd(monthlyAmount)}`
    : '+ 月扣';

  return (
    <div className="flex items-center justify-between gap-2 py-2 px-1 border-b border-border/50 last:border-b-0">
      {/* Left: name + units · cost · monthly */}
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium truncate">{holding.displayName}</span>
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
        <div className="flex items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground flex-wrap">
          {/* Units */}
          <Popover open={editingUnits} onOpenChange={setEditingUnits}>
            <PopoverTrigger
              className="hover:text-foreground transition-colors"
              onClick={() => {
                setUnitsInput(String(holding.units));
                setEditingUnits(true);
              }}
            >
              {formatUnits(holding.units, holding.type)}{' '}
              {unitLabel(holding.type)}
            </PopoverTrigger>
            <PopoverContent className="w-64" align="start">
              <Label htmlFor={`units-${holding.id}`} className="text-xs">
                數量({unitLabel(holding.type)})
              </Label>
              <Input
                id={`units-${holding.id}`}
                type="number"
                inputMode="decimal"
                step="any"
                value={unitsInput}
                onChange={(e) => setUnitsInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitUnits();
                  if (e.key === 'Escape') setEditingUnits(false);
                }}
                onBlur={commitUnits}
                autoFocus
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Enter 確認 / Esc 取消
              </p>
            </PopoverContent>
          </Popover>

          <span>·</span>

          {/* Cost */}
          <Popover open={editingCost} onOpenChange={setEditingCost}>
            <PopoverTrigger
              className="hover:text-foreground transition-colors"
              onClick={() => {
                setCostInput(
                  isUsdNative
                    ? costUsdView > 0
                      ? costUsdView.toFixed(2)
                      : ''
                    : String(holding.costBasisTwd),
                );
                setEditingCost(true);
              }}
            >
              {costDisplay}
            </PopoverTrigger>
            <PopoverContent className="w-64" align="start">
              <Label htmlFor={`cost-${holding.id}`} className="text-xs">
                {isUsdNative
                  ? `累計成本(USD,從${sourceHint}抄)`
                  : '累計成本(TWD)'}
              </Label>
              <Input
                id={`cost-${holding.id}`}
                type="number"
                inputMode="decimal"
                step="any"
                value={costInput}
                onChange={(e) => setCostInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitCost();
                  if (e.key === 'Escape') setEditingCost(false);
                }}
                onBlur={commitCost}
                autoFocus
                className="mt-1"
              />
              {isUsdNative && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  {fxRate > 0 ? (
                    <>
                      USD/TWD = {fxRate.toFixed(2)}
                      {Number(costInput) > 0 &&
                        ` · ≈ ${formatTwd(Number(costInput) * fxRate)}`}
                    </>
                  ) : (
                    <span className="text-warning">即時匯率載入中,稍後再儲存</span>
                  )}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Enter 確認 / Esc 取消
              </p>
            </PopoverContent>
          </Popover>

          <span>·</span>

          {/* Monthly DCA */}
          <Popover open={editingMonthly} onOpenChange={setEditingMonthly}>
            <PopoverTrigger
              className={cn(
                'hover:text-foreground transition-colors',
                !hasMonthly && 'text-muted-foreground/70',
              )}
              onClick={() => {
                setMonthlyInput(hasMonthly ? String(monthlyAmount) : '');
                setEditingMonthly(true);
              }}
            >
              {monthlyDisplay}
            </PopoverTrigger>
            <PopoverContent className="w-64" align="start">
              <Label htmlFor={`monthly-${holding.id}`} className="text-xs">
                {isUsdNative
                  ? '每月定期定額(USD)'
                  : '每月定期定額(TWD)'}
              </Label>
              <Input
                id={`monthly-${holding.id}`}
                type="number"
                inputMode="decimal"
                step="any"
                placeholder={isUsdNative ? '例如 50' : '例如 5000'}
                value={monthlyInput}
                onChange={(e) => setMonthlyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitMonthly();
                  if (e.key === 'Escape') setEditingMonthly(false);
                }}
                onBlur={commitMonthly}
                autoFocus
                className="mt-1"
              />
              {isUsdNative && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  {fxRate > 0 ? (
                    <>
                      USD/TWD = {fxRate.toFixed(2)}
                      {Number(monthlyInput) > 0 &&
                        ` · ≈ ${formatTwd(Number(monthlyInput) * fxRate)}/月`}
                    </>
                  ) : (
                    <span className="text-warning">即時匯率載入中</span>
                  )}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                空白或 0 = 不定額。Enter 確認 / Esc 取消
              </p>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Right: market value + PnL */}
      <div className="flex flex-col items-end shrink-0">
        <span className="text-sm font-medium tabular-nums">
          {formatTwd(holding.marketValueTwd)}
        </span>
        <span
          className={cn(
            'text-xs tabular-nums',
            holding.costBasisTwd === 0
              ? 'text-muted-foreground'
              : pnlPositive
                ? 'text-up'
                : 'text-down',
          )}
        >
          {holding.costBasisTwd === 0
            ? '—'
            : `${pnlPositive ? '▲' : '▼'} ${formatPct(holding.unrealizedPnlPct)}`}
        </span>
      </div>

      {/* Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
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
  );
}

function unitLabel(type: EnrichedHolding['type']): string {
  switch (type) {
    case 'tw_stock':
    case 'us_stock':
      return '股';
    case 'crypto':
      return '幣';
    case 'cash_twd':
    case 'cash_usd':
    case 'trust':
      return type === 'cash_usd' ? 'USD' : 'TWD';
  }
}
