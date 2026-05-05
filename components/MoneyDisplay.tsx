'use client';

import { useState } from 'react';
import { formatTwd } from '@/lib/format';
import { cn } from '@/lib/utils';

type Props = {
  twd: number;
  className?: string;
  defaultMode?: 'compact' | 'full';
  toggleable?: boolean;
};

export function MoneyDisplay({
  twd,
  className,
  defaultMode = 'compact',
  toggleable = true,
}: Props) {
  const [mode, setMode] = useState<'compact' | 'full'>(defaultMode);
  return (
    <button
      type="button"
      onClick={() => toggleable && setMode((m) => (m === 'compact' ? 'full' : 'compact'))}
      className={cn(
        'tabular-nums transition-colors',
        toggleable && 'cursor-pointer hover:text-foreground',
        className,
      )}
      aria-label={`金額 ${formatTwd(twd, 'full')}`}
    >
      {formatTwd(twd, mode)}
    </button>
  );
}
