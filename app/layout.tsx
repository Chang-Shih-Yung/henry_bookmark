import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { Providers } from '@/components/Providers';
import './globals.css';

// Geist + Geist Mono — Vercel 出品,Stripe / Linear / Vercel 自家用,
// 比 Inter 更現代俐落,Geist Mono 等寬數字對齊感極佳,專門給金額大字用。
// 中文 fallback 到 PingFang TC(iOS 預裝最好的中文字)。
const geistMono = Geist_Mono({
  variable: '--font-display',
  subsets: ['latin'],
});

const geist = Geist({
  variable: '--font-body',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Henry Bookmark',
  description: '個人投資組合追蹤 + 長期資產試算',
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
      className={`dark ${geistMono.variable} ${geist.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-body tabular-nums bg-background text-foreground">
        <Providers>{children}</Providers>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
