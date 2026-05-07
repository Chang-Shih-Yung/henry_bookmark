import { auth, signOut } from '@/auth';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { MobileShell } from '@/components/MobileShell';
import { PushReminderSettings } from '@/components/PushReminderSettings';

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.email) redirect('/login');

  return (
    <MobileShell active="/settings">
      <main
        className="mx-auto w-full max-w-2xl p-4 pb-32 space-y-6"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
      >
        <header className="pt-2">
          <h1 className="text-2xl font-semibold tracking-tight font-display">
            設定
          </h1>
        </header>

        <section className="space-y-2">
          <h2 className="text-sm font-medium font-display text-muted-foreground">
            帳號
          </h2>
          <div className="rounded-lg border border-border bg-card p-4 text-sm">
            <div className="text-muted-foreground text-xs">登入身分</div>
            <div className="font-medium mt-1">{session.user.email}</div>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-medium font-display text-muted-foreground">
            提醒
          </h2>
          <PushReminderSettings />
        </section>



        <section className="space-y-2 pt-4">
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/login' });
            }}
          >
            <Button type="submit" variant="outline" size="lg" className="w-full">
              登出
            </Button>
          </form>
        </section>

        <footer className="pt-8 text-center text-xs text-muted-foreground">
          v0.1 · Henry Bookmark
        </footer>
      </main>
    </MobileShell>
  );
}
