'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Holding } from '@/lib/types';
import { applyBuy } from '@/lib/calc';
import { formatTwd, formatUnits, formatUsd } from '@/lib/format';
import { cn } from '@/lib/utils';

type BuyProps = {
  holding: Holding | null;
  open: boolean;
  /** USD↔TWD 即時匯率,用於把美股/加密的 USD 累計轉成 TWD 落地。 */
  usdTwd: number | null | undefined;
  onClose: () => void;
  onConfirm: (next: Holding) => void;
};

/**
 * 「新增一筆存款」對話框。
 *
 * 記帳 app 心智模型:Henry 從國泰 / 券商 app 抄「買完後的累計總量、累計總額」,
 * 系統自動算這筆 delta 寫進 transactions。不分定期定額/額外加碼,通通是一筆「存款」。
 *
 * - 一般資產(stock / crypto / trust):兩欄(累計總量、累計總額)
 * - 現金(cash_twd / cash_usd):一欄(累計餘額,單位即金額)
 * - USD-native(us_stock / crypto / cash_usd):金額欄用 USD,後台用即時匯率換算 TWD 落地
 */
export function BuyDialog({
  holding,
  open,
  usdTwd,
  onClose,
  onConfirm,
}: BuyProps) {
  const [units, setUnits] = useState('');
  const [cost, setCost] = useState('');
  const [avg, setAvg] = useState('');

  useEffect(() => {
    if (open && holding) {
      setUnits('');
      setCost('');
      setAvg('');
    }
  }, [open, holding]);

  if (!holding) return null;

  const isCash = holding.type === 'cash_twd' || holding.type === 'cash_usd';
  const isUsdNative =
    holding.type === 'us_stock' ||
    holding.type === 'crypto' ||
    holding.type === 'cash_usd';

  const currentUnits = holding.units;
  const currentCostTwd = holding.costBasisTwd;
  const currentCostUsd = holding.costBasisUsd ?? 0;

  // 現金:單欄(累計餘額),values 都用 cost 欄
  // 非現金:雙欄(累計總量 + 累計總額)
  const newTotalUnits = isCash ? Number(cost) : Number(units);
  const newTotalCost = Number(cost);
  const hasUnits = isCash ? cost !== '' && isFinite(newTotalUnits) : units !== '' && isFinite(newTotalUnits);
  const hasCost = cost !== '' && isFinite(newTotalCost);

  const addUnits = hasUnits ? newTotalUnits - currentUnits : 0;
  const addCostUsd =
    isUsdNative && hasCost ? newTotalCost - currentCostUsd : 0;
  const addCostTwd = isUsdNative
    ? addCostUsd * (usdTwd ?? 0)
    : hasCost
      ? newTotalCost - currentCostTwd
      : 0;

  const unitsError =
    hasUnits && addUnits <= 0
      ? addUnits === 0
        ? '沒有變化'
        : '需大於目前累計'
      : null;
  const costError = isUsdNative
    ? hasCost && addCostUsd < 0
      ? '需大於或等於目前累計'
      : null
    : hasCost && addCostTwd < 0
      ? '需大於或等於目前累計'
      : null;
  const fxMissing = isUsdNative && !usdTwd;

  // 現金:只有一欄(cost),unitsError 也來自 cost 變化
  const canSubmit = isCash
    ? hasCost && !unitsError && !fxMissing
    : hasUnits && hasCost && !unitsError && !costError && !fxMissing;

  const handle = () => {
    if (!canSubmit) return;
    try {
      const next = isUsdNative
        ? applyBuy(holding, addUnits, addCostTwd, addCostUsd, 'buy')
        : applyBuy(holding, addUnits, addCostTwd, undefined, 'buy');
      // 如果使用者抄了「成交均價」(從國泰 app 抄),覆寫到 holding 上 — 顯示時會優先用這個
      const avgNum = Number(avg);
      const finalNext =
        avg !== '' && isFinite(avgNum) && avgNum > 0
          ? {
              ...next,
              ...(isUsdNative
                ? { avgPriceUsd: avgNum }
                : { avgPriceTwd: avgNum }),
            }
          : next;
      onConfirm(finalNext);
      onClose();
    } catch (e) {
      console.error(e);
    }
  };

  const unitTag =
    holding.type === 'crypto'
      ? '顆'
      : holding.type === 'tw_stock' || holding.type === 'us_stock'
        ? '股'
        : holding.type === 'cash_usd'
          ? 'USD'
          : 'TWD';

  const currentUnitsStr = formatUnits(currentUnits, holding.type);
  const currentCostStr = isUsdNative
    ? formatUsd(currentCostUsd)
    : formatTwd(currentCostTwd, 'full');

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新增一筆存款 — {holding.displayName}</DialogTitle>
          <DialogDescription>
            從 app 抄「買完後」的累計總量、累計總額。系統幫你算這筆 delta。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!isCash && (
            <div>
              <Label htmlFor="buy-units">買後累計總數量</Label>
              <Input
                id="buy-units"
                type="number"
                inputMode="decimal"
                step="any"
                value={units}
                onChange={(e) => setUnits(e.target.value)}
                className="text-base h-11"
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                目前{' '}
                <span className="font-medium tabular-nums">
                  {currentUnitsStr}
                </span>{' '}
                {unitTag}
                {hasUnits && !unitsError && addUnits > 0 && (
                  <span className="text-up font-medium ml-2 tabular-nums">
                    +{formatUnits(addUnits, holding.type)} {unitTag}
                  </span>
                )}
                {unitsError && (
                  <span className="text-destructive font-medium ml-2">
                    · {unitsError}
                  </span>
                )}
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="buy-cost">
              {isCash ? '存後累計餘額' : '買後累計總投入'}
              {isUsdNative ? '(USD)' : '(TWD)'}
            </Label>
            <Input
              id="buy-cost"
              type="number"
              inputMode="decimal"
              step="any"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              className="text-base h-11"
              autoFocus={isCash}
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              目前{' '}
              <span className="font-medium tabular-nums">
                {currentCostStr}
              </span>
              {hasCost && !costError && !fxMissing && !(isCash && unitsError) && (
                <span
                  className={cn(
                    'font-medium ml-2 tabular-nums',
                    (isUsdNative ? addCostUsd : addCostTwd) > 0
                      ? 'text-up'
                      : 'text-muted-foreground',
                  )}
                >
                  {isUsdNative
                    ? `+${formatUsd(addCostUsd)}${
                        usdTwd && !isCash
                          ? ` ≈ ${formatTwd(addCostTwd, 'full')}`
                          : ''
                      }`
                    : `+${formatTwd(addCostTwd, 'full')}`}
                </span>
              )}
              {costError && (
                <span className="text-destructive font-medium ml-2">
                  · {costError}
                </span>
              )}
              {fxMissing && (
                <span className="text-destructive font-medium ml-2">
                  · 等待匯率載入
                </span>
              )}
            </p>
          </div>

          {!isCash && (
            <div>
              <Label htmlFor="buy-avg">
                成交均價(從 app 抄,選填)
                {isUsdNative ? '(USD)' : '(TWD)'}
              </Label>
              <Input
                id="buy-avg"
                type="number"
                inputMode="decimal"
                step="any"
                value={avg}
                onChange={(e) => setAvg(e.target.value)}
                className="text-base h-11"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                國泰 / 券商 app 顯示的「成交均價」(不含手續費)。
                空白 = 自動用「成本 ÷ 持股數」算(會比 app 多 ~0.5–1 元 / 股,因為含手續費)。
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handle} disabled={!canSubmit}>
            確認
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
