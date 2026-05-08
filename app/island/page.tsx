import { MobileShell } from '@/components/MobileShell';
import { IslandShell } from '@/components/island/IslandShell';

/**
 * /island — 島嶼主畫面(Phase 1 minimal)。
 *
 * Phase 1 內容:蛋 + 族名 + 「她還在睡。下次月扣會孵化。」
 * Phase 2 會擴充孵化動畫,Phase 3 加月扣明信片儀式入口。
 *
 * 這個 page 走 client component 拿 useIslandState (TanStack Query),
 * 因為要顯示 mascot age / streak 等動態 state。Server-side auth 已在 layout 做。
 */
export default function IslandPage() {
  return (
    <MobileShell active="/island">
      <IslandShell />
    </MobileShell>
  );
}
