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
        <PikminSpriteInline color={pikmin.color} />
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
        className="absolute size-12"
        initial={{ scale: 0, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        transition={{
          ...ISLAND_SPRING,
          delay: 0.7,
        }}
        aria-hidden
      >
        <PikminSpriteInline color={pikmin.color} />
      </motion.div>

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

/**
 * Pikmin sprite inline 版 — 跟 IslandShell 的 PikminSprite 視覺一致(sprout stage)。
 * 抽出來避免 IslandShell ↔ EggHatchScene 互相 import 的循環依賴。
 */
function PikminSpriteInline({ color }: { color: Pikmin['color'] }) {
  return (
    <div className="relative size-12">
      {/* 葉子(從圓頂出芽 — sprout 階段視覺特徵)*/}
      <svg
        aria-hidden
        viewBox="0 0 24 32"
        className="absolute -top-3 left-1/2 -translate-x-1/2 h-4 w-3 drop-shadow-sm"
      >
        <line
          x1="12"
          y1="32"
          x2="12"
          y2="14"
          stroke="var(--island-grass-dark)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M12 4 C 4 4, 4 14, 12 14 C 20 14, 20 4, 12 4 Z"
          fill="var(--pikmin-green)"
          stroke="var(--island-grass-dark)"
          strokeWidth="1.5"
        />
      </svg>
      <div
        className="size-full rounded-full border-2 border-foreground shadow-md"
        style={{ backgroundColor: PIKMIN_BG_VAR[color] }}
      />
    </div>
  );
}
