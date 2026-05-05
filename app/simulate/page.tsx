import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { SimulatePage } from '@/components/SimulatePage';

export default async function Simulate() {
  const session = await auth();
  if (!session?.user?.email) redirect('/login');
  return <SimulatePage />;
}
