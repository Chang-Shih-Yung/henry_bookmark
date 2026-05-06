import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { Dashboard } from '@/components/Dashboard';
import { MobileShell } from '@/components/MobileShell';

export default async function Home() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect('/login');
  }
  return (
    <MobileShell active="/">
      <Dashboard />
    </MobileShell>
  );
}
