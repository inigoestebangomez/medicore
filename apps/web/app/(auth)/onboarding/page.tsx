import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { OnboardingForm } from './onboarding-form';

export default async function OnboardingPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((session as any)?.organizationId) {
    redirect('/dashboard');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-low">
      <div className="w-full max-w-md">
        <h1 className="mb-2 text-2xl font-bold text-on-surface">Welcome to MediCore</h1>
        <p className="mb-6 text-sm text-on-surface-variant">
          Let&apos;s set up your clinical workspace. You can change these details later.
        </p>
        <OnboardingForm />
      </div>
    </div>
  );
}
