// apps/web/app/(dashboard)/layout.tsx
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AuthSync } from '@/components/auth-sync';
import { ImportReminderBanner } from '@/components/import-reminder-banner';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
      <div className="min-h-screen bg-gray-50">
      <nav className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="text-lg font-semibold text-gray-900">MediCore</div>
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">Dashboard</Link>
            <Link href="/patients" className="text-sm text-gray-600 hover:text-gray-900">Patients</Link>
            <Link href="/imports" className="text-sm text-gray-600 hover:text-gray-900">Importar</Link>
            <Link href="/research" className="text-sm text-gray-600 hover:text-gray-900">Investigación</Link>
            <Link href="/analytics" className="text-sm text-gray-600 hover:text-gray-900">Analytics</Link>
            <Link href="/settings" className="text-sm text-gray-600 hover:text-gray-900">Settings</Link>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{session.user.email}</span>
            <form
              action={async () => {
                'use server';
                const { signOut } = await import('@/lib/auth');
                await signOut({ redirectTo: '/login' });
              }}
            >
              <button
                type="submit"
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </nav>
      <ImportReminderBanner />
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
    </AuthSync>
  );
}