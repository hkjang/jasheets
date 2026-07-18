import withPWAInit from "@ducanh2912/next-pwa";
import type { NextConfig } from "next";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  cacheStartUrl: false,
  publicExcludes: ["!sw.ts"],
  workboxOptions: {
    skipWaiting: true,
    runtimeCaching: [
      {
        urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
        handler: "NetworkOnly",
        method: "GET",
      },
      {
        urlPattern: ({ request }) => request.mode === "navigate",
        handler: "NetworkOnly",
        method: "GET",
      },
      {
        urlPattern: /\/_next\/static\/.*/i,
        handler: "CacheFirst",
        method: "GET",
        options: {
          cacheName: "next-static-assets",
          expiration: {
            maxEntries: 128,
            maxAgeSeconds: 30 * 24 * 60 * 60,
          },
          cacheableResponse: { statuses: [200] },
        },
      },
    ],
  },
  disable: process.env.NODE_ENV === "development",
});

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
    "media-src 'self' blob:",
    "manifest-src 'self'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "script-src-attr 'none'",
    `frame-ancestors ${frameAncestors}`,
  ].join("; ");

const commonSecurityHeaders = [
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-site" },
  { key: "Origin-Agent-Cluster", value: "?1" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
  ...(isDevelopment
    ? []
    : [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  images: {
    dangerouslyAllowLocalIP: false,
    maximumRedirects: 0,
  },
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
      {
        source: "/:path*",
        headers: commonSecurityHeaders,
      },
      ...protectedRoutes.map((source) => ({
        source,
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy("'self'"),
          },
        ],
      })),
      {
        source: "/embed/:path*",
        headers: [
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
