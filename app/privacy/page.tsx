//app/privacy/page.tsx

import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "@phosphor-icons/react/dist/ssr";

export default function PrivacyPage() {
  return (
    <div className="flex flex-col gap-8 sm:gap-10 pb-20 max-w-3xl">

      <section className="space-y-3 px-1">
        <Link href="/" className="btn-secondary w-fit px-5 py-2 text-[10px] nothing-label opacity-100 hover:bg-(--db-text) hover:text-(--db-bg) transition-all">
          <ArrowLeft size={13} /> BACK_TO_SYSTEM
        </Link>
        <div className="flex items-center gap-2 text-(--db-text-muted)">
          <ShieldCheck size={14} />
          <span className="nothing-label tracking-widest">Privacy_Protocol</span>
        </div>
        <h1 className="text-4xl nothing-title text-(--db-text)">PRIVACY_POLICY</h1>
        <p className="nothing-label normal-case tracking-normal opacity-40">Last updated: December 2025</p>
      </section>

      <div className="db-card p-7 sm:p-12 space-y-10 shadow-xl">

        <div className="space-y-4">
          <h2 className="nothing-title text-lg text-(--db-text) border-b border-(--db-border)/30 pb-4">1. INFORMATION_COLLECTED</h2>
          <p className="text-sm text-(--db-text-muted) leading-relaxed font-medium">We collect information you provide directly to us, such as when you create an account or shorten a link:</p>
          <ul className="space-y-2 pl-3">
            {["Account Information: Name, Email address.", "Usage Data: IP address, browser type, device type, and referral URLs (for link analytics)."].map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-(--db-text-muted) font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-(--db-border) mt-2 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-4">
          <h2 className="nothing-title text-lg text-(--db-text) border-b border-(--db-border)/30 pb-4">2. HOW_WE_USE_DATA</h2>
          <p className="text-sm text-(--db-text-muted) leading-relaxed font-medium">We use collected data to:</p>
          <ul className="space-y-2 pl-3">
            {["Provide, maintain, and improve our services.", "Monitor and analyze trends and usage.", "Detect, investigate, and prevent fraudulent transactions and other illegal activities."].map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-(--db-text-muted) font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-(--db-border) mt-2 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-4">
          <h2 className="nothing-title text-lg text-(--db-text) border-b border-(--db-border)/30 pb-4">3. COOKIES_&_STORAGE</h2>
          <p className="text-sm text-(--db-text-muted) leading-relaxed font-medium">
            We use cookies to store session tokens and user preferences (such as theme settings). Session cookies are HTTP-only and are not accessible by JavaScript. You can instruct your browser to refuse all cookies, but some features may not function properly.
          </p>
        </div>

        <div className="bg-(--db-surface-hover) rounded-2xl p-6 border border-(--db-border)">
          <p className="nothing-label text-[9px] opacity-50 normal-case tracking-normal leading-relaxed">
            DeauBit is a self-hosted, privacy-focused service. We do not sell or share your personal data with third parties for marketing purposes. Analytics data is stored locally and is only accessible to account holders and administrators.
          </p>
        </div>

      </div>
    </div>
  );
}
