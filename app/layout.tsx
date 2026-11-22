import type { Metadata, Viewport } from 'next';
import './globals.css';
import SpriteHost from '@/components/SpriteHost';
import { ToastProvider } from '@/components/Toaster';

export const metadata: Metadata = {
  title: {
    default: 'شركة النصر — لوحة العمليات',
    template: '%s · شركة النصر',
  },
  description: 'منصّة العمليات المالية — شركة النصر للخدمات المالية والإدارية',
  applicationName: 'شركة النصر',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'شركة النصر',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0F1B2D' },
    { media: '(display-mode: standalone)', color: '#2757B5' },
  ],
};

const THEME_BOOT = `try{var t=localStorage.getItem('amanah-theme')||'light';document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='light';}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        <SpriteHost />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
