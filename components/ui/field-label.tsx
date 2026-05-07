'use client';

import * as React from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type Props = React.ComponentProps<typeof Label> & {
  /** 主 label 文字 */
  children: React.ReactNode;
  /** 右側反灰小字 hint(currency / 選填 / 單位等) */
  hint?: React.ReactNode;
};

/**
 * 輸入欄位 label — 主 label 左邊,hint(currency tag / 選填等)右邊反灰。
 * 取代醜的 `<Label>主文字 (hint)</Label>` 寫法。
 */
export function FieldLabel({ children, hint, className, ...props }: Props) {
  return (
    <div className="flex items-baseline justify-between gap-2 mb-1">
      <Label className={cn(className)} {...props}>
        {children}
      </Label>
      {hint && (
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {hint}
        </span>
      )}
    </div>
  );
}
