import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { SettingsPage } from './settings-page';

export default async function Settings() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const organizationId = (session as any)?.organizationId as string | undefined;

  if (!organizationId) {
    redirect('/onboarding');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = ((session as any)?.role as string) ?? 'VIEWER';
  const isOwner = role === 'OWNER';

  return <SettingsPage organizationId={organizationId} isOwner={isOwner} />;
}
