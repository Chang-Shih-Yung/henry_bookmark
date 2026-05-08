import { MobileShell } from '@/components/MobileShell';
import { PostcardsInbox } from '@/components/island/PostcardsInbox';

/**
 * /island/postcards — 月扣明信片信箱(Phase 3)。
 *
 * Layout 已經做完 feature flag gate + auth(`app/island/layout.tsx`),
 * 所以這頁只 render shell + client component。
 */
export default function PostcardsPage() {
  return (
    <MobileShell active="/island">
      <PostcardsInbox />
    </MobileShell>
  );
}
