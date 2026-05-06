import { signIn } from '@/auth';
import { Button } from '@/components/ui/button';
import { Wallet } from 'lucide-react';

export default function LoginPage() {
  return (
    <main className="min-h-svh flex flex-col bg-background text-foreground relative overflow-hidden">
      {/* Brand glow */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-accent-brand/10 via-background to-background" />
      <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-accent-brand/20 blur-3xl -z-10" />
      <div className="absolute -bottom-32 -left-32 h-72 w-72 rounded-full bg-accent-brand/10 blur-3xl -z-10" />

      {/* Hero */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-6"
        style={{ paddingTop: 'max(3rem, env(safe-area-inset-top) + 2rem)' }}
      >
        <div className="text-center space-y-4 max-w-sm">
          <div className="inline-flex h-16 w-16 rounded-2xl bg-accent-brand/15 ring-1 ring-accent-brand/30 items-center justify-center">
            <Wallet className="h-8 w-8 text-accent-brand" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight font-display">
            Henry Bookmark
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            個人投資組合追蹤 + 長期試算
          </p>
        </div>
      </div>

      {/* Bottom-anchored CTA */}
      <div
        className="px-6 pb-6 space-y-3 max-w-sm w-full mx-auto"
        style={{
          paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom) + 0.75rem)',
        }}
      >
        <form
          action={async () => {
            'use server';
            await signIn('google', { redirectTo: '/' });
          }}
        >
          <Button
            type="submit"
            size="lg"
            className="w-full h-12 text-base font-medium"
          >
            使用 Google 登入
          </Button>
        </form>
        <p className="text-center text-xs text-muted-foreground/80">
          僅授權 email 可登入。其他帳號會被拒絕。
        </p>
      </div>
    </main>
  );
}
