import type { Metadata, Viewport } from 'next';
import { Space_Grotesk } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { Providers } from '@/components/Providers';
import './globals.css';

// Body:Space Grotesk(幾何 grotesque,科技感)
// Display(數字大字):用系統 mono `ui-monospace`,iOS / macOS 自動 fallback 到 SF Mono
// — SF Mono 數字 0 純淨無斜線無中央點,Apple 自家用,品質最佳,還省 next/font 載入成本
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
      className={`dark ${fontBody.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-body tabular-nums bg-background text-foreground">
        <Providers>{children}</Providers>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
