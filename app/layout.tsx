import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import './markdown.css';
import { HeroUIProvider } from './hero-ui-provider';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Atlas Axis Notion-Supabase Workflow',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        <HeroUIProvider>{children}</HeroUIProvider>
      </body>
    </html>
  );
}
