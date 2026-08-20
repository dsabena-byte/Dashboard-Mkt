// MODO DEMO: se activa cuando el deploy corre sobre la rama `demo` (preview de
// Vercel) o con DEMO_MODE=1 en el entorno. Se expone como NEXT_PUBLIC_DEMO_MODE
// para que también lo vean los componentes cliente (charts/tooltips). En `main`
// queda en "0" y la app se comporta exactamente igual que hoy.
const DEMO_ON =
  process.env.NEXT_PUBLIC_DEMO_MODE === "1" ||
  process.env.DEMO_MODE === "1" ||
  process.env.VERCEL_GIT_COMMIT_REF === "demo";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@dashboard/db", "@dashboard/shared"],
  experimental: {
    typedRoutes: true,
  },
  env: {
    NEXT_PUBLIC_DEMO_MODE: DEMO_ON ? "1" : "0",
  },
};

export default nextConfig;
