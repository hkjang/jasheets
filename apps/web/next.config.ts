
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withPWA(nextConfig);
