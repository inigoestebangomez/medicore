'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

interface NavItem {
  label: string;
  href: string;
}

interface NavOverflowMenuProps {
  items: NavItem[];
  pathname: string;
}

/**
 * "Más" overflow dropdown for nav items that don't fit below the `lg`
 * breakpoint. Built on native primitives (no extra dependency) — clicks
 * outside or selecting an item closes the menu.
 */
export function NavOverflowMenu({ items, pathname }: NavOverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const hasActive = items.some((item) => pathname.startsWith(item.href));

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        data-active={hasActive}
        className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-on-surface-variant transition-all duration-120 hover:bg-surface-high hover:text-on-surface data-[active=true]:bg-surface-container-high data-[active=true]:text-on-surface"
      >
        Más
        <svg
          className={`h-3 w-3 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-1 min-w-[12rem] rounded-lg border border-outline-variant bg-surface/95 py-1 shadow-card backdrop-blur-xl backdrop-saturate-180"
        >
          {items.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                data-active={isActive}
                role="menuitem"
                className="block px-3 py-1.5 text-sm font-medium text-on-surface-variant transition-all duration-120 hover:bg-surface-high hover:text-on-surface data-[active=true]:bg-surface-container-high data-[active=true]:text-on-surface"
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
