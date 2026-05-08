'use client';

/**
 * EggHatchScene — 蛋裂開 → 第一隻小精靈跳出來(Phase 2 動畫)。
 *
 * 觸發時機:server `applyMonthlyTrigger` 回 newPikmin !== null
 *           → IslandShell 套用此 component
 *
 * 動畫節拍(~1.5 秒,純視覺,沒文字):
 *   T0 (0-300ms)   蛋震動(spring shake)
 *   T1 (300-1000ms) 蛋裂、消失
 *   T2 (700-1500ms) 小精靈從原位置 spring 跳出來
 *   T3 (1500ms)    onComplete → IslandShell 接力 WelcomeCard 做儀式 acknowledge
 *
 * Reduced motion fallback:跳過所有動畫,即刻 onComplete(讓 WelcomeCard 接手)。
 *
 * 設計重點:這個 component **只負責動畫**。儀式感(歡迎文字 + acknowledge button)
 * 由 WelcomeCard 接力。分開後 user 看完動畫不會被自動 dismissed,卡片永遠在,
 * 切走再回來也還在,直到按「好」才消失。
 */

import { motion, useReducedMotion } from 'framer-motion';
import { useEffect } from 'react';
import { ISLAND_EASE, ISLAND_SPRING } from '@/lib/animations';
import type { Pikmin } from '@/lib/island-types';

const PIKMIN_BG_VAR: Record<Pikmin['color'], string> = {
  green: 'var(--pikmin-green)',
  violet: 'var(--pikmin-violet)',
  orange: 'var(--pikmin-orange)',
  cyan: 'var(--pikmin-cyan)',
  grey: 'var(--pikmin-grey)',
};

type Props = {
  pikmin: Pikmin;
  /** 動畫播完(或 reduced-motion 即刻)觸發,讓 IslandShell 切換成 WelcomeCard 階段 */
  onComplete?: () => void;
};

export function EggHatchScene({ pikmin, onComplete }: Props) {
  const reducedMotion = useReducedMotion();

  // 動畫播完 → onComplete(reduced motion 立即,正常 1500ms)
  useEffect(() => {
    const duration = reducedMotion ? 0 : 1500;
    const t = window.setTimeout(() => {
      onComplete?.();
    }, duration);
    return () => window.clearTimeout(t);
  }, [reducedMotion, onComplete]);

  // Reduced motion:跳過動畫,直接 onComplete(WelcomeCard 接手)
  if (reducedMotion) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="absolute inset-0 flex items-center justify-center bg-background/30 backdrop-blur-[2px]"
    >
      {/* 蛋震動 → 縮小消失 */}
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

      {/* 小精靈從原位置 spring 跳出來(delay 0.7s 蛋裂後)*/}
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
