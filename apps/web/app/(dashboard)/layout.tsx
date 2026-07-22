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
      <div className="min-h-screen bg-app">
        <nav className="border-b border-outline-variant bg-surface-lowest">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
            <div className="font-display text-lg font-semibold text-on-surface">
              MediCore
            </div>
            <div className="flex items-center gap-6">
              <Link
                href="/dashboard"
                className="text-sm text-on-surface-variant hover:text-on-surface transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/patients"
                className="text-sm text-on-surface-variant hover:text-on-surface transition-colors"
              >
                Patients
              </Link>
              <Link
                href="/schedule"
                className="text-sm text-on-surface-variant hover:text-on-surface transition-colors"
              >
                Agenda
              </Link>
              <Link
                href="/billing"
                className="text-sm text-on-surface-variant hover:text-on-surface transition-colors"
              >
                Facturación
              </Link>
              <Link
                href="/pharma"
                className="text-sm text-on-surface-variant hover:text-on-surface transition-colors"
              >
                Farma
              </Link>
              <Link
                href="/imports"
                className="text-sm text-on-surface-variant hover:text-on-surface transition-colors"
              >
                Importar
              </Link>
              <Link
                href="/research"
                className="text-sm text-on-surface-variant hover:text-on-surface transition-colors"
              >
                Investigación
              </Link>
              <Link
                href="/analytics"
                className="text-sm text-on-surface-variant hover:text-on-surface transition-colors"
              >
                Analytics
              </Link>
              <Link
                href="/settings"
                className="text-sm text-on-surface-variant hover:text-on-surface transition-colors"
              >
                Settings
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-on-surface-variant">
                {session.user.email}
              </span>
              <form
                action={async () => {
                  'use server';
                  const { signOut } = await import('@/lib/auth');
                  await signOut({ redirectTo: '/login' });
                }}
              >
                <button
                  type="submit"
                  className="text-sm text-on-surface-variant/70 hover:text-on-surface transition-colors"
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
