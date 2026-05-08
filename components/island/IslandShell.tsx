'use client';

/**
 * IslandShell — Phase 1 island 主畫面 minimal 版本。
 *
 * Phase 1 視覺(GDD §32.13 + DESIGN.md 畫面 1):
 * - 連續紀錄 badge 左上
 * - mascot 站立中央 + 年齡小字
 * - 蛋(尚未孵化)
 * - 文字「她還在睡。下次月扣會孵化。」
 * - 純 SVG placeholder,Phase 4 換真實美術資產
 *
 * Phase 2 擴充:孵化動畫、隨機事件 toast
 * Phase 3 擴充:月扣明信片入口、mailbox icon
 */

import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { useIslandState } from '@/lib/island-api';
import { dropDown, idleBob, ISLAND_DURATION, ISLAND_EASE } from '@/lib/animations';

export function IslandShell() {
  const { data, isLoading, isError } = useIslandState();

  if (isLoading) {
    return (
      <main className="mx-auto w-full max-w-2xl p-4 pb-32 space-y-4">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-[60vh] w-full rounded-3xl" />
      </main>
    );
  }

  if (isError || !data) {
    // Pass 2 互動狀態矩陣:不暴露技術錯誤
    return (
      <main className="mx-auto w-full max-w-2xl p-4 pb-32">
        <div className="rounded-3xl border border-border bg-card/40 p-12 text-center text-sm text-muted-foreground">
          今天島上有薄霧。
          <br />
          <button
            type="button"
            onClick={() => location.reload()}
            className="mt-4 text-foreground underline-offset-4 hover:underline"
          >
            等等再來看看
          </button>
        </div>
      </main>
    );
  }

  const tribeName = data.profile.pikminTribeName;
  const streak = data.tracks.time.currentStreak;
  const mascotAge = data.profile.mascot.age;

  return (
    <main
      className="mx-auto w-full max-w-2xl p-4 pb-32 space-y-6"
      style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
      aria-label={`你的島嶼,Day ${data.tracks.time.daysOpened},連續 ${streak} 天`}
    >
      {/* Top row: streak badge */}
      <header className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 rounded-full border border-border bg-card/40 px-2.5 py-1 backdrop-blur-sm">
          <span className="size-1.5 rounded-full bg-[var(--pikmin-green)]" aria-hidden />
          <span className="font-display tabular-nums">連續 {streak} 天</span>
        </div>
        {/* Mailbox icon (Phase 3 才接 /island/postcards),Phase 1 只放占位 */}
        <button
          type="button"
          aria-label="信箱(Phase 3 開放)"
          disabled
          className="opacity-30 size-8 rounded-full border border-border bg-card/40 backdrop-blur-sm"
        >
          📮
        </button>
      </header>

      {/* Island view — Phase 1 是 SVG placeholder,Phase 4 換真實美術資產 */}
      <motion.section
        className="relative aspect-[3/4] w-full rounded-[40%_60%_55%_45%/45%_50%_50%_55%] overflow-hidden"
        style={{
          background:
            'linear-gradient(180deg, var(--island-sky-day) 0%, var(--island-grass) 50%, var(--island-water) 100%)',
        }}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: ISLAND_DURATION.medium, ease: ISLAND_EASE.enter }}
      >
        {/* Mascot 站立 */}
        <motion.div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2"
          variants={idleBob}
          animate="animate"
        >
          <div
            className="size-12 rounded-full border-2 border-foreground bg-[var(--island-sand)]"
            aria-label={`${tribeName} 的島嶼主人,目前 ${mascotAge} 歲`}
          />
          <span className="text-[10px] font-display text-foreground/80 tabular-nums">
            {mascotAge} 歲
          </span>
        </motion.div>

        {/* 蛋 — 從天空飄下,落地後 idle */}
        <motion.div
          className="absolute right-[20%] top-[55%] size-10"
          variants={dropDown}
          initial="initial"
          animate="animate"
          transition={{
            duration: ISLAND_DURATION.medium,
            delay: 0.3,
          }}
          aria-label="尚未孵化的蛋"
        >
          <div className="size-full rounded-full bg-[var(--island-paper)] border-2 border-[var(--island-soil)] shadow-md" />
        </motion.div>
      </motion.section>

      {/* 引導文字 — Pikmin Bloom tonality */}
      <motion.div
        className="text-center text-sm text-muted-foreground"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: ISLAND_DURATION.short, delay: 0.6 }}
      >
        <span className="font-display">{tribeName}</span> 還在睡。
        <br />
        下次月扣會孵化。
      </motion.div>
    </main>
  );
}
