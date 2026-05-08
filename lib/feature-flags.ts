/**
 * Feature flag 控制台 — 用 NEXT_PUBLIC_* env var 在 build time 切換。
 *
 * 為什麼用 NEXT_PUBLIC_*:Next.js inline 進 client bundle,production main
 * 分支 build 出來看不到關閉的 feature 程式碼路徑(tree-shaken)。
 *
 * 用法:
 *   import { FEATURES } from '@/lib/feature-flags';
 *   if (FEATURES.island) { ... }
 *
 * Vercel env 設定:
 *   - Production(main 分支)→ NEXT_PUBLIC_ISLAND_ENABLED 不設 / "false"
 *   - Preview(feature 分支)→ "true"
 *   - Development(local)→ "true"(`.env.local`)
 */
export const FEATURES = {
  /**
   * 島嶼遊戲層(Phase 1-12)。預設 false,production main 分支看不到。
   * - 4 tab BottomNav(加「島」)
   * - /island/* 路由可訪問
   * - 設定頁顯示「隱藏島」toggle
   */
  island: process.env.NEXT_PUBLIC_ISLAND_ENABLED === 'true',
} as const;
