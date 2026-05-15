import type { Metadata, Viewport } from "next";
import { DotGothic16, Inter } from "next/font/google";
import "@/app/globals.css";
import PageWrapperClient from "@/components/PageWrapperClient";
import PhosphorProvider from "@/components/PhosphorProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const dot = DotGothic16({ weight: "400", subsets: ["latin"], variable: "--font-dot" });

export const viewport: Viewport = {
  themeColor: "#ea1506",
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
  description: "Self-hosted, privacy-focused URL shortener with Nothing OS design logic. Pure utility.",
  keywords: ["url shortener", "link management", "self-hosted", "privacy", "deaubit", "nothing os"],
  authors: [{ name: "Deauport", url: "https://deau.site" }],
  creator: "Deauport",
  
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    title: "DeauBit - Pure Utility Shortener",
    description: "Shorten your links with minimal distraction. Privacy-first, analytics-included.",
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
    title: "DeauBit | Minimal Shortener",
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
        className={`${inter.variable} ${dot.variable} antialiased font-sans bg-(--db-bg) text-(--db-text) selection:bg-(--db-primary) selection:text-white`}
      >
        <PhosphorProvider>
          <PageWrapperClient>{children}</PageWrapperClient>
        </PhosphorProvider>
      </body>
    </html>
  );
}
