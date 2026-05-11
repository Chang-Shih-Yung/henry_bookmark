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
import { pickRandomEvent } from '@/lib/island-content';
import type { Pikmin, Postcard } from '@/lib/island-types';
import { EggHatchScene } from './EggHatchScene';
import { WelcomeCard } from './WelcomeCard';
import { PostcardRitual } from './PostcardRitual';
import { PhaserIslandHost } from './PhaserIslandHost';

export function IslandShell() {
  const { data, isLoading, isError } = useIslandState();
  const postcardsQuery = usePostcards();
  const unreadCount = useUnreadPostcardCount();
  const markRead = useMarkPostcardsRead();

  // 動畫 consumed gate:每個 trigger.newPikmin.id 對應一次播放
  const triggerNewPikmin = data?.monthlyTrigger?.newPikmin ?? null;
  const [consumedHatchId, setConsumedHatchId] = useState<string | null>(null);
  // 兩段式:先播動畫(EggHatchScene),動畫完才出 WelcomeCard 讓 user acknowledge
  const [hatchAnimationDoneId, setHatchAnimationDoneId] = useState<string | null>(null);

  const isUnconsumedTrigger =
    triggerNewPikmin !== null && triggerNewPikmin.id !== consumedHatchId;
  const isPlayingHatchAnimation =
    isUnconsumedTrigger && triggerNewPikmin.id !== hatchAnimationDoneId;
  const isShowingWelcomeCard =
    isUnconsumedTrigger && triggerNewPikmin.id === hatchAnimationDoneId;

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

  // 正在孵化的 pikmin 從 visiblePikmin 過濾掉(只在動畫階段),避免 flock 搶先畫到
  // WelcomeCard 階段 pikmin 已該在 flock 顯示(user 看到她在島上 + 卡片同時)
  const visiblePikmin = isPlayingHatchAnimation
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
        hatchingPikmin={isPlayingHatchAnimation ? triggerNewPikmin : null}
        welcomingPikmin={isShowingWelcomeCard ? triggerNewPikmin : null}
        unreadCount={unreadCount}
        onHatchAnimationDone={() =>
          setHatchAnimationDoneId(triggerNewPikmin?.id ?? null)
        }
        onWelcomeAcknowledge={() =>
          setConsumedHatchId(triggerNewPikmin?.id ?? null)
        }
      />

      {/* PostcardRitual portal — 顯示一張 postcard 給 user 看完 + 蓋戳章 */}
      <PostcardRitual
        postcard={activePostcard}
        open={activePostcard !== null}
        onOpenChange={(open) => {
          if (!open) setActivePostcard(null);
        }}
        onClose={() => {
          // 關閉 ritual → 標已讀,client 會 refetch postcards 更新紅點
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
  /** 動畫階段正在孵化的 pikmin(EggHatchScene 顯示) */
  hatchingPikmin: Pikmin | null;
  /** 動畫播完後待 acknowledge 的 pikmin(WelcomeCard 顯示) */
  welcomingPikmin: Pikmin | null;
  unreadCount: number;
  onHatchAnimationDone: () => void;
  onWelcomeAcknowledge: () => void;
};

function IslandView({
  tribeName,
  streak,
  mascotAge,
  visiblePikmin,
  hasHatched,
  hatchingPikmin,
  welcomingPikmin,
  unreadCount,
  onHatchAnimationDone,
  onWelcomeAcknowledge,
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

      {/* Island view — Phase 3.5 Phaser canvas 取代原 DOM/SVG sprites
          外殼仍是 React 控制 aspect-ratio + 圓角 + 背景漸層,Phaser canvas
          透明疊上去畫 mascot / pikmin / 蛋。EggHatchScene 仍是 React overlay
          (Phase 3.6 才搬進 Phaser scene)。 */}
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
        {/* Phaser canvas — mascot + pikmin + 蛋 都在這 */}
        <PhaserIslandHost
          tribeName={tribeName}
          mascotAge={mascotAge}
          pikminList={visiblePikmin}
          hasHatched={hasHatched}
          // 動畫階段把 hatchingPikmin.id 餵進去,Phaser 不畫這隻
          // 讓 React EggHatchScene overlay 接管視覺
          hidePikminId={hatchingPikmin?.id ?? null}
        />

        {/* 蛋孵化動畫 — React overlay 蓋在 Phaser canvas 上方
            Phase 3.6 會把這個動畫搬進 Phaser scene 用 particle + tween 做更
            game-feel 的版本。Phase 3.5 先讓架構走通,動畫先用既有的 React 版。*/}
        <AnimatePresence>
          {hatchingPikmin && (
            <EggHatchScene
              key={hatchingPikmin.id}
              pikmin={hatchingPikmin}
              onComplete={onHatchAnimationDone}
            />
          )}
        </AnimatePresence>
      </motion.section>

      {/* 文字區:welcomingPikmin 在 → WelcomeCard;否則 → daily random event */}
      <AnimatePresence mode="wait">
        {welcomingPikmin ? (
          <WelcomeCard
            key={`welcome-${welcomingPikmin.id}`}
            pikmin={welcomingPikmin}
            tribeName={tribeName}
            onAcknowledge={onWelcomeAcknowledge}
          />
        ) : (
          <motion.div
            key="daily-event"
            className="text-center text-sm text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: ISLAND_DURATION.short, delay: 0.6 }}
          >
            {dailyEvent}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

// Phase 3.5: PikminFlock + PikminSprite 已搬進 Phaser scene
// (lib/phaser/island-scene.ts),React 不再 render 它們。
// EggHatchScene 內部 PikminSpriteInline 還在 — Phase 3.6 蛋孵化動畫搬進
// Phaser 時連動刪掉。
