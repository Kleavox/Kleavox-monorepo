//app/terms/page.tsx

import Link from "next/link";
import DeauBitLogo from "@/components/DeauBitLogo";

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 text-(--db-text)">
      <div className="mb-8 flex items-center gap-4 border-b-4 border-(--db-border) pb-4">
        <DeauBitLogo size={40} />
        <h1 className="text-3xl font-black uppercase">Terms of Service</h1>
      </div>

      <div className="space-y-6 text-sm font-medium leading-relaxed bg-(--db-surface) p-6 border-4 border-(--db-border) shadow-[8px_8px_0px_0px_var(--db-border)]">
        <p>Last updated: December 2025</p>

        <section>
            <h2 className="text-xl font-black uppercase mb-2">1. Acceptance of Terms</h2>
            <p>By accessing and using DeauBit, you accept and agree to be bound by the terms and provision of this agreement.</p>
        </section>

        <section>
            <h2 className="text-xl font-black uppercase mb-2">2. Use License</h2>
            <p>Permission is granted to temporarily download one copy of the materials (information or software) on DeauBit&apos;s website for personal, non-commercial transitory viewing only.</p>
        </section>

        <section>
            <h2 className="text-xl font-black uppercase mb-2">3. Prohibited Content</h2>
            <p>You agree not to use the Service to shorten links to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Malware, viruses, or phishing sites.</li>
                <li>Content that is illegal, harmful, or promotes violence.</li>
                <li>Spam or unsolicited advertising.</li>
            </ul>
            <p className="mt-2 text-red-600 font-bold">Violation of these terms will result in immediate permanent ban and deletion of links.</p>
        </section>

        <section>
            <h2 className="text-xl font-black uppercase mb-2">4. Disclaimer</h2>
            <p>The materials on DeauBit&apos;s website are provided &quot;as is&quot;. DeauBit makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties.</p>
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