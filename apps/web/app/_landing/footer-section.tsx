import { FOOTER } from './data';

export function FooterSection() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-outline-variant bg-surface-lowest">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
        <div className="flex items-center gap-2">
          <span className="font-display text-base font-semibold text-primary-container">
            {FOOTER.brand}
          </span>
          <span className="text-xs text-on-surface-variant">· Sistema de gestión clínica</span>
        </div>
        <nav className="flex items-center gap-6 text-sm">
          <a
            href={FOOTER.privacyPolicyHref}
            className="text-on-surface-variant underline-offset-4 hover:text-secondary hover:underline"
          >
            {FOOTER.privacyPolicyLabel}
          </a>
        </nav>
        <p className="text-xs text-on-surface-variant">© {year} {FOOTER.brand}</p>
      </div>
    </footer>
  );
}