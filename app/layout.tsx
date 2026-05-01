import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
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
 
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased`}>
        <HeroUIProvider>{children}</HeroUIProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  );
}
