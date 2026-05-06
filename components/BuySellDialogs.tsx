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
import { applyBuy, applySell } from '@/lib/calc';
import { formatTwd, formatUnits } from '@/lib/format';

type BuyProps = {
  holding: Holding | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (next: Holding) => void;
};

export function BuyDialog({ holding, open, onClose, onConfirm }: BuyProps) {
  const [units, setUnits] = useState('');
  const [cost, setCost] = useState('');

  useEffect(() => {
    if (open && holding) {
      setUnits('');
      // 預先填入月扣金額(TWD canonical),user 對著銀行 / 幣安微調
      const monthly = holding.monthlyAutoBuyTwd ?? 0;
      setCost(monthly > 0 ? String(monthly) : '');
    }
  }, [open, holding]);

  if (!holding) return null;

  const handle = () => {
    const u = Number(units);
    const c = Number(cost);
    if (!isFinite(u) || u <= 0 || !isFinite(c) || c < 0) return;
    // 金額對得上月扣 → 標記為 monthly_dca,跟一般加買區分
    const monthly = holding.monthlyAutoBuyTwd ?? 0;
    const isMonthly = monthly > 0 && Math.abs(c - monthly) < 1;
    try {
      onConfirm(
        applyBuy(holding, u, c, undefined, isMonthly ? 'monthly_dca' : 'buy'),
      );
      onClose();
    } catch (e) {
      console.error(e);
    }
  };

  const isCash = holding.type === 'cash_twd' || holding.type === 'cash_usd';
  const monthlyTwd = holding.monthlyAutoBuyTwd ?? 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新增一筆 — {holding.displayName}</DialogTitle>
          <DialogDescription>
            記錄這個月扣款 / 加買。對照銀行 / 幣安 app 抄股數,金額已預填月扣可微調。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="buy-units">
              {isCash ? '存入金額' : '本次加買數量'}
              {holding.type === 'cash_usd' ? '(USD)' : ''}
            </Label>
            <Input
              id="buy-units"
              type="number"
              inputMode="decimal"
              step="any"
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              placeholder={
                holding.type === 'crypto'
                  ? '例如 12.345'
                  : holding.type === 'us_stock'
                    ? '例如 0.298'
                    : '例如 85'
              }
              className="text-base h-11"
            />
          </div>
          <div>
            <Label htmlFor="buy-cost">
              本次扣款金額(TWD,扣手續費後)
            </Label>
            <Input
              id="buy-cost"
              type="number"
              inputMode="numeric"
              step="any"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              className="text-base h-11"
            />
            {monthlyTwd > 0 && (
              <p className="text-xs text-muted-foreground mt-1.5">
                已預填月扣 {formatTwd(monthlyTwd)}。實際扣款不同直接覆蓋。
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handle} disabled={!Number(units) || !Number(cost)}>
            確認
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type SellProps = BuyProps;

export function SellDialog({ holding, open, onClose, onConfirm }: SellProps) {
  const [units, setUnits] = useState('');
  const [recv, setRecv] = useState('');

  useEffect(() => {
    if (open) {
      setUnits('');
      setRecv('');
    }
  }, [open]);

  if (!holding) return null;

  const handle = () => {
    const u = Number(units);
    const r = Number(recv);
    if (!isFinite(u) || u < 0 || !isFinite(r) || r < 0) return;
    try {
      onConfirm(applySell(holding, u, r));
      onClose();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : '賣出失敗');
    }
  };

  const isCash = holding.type === 'cash_twd' || holding.type === 'cash_usd';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>賣出 / 提領 — {holding.displayName}</DialogTitle>
          <DialogDescription>
            目前持有 {formatUnits(holding.units, holding.type)} · 平均成本{' '}
            {holding.units > 0
              ? formatTwd(holding.costBasisTwd / holding.units, 'full')
              : '—'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="sell-units">
              {isCash ? '提領金額' : '賣出數量'}
              {holding.type === 'cash_usd' ? '(USD)' : ''}
            </Label>
            <Input
              id="sell-units"
              type="number"
              inputMode="decimal"
              step="any"
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="sell-recv">
              實收金額(TWD,扣手續費後)
            </Label>
            <Input
              id="sell-recv"
              type="number"
              inputMode="numeric"
              step="any"
              value={recv}
              onChange={(e) => setRecv(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handle}>確認</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
