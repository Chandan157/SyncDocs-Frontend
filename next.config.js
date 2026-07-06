const nextConfig = {
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:1234';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`, 
      },
    ];
  },
};
module.exports = nextConfig;
