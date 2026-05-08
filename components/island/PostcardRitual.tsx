'use client';

/**
 * PostcardRitual — 月扣明信片儀式(GDD §6 + Phase 3)。
 *
 * 視覺(GDD §32 + DESIGN.md):
 * - vaul Drawer 92vh 從底部滑上來
 * - 信紙 paper texture(SVG noise filter + deckle edge mask)
 * - 內文字體用 Noto Serif TC(僅這頁載入,差異化跟 UI sans 區隔)
 * - 打字機效果:60ms / 字
 * - 第一次強制看完打字機,第二次起出現「跳過」按鈕
 * - 翻頁動作 → 戳章從信尾彈跳出來,飛向島嶼某角落
 * - reduced-motion fallback:打字機改瞬間顯示完整文字
 *
 * 觸發時機:
 * - state route GET 偵測 monthlyTrigger.newPostcardIds.length > 0
 *   → IslandShell 顯示信箱紅點 + 自動推進 ritual
 * - 或 user 手動從 /island/postcards 點某封信 → reopen ritual(只看,不重生)
 *
 * 結束時機:
 * - 點「翻頁」(已看完打字機)→ 戳章動畫 → onClose
 * - 點「跳過」→ 直接 onClose(打字機 fast-forward 完整 + 戳章瞬間)
 */

import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { ISLAND_DURATION, ISLAND_EASE } from '@/lib/animations';
import type { Postcard } from '@/lib/island-types';

/** 打字機速度(每字 ms)— 太快沒儀式感、太慢無聊。60ms 接近自然語速 */
const TYPEWRITER_MS_PER_CHAR = 60;

/** 「跳過」按鈕從第幾次打開儀式起開始顯示(client localStorage 記憶) */
const SKIP_BUTTON_THRESHOLD = 1;
const SKIP_VIEWED_KEY = 'island:postcard-ritual-views';

type Props = {
  postcard: Postcard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 關閉後 callback(client 用來 mark read + 推進 monthlyTrigger consumed) */
  onClose?: () => void;
};

export function PostcardRitual({ postcard, open, onOpenChange, onClose }: Props) {
  const reducedMotion = useReducedMotion();

  // 打字機進度
  const [typedLen, setTypedLen] = useState(0);
  const [isTyping, setIsTyping] = useState(false);

  // 戳章動畫 phase
  const [stampPhase, setStampPhase] = useState<'hidden' | 'flying' | 'placed'>('hidden');

  // 是否顯示跳過按鈕(第二次起)
  const [showSkip, setShowSkip] = useState(false);

  // 重置 — 每次打開新的 postcard / 重開 drawer 都要重置 state
  useEffect(() => {
    if (!open || !postcard) return;

    setTypedLen(0);
    setStampPhase('hidden');

    // 是否第二次起?
    const viewed = readViewedSet();
    setShowSkip(viewed.size >= SKIP_BUTTON_THRESHOLD);

    // reduced motion → 直接顯示完整文字
    if (reducedMotion) {
      setTypedLen(postcard.body.length);
      setIsTyping(false);
      return;
    }

    setIsTyping(true);
  }, [open, postcard?.id, reducedMotion]);

  // 打字機 driver
  useEffect(() => {
    if (!isTyping || !postcard) return;
    if (typedLen >= postcard.body.length) {
      setIsTyping(false);
      return;
    }
    const t = window.setTimeout(() => {
      setTypedLen((n) => n + 1);
    }, TYPEWRITER_MS_PER_CHAR);
    return () => window.clearTimeout(t);
  }, [isTyping, typedLen, postcard?.body.length]);

  if (!postcard) return null;

  const fullyTyped = typedLen >= postcard.body.length;
  const visibleBody = postcard.body.slice(0, typedLen);

  function onSkipTypewriter() {
    if (!postcard) return;
    setTypedLen(postcard.body.length);
    setIsTyping(false);
  }

  function onTurnPage() {
    if (!postcard || !fullyTyped) return;
    // 戳章動畫 → 完成後關閉 drawer
    setStampPhase('flying');
    const flyDuration = reducedMotion ? 0 : 600;
    window.setTimeout(() => {
      setStampPhase('placed');
      // 標記這份儀式已看過(第二次起顯示跳過)
      markViewed(postcard.id);
      // 短暫停頓讓 user 看到戳章落定
      window.setTimeout(() => {
        onClose?.();
        onOpenChange(false);
      }, reducedMotion ? 0 : 400);
    }, flyDuration);
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className="!bg-background/95 backdrop-blur-md max-h-[92vh]"
        aria-describedby="postcard-body"
      >
        <DrawerHeader className="sr-only">
          <DrawerTitle>月扣明信片</DrawerTitle>
          <DrawerDescription>
            {postcard.monthYYYYMM} 從你寄給未來自己的信
          </DrawerDescription>
        </DrawerHeader>

        <article
          className="mx-auto w-full max-w-md px-5 pb-8 pt-2"
          aria-labelledby="postcard-month"
        >
          {/* 信紙 paper card */}
          <PaperCard>
            <header className="mb-4">
              <p
                id="postcard-month"
                className="text-xs font-display tabular-nums text-muted-foreground"
              >
                {formatMonth(postcard.monthYYYYMM)}
              </p>
            </header>

            <div
              id="postcard-body"
              className="font-serif text-base leading-relaxed whitespace-pre-line text-foreground min-h-[14rem]"
              style={{
                fontFamily:
                  '"Noto Serif TC", "PingFang TC", "Songti TC", serif',
              }}
              role="region"
              aria-live={isTyping ? 'polite' : 'off'}
            >
              {visibleBody}
              {isTyping && (
                <span
                  aria-hidden
                  className="inline-block w-0.5 h-4 bg-foreground/60 ml-0.5 animate-pulse align-middle"
                />
              )}
            </div>

            {/* 戳章 - 信尾右下,打字機完成後 fade in */}
            <Stamp
              monthYYYYMM={postcard.monthYYYYMM}
              visible={fullyTyped && stampPhase !== 'flying'}
              flying={stampPhase === 'flying'}
            />
          </PaperCard>

          {/* CTA buttons */}
          <div className="mt-6 space-y-2">
            {!fullyTyped && (
              <>
                {showSkip && !reducedMotion && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={onSkipTypewriter}
                  >
                    跳過
                  </Button>
                )}
              </>
            )}
            {fullyTyped && (
              <Button
                type="button"
                variant="default"
                size="lg"
                className="w-full"
                onClick={onTurnPage}
                disabled={stampPhase !== 'hidden'}
              >
                {stampPhase === 'hidden' ? '收下' : stampPhase === 'flying' ? '蓋戳章中…' : '完成'}
              </Button>
            )}
          </div>
        </article>
      </DrawerContent>
    </Drawer>
  );
}

/* ============================================================
   Paper card + 戳章 子元件
   ============================================================ */

function PaperCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative rounded-md p-6 shadow-lg"
      style={{
        // 紙質米色 + SVG noise filter 製造手繪 paper 質感(不用照片底圖,純 CSS)
        backgroundColor: 'var(--island-paper)',
        backgroundImage:
          'url("data:image/svg+xml;utf8,<svg xmlns=\\"http://www.w3.org/2000/svg\\" width=\\"160\\" height=\\"160\\"><filter id=\\"n\\"><feTurbulence type=\\"fractalNoise\\" baseFrequency=\\"0.85\\" numOctaves=\\"2\\" stitchTiles=\\"stitch\\"/><feColorMatrix values=\\"0 0 0 0 0.45 0 0 0 0 0.35 0 0 0 0 0.25 0 0 0 0.07 0\\"/></filter><rect width=\\"100%\\" height=\\"100%\\" filter=\\"url(%23n)\\"/></svg>")',
        // 邊緣略微毛邊感(不規則 mask 製造 deckle edge)
        // 用 box-shadow 假裝手撕邊
        boxShadow:
          '0 1px 0 var(--island-paper-edge), 0 0 0 1px var(--island-paper-edge), 0 12px 30px -8px rgba(0,0,0,0.4)',
      }}
    >
      {children}
    </div>
  );
}

function Stamp({
  monthYYYYMM,
  visible,
  flying,
}: {
  monthYYYYMM: string;
  visible: boolean;
  flying: boolean;
}) {
  if (!visible && !flying) return null;
  return (
    <motion.div
      className="absolute -bottom-3 -right-3 size-16 rounded-full border-2 flex items-center justify-center font-display text-[10px] tabular-nums select-none"
      style={{
        borderColor: 'var(--accent-brand)',
        color: 'var(--accent-brand)',
        backgroundColor: 'var(--island-paper)',
        transform: 'rotate(-12deg)',
      }}
      initial={{ scale: 0, opacity: 0 }}
      animate={
        flying
          ? { scale: 1.3, opacity: 0, x: 100, y: 100, rotate: -45 }
          : { scale: 1, opacity: 1, x: 0, y: 0, rotate: -12 }
      }
      transition={{
        duration: flying ? 0.6 : 0.4,
        ease: ISLAND_EASE.enter,
      }}
      aria-label={`${monthYYYYMM} 月扣戳章`}
    >
      <div className="text-center leading-tight">
        <div>月扣</div>
        <div>{formatStampMonth(monthYYYYMM)}</div>
      </div>
    </motion.div>
  );
}

/* ============================================================
   Helpers
   ============================================================ */
function formatMonth(yyyymm: string): string {
  const m = yyyymm.match(/^(\d{4})-(\d{2})$/);
  if (!m) return yyyymm;
  return `${m[1]} 年 ${parseInt(m[2], 10)} 月`;
}

function formatStampMonth(yyyymm: string): string {
  const m = yyyymm.match(/^\d{4}-(\d{2})$/);
  if (!m) return yyyymm;
  return `${parseInt(m[1], 10)} 月`;
}

function readViewedSet(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(SKIP_VIEWED_KEY);
    return new Set<string>(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function markViewed(id: string) {
  if (typeof window === 'undefined') return;
  try {
    const set = readViewedSet();
    set.add(id);
    window.localStorage.setItem(SKIP_VIEWED_KEY, JSON.stringify([...set]));
  } catch {
    // localStorage 滿 / 拒絕 → 失敗就算了,只是失去「跳過」按鈕記憶
  }
}
