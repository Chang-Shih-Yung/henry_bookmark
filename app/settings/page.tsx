import Link from 'next/link';
import { auth, signOut } from '@/auth';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.email) redirect('/login');

  return (
    <main className="mx-auto w-full max-w-2xl p-4 space-y-6">
      <header className="flex items-center gap-2">
        <Link href="/">
          <Button variant="ghost" size="icon" aria-label="返回">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-lg font-semibold tracking-tight font-display">設定</h1>
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-medium font-display">帳號</h2>
        <div className="rounded-md border border-border p-3 text-sm">
          <div className="text-muted-foreground text-xs">登入身分</div>
          <div className="font-medium mt-1">{session.user.email}</div>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium font-display">資料</h2>
        <p className="text-xs text-muted-foreground">
          Holdings 自動存在 Upstash Redis,跨裝置同步。匯出 / 匯入功能待 v2 實作。
        </p>
      </section>

      <section className="space-y-2 pt-4">
        <form
          action={async () => {
            'use server';
            await signOut({ redirectTo: '/login' });
          }}
        >
          <Button type="submit" variant="outline" className="w-full">
            登出
          </Button>
        </form>
      </section>

      <footer className="pt-8 text-center text-xs text-muted-foreground">
        v0.1 · Henry Bookmark
      </footer>
    </main>
  );
}
