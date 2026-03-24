/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8001/api/:path*',
      },
      {
        source: '/whatsapp-v3/:path*',
        destination: 'http://localhost:8001/whatsapp-v3/:path*',
      },
      {
        source: '/media/:path*',
        destination: 'http://localhost:8001/media/:path*',
      },
      {
        source: '/socket.io/:path*',
        destination: 'http://localhost:8001/socket.io/:path*',
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
};

module.exports = nextConfig;
