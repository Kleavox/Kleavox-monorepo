//app/terms/page.tsx

import Link from "next/link";
import { ArrowLeft, FileText } from "@phosphor-icons/react/dist/ssr";

export default function TermsPage() {
  return (
    <div className="flex flex-col gap-8 sm:gap-10 pb-20 max-w-3xl">

      <section className="space-y-3 px-1">
        <Link href="/" className="btn-secondary w-fit px-5 py-2 text-[10px] nothing-label opacity-100 hover:bg-(--db-text) hover:text-(--db-bg) transition-all">
          <ArrowLeft size={13} /> BACK_TO_SYSTEM
        </Link>
        <div className="flex items-center gap-2 text-(--db-text-muted)">
          <FileText size={14} />
          <span className="nothing-label tracking-widest">Legal_Framework</span>
        </div>
        <h1 className="text-4xl nothing-title text-(--db-text)">TERMS_OF_SERVICE</h1>
        <p className="nothing-label normal-case tracking-normal opacity-40">Last updated: December 2025</p>
      </section>

      <div className="db-card p-7 sm:p-12 space-y-10 shadow-xl">

        {[
          {
            title: "1. ACCEPTANCE_OF_TERMS",
            content: "By accessing and using DeauBit, you accept and agree to be bound by the terms and provisions of this agreement. If you do not agree to these terms, please discontinue use of the service."
          },
          {
            title: "2. USE_LICENSE",
            content: "Permission is granted to temporarily use the materials on DeauBit for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title."
          },
          {
            title: "3. PROHIBITED_CONTENT",
            content: null,
            list: ["Malware, viruses, or phishing sites.", "Content that is illegal, harmful, or promotes violence.", "Spam or unsolicited advertising."],
            warning: "Violation of these terms will result in immediate permanent ban and deletion of associated links."
          },
          {
            title: "4. DISCLAIMER",
            content: "The materials on DeauBit are provided \"as is\". DeauBit makes no warranties, expressed or implied, and hereby disclaims all other warranties including merchantability, fitness for a particular purpose, or non-infringement of intellectual property."
          }
        ].map((section, i) => (
          <div key={i} className="space-y-4">
            <h2 className="nothing-title text-lg text-(--db-text) border-b border-(--db-border)/30 pb-4">{section.title}</h2>
            {section.content && (
              <p className="text-sm text-(--db-text-muted) leading-relaxed font-medium">{section.content}</p>
            )}
            {section.list && (
              <>
                <p className="text-sm text-(--db-text-muted) leading-relaxed font-medium">You agree not to use the Service to shorten links to:</p>
                <ul className="space-y-2 pl-3">
                  {section.list.map((item, j) => (
                    <li key={j} className="flex items-start gap-3 text-sm text-(--db-text-muted) font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-(--db-primary) mt-2 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {section.warning && (
              <div className="bg-(--db-primary)/8 border border-(--db-primary)/20 rounded-2xl p-4">
                <p className="text-[10px] font-bold text-(--db-primary) uppercase tracking-widest">{section.warning}</p>
              </div>
            )}
          </div>
        ))}

      </div>
    </div>
  );
}
