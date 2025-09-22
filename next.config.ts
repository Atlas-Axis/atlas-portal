import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Configuration options can be added here as needed
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  swcMinify: true,
};

export default nextConfig;
