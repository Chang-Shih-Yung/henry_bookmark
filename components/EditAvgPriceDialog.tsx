'use client';

import { useEffect, useState } from 'react';
import {
  NestedDrawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field-label';
import type { Holding } from '@/lib/types';
import { isUsdNativeType } from '@/components/HoldingEditSheet';

type Props = {
  holding: Holding | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (next: Holding) => void;
};

/**
 * 單獨編輯「成交均價」mini drawer。
 * 只有一個欄位,從國泰 / 券商 app 抄純成交均價(不含手續費),
 * 不動 units / costBasisTwd 也不新增 transaction。
 */
export function EditAvgPriceDialog({
  holding,
  open,
  onClose,
  onConfirm,
}: Props) {
  const [avg, setAvg] = useState('');

  useEffect(() => {
    if (open && holding) {
      const isUsdNative = isUsdNativeType(holding.type);
      const current = isUsdNative ? holding.avgPriceUsd : holding.avgPriceTwd;
      setAvg(current !== undefined ? String(current) : '');
    }
  }, [open, holding]);

  if (!holding) return null;

  const isUsdNative = isUsdNativeType(holding.type);
  const avgNum = avg.trim() === '' ? null : Number(avg);
  const valid = avg.trim() === '' || (isFinite(avgNum ?? 0) && (avgNum ?? 0) > 0);

  const handle = () => {
    if (!valid) return;
    const next: Holding = {
      ...holding,
      ...(avgNum === null
        ? // 清空 → 拿掉 avgPrice 欄位(會 fallback 到 cost÷units)
          isUsdNative
          ? { avgPriceUsd: undefined }
          : { avgPriceTwd: undefined }
        : isUsdNative
          ? { avgPriceUsd: avgNum }
          : { avgPriceTwd: avgNum }),
      updatedAt: new Date().toISOString(),
    };
    onConfirm(next);
    onClose();
  };

  return (
    <NestedDrawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent
        className="!h-auto max-h-[60vh] border-t border-white/15 shadow-[0_-12px_32px_rgba(0,0,0,0.4)]"
        style={{ backgroundColor: 'oklch(0.235 0 0)' }}
      >
        <div className="h-11 flex items-center justify-center shrink-0">
          <div className="h-1.5 w-12 rounded-full bg-foreground/25" />
        </div>

        <div className="px-4 pb-4">
          <div className="text-center pb-3">
            <DrawerTitle className="text-base font-medium">
              編輯成交均價 — {holding.displayName}
            </DrawerTitle>
            <DrawerDescription className="text-xs text-muted-foreground mt-1">
              不動數量、成本、交易紀錄。只更新顯示用的均價。
            </DrawerDescription>
          </div>

          <div className="space-y-2 py-2">
            <FieldLabel htmlFor="avg-only" hint={isUsdNative ? 'USD' : 'TWD'}>
              成交均價
            </FieldLabel>
            <Input
              id="avg-only"
              type="number"
              inputMode="decimal"
              step="any"
              value={avg}
              onChange={(e) => setAvg(e.target.value)}
              placeholder="例:64.59"
              autoFocus
            />
            <p className="text-xs text-muted-foreground leading-relaxed">
              空白 = 自動用「成本 ÷ 持股數」算(會比 app 多 ~0.5–1 元 / 股,因為含手續費)。
            </p>
          </div>

          <div
            className="grid grid-cols-2 gap-2 pt-3"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
          >
            <Button variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button onClick={handle} disabled={!valid}>
              儲存
            </Button>
          </div>
        </div>
      </DrawerContent>
    </NestedDrawer>
  );
}
