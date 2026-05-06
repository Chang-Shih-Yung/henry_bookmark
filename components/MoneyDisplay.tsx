'use client';

import { useState } from 'react';
import { formatTwd } from '@/lib/format';
import { cn } from '@/lib/utils';

type Props = {
  twd: number;
  className?: string;
  defaultMode?: 'compact' | 'full';
  toggleable?: boolean;
  /** 隱私模式 — 顯示遮蔽符號取代實際金額。 */
  hidden?: boolean;
};

export function MoneyDisplay({
  twd,
  className,
  defaultMode = 'compact',
  toggleable = true,
  hidden = false,
}: Props) {
  const [mode, setMode] = useState<'compact' | 'full'>(defaultMode);
  const display = hidden ? '••••••' : formatTwd(twd, mode);
  return (
    <button
      type="button"
      onClick={() =>
        !hidden && toggleable && setMode((m) => (m === 'compact' ? 'full' : 'compact'))
      }
      className={cn(
        'tabular-nums transition-colors',
        !hidden && toggleable && 'cursor-pointer hover:text-foreground',
        className,
      )}
      aria-label={hidden ? '金額已隱藏' : `金額 ${formatTwd(twd, 'full')}`}
    >
      {display}
    </button>
  );
}
