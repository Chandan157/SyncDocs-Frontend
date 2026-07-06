/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // Determine the backend URL (default to localhost for dev)
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:1234';
    
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`, // Proxy to Backend
      },
    ];
  },
};

module.exports = nextConfig;
