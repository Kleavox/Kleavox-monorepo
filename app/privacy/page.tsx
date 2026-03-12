//app/privacy/page.tsx

import Link from "next/link";
import DeauBitLogo from "@/components/DeauBitLogo";

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 text-(--db-text)">
      <div className="mb-8 flex items-center gap-4 border-b-4 border-(--db-border) pb-4">
        <DeauBitLogo size={40} />
        <h1 className="text-3xl font-black uppercase">Privacy Policy</h1>
      </div>

      <div className="space-y-6 text-sm font-medium leading-relaxed bg-(--db-surface) p-6 border-4 border-(--db-border) shadow-[8px_8px_0px_0px_var(--db-border)]">
        <p>Last updated: December 2025</p>

        <section>
            <h2 className="text-xl font-black uppercase mb-2">1. Information We Collect</h2>
            <p>We collect information you provide directly to us, such as when you create an account, shorten a link, or contact us.</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Account Information: Name, Email address.</li>
                <li>Usage Data: IP address, browser type, device type, and referral URLs (for analytics purposes).</li>
            </ul>
        </section>

        <section>
            <h2 className="text-xl font-black uppercase mb-2">2. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Provide, maintain, and improve our services.</li>
                <li>Monitor and analyze trends and usage.</li>
                <li>Detect, investigate, and prevent fraudulent transactions and other illegal activities.</li>
            </ul>
        </section>

        <section>
            <h2 className="text-xl font-black uppercase mb-2">3. Cookies</h2>
            <p>We use cookies to store session information and user preferences (like theme settings). You can instruct your browser to refuse all cookies.</p>
        </section>

        <div className="pt-6 border-t-2 border-dashed border-(--db-border)">
            <Link href="/" className="font-black text-(--db-primary) hover:underline">
                &larr; Back to Home
            </Link>
        </div>
      </div>
    </div>
  );
}