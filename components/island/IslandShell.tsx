'use client';

/**
 * IslandShell — Phase 2 island 主畫面。
 *
 * Phase 2 vs Phase 1 的差別:
 * - 顯示孵化後的小精靈(從 collections.pikmin)+ 蛋只在還沒孵化時出現
 * - 隨機事件腳本(30 種輪播 toast)
 * - 偵測 monthlyTrigger.newPikmin → 播 EggHatchScene
 * - 顯示 streak 是真實 server 算的(不是寫死 0)
 *
 * Phase 4 視覺資產到位前:小精靈仍是色塊圓圈、mascot 仍是米色圓圈(設計如此,GDD §35)
 */

import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useIslandState,
  useMarkPostcardsRead,
  usePostcards,
  useUnreadPostcardCount,
} from '@/lib/island-api';
import { ISLAND_DURATION, ISLAND_EASE } from '@/lib/animations';
import { pickRandomEvent, pikminWelcomeFlavor } from '@/lib/island-content';
import type { Pikmin, Postcard } from '@/lib/island-types';
import { islandEventBus } from '@/lib/phaser/event-bus';
// Phase 3.6:React EggHatchScene + WelcomeCard 已搬進 Phaser cutscene,
// 此處不再 import 它們。.tsx 檔留著當參照,等 PostcardRitual 也進 Phaser 後一起刪
import { PostcardRitual } from './PostcardRitual';
import { PhaserIslandHost } from './PhaserIslandHost';

export function IslandShell() {
  const { data, isLoading, isError } = useIslandState();
  const postcardsQuery = usePostcards();
  const unreadCount = useUnreadPostcardCount();
  const markRead = useMarkPostcardsRead();

  // Phase 3.6 純 Phaser:cutscene 完全在 Phaser scene 內播,React 只 emit + 接 done
  const triggerNewPikmin = data?.monthlyTrigger?.newPikmin ?? null;

  // Cutscene 三階段 state:idle → hatching → welcoming → consumed
  type CutscenePhase = 'idle' | 'hatching' | 'welcoming' | 'consumed';
  const [cutscenePhase, setCutscenePhase] = useState<CutscenePhase>('idle');
  const [cutsceneTargetId, setCutsceneTargetId] = useState<string | null>(null);

  // 偵測新 trigger.newPikmin → kick off 蛋孵化 cutscene
  useEffect(() => {
    if (!triggerNewPikmin) return;
    if (cutsceneTargetId === triggerNewPikmin.id) return; // 已經處理過

    setCutsceneTargetId(triggerNewPikmin.id);
    setCutscenePhase('hatching');
    islandEventBus.emit('cutscene:eggHatch', {
      pikminId: triggerNewPikmin.id,
      pikminColor: triggerNewPikmin.color,
    });
  }, [triggerNewPikmin, cutsceneTargetId]);

  // 接 hatch:done → kick welcome cutscene
  useEffect(() => {
    const off = islandEventBus.on('cutscene:eggHatch:done', ({ pikminId }) => {
      if (pikminId !== triggerNewPikmin?.id) return;
      setCutscenePhase('welcoming');
      islandEventBus.emit('cutscene:welcome', {
        pikminId,
        pikminColor: triggerNewPikmin.color,
        tribeName: data?.state.profile.pikminTribeName ?? '小苗',
        flavor: pikminWelcomeFlavor(triggerNewPikmin),
      });
    });
    return off;
  }, [triggerNewPikmin, data?.state.profile.pikminTribeName]);

  // 接 welcome:done → mark consumed,Phaser scene 接手畫 idle pikmin
  useEffect(() => {
    const off = islandEventBus.on('cutscene:welcome:done', ({ pikminId }) => {
      if (pikminId !== triggerNewPikmin?.id) return;
      setCutscenePhase('consumed');
    });
    return off;
  }, [triggerNewPikmin]);

  const isUnconsumedTrigger =
    triggerNewPikmin !== null && cutscenePhase !== 'consumed';

  // Phase 3:monthly trigger 帶來的新 postcards → 自動推進 ritual
  // 只在 hatch ceremony 結束後(WelcomeCard consumed)才推 postcard,避免疊加儀式
  const newPostcardIds = data?.monthlyTrigger?.newPostcardIds ?? [];
  const [autoOpenedPostcardId, setAutoOpenedPostcardId] = useState<string | null>(null);
  const [activePostcard, setActivePostcard] = useState<Postcard | null>(null);

  useEffect(() => {
    if (newPostcardIds.length === 0) return;
    if (isUnconsumedTrigger) return; // 等 hatch 儀式完才推 postcard
    const list = postcardsQuery.data ?? [];
    // 只挑「本次 trigger 帶來的」postcard,從新到舊
    for (const id of newPostcardIds) {
      if (autoOpenedPostcardId === id) continue;
      const found = list.find((p) => p.id === id);
      if (found) {
        setActivePostcard(found);
        setAutoOpenedPostcardId(id);
        break;
      }
    }
  }, [newPostcardIds, isUnconsumedTrigger, postcardsQuery.data, autoOpenedPostcardId]);

  if (isLoading) {
    return (
      <main className="mx-auto w-full max-w-2xl p-4 pb-32 space-y-4">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-[60vh] w-full rounded-3xl" />
      </main>
    );
  }

  if (isError || !data) {
    // Pass 2 互動狀態矩陣:不暴露技術錯誤(GDD §32.5)
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

  const { state } = data;
  const tribeName = state.profile.pikminTribeName;
  const streak = state.tracks.time.currentStreak;
  const mascotAge = state.profile.mascot.age;
  const allPikmin = state.collections.pikmin;

  // Cutscene 進行中(hatch + welcome 都算)→ 把目標 pikmin 從 Phaser scene 過濾掉
  // welcome:done 後才正式出現在島上 idle bob
  const visiblePikmin = isUnconsumedTrigger
    ? allPikmin.filter((p) => p.id !== triggerNewPikmin?.id)
    : allPikmin;
  const hasHatched = visiblePikmin.length > 0;

  return (
    <>
      <IslandView
        tribeName={tribeName}
        streak={streak}
        mascotAge={mascotAge}
        visiblePikmin={visiblePikmin}
        hasHatched={hasHatched}
        hidePikminId={isUnconsumedTrigger ? triggerNewPikmin?.id ?? null : null}
        unreadCount={unreadCount}
      />

      {/* PostcardRitual — Phase 3.7 才搬進 Phaser,暫時還是 React vaul drawer */}
      <PostcardRitual
        postcard={activePostcard}
        open={activePostcard !== null}
        onOpenChange={(open) => {
          if (!open) setActivePostcard(null);
        }}
        onClose={() => {
          if (activePostcard) {
            markRead.mutate([activePostcard.id]);
          }
        }}
      />
    </>
  );
}

type ViewProps = {
  tribeName: string;
  streak: number;
  mascotAge: number;
  visiblePikmin: Pikmin[];
  hasHatched: boolean;
  /** Cutscene 進行中要從 Phaser scene 過濾掉的 pikmin id(避免重複出現) */
  hidePikminId: string | null;
  unreadCount: number;
};

function IslandView({
  tribeName,
  streak,
  mascotAge,
  visiblePikmin,
  hasHatched,
  hidePikminId,
  unreadCount,
}: ViewProps) {
  // 隨機事件 — 用 daily seed 確保同一天打開看到一樣的 event(避免 hydration 閃爍)
  const dailyEvent = useMemo(() => {
    if (!hasHatched) return `${tribeName} 還在睡。`;
    const today = new Date();
    const seed =
      today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    return pickRandomEvent(tribeName, seed);
  }, [tribeName, hasHatched]);

  return (
    <main
      className="mx-auto w-full max-w-2xl p-4 pb-32 space-y-6"
      style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
      aria-label={`你的島嶼,連續 ${streak} 天`}
    >
      {/* Top row: streak badge */}
      <header className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 rounded-full border border-border bg-card/40 px-2.5 py-1 backdrop-blur-sm">
          <span className="size-1.5 rounded-full bg-[var(--pikmin-green)]" aria-hidden />
          <span className="font-display tabular-nums">連續 {streak} 天</span>
        </div>
        <Link
          href="/island/postcards"
          aria-label={`信箱${unreadCount > 0 ? `,${unreadCount} 封未讀` : ''}`}
          className="relative size-8 rounded-full border border-border bg-card/40 backdrop-blur-sm flex items-center justify-center text-sm transition-transform active:scale-95 [-webkit-tap-highlight-color:transparent]"
        >
          📮
          {unreadCount > 0 && (
            <span
              aria-hidden
              className="absolute -top-1 -right-1 min-w-4 h-4 rounded-full bg-[var(--accent-brand)] text-[9px] font-display tabular-nums text-foreground flex items-center justify-center px-1 leading-none"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Link>
      </header>

      {/* Island view — Phase 3.6 純 Phaser canvas
          - mascot / pikmin / 蛋盆 / 雲 / 草 全部在 Phaser scene 渲染
          - EggHatchScene + WelcomeCard cinematic 也都在 Phaser scene 內播
          - React 只控外殼(aspect ratio + 圓角 + 漸層背景) */}
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
        <PhaserIslandHost
          tribeName={tribeName}
          mascotAge={mascotAge}
          pikminList={visiblePikmin}
          hasHatched={hasHatched}
          hidePikminId={hidePikminId}
        />
      </motion.section>

      {/* Daily random event text — Phase 3.7 才會搬進 Phaser BitmapText.
          現在還是 React,因為 WelcomeCard cutscene 結束後文字直接顯示沒問題 */}
      <motion.div
        key="daily-event"
        className="text-center text-sm text-muted-foreground"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: ISLAND_DURATION.short, delay: 0.6 }}
      >
        {dailyEvent}
      </motion.div>
    </main>
  );
}

// Phase 3.5: PikminFlock + PikminSprite 已搬進 Phaser scene
// (lib/phaser/island-scene.ts),React 不再 render 它們。
// EggHatchScene 內部 PikminSpriteInline 還在 — Phase 3.6 蛋孵化動畫搬進
// Phaser 時連動刪掉。
