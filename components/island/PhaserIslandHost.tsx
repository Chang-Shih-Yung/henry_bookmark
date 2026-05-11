'use client';

/**
 * PhaserIslandHost — React 包住 Phaser game canvas(Phase 3.5)。
 *
 * 職責:
 * 1. mount 時 dynamic import phaser + 啟動 game
 * 2. 接 React props(state slice)→ 透過 event bus 推給 IslandScene
 * 3. 接 Phaser scene 的事件(mascot/pikmin tap)→ 傳給 React 父
 * 4. unmount 時 destroy game(避免記憶體洩漏 + HMR 殘留)
 *
 * 為什麼 dynamic import phaser:
 * - phaser 依賴 window,SSR 會炸
 * - 動態 import 確保只在 client run
 * - bundle 拆出來,只在 /island 路由載入(其他頁面不付這個代價)
 *
 * 為什麼整段 island view 都包這個 component(而不是只包 mascot):
 * - 一張 Phaser canvas 才能正確處理 z-order、共用 camera、共用粒子系統
 * - 分裂多張 canvas 重疊 → iOS Safari 渲染惡夢
 */

import { useEffect, useRef } from 'react';
import { islandEventBus } from '@/lib/phaser/event-bus';
import type { Pikmin } from '@/lib/island-types';

type Props = {
  tribeName: string;
  mascotAge: number;
  pikminList: Pikmin[];
  hasHatched: boolean;
  /** 動畫中的 pikmin(React EggHatchScene overlay 接管時暫時不在 canvas 出現)*/
  hidePikminId: string | null;
  /** mascot tap → 父 component 接(Phase 3.5 暫不用,Phase 4+ 觸發 toast)*/
  onMascotTap?: () => void;
};

export function PhaserIslandHost({
  tribeName,
  mascotAge,
  pikminList,
  hasHatched,
  hidePikminId,
  onMascotTap,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // 用 any 因為 Phaser type 在 dynamic import 環境下不好標
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gameRef = useRef<any>(null);
  const isReadyRef = useRef(false);
  const pendingStateRef = useRef<{
    tribeName: string;
    mascotAge: number;
    pikminList: Pikmin[];
    hasHatched: boolean;
    hidePikminId: string | null;
  } | null>(null);

  // Mount Phaser game(只一次)
  useEffect(() => {
    if (!containerRef.current) return;
    if (gameRef.current) return;

    let cancelled = false;

    // scene:ready 一觸發 → 把 pending state 推進 scene
    const unsubscribeReady = islandEventBus.on('scene:ready', () => {
      isReadyRef.current = true;
      if (pendingStateRef.current) {
        islandEventBus.emit('state:update', {
          tribeName: pendingStateRef.current.tribeName,
          mascotAge: pendingStateRef.current.mascotAge,
          pikmin: pendingStateRef.current.pikminList.map((p) => ({
            id: p.id,
            color: p.color,
            stage: p.stage,
          })),
          hasHatched: pendingStateRef.current.hasHatched,
          hidePikminId: pendingStateRef.current.hidePikminId,
        });
      }
    });

    // mascot tap → onMascotTap callback
    const unsubscribeTap = islandEventBus.on('mascot:tap', () => {
      onMascotTap?.();
    });

    // 動態 import,避免 SSR 載 phaser
    import('@/lib/phaser/island-game')
      .then(({ createIslandGame }) => {
        if (cancelled || !containerRef.current) return;
        gameRef.current = createIslandGame(containerRef.current);
      })
      .catch((err) => {
        console.error('[PhaserIslandHost] failed to load phaser', err);
      });

    return () => {
      cancelled = true;
      unsubscribeReady();
      unsubscribeTap();
      isReadyRef.current = false;
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
    // 故意只跑一次,onMascotTap 用 ref 抓最新版本以下用 effect 不需要
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // State sync — props 變動就推進 scene
  useEffect(() => {
    const next = { tribeName, mascotAge, pikminList, hasHatched, hidePikminId };
    pendingStateRef.current = next;
    if (!isReadyRef.current) return;
    islandEventBus.emit('state:update', {
      tribeName,
      mascotAge,
      pikmin: pikminList.map((p) => ({
        id: p.id,
        color: p.color,
        stage: p.stage,
      })),
      hasHatched,
      hidePikminId,
    });
  }, [tribeName, mascotAge, pikminList, hasHatched, hidePikminId]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      aria-hidden
      // Phaser canvas 用 absolute 填滿父,父 div 控制 aspect ratio + 圓角
    />
  );
}
