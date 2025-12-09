import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PWAHandler from '@/components/PWAHandler';
import GlobalHeader from '@/components/layout/GlobalHeader';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#1a73e8",
};

export const metadata: Metadata = {
  title: "JaSheets - Web Spreadsheet",
  description: "A Google Sheets-like web spreadsheet application with real-time collaboration and AI features",
  manifest: "/manifest.json",
  icons: [
    { rel: 'apple-touch-icon', url: '/icons/icon-192x192.png' },
    { rel: 'icon', url: '/icons/icon-192x192.png' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <GlobalHeader />
        <PWAHandler />
        {children}
      </body>
    </html>
  );
}
