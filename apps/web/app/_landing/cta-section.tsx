import { signIn } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { CTA_SECTION } from './data';

async function googleSignIn() {
  'use server';
  await signIn('google', { redirectTo: '/dashboard' });
}

export function CtaSection() {
  return (
    <section className="bg-surface-low">
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h2 className="font-display text-3xl font-semibold tracking-tight text-on-surface">
          {CTA_SECTION.heading}
        </h2>
        <p className="mt-4 text-base leading-relaxed text-on-surface-variant">
          {CTA_SECTION.subhead}
        </p>
        {/* Both entry points flow through the same Google OAuth sign-in (LP-004). */}
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <form action={googleSignIn}>
            <Button type="submit" size="lg" variant="secondary">
              {CTA_SECTION.primaryLabel}
            </Button>
          </form>
          <form action={googleSignIn}>
            <Button type="submit" size="lg" variant="outline">
              {CTA_SECTION.secondaryLabel}
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}