// apps/web/app/(dashboard)/layout.tsx
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AuthSync } from '@/components/auth-sync';
import { ImportReminderBanner } from '@/components/import-reminder-banner';
import { TopBar } from '@/components/layout/topbar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const organizationId = (session as any)?.organizationId as string | undefined;

  if (!organizationId) {
    redirect('/onboarding');
  }

  return (
    <AuthSync>
      <div className="min-h-screen">
        <TopBar />
        <ImportReminderBanner />
        <main className="mx-auto max-w-[1600px] px-8 py-6">{children}</main>
      </div>
    </AuthSync>
  );
}
