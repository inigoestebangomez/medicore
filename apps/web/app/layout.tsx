import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { GeistSans } from 'geist/font/sans';
import { Providers } from '@/components/providers';
import { CookieConsent } from '@/components/cookie-consent';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
});

const geistSans = GeistSans;

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'MediCore — Sistema de Gestión Clínica',
  description: 'Clinical management system for Otorhinolaryngology',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${geistSans.variable} ${jetbrainsMono.variable}`}
    >
      <body className="font-sans text-app antialiased bg-app">
        <Providers>
          {children}
          <CookieConsent />
        </Providers>
      </body>
    </html>
  );
}
