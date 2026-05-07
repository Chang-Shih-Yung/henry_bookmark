import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { HoldingDetailPage } from '@/components/HoldingDetailPage';

export default async function HoldingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect('/login');
  const { id } = await params;
  return <HoldingDetailPage id={id} />;
}
