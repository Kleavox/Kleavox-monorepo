//app/layout.tsx

import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Inter } from "next/font/google";
import "./globals.css";
import PageWrapperClient from "@/components/PageWrapperClient";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_HOST ? `https://${process.env.NEXT_PUBLIC_APP_HOST}` : "http://localhost:3000"),
  title: {
    default: "DeauBit",
    template: "%s | DeauBit",
  },
  description: "Self-hosted, privacy-focused URL shortener with heavy industrial design. No tracking, just links.",
  keywords: ["url shortener", "link management", "self-hosted", "privacy", "deaubit"],
  authors: [{ name: "Deauport", url: "https://deau.site" }],
  creator: "Deauport",
  
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    title: "DeauBit - The Brutalist Shortener",
    description: "Shorten your links with style. Privacy-first, analytics-included, zero-bullshit.",
    siteName: "DeauBit",
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "DeauBit Interface",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "DeauBit | Shorten Boldly",
    description: "Privacy-focused URL shortener for the modern web.",
    creator: "@deauport",
    images: ["/api/og"],
  },

  icons: {
    icon: "/icon",
    shortcut: "/icon",
    apple: "/icon",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${mono.variable} antialiased font-sans bg-(--db-bg) text-(--db-text) selection:bg-(--db-primary) selection:text-white`}
      >
        <PageWrapperClient>{children}</PageWrapperClient>
      </body>
    </html>
  );
}
