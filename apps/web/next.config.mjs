/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@dashboard/db", "@dashboard/shared"],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
