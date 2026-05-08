'use client';

/**
 * PostcardsInbox — `/island/postcards` 列表頁(Phase 3)。
 *
 * 設計:
 * - reverse-chronological(server 已 reverse,直接 render)
 * - 每張 row:月份 + 預覽前 30 字 + 未讀紅點(金邊)
 * - 點 row → 開 PostcardRitual reopen ritual(只看,不重生戳章 → ritual 結束時 markRead)
 * - Empty state(GDD §32.5):「信箱還是空的。第一次月扣後會收到第一封信。」+ 小精靈坐空信箱旁
 * - Error state:in-world 比喻「明信片飄走了,等等再來」
 * - Loading:信紙骨架 skeleton
 */

import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useMarkPostcardsRead,
  usePostcards,
  usePikminTribeName,
} from '@/lib/island-api';
import type { Postcard } from '@/lib/island-types';
import { PostcardRitual } from './PostcardRitual';

export function PostcardsInbox() {
  const { data: list, isLoading, isError, refetch } = usePostcards();
  const tribeName = usePikminTribeName() ?? '小苗';
  const markRead = useMarkPostcardsRead();
  const [activePostcard, setActivePostcard] = useState<Postcard | null>(null);

  return (
    <main
      className="mx-auto w-full max-w-2xl p-4 pb-32 space-y-4"
      style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
    >
      {/* Header */}
      <header className="flex items-center gap-2">
        <Link
          href="/island"
          className="size-8 -ml-2 inline-flex items-center justify-center rounded-full active:scale-95 transition [-webkit-tap-highlight-color:transparent]"
          aria-label="返回島嶼"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="text-lg font-semibold tracking-tight font-display">信箱</h1>
      </header>

      {/* Body */}
      {isLoading ? (
        <PostcardsLoadingSkeleton />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !list || list.length === 0 ? (
        <EmptyState tribeName={tribeName} />
      ) : (
        <ul className="space-y-2">
          {list.map((p) => (
            <li key={p.id}>
              <PostcardRow
                postcard={p}
                onOpen={() => setActivePostcard(p)}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Reopen ritual for tapped postcard */}
      <PostcardRitual
        postcard={activePostcard}
        open={activePostcard !== null}
        onOpenChange={(open) => {
          if (!open) setActivePostcard(null);
        }}
        onClose={() => {
          if (activePostcard && activePostcard.readAt === null) {
            markRead.mutate([activePostcard.id]);
          }
        }}
      />
    </main>
  );
}

/* ============================================================
   Row
   ============================================================ */
function PostcardRow({
  postcard,
  onOpen,
}: {
  postcard: Postcard;
  onOpen: () => void;
}) {
  const isUnread = postcard.readAt === null;
  const preview = postcard.body
    .replace(/^親愛的未來的我:?\s*/u, '')
    .slice(0, 30)
    .trim();

  return (
    <button
      type="button"
      onClick={onOpen}
      className={[
        'w-full rounded-xl border p-4 text-left transition-transform active:scale-[0.99] [-webkit-tap-highlight-color:transparent]',
        isUnread
          ? 'border-[var(--accent-brand)] bg-card/60 shadow-sm'
          : 'border-border bg-card/30',
      ].join(' ')}
      aria-label={`${formatMonth(postcard.monthYYYYMM)} 的明信片${isUnread ? ',未讀' : ''}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-xs font-display tabular-nums text-muted-foreground">
          {formatMonth(postcard.monthYYYYMM)}
        </div>
        {isUnread && (
          <span
            aria-hidden
            className="size-1.5 rounded-full bg-[var(--accent-brand)]"
          />
        )}
      </div>
      <p
        className="mt-1.5 text-sm text-foreground line-clamp-2"
        style={{
          fontFamily: '"Noto Serif TC", "PingFang TC", "Songti TC", serif',
        }}
      >
        {preview}…
      </p>
    </button>
  );
}

/* ============================================================
   States
   ============================================================ */
function EmptyState({ tribeName }: { tribeName: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/30 p-8 text-center space-y-4">
      {/* 小精靈坐空信箱旁(SVG 簡圖,Phase 4 換真實美術)*/}
      <div className="mx-auto flex items-end justify-center gap-2">
        <span className="text-3xl" role="img" aria-label="空信箱">
          📮
        </span>
        <div className="relative size-10">
          <svg
            aria-hidden
            viewBox="0 0 24 32"
            className="absolute -top-3 left-1/2 -translate-x-1/2 h-3 w-2.5"
          >
            <line x1="12" y1="32" x2="12" y2="14" stroke="var(--island-grass-dark)" strokeWidth="2" strokeLinecap="round" />
            <path d="M12 4 C 4 4, 4 14, 12 14 C 20 14, 20 4, 12 4 Z" fill="var(--pikmin-green)" stroke="var(--island-grass-dark)" strokeWidth="1.5" />
          </svg>
          <div
            className="size-full rounded-full border-2 border-foreground shadow-md"
            style={{ backgroundColor: 'var(--pikmin-green)' }}
          />
        </div>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">
        信箱還是空的。
        <br />
        下個月扣後,{tribeName} 會幫你收信。
      </p>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-border bg-card/30 p-8 text-center space-y-3">
      <p className="text-sm text-muted-foreground">
        明信片飄走了,等等再來看看。
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="text-sm text-foreground underline-offset-4 hover:underline"
      >
        重試
      </button>
    </div>
  );
}

function PostcardsLoadingSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
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
