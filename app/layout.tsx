import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import PortalHeader from './components/portal-header';
import './globals.css';
import { HeroUIProvider } from './hero-ui-provider';
import './markdown.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Sky Atlas',
};

/**
 * Blocking, pre-paint theme script.
 *
 * FOUC fix: HeroUI v3's `@heroui/styles` defaults `:root` to a LIGHT surface
 * (`--heroui-background: oklch(97.02% 0 0)`) and ships no `prefers-color-scheme`
 * support, so without intervention the very first paint is light and only snaps
 * to dark once next-themes' (in-<body>) script runs — the flash. v3 keys dark
 * mode off both `[data-theme=dark]` and `.dark`.
 *
 * This script runs synchronously in <head> BEFORE the stylesheets paint. It
 * mirrors next-themes' resolution exactly — storageKey `theme`, values
 * light/dark/system, defaultTheme `system` resolved via prefers-color-scheme —
 * and sets BOTH `class` and `data-theme` on <html> so the first frame is already
 * correct and there is no hydration mismatch with the provider.
 */
const themeScript = `(function(){try{var e=document.documentElement,t=localStorage.getItem("theme")||"system";if("system"===t){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}e.classList.remove("light","dark"),e.classList.add(t),e.setAttribute("data-theme",t)}catch(n){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${inter.variable} antialiased`}>
        <HeroUIProvider>
          <PortalHeader />
          {children}
        </HeroUIProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  );
}
