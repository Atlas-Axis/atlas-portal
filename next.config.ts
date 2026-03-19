import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Configuration options can be added here as needed
  poweredByHeader: false,
  reactStrictMode: true,
  // cacheComponents: true,
  typedRoutes: true,
  experimental: {
    typedEnv: true,
  },
};

export default nextConfig;
