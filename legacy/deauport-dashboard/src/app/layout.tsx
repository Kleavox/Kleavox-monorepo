import "./globals.css";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/toast";
import { ConfirmProvider } from "@/components/confirm";

export const metadata = { title: "Deauport Dashboard" };

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={inter.variable}>
      <body className="min-h-dvh bg-[var(--bg)] text-[var(--text)] antialiased">
        <Toaster>
          <ConfirmProvider>
            {children}
          </ConfirmProvider>
        </Toaster>
      </body>
    </html>
  );
}