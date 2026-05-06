'use client';

import { useEffect, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { EnrichedHolding, Holding } from '@/lib/types';
import { formatTwd, formatUsd } from '@/lib/format';

type Patch = Partial<
  Pick<
    Holding,
    | 'units'
    | 'costBasisTwd'
    | 'costBasisUsd'
    | 'monthlyAutoBuyTwd'
    | 'monthlyAutoBuyUsd'
  >
>;

type Props = {
  holding: EnrichedHolding | null;
  open: boolean;
  usdTwd: number | null | undefined;
  onClose: () => void;
  onUpdate: (patch: Patch) => void;
};

function isUsdNativeType(type: Holding['type']): boolean {
  return type === 'us_stock' || type === 'crypto';
}

function unitLabel(type: Holding['type']): string {
  switch (type) {
    case 'tw_stock':
    case 'us_stock':
      return '股';
    case 'crypto':
      return '顆';
    case 'cash_twd':
      return 'TWD';
    case 'cash_usd':
      return 'USD';
    case 'trust':
      return 'TWD';
  }
}

export function HoldingEditSheet({
  holding,
  open,
  usdTwd,
  onClose,
  onUpdate,
}: Props) {
  const [unitsInput, setUnitsInput] = useState('');
  const [costInput, setCostInput] = useState('');
  const [monthlyInput, setMonthlyInput] = useState('');

  const isUsdNative = holding ? isUsdNativeType(holding.type) : false;
  const fxRate = usdTwd ?? 0;

  useEffect(() => {
    if (!open || !holding) return;
    setUnitsInput(String(holding.units));
    if (isUsdNative) {
      const usdView =
        holding.costBasisUsd ??
        (fxRate > 0 && holding.costBasisTwd > 0
          ? holding.costBasisTwd / fxRate
          : 0);
      setCostInput(usdView > 0 ? usdView.toFixed(2) : '');
      const monthlyUsdView =
        holding.monthlyAutoBuyUsd ??
        (fxRate > 0 && (holding.monthlyAutoBuyTwd ?? 0) > 0
          ? (holding.monthlyAutoBuyTwd ?? 0) / fxRate
          : 0);
      setMonthlyInput(monthlyUsdView > 0 ? String(monthlyUsdView) : '');
    } else {
      setCostInput(String(holding.costBasisTwd));
      setMonthlyInput(
        holding.monthlyAutoBuyTwd ? String(holding.monthlyAutoBuyTwd) : '',
      );
    }
  }, [open, holding, isUsdNative, fxRate]);

  if (!holding) return null;

  const usdLabel = `(${holding.type === 'crypto' ? '幣安顯示金額' : '銀行顯示金額'},USD)`;

  const handleSave = () => {
    const patch: Patch = {};

    const u = Number(unitsInput);
    if (isFinite(u) && u >= 0 && u !== holding.units) {
      patch.units = u;
    }

    const c = Number(costInput);
    if (isFinite(c) && c >= 0) {
      if (isUsdNative) {
        if (fxRate > 0) {
          const newTwd = Math.round(c * fxRate);
          if (
            Math.abs(newTwd - holding.costBasisTwd) > 0.5 ||
            (holding.costBasisUsd ?? -1) !== c
          ) {
            patch.costBasisTwd = newTwd;
            patch.costBasisUsd = c;
          }
        }
      } else if (Math.abs(c - holding.costBasisTwd) > 0.5) {
        patch.costBasisTwd = c;
      }
    }

    const trimmed = monthlyInput.trim();
    if (trimmed === '' || Number(trimmed) === 0) {
      if (
        holding.monthlyAutoBuyTwd != null ||
        holding.monthlyAutoBuyUsd != null
      ) {
        patch.monthlyAutoBuyTwd = undefined;
        patch.monthlyAutoBuyUsd = undefined;
      }
    } else {
      const m = Number(trimmed);
      if (isFinite(m) && m > 0) {
        if (isUsdNative && fxRate > 0) {
          patch.monthlyAutoBuyUsd = m;
          patch.monthlyAutoBuyTwd = Math.round(m * fxRate);
        } else if (!isUsdNative) {
          patch.monthlyAutoBuyTwd = m;
        }
      }
    }

    if (Object.keys(patch).length > 0) onUpdate(patch);
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl max-h-[90vh] overflow-y-auto"
        initialFocus={false}
      >
        <SheetHeader className="pb-2">
          <SheetTitle className="text-lg">{holding.displayName}</SheetTitle>
          <SheetDescription className="font-mono text-xs">
            {holding.symbol}
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 space-y-5 pb-2">
          {/* Units */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-units" className="text-sm">
              持有數量({unitLabel(holding.type)})
            </Label>
            <Input
              id="edit-units"
              type="number"
              inputMode="decimal"
              step="any"
              value={unitsInput}
              onChange={(e) => setUnitsInput(e.target.value)}
              className="text-base h-12"
            />
          </div>

          {/* Cost */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-cost" className="text-sm">
              已投入金額{isUsdNative ? usdLabel : '(TWD)'}
            </Label>
            <Input
              id="edit-cost"
              type="number"
              inputMode="decimal"
              step="any"
              value={costInput}
              onChange={(e) => setCostInput(e.target.value)}
              className="text-base h-12"
            />
            {isUsdNative && fxRate > 0 && Number(costInput) > 0 && (
              <p className="text-xs text-muted-foreground">
                ≈ {formatTwd(Number(costInput) * fxRate)} (匯率 {fxRate.toFixed(2)})
              </p>
            )}
            {(() => {
              const u = Number(unitsInput);
              const c = Number(costInput);
              if (
                !(
                  holding.type === 'tw_stock' ||
                  holding.type === 'us_stock' ||
                  holding.type === 'crypto'
                ) ||
                !isFinite(u) ||
                u <= 0 ||
                !isFinite(c) ||
                c <= 0
              )
                return null;
              const avg = c / u;
              const tag = holding.type === 'crypto' ? '顆' : '股';
              return (
                <p className="text-xs text-muted-foreground">
                  成交均價 {isUsdNative ? formatUsd(avg) : formatTwd(avg)} /{' '}
                  {tag}(對照銀行 / 幣安 app 校準用)
                </p>
              );
            })()}
          </div>

          {/* Monthly */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-monthly" className="text-sm">
              每月定期定額{isUsdNative ? '(USD)' : '(TWD)'}
            </Label>
            <Input
              id="edit-monthly"
              type="number"
              inputMode="decimal"
              step="any"
              placeholder={isUsdNative ? '例如 50' : '例如 5000(留空 = 取消)'}
              value={monthlyInput}
              onChange={(e) => setMonthlyInput(e.target.value)}
              className="text-base h-12"
            />
            {isUsdNative && fxRate > 0 && Number(monthlyInput) > 0 && (
              <p className="text-xs text-muted-foreground">
                ≈ {formatTwd(Number(monthlyInput) * fxRate)}/月
              </p>
            )}
          </div>
        </div>

        <SheetFooter className="grid grid-cols-2 gap-2 pt-0">
          <Button variant="outline" size="lg" onClick={onClose}>
            取消
          </Button>
          <Button size="lg" onClick={handleSave}>
            儲存
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export { isUsdNativeType, unitLabel };
export function formatPriceForDisplay(
  priceTwd: number | null,
  isUsdNative: boolean,
  fxRate: number,
): string {
  if (priceTwd === null) return '—';
  if (isUsdNative && fxRate > 0) {
    return formatUsd(priceTwd / fxRate);
  }
  return formatTwd(priceTwd);
}
