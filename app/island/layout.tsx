import { redirect } from 'next/navigation';
import { MotionConfig } from 'framer-motion';
import { FEATURES } from '@/lib/feature-flags';
import { auth } from '@/auth';

/**
 * Island layout — feature flag gate + 全 island view 共用 MotionConfig。
 *
 * GDD §32.10:reducedMotion="user" 自動降級 iOS 設定有 prefers-reduced-motion 的玩家。
 *
 * GDD §32.13 Phase 1 checklist:這個 layout 是 island 樹狀根。
 */
export default async function IslandLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Feature flag 關 → 跳回 V1 首頁。production main 分支永遠走這條(flag 預設 false)
  if (!FEATURES.island) redirect('/');

  // Auth — 跟 V1 其他頁一致
  const session = await auth();
  if (!session?.user?.email) redirect('/login');

  return (
    <MotionConfig reducedMotion="user">
      {children}
    </MotionConfig>
  );
}
