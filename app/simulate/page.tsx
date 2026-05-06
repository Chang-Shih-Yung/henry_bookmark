import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { SimulatePage } from '@/components/SimulatePage';
import { MobileShell } from '@/components/MobileShell';

export default async function Simulate() {
  const session = await auth();
  if (!session?.user?.email) redirect('/login');
  return (
    <MobileShell active="/simulate">
      <SimulatePage />
    </MobileShell>
  );
}
