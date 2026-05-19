/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { dev }) => {
    if (dev) {
      // Disable Webpack dev caching to prevent out-of-memory ArrayBuffer allocation failures
      config.cache = false;
    }
    return config;
  },
  turbopack: {},
  allowedDevOrigins: ['192.168.0.118', '192.168.0.118:3000', 'localhost:3000']
};

export default nextConfig;
