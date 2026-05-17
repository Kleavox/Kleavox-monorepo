import Navbar from "@/components/navbar";
import Footer from "@/components/footer";

export function Shell({
  children,
  authed,
}: {
  children: React.ReactNode;
  authed?: boolean;
}) {
  return (
    <div className="min-h-dvh bg-[var(--bg)] text-[var(--text)]">
      <Navbar authed={authed} />
      <div className="mx-auto max-w-6xl px-4 py-4">{children}</div>
      <Footer />
    </div>
  );
}
