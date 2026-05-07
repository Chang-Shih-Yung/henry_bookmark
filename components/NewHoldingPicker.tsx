'use client';

import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import {
  Building2,
  Globe,
  Bitcoin,
  Coins,
  DollarSign,
  Landmark,
  type LucideIcon,
} from 'lucide-react';
import type { AssetType } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * 「全部」分頁底部「+ 新增」按鈕展開的類別選擇器。
 *
 * iOS native 感:vaul Drawer 從底部滑上,2 欄 grid 大按鈕,
 * 點任一個 → drawer 關閉 + 帶 type 回去開 NewHoldingDialog。
 *
 * 6 個類別都列出來(包含 cash_twd / cash_usd 各別),user 一次點到位
 * 不再經過二段式選擇。順序對齊 TabValue 邏輯:股 → 加密 → 現金 → 信託。
 */
type Option = {
  type: AssetType;
  label: string;
  subtitle: string;
  Icon: LucideIcon;
};

const OPTIONS: Option[] = [
  {
    type: 'tw_stock',
    label: '台股',
    subtitle: '上市櫃 / ETF',
    Icon: Building2,
  },
  {
    type: 'us_stock',
    label: '美股',
    subtitle: 'NASDAQ / NYSE',
    Icon: Globe,
  },
  {
    type: 'crypto',
    label: '加密貨幣',
    subtitle: 'BTC / ETH …',
    Icon: Bitcoin,
  },
  {
    type: 'cash_twd',
    label: '台幣現金',
    subtitle: '銀行活存 / 定存',
    Icon: Coins,
  },
  {
    type: 'cash_usd',
    label: '美金現金',
    subtitle: 'USD 帳戶',
    Icon: DollarSign,
  },
  {
    type: 'trust',
    label: '信託',
    subtitle: '富邦信託等',
    Icon: Landmark,
  },
];

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (type: AssetType) => void;
};

export function NewHoldingPicker({ open, onClose, onPick }: Props) {
  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent
        className="!h-auto max-h-[88vh] border-t border-white/15 shadow-[0_-12px_32px_rgba(0,0,0,0.4)]"
        style={{ backgroundColor: 'oklch(0.235 0 0)' }}
      >
        {/* drag handle */}
        <div className="h-11 flex items-center justify-center shrink-0">
          <div className="h-1.5 w-12 rounded-full bg-foreground/25" />
        </div>

        <div className="px-4 pb-4">
          <div className="text-center pb-4">
            <DrawerTitle className="text-base font-medium">
              新增資產
            </DrawerTitle>
            <DrawerDescription className="text-xs text-muted-foreground mt-1">
              選擇要新增的類別
            </DrawerDescription>
          </div>

          <div
            className="grid grid-cols-2 gap-2.5"
            style={{
              paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
            }}
          >
            {OPTIONS.map((opt) => (
              <button
                key={opt.type}
                type="button"
                onClick={() => {
                  onPick(opt.type);
                  onClose();
                }}
                className={cn(
                  'group flex flex-col items-start gap-2 p-4 text-left',
                  'rounded-xl border border-white/10 bg-card/55 backdrop-blur-sm',
                  'transition-all duration-150',
                  'hover:bg-card/75 hover:border-white/20',
                  'active:scale-[0.97] active:bg-card/85',
                  '[-webkit-tap-highlight-color:transparent]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                )}
              >
                <opt.Icon
                  className="h-6 w-6 text-foreground/80 group-hover:text-foreground transition-colors"
                  strokeWidth={1.75}
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium leading-tight">
                    {opt.label}
                  </div>
                  <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                    {opt.subtitle}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
