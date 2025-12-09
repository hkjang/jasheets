
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable React Strict Mode to prevent double rendering issues
  // that can cause problems with useEffect cleanup and WebSocket connections
  reactStrictMode: false,
};

export default withPWA(nextConfig);
