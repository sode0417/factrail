import type { Metadata } from 'next';
import { Noto_Sans_JP, Noto_Serif_JP } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const notoSansJP = Noto_Sans_JP({
  variable: '--font-sans-jp',
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
});

const notoSerifJP = Noto_Serif_JP({
  variable: '--font-serif-jp',
  subsets: ['latin'],
  weight: ['500', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Factrail',
  description: 'Fact Trail — 事実の軌跡を集めて振り返る',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${notoSansJP.variable} ${notoSerifJP.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
