'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { NavOverflowMenu } from './nav-overflow-menu';

interface NavItem {
  label: string;
  href: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Pacientes', href: '/patients' },
  { label: 'Cirugías', href: '/surgeries' },
  { label: 'Imágenes', href: '/imaging' },
  { label: 'Investigación', href: '/research' },
  { label: 'Analytics', href: '/analytics' },
  { label: 'Agenda', href: '/schedule' },
  { label: 'Facturación', href: '/billing' },
  { label: 'Pharma', href: '/pharma' },
  { label: 'Importaciones', href: '/imports' },
];

// Items shown inline at every breakpoint; the rest collapse into "Más"
// below `lg` (1024px) and expand inline on `lg+`.
const INLINE_ITEM_COUNT = 4;
const inlineItems = NAV_ITEMS.slice(0, INLINE_ITEM_COUNT);
const overflowItems = NAV_ITEMS.slice(INLINE_ITEM_COUNT);

function getInitials(name?: string | null): string {
  if (!name) return '??';
  return name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function TopBar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userName = session?.user?.name;
  const initials = getInitials(userName);

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-outline-variant bg-surface/80 px-6 backdrop-blur-xl backdrop-saturate-180">
      {/* Logo + Nav */}
      <div className="flex items-center gap-8">
        {/* Monogram logo */}
        <Link
          href="/dashboard"
          className="w-8 h-8 rounded-lg bg-aqua-gradient flex items-center justify-center text-white font-bold text-sm tracking-tight shadow-glow-aqua"
        >
          M
        </Link>

        {/* Nav links — inline items always visible; overflow collapses below lg */}
        <nav className="flex items-center gap-1">
          {inlineItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                data-active={isActive}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-on-surface-variant transition-all duration-120 hover:bg-surface-high hover:text-on-surface data-[active=true]:bg-surface-container-high data-[active=true]:text-on-surface"
              >
                {item.label}
              </Link>
            );
          })}

          {/* Overflow items rendered inline on lg+ */}
          <div className="hidden lg:flex items-center gap-1">
            {overflowItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-active={isActive}
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-on-surface-variant transition-all duration-120 hover:bg-surface-high hover:text-on-surface data-[active=true]:bg-surface-container-high data-[active=true]:text-on-surface"
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* "Más" dropdown shown below lg */}
          <div className="lg:hidden">
            <NavOverflowMenu items={overflowItems} pathname={pathname} />
          </div>
        </nav>
      </div>

      {/* Global search trigger */}
      <button
        type="button"
        className="flex w-64 items-center gap-2 rounded-lg border border-outline-variant bg-surface-low px-4 py-2 text-sm text-on-surface-variant transition-all duration-150 hover:border-outline hover:bg-surface-container hover:text-on-surface"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <span>Buscar...</span>
        <kbd className="ml-auto font-mono text-xs text-on-surface-variant">⌘K</kbd>
      </button>

      {/* User actions */}
      <div className="flex items-center gap-3">
        {/* Notifications bell */}
        <button
          type="button"
          aria-label="Notificaciones"
          className="relative rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-high hover:text-on-surface"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          {/* Notification dot — only show when there are notifications */}
          {/* <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-aqua-500 rounded-full" /> */}
        </button>

        {/* User avatar */}
        <Link
          href="/settings"
          className="flex items-center gap-2 border-l border-outline-variant pl-3 transition-opacity hover:opacity-80"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-container text-primary-on-container text-xs font-semibold">
            {initials}
          </div>
          <span className="text-sm text-on-surface-variant">{userName ?? 'Usuario'}</span>
        </Link>
      </div>
    </header>
  );
}
