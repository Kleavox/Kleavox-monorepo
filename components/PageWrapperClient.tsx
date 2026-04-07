//components/PageWrapperClient.tsx

"use client";

import { usePathname } from "next/navigation";
import AppShell from "./AppShell";
import ThemeToggle from "./ThemeToggle";
import GlobalSecurityGate from "./GlobalSecurityGate";

export default function PageWrapperClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  const isSlugPage =
    segments.length === 1 &&
    !["dash", "api", "login", "register", "verify", "forgot-password", "reset-password", "account-deleted", "admin", "setup", "terms", "privacy", "report"].includes(segments[0]);

  if (isSlugPage) {
    return (
      <div className="min-h-dvh flex items-center justify-center px-4">
        <div key={pathname} className="animate-reveal w-full flex justify-center">
          {children}
        </div>
      </div>
    );
  }

  return (
    <GlobalSecurityGate>
      <ThemeToggle />
      <AppShell>
        <div key={pathname} className="w-full h-full">
          {children}
        </div>
      </AppShell>
    </GlobalSecurityGate>
  );
}
