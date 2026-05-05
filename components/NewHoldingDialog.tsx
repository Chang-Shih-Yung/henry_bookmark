'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AssetType, Holding } from '@/lib/types';

const TYPE_DEFAULTS: Record<
  AssetType,
  { symbolPlaceholder: string; namePlaceholder: string; symbolHint: string }
> = {
  tw_stock: {
    symbolPlaceholder: '2330.TW',
    namePlaceholder: '台積電',
    symbolHint: '台股代號 + .TW(目前支援 2330.TW、0050.TW 即時價)',
  },
  us_stock: {
    symbolPlaceholder: 'GOOGL',
    namePlaceholder: 'Google',
    symbolHint: '美股代號(目前支援 GOOGL、VTI 即時價)',
  },
  crypto: {
    symbolPlaceholder: 'BTC',
    namePlaceholder: '比特幣',
    symbolHint: '幣種代號(目前支援 BTC、ETH、ADA 即時價)',
  },
  cash_twd: {
    symbolPlaceholder: 'TWD-Bank',
    namePlaceholder: '台幣活存',
    symbolHint: '帳戶識別,任意填',
  },
  cash_usd: {
    symbolPlaceholder: 'USD-Cash',
    namePlaceholder: '美金現金',
    symbolHint: '帳戶識別,任意填',
  },
  trust: {
    symbolPlaceholder: 'fubon-trust',
    namePlaceholder: '富邦信託',
    symbolHint: '無公開即時價,以累計成本估算市值',
  },
};

type Props = {
  type: AssetType | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (h: Holding) => void;
};

export function NewHoldingDialog({ type, open, onClose, onConfirm }: Props) {
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [units, setUnits] = useState('');
  const [cost, setCost] = useState('');
  const [auto, setAuto] = useState('');

  useEffect(() => {
    if (open) {
      setSymbol('');
      setName('');
      setUnits('');
      setCost('');
      setAuto('');
    }
  }, [open]);

  if (!type) return null;
  const def = TYPE_DEFAULTS[type];

  const handle = () => {
    const u = Number(units || 0);
    const c = Number(cost || 0);
    const a = auto ? Number(auto) : undefined;
    if (!isFinite(u) || u < 0 || !isFinite(c) || c < 0) return;
    if (a !== undefined && (!isFinite(a) || a < 0)) return;
    if (!symbol || !name) return;

    const holding: Holding = {
      id: crypto.randomUUID(),
      type,
      symbol: symbol.trim(),
      displayName: name.trim(),
      units: u,
      costBasisTwd: c,
      monthlyAutoBuyTwd: a,
      updatedAt: new Date().toISOString(),
    };
    onConfirm(holding);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新增資產</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <Label htmlFor="new-symbol">代號</Label>
            <Input
              id="new-symbol"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder={def.symbolPlaceholder}
              autoFocus
            />
            <p className="text-xs text-muted-foreground mt-1">{def.symbolHint}</p>
          </div>
          <div>
            <Label htmlFor="new-name">顯示名稱</Label>
            <Input
              id="new-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={def.namePlaceholder}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="new-units">數量</Label>
              <Input
                id="new-units"
                type="number"
                inputMode="decimal"
                step="any"
                value={units}
                onChange={(e) => setUnits(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="new-cost">成本(TWD)</Label>
              <Input
                id="new-cost"
                type="number"
                inputMode="numeric"
                step="any"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="new-auto">每月定期定額(TWD,選填)</Label>
            <Input
              id="new-auto"
              type="number"
              inputMode="numeric"
              step="any"
              value={auto}
              onChange={(e) => setAuto(e.target.value)}
              placeholder="例:5000"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handle}>新增</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
