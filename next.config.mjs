/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  // مكتبات تعمل على Node فقط — لا تُحزَّم مع الـ bundle
  serverExternalPackages: ['@whiskeysockets/baileys', 'libsignal', 'pino', 'qrcode', 'exceljs'],
  // إن كان الخادم الحقيقي على نطاق آخر، استخدم rewrites بدل تعديل الكود:
  // async rewrites() {
  //   return [{ source: '/api/:path*', destination: `${process.env.API_ORIGIN}/:path*` }];
  // },
};

export default nextConfig;
