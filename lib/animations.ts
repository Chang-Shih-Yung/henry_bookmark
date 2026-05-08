/**
 * 統一所有 framer-motion variants(GDD §32.10、DESIGN.md Motion 章節)。
 *
 * 為什麼集中:GDD §21 動畫禁忌長表 + §22 時長準則,散在 component 內維護痛苦。
 * 全部 island 動畫從這裡 import,reduced-motion 在 app/island/layout.tsx 的
 * <MotionConfig reducedMotion="user"> 全自動降級。
 *
 * Easing(GDD §32.10):
 * - enter: easeOut,像花瓣落下
 * - exit: easeIn,像吸入
 * - move: easeInOut,mascot 散步
 * - spring: 蛋孵化、戳章彈跳
 */

import type { Transition, Variants } from 'framer-motion';

/* ============================================================
   Easing presets
   ============================================================ */
export const ISLAND_EASE = {
  enter: [0, 0, 0.2, 1] as const,            // easeOut
  exit: [0.4, 0, 1, 1] as const,             // easeIn
  move: [0.4, 0, 0.2, 1] as const,           // easeInOut
} as const;

export const ISLAND_SPRING: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
};

/* ============================================================
   Duration tier(DESIGN.md / GDD §22)
   ============================================================ */
export const ISLAND_DURATION = {
  instant: 0.15,    // 100-200ms — toast、按鈕 hover
  short: 0.3,       // 300ms — crossfade、信紙翻頁、頁面切換
  medium: 0.7,      // 600-800ms — 蛋裂開、樹開花單次
  // ritual 級(5-30s)各自定義在 component 內,因為涉及 sequence
} as const;

/* ============================================================
   通用 variants
   ============================================================ */

/** Crossfade — 場景切換、訪客模式進出朋友島 */
export const crossfade: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const crossfadeTransition: Transition = {
  duration: ISLAND_DURATION.short,
  ease: ISLAND_EASE.enter,
};

/** Fade in from bottom — toast、明信片進場 */
export const slideUpFade: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 12 },
};

/** 蛋孵化 / 戳章從天空飄下 — spring */
export const dropDown: Variants = {
  initial: { opacity: 0, y: -40, scale: 0.8 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -40, scale: 0.8 },
};

/** Mascot / 小精靈走路 — 持續 idle 用 */
export const idleBob: Variants = {
  animate: {
    y: [0, -2, 0],
    transition: {
      duration: 2,
      ease: ISLAND_EASE.move,
      repeat: Infinity,
    },
  },
};

/** Day 0 splash — 拉開窗簾(§23.5)*/
export const splashCurtain: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
};

export const splashCurtainTransition: Transition = {
  duration: 1.5,
  ease: ISLAND_EASE.enter,
};

/* ============================================================
   Reduced motion fallback presets
   <MotionConfig reducedMotion="user"> 會自動把 transition 縮成 0.
   只在需要「文字直接顯示」這種特殊降級時手動處理。
   ============================================================ */
export function reducedMotionFallback<T extends Variants>(v: T): T {
  // 大部分情境 framer-motion 自動降級即可,這個 helper 留給未來需要時用
  return v;
}
