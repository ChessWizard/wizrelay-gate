import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans, JetBrains_Mono, Source_Sans_3 } from 'next/font/google';
import { prisma } from '@/services/db/client';
import { branding } from '@/services/panel/branding';
import { getLocale } from '@/services/panel/locale';
import './globals.css';

const plexSans = IBM_Plex_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-sans',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
  display: 'swap',
});

const sourceSans = Source_Sans_3({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-source-sans',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const brand = await branding();
  return {
    title: brand.name,
    description: 'Run a wizrelay task as a pipeline of task quality gates.',
    icons: brand.faviconUrl ? { icon: brand.faviconUrl } : undefined,
  };
}

export const dynamic = 'force-dynamic';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

const THEME_SCRIPT = `
try {
  var el = document.documentElement;
  if (el.dataset.themeChoice === 'system') {
    var dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    el.dataset.theme = dark ? 'dark' : 'light';
  }
} catch (error) {}
`;

async function appearance(): Promise<{ direction: string; theme: string }> {
  try {
    const panel = await prisma.panel.findUnique({ where: { id: 'panel' } });
    return { direction: panel?.direction ?? 'a', theme: panel?.theme ?? 'dark' };
  } catch {
    return { direction: 'a', theme: 'dark' };
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [locale, look, brand] = await Promise.all([getLocale(), appearance(), branding()]);
  const resolvedTheme = look.theme === 'system' ? (look.direction === 'b' ? 'light' : 'dark') : look.theme;

  return (
    <html
      lang={locale}
      data-direction={look.direction}
      data-theme={resolvedTheme}
      data-theme-choice={look.theme}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {brand.accent ? (
          <style>{`:root{--accent-default:${brand.accent};}`}</style>
        ) : null}
      </head>
      <body
        className={`wg ${plexSans.variable} ${plexMono.variable} ${sourceSans.variable} ${jetbrains.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
