import type { Metadata, Viewport } from 'next';
import { Space_Grotesk, IBM_Plex_Mono } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { Providers } from '@/components/Providers';
import './globals.css';

// Space Grotesk + IBM Plex Mono — 金融科技感最強的開源組合
// Space Grotesk:幾何 grotesque,Stripe / Vercel analytics 風
// IBM Plex Mono:IBM 設計系統字體,沒 slashed zero(0 中間沒斜線),專業金融感
// 中文 fallback PingFang TC(iOS 內建最好的中文字)
const fontDisplay = IBM_Plex_Mono({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const fontBody = Space_Grotesk({
  variable: '--font-body',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Henry Bookmark',
  description: '個人投資組合追蹤 + 長期資產試算',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'Bookmark',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a0a0a',
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-TW"
      className={`dark ${fontDisplay.variable} ${fontBody.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-body tabular-nums bg-background text-foreground">
        <Providers>{children}</Providers>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
