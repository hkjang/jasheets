const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";
const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:4000";

const contentSecurityPolicy = (frameAncestors: string) =>
  [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' ${apiUrl} ${wsUrl}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-ancestors ${frameAncestors}`,
  ].join("; ");

const commonSecurityHeaders = [
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  // Disable React Strict Mode to prevent double rendering issues
  // that can cause problems with useEffect cleanup and WebSocket connections
  reactStrictMode: false,
  async headers() {
    const protectedRoutes = [
      "/",
      "/admin/:path*",
      "/dashboard/:path*",
      "/spreadsheet/:path*",
      "/flows/:path*",
      "/login",
      "/help",
      "/privacy",
      "/terms",
      "/updates",
    ];

    return [
      ...protectedRoutes.map((source) => ({
        source,
        headers: [
          ...commonSecurityHeaders,
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy("'self'"),
          },
        ],
      })),
      {
        source: "/embed/:path*",
        headers: [
          ...commonSecurityHeaders,
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy("*"),
          },
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);
