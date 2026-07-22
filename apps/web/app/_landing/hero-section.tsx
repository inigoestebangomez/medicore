import { signIn } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { HERO } from './data';

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-primary text-on-primary">
      {/* Soft radial gradient backdrop */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(60% 60% at 50% 10%, rgba(58,114,168,0.45) 0%, rgba(15,31,46,0) 70%)',
        }}
        aria-hidden="true"
      />
      <div className="relative mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center sm:py-32">
        <span className="mb-6 inline-flex items-center rounded-full border border-on-primary/15 bg-on-primary/5 px-3 py-1 text-xs font-medium tracking-wide text-on-primary/70">
          Sistema de gestión clínica para especialistas
        </span>
        <h1 className="font-display text-4xl font-bold leading-tight tracking-tight text-balance sm:text-5xl">
          {HERO.headline}
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-on-primary/70 sm:text-lg">
          {HERO.subhead}
        </p>
        <form
          action={async () => {
            'use server';
            await signIn('google', { redirectTo: '/dashboard' });
          }}
          className="mt-10"
        >
          <Button type="submit" size="lg" className="bg-surface-lowest text-primary hover:bg-surface-low">
            {HERO.primaryCtaLabel}
          </Button>
        </form>
        <p className="mt-4 text-xs text-on-primary/50">
          Sin coste durante la prueba. Sin tarjeta requerida.
        </p>
      </div>
    </section>
  );
}
