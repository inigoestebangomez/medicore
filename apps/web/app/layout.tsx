import type { Metadata } from 'next';
import { Providers } from '@/components/providers';
import { CookieConsent } from '@/components/cookie-consent';
import { getTheme } from '@/lib/theme';
import './globals.css';

export const metadata: Metadata = {
  title: 'MediCore — Sistema de Gestión Clínica',
  description: 'Clinical management system for Otorhinolaryngology',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = await getTheme();

  return (
    <html
      lang="es"
      className={theme === 'light' ? 'light-mode' : undefined}
      style={{ colorScheme: theme }}
      suppressHydrationWarning
    >
      <head>
        {/* Geist — UI / display font. Loaded via Google Fonts CDN per Design decision
            (user preference: "5-google fonts cdn"); avoids build-time font network fetch. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        {/* Geist Mono — tabular numerals for CIE-10 codes, NHC, analytics columns. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased">
        <Providers>
          {children}
          <CookieConsent />
        </Providers>
      </body>
    </html>
  );
}
