'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toggleTheme, getCurrentTheme } from '@/lib/theme-actions';

function applyTheme(theme: 'light' | 'dark') {
  const root = document.documentElement;
  root.classList.toggle('light-mode', theme === 'light');
  root.style.colorScheme = theme;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    getCurrentTheme().then((t) => {
      setTheme(t);
      // Keep client navigation and the server-rendered <html> state in sync.
      applyTheme(t);
      setLoading(false);
    });
  }, []);

  const handleToggle = async () => {
    const next = await toggleTheme();
    setTheme(next);
    applyTheme(next);
    // Refresh to ensure server-rendered layout picks up the new theme
    router.refresh();
  };

  if (loading) {
    return <div className="h-9 w-16 animate-pulse rounded bg-surface-low" />;
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-on-surface-variant">
        {theme === 'dark' ? '🌙 Oscuro' : '☀️ Claro'}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={theme === 'light'}
        onClick={handleToggle}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-surface ${
          theme === 'light' ? 'bg-primary' : 'bg-surface-high'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-primary-on shadow ring-0 transition duration-200 ease-in-out ${
            theme === 'light' ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
