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
import type { EnrichedHolding } from '@/lib/types';
import { formatTwd, formatPct, formatUnits } from '@/lib/format';
import { cn } from '@/lib/utils';

type Props = {
  holding: EnrichedHolding;
  onUpdate: (next: { units: number; costBasisTwd: number }) => void;
  onDelete: () => void;
  onBuyClick: () => void;
  onSellClick: () => void;
};

export function HoldingRow({
  holding,
  onUpdate,
  onDelete,
  onBuyClick,
  onSellClick,
}: Props) {
  const [editingUnits, setEditingUnits] = useState(false);
  const [editingCost, setEditingCost] = useState(false);
  const [unitsInput, setUnitsInput] = useState(String(holding.units));
  const [costInput, setCostInput] = useState(String(holding.costBasisTwd));

  const pnlPositive = holding.unrealizedPnlTwd >= 0;

  const commitUnits = () => {
    const parsed = Number(unitsInput);
    if (!isFinite(parsed) || parsed < 0) {
      setUnitsInput(String(holding.units));
    } else if (parsed !== holding.units) {
      onUpdate({ units: parsed, costBasisTwd: holding.costBasisTwd });
    }
    setEditingUnits(false);
  };
  const commitCost = () => {
    const parsed = Number(costInput);
    if (!isFinite(parsed) || parsed < 0) {
      setCostInput(String(holding.costBasisTwd));
    } else if (parsed !== holding.costBasisTwd) {
      onUpdate({ units: holding.units, costBasisTwd: parsed });
    }
    setEditingCost(false);
  };

  return (
    <div className="flex items-center justify-between gap-2 py-2 px-1 border-b border-border/50 last:border-b-0">
      {/* Left: name + units */}
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
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
          <Popover open={editingCost} onOpenChange={setEditingCost}>
            <PopoverTrigger
              className="hover:text-foreground transition-colors"
              onClick={() => {
                setCostInput(String(holding.costBasisTwd));
                setEditingCost(true);
              }}
            >
              成本 {formatTwd(holding.costBasisTwd)}
            </PopoverTrigger>
            <PopoverContent className="w-64" align="start">
              <Label htmlFor={`cost-${holding.id}`} className="text-xs">
                累計成本(TWD)
              </Label>
              <Input
                id={`cost-${holding.id}`}
                type="number"
                inputMode="numeric"
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
              <p className="text-xs text-muted-foreground mt-2">
                Enter 確認 / Esc 取消
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
