// CSP en modo Report-Only: no bloquea nada, solo reporta en la consola del navegador.
// Hosts = los que carga el código: Next (inline), Chart.js de cdnjs/jsdelivr (iframes de
// public/), Google Fonts, Supabase (REST/realtime) y data.json de raw.githubusercontent.
// Imágenes/videos: miniaturas de Meta/YouTube/DV360/Supabase con CDNs variables → https:.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://raw.githubusercontent.com https://bip-platform.vercel.app https://vitals.vercel-insights.com",
  "frame-src 'self' https://www.youtube.com https://www.instagram.com https://www.facebook.com https://www.tiktok.com",
  "frame-ancestors 'self'",
  "form-action 'self' https://bip-platform.vercel.app",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Sin optimizador de imágenes (/_next/image): next 14 tiene RCE críticos ahí (AVIF/SVG, arreglados recién en
  // 15.5.28) y solo se usaba para el logo local. Los <Image> se sirven tal cual.
  images: { unoptimized: true },
  transpilePackages: ["@dashboard/db", "@dashboard/shared"],
  experimental: {
    typedRoutes: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          // SAMEORIGIN: la app embebe su propio /mkt-canal/index.html en un iframe.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy-Report-Only", value: csp },
        ],
      },
      {
        // /auth/callback fija su propio Referrer-Policy (same-origin: el POST necesita Origin).
        source: "/((?!auth/callback).*)",
        headers: [{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }],
      },
    ];
  },
};

export default nextConfig;
