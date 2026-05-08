'use client';

/**
 * EggHatchScene — 蛋裂開 → 第一隻小精靈跳出來(Phase 2 中循環片段)。
 *
 * 觸發時機:server `applyMonthlyTrigger` 回 newPikmin !== null
 *           → useMonthlyTrigger() hook 偵測到 → IslandShell 套用此 component
 *
 * 動畫節拍(~3 秒,GDD §22 medium duration):
 *   T0 (0-300ms)   蛋抖動(spring shake)
 *   T1 (300-700ms) 蛋裂成兩半(scale 0 + opacity)
 *   T2 (700-1200ms) 小精靈從原位置 spring 跳出來
 *   T3 (1200-2500ms) 文字「[顏色] 小精靈來了!」淡入
 *   T4 (2500ms+)   onComplete callback,IslandShell 切到正常顯示
 *
 * Reduced motion fallback:跳過所有動畫,直接顯示完成狀態 + 文字。
 */

import { motion, useReducedMotion } from 'framer-motion';
import { useEffect } from 'react';
import { ISLAND_DURATION, ISLAND_EASE, ISLAND_SPRING } from '@/lib/animations';
import type { Pikmin } from '@/lib/island-types';
import { pikminHatchedGreeting } from '@/lib/island-content';

const PIKMIN_BG_VAR: Record<Pikmin['color'], string> = {
  green: 'var(--pikmin-green)',
  violet: 'var(--pikmin-violet)',
  orange: 'var(--pikmin-orange)',
  cyan: 'var(--pikmin-cyan)',
  grey: 'var(--pikmin-grey)',
};

type Props = {
  pikmin: Pikmin;
  tribeName: string;
  /** 動畫播完(或 reduced-motion 即刻)觸發,IslandShell 用來切回正常顯示 */
  onComplete?: () => void;
};

export function EggHatchScene({ pikmin, tribeName, onComplete }: Props) {
  const reducedMotion = useReducedMotion();

  // Reduced motion / 動畫播完 → 自動 onComplete
  useEffect(() => {
    const totalDuration = reducedMotion ? 800 : 3000;
    const t = window.setTimeout(() => {
      onComplete?.();
    }, totalDuration);
    return () => window.clearTimeout(t);
  }, [reducedMotion, onComplete]);

  // 共用文字
  const greeting = pikminHatchedGreeting(tribeName, pikmin);

  if (reducedMotion) {
    // 純文字版本,沒動畫
    return (
      <div
        role="status"
        aria-live="polite"
        className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/60 backdrop-blur-sm"
      >
        <div
          className="size-12 rounded-full border-2 border-foreground"
          style={{ backgroundColor: PIKMIN_BG_VAR[pikmin.color] }}
          aria-hidden
        />
        <p className="text-sm font-display text-foreground">{greeting}</p>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/40 backdrop-blur-sm"
    >
      {/* 蛋抖動 → 縮小消失(animation 用 keyframes 排序) */}
      <motion.div
        className="size-12 rounded-full bg-[var(--island-paper)] border-2 border-[var(--island-soil)] shadow-md"
        initial={{ scale: 1, rotate: 0, opacity: 1 }}
        animate={{
          scale: [1, 1, 1.1, 0],
          rotate: [0, -5, 5, -3, 0],
          opacity: [1, 1, 1, 0],
        }}
        transition={{
          duration: 1.0,
          times: [0, 0.3, 0.6, 1],
          ease: ISLAND_EASE.exit,
        }}
        aria-hidden
      />

      {/* 小精靈從原位置跳出來(delay 0.7s 蛋裂後)*/}
      <motion.div
        className="absolute size-12 rounded-full border-2 border-foreground"
        style={{ backgroundColor: PIKMIN_BG_VAR[pikmin.color] }}
        initial={{ scale: 0, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        transition={{
          ...ISLAND_SPRING,
          delay: 0.7,
        }}
        aria-hidden
      />

      {/* 歡迎文字 */}
      <motion.p
        className="absolute mt-24 text-sm font-display text-foreground"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: ISLAND_DURATION.short, delay: 1.2 }}
      >
        {greeting}
      </motion.p>
    </div>
  );
}
