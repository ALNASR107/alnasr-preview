import type { MetadataRoute } from 'next';

/**
 * ملف التطبيق (PWA): يجعل الموقع يُثبَّت كأيقونة على شاشة الموبايل
 * ويفتح بشكل تطبيق كامل بلا شريط عنوان.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'شركة النصر — العمليات',
    short_name: 'شركة النصر',
    description: 'نظام العمليات المالية + ربط واتساب + الترحيل التلقائي',
    lang: 'ar',
    dir: 'rtl',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#2757B5',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
