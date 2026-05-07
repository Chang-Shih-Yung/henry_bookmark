import type { Metadata, Viewport } from 'next';
import { Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { Providers } from '@/components/Providers';
import './globals.css';

// Space Grotesk + JetBrains Mono — 金融科技感最強的開源組合
// Space Grotesk:幾何 grotesque,Stripe / Vercel analytics dashboard 風,大字超有科技感
// JetBrains Mono:monospace,數字粗細對齊感極佳(原本給工程師看 code 用,金融數字也完美)
// 中文 fallback PingFang TC(iOS 內建最好的中文字)
const fontDisplay = JetBrains_Mono({
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
