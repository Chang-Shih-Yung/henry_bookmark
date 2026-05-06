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
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-popover/95 backdrop-blur"
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
                'flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] transition-colors',
                isActive
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <t.Icon
                className={cn(
                  'h-5 w-5',
                  isActive && 'text-accent-brand',
                )}
              />
              <span className={cn(isActive && 'font-medium')}>{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
