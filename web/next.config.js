/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  async rewrites() {
    // dev only (ignored by static export): proxy API + assets to Go backend
    return [
      { source: '/api/:path*', destination: 'http://localhost:8080/api/:path*' },
      { source: '/assets/:path*', destination: 'http://localhost:8080/assets/:path*' },
    ];
  },
};

module.exports = nextConfig;
