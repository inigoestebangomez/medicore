import type { SVGProps } from 'react';
import type { FeatureIcon } from './data';
import { FEATURES } from './data';

// Inline icons matching Lucide's outline style (1.5px stroke, 24x24 viewBox)
// per docs/04-design-spec.md §4. lucide-react is not installed, so we inline the
// three glyphs actually used on the landing page to keep this PR dependency-free.
const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function UsersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke} {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ClipboardPlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke} {...props}>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M12 11v6" />
      <path d="M9 14h6" />
    </svg>
  );
}

function FileCheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke} {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="m9 15 2 2 4-4" />
    </svg>
  );
}

const ICONS: Record<FeatureIcon, (props: SVGProps<SVGSVGElement>) => JSX.Element> = {
  Users: UsersIcon,
  ClipboardPlus: ClipboardPlusIcon,
  FileCheck: FileCheckIcon,
};

export function FeaturesSection() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-3xl font-semibold tracking-tight text-on-surface">
          Diseñado para la consulta de cada día
        </h2>
        <p className="mt-4 text-base leading-relaxed text-on-surface-variant">
          Cada módulo resuelve una necesidad real del especialista, sin la fricción
          de los sistemas hospitalarios tradicionales.
        </p>
      </div>

      <ul className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => {
          const Icon = ICONS[feature.icon];
          return (
            <li
              key={feature.title}
              className="card-primary flex flex-col p-6"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-secondary-container text-on-secondary-container">
                <Icon className="h-6 w-6" />
              </span>
              <h3 className="mt-5 font-display text-lg font-semibold text-on-surface">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
                {feature.body}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}