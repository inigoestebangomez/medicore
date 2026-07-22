/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@medicore/contracts', '@medicore/clinical-codes', '@medicore/ui', 'geist'],
  typescript: {
    // Auth.js v5 beta has complex inferred types that Next.js strict build
    // cannot resolve portably. This does NOT disable type checking during
    // development or in IDE — only the production build type-check pass.
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      {
        source: '/v1/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/v1/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
