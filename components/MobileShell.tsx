'use client';

import Link from 'next/link';
import {
  LayoutGrid,
  BarChart3,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type TabKey = '/' | '/simulate' | '/settings';

const TABS: Array<{ href: TabKey; label: string; Icon: LucideIcon }> = [
  { href: '/', label: '首頁', Icon: LayoutGrid },
  { href: '/simulate', label: '試算', Icon: BarChart3 },
  { href: '/settings', label: '設定', Icon: Settings },
];

type Props = {
  children: React.ReactNode;
  active: TabKey;
};

/**
 * Authenticated 頁面共用 shell:
 * - 內容區頂部留 safe-area(避開 notch / 動態島)
 * - 底部固定 BottomNav(避開 home indicator,respect safe-area-inset-bottom)
 */
export function MobileShell({ children, active }: Props) {
  return (
    <>
      {children}
      <BottomNav active={active} />
    </>
  );
}

function BottomNav({ active }: { active: TabKey }) {
  return (
    <nav
      className={cn(
        // 滿版貼邊到底,只有頂部圓角(對齊截圖二的 BANEXCOIN bottom nav)
        'fixed inset-x-0 bottom-0 z-50',
        'rounded-t-3xl',
        'bg-card/40 backdrop-blur-3xl',
        'border-t border-white/10',
        'shadow-[0_-12px_40px_rgba(0,0,0,0.5)]',
      )}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto max-w-2xl flex">
        {TABS.map((t) => {
          const isActive = active === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              prefetch
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-1 py-3 text-[11px] transition-colors relative',
                isActive
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {/* active icon 加 accent-brand 光暈 */}
              <div className="relative">
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute -inset-2 rounded-full bg-accent-brand/20 blur-md"
                  />
                )}
                <t.Icon
                  className={cn(
                    'h-5 w-5 relative',
                    isActive && 'text-accent-brand',
                  )}
                />
              </div>
              <span className={cn(isActive && 'font-medium')}>{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
