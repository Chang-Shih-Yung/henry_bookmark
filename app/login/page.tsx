import { signIn } from '@/auth';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-border bg-card p-8 shadow-sm">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Henry Bookmark</h1>
          <p className="text-sm text-muted-foreground">
            個人投資組合追蹤 + 長期試算
          </p>
        </div>

        <form
          action={async () => {
            'use server';
            await signIn('google', { redirectTo: '/' });
          }}
        >
          <Button type="submit" className="w-full" size="lg">
            使用 Google 登入
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          僅授權 email 可登入。其他帳號會被拒絕。
        </p>
      </div>
    </main>
  );
}
