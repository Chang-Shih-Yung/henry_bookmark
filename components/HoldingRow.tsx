'use client';

import { AlertTriangle, ChevronRight, GripVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { EnrichedHolding } from '@/lib/types';
import {
  formatTwd,
  formatPct,
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
  /** 點 row → 開詳情 sheet。所有編輯 / 加買賣 / 刪除都在那裡。 */
  onCardClick: () => void;
};

export function HoldingRow({ holding, usdTwd, onCardClick }: Props) {
  const { privacy } = usePrivacy();

  // dnd-kit sortable hook — 長按 200ms 觸發拖動,放開 commit 順序
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: holding.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.6 : 1,
  };

  const isUsdNative = isUsdNativeType(holding.type);
  const fxRate = usdTwd ?? 0;

  const pnlPositive = holding.unrealizedPnlTwd >= 0;
  const hasTodayChange = holding.todayChangePct !== null;
  const todayPositive = (holding.todayChangePct ?? 0) >= 0;
  const showAvg =
    (holding.type === 'tw_stock' ||
      holding.type === 'us_stock' ||
      holding.type === 'crypto') &&
    holding.units > 0 &&
    holding.costBasisTwd > 0;

  const priceStr = formatPriceForDisplay(
    holding.currentPriceTwd,
    isUsdNative,
    fxRate,
  );

  // 中間第二行:即時價(stock/crypto)或 symbol(其他)
  const subLine = holding.currentPriceTwd !== null
    ? `${holding.symbol} · 即時 ${priceStr}`
    : holding.symbol;

  // 平均成交價(可選顯示在 row,簡化版只顯示在 detail)
  const _avg = showAvg ? holding.costBasisTwd / holding.units : 0;
  void _avg; // 保留變數但 row 不渲染,讓 detail sheet 顯示

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onCardClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onCardClick();
        }
      }}
      {...attributes}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-3 text-left transition-colors cursor-pointer',
        // 粒粒分明:每張 row 自己一張卡,半透明 + backdrop blur 讓 ambient 漸層滲透
        'rounded-xl border border-white/10 bg-card/55 backdrop-blur-sm',
        'shadow-[0_2px_8px_rgba(0,0,0,0.15)]',
        'hover:bg-card/70 active:bg-card/80',
        // 拖動 grip 時不要被 iOS 文字選取干擾;但卡身保持可滾動(touch-action 不鎖)
        'select-none [-webkit-user-select:none] [-webkit-touch-callout:none]',
      )}
    >
      {/* drag handle — 只有這個區域吃 dnd-kit listeners,其他地方放手讓 page scroll */}
      <span
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        aria-label="拖動排序"
        className="flex items-center justify-center -mx-1 px-1 py-2 touch-none cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/30 shrink-0" />
      </span>
      {/* Name + symbol/price */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-medium truncate">{holding.displayName}</span>
          {holding.hasPriceFallback && holding.type !== 'trust' && (
            <Badge
              variant="outline"
              className="text-[10px] py-0 h-4 border-warning text-warning gap-0.5 shrink-0"
            >
              <AlertTriangle className="h-2.5 w-2.5" />
              估算
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground truncate tabular-nums">
          {subLine}
        </div>
      </div>

      {/* Market value + PnL */}
      <div className="text-right shrink-0">
        <div className="text-sm font-semibold tabular-nums">
          {maskMoney(formatTwd(holding.marketValueTwd), privacy)}
        </div>
        <div className="text-xs tabular-nums leading-tight">
          {holding.costBasisTwd === 0 ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <span className={pnlPositive ? 'text-up' : 'text-down'}>
              {pnlPositive ? '▲' : '▼'} {formatPct(holding.unrealizedPnlPct)}
            </span>
          )}
          {hasTodayChange && (holding.todayChangePct ?? 0) !== 0 && (
            <span
              className={cn(
                'ml-1.5 opacity-70',
                todayPositive ? 'text-up' : 'text-down',
              )}
            >
              今日 {formatPct(holding.todayChangePct ?? 0)}
            </span>
          )}
        </div>
      </div>

      <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
    </div>
  );
}

// 保留以免外部 import 壞掉
export { formatTwd, formatPrice };
