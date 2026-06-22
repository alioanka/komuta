/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  transpilePackages: ['@komuta/shared', '@komuta/config', '@komuta/money'],
  eslint: {
    // Linting runs as a separate step; never fail the build on lint.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
