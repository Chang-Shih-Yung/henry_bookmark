'use client';

/**
 * WelcomeCard — 新小精靈孵化完之後的儀式 acknowledge 卡。
 *
 * GDD §6 + Pillar P2(你的金錢決策有生命):新成員到來必須有儀式感。
 * 不能只用 toast/淡出文字,user 切走再回來會錯過。卡片**持續存在直到按下**。
 *
 * 顯示時機:EggHatchScene 動畫播完 → IslandShell 切入此卡。
 * 消失時機:user 按「好」→ onAcknowledge() → IslandShell 把 trigger 標 consumed。
 *
 * 視覺:不蓋掉島嶼,只在「random event 文字」位置擴張成卡片。Pikmin 在島上
 * 已經 idle bob,user 看得到她在卡片上方。
 */

import { motion } from 'framer-motion';
import { ISLAND_DURATION, ISLAND_EASE } from '@/lib/animations';
import {
  pikminHatchedGreeting,
  pikminWelcomeFlavor,
} from '@/lib/island-content';
import type { Pikmin } from '@/lib/island-types';
import { Button } from '@/components/ui/button';

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
  onAcknowledge: () => void;
};

export function WelcomeCard({ pikmin, tribeName, onAcknowledge }: Props) {
  return (
    <motion.div
      role="dialog"
      aria-labelledby="welcome-card-title"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: ISLAND_DURATION.short, ease: ISLAND_EASE.enter }}
      className="rounded-2xl border border-border bg-card/80 backdrop-blur-md p-4 shadow-lg"
    >
      <div className="flex items-start gap-3">
        {/* 小 sprite(跟島上一致 — 帶葉子)*/}
        <div className="relative size-12 shrink-0 mt-0.5">
          <svg
            aria-hidden
            viewBox="0 0 24 32"
            className="absolute -top-3 left-1/2 -translate-x-1/2 h-4 w-3"
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
            style={{ backgroundColor: PIKMIN_BG_VAR[pikmin.color] }}
          />
        </div>

        {/* 標題 + 內文 */}
        <div className="flex-1 space-y-1.5">
          <h2
            id="welcome-card-title"
            className="text-base font-display font-medium text-foreground"
          >
            {pikminHatchedGreeting(tribeName, pikmin)}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {pikminWelcomeFlavor(pikmin)}
          </p>
        </div>
      </div>

      {/* Acknowledge button — 按下才消失,確保儀式感 */}
      <Button
        type="button"
        size="sm"
        variant="default"
        className="w-full mt-4"
        onClick={onAcknowledge}
      >
        好
      </Button>
    </motion.div>
  );
}
