'use client';

import Link from 'next/link';
import {
  LayoutGrid,
  BarChart3,
  Settings,
  Sprout,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FEATURES } from '@/lib/feature-flags';

type TabKey = '/' | '/simulate' | '/island' | '/settings';

const BASE_TABS: Array<{ href: TabKey; label: string; Icon: LucideIcon }> = [
  { href: '/', label: '首頁', Icon: LayoutGrid },
  { href: '/simulate', label: '試算', Icon: BarChart3 },
  { href: '/settings', label: '設定', Icon: Settings },
];

const ISLAND_TAB: { href: TabKey; label: string; Icon: LucideIcon } = {
  href: '/island',
  label: '島',
  Icon: Sprout,
};

/**
 * Tabs 組合:
 * - V1 預設(FEATURES.island = false):3 tab(首頁 / 試算 / 設定)
 * - 開啟 island flag:4 tab,「島」插在「試算」與「設定」之間
 *
 * 為什麼插中間:用戶肌肉記憶上「設定」固定在最右,island 是新增 content tab
 * 應該跟「首頁/試算」並列。
 */
function getTabs(): Array<{ href: TabKey; label: string; Icon: LucideIcon }> {
  if (!FEATURES.island) return BASE_TABS;
  return [
    BASE_TABS[0],     // 首頁
    BASE_TABS[1],     // 試算
    ISLAND_TAB,       // 島(新增)
    BASE_TABS[2],     // 設定
  ];
}

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
  const tabs = getTabs();
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
        {tabs.map((t) => {
          const isActive = active === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              prefetch
              draggable={false}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-1 py-3 text-[11px] transition-colors relative',
                isActive
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
                // iOS PWA / Safari:長按 <a> 預設跳「打開連結 / 拷貝」link preview menu,
                // 純導航元件不需要這 menu,加 -webkit-touch-callout 關掉 +
                // -webkit-user-select 防文字反白 + tap-highlight 透明關掉灰底閃爍
                'select-none [-webkit-touch-callout:none] [-webkit-user-select:none] [-webkit-tap-highlight-color:transparent]',
              )}
            >
              {/* active = 純白色 icon + 文字加粗;inactive = 深灰。沒有光暈 */}
              <t.Icon
                className={cn(
                  'h-5 w-5',
                  isActive ? 'text-foreground' : 'text-muted-foreground',
                )}
              />
              <span className={cn(isActive && 'font-medium text-foreground')}>
                {t.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
