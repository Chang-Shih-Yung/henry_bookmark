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
    if (open) {
      setUnits('');
      setCost('');
    }
  }, [open]);

  if (!holding) return null;

  const handle = () => {
    const u = Number(units);
    const c = Number(cost);
    if (!isFinite(u) || u < 0 || !isFinite(c) || c < 0) return;
    try {
      onConfirm(applyBuy(holding, u, c));
      onClose();
    } catch (e) {
      console.error(e);
    }
  };

  const isCash = holding.type === 'cash_twd' || holding.type === 'cash_usd';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>加買 / 加值 — {holding.displayName}</DialogTitle>
          <DialogDescription>
            目前持有 {formatUnits(holding.units, holding.type)} · 已投入 {formatTwd(holding.costBasisTwd)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="buy-units">
              {isCash ? '存入金額' : '加買數量'}
              {holding.type === 'cash_usd' ? '(USD)' : ''}
            </Label>
            <Input
              id="buy-units"
              type="number"
              inputMode="decimal"
              step="any"
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="buy-cost">
              實付金額(TWD,扣手續費後)
            </Label>
            <Input
              id="buy-cost"
              type="number"
              inputMode="numeric"
              step="any"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
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
